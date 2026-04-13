import { cron, Patterns } from '@elysiajs/cron'
import { PublicKey } from '@solana/web3.js'
import Elysia, { t } from 'elysia'
import { processDrawing } from './cron'
import { db } from '../../db'
import { getLendingAccountsForMint, ROUND_TIME } from 'ts-sdk'
import type { DrawingRow, ProofRow } from '../../db'
import { formatDrawing } from '../../utils'

const SECONDS_PER_DAY = 86_400
const ROUND_SECONDS = ROUND_TIME * 60

type SqlInt = number | bigint

interface WinnerTicketsRow {
  tickets: SqlInt
}

interface PrevSnapshotRow {
  prev_snapshot_at: SqlInt | null
}

function toFiniteNumber(value: SqlInt | null | undefined): number | null {
  if (value === null || value === undefined) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function getDrawingSnapshotTs(drawing: DrawingRow): number | null {
  return toFiniteNumber(
    (drawing.snapshot_at ?? drawing.committed_at) as unknown as SqlInt
  )
}

function getMintDecimals(
  mint: string | null,
  decimalsCache: Map<string, number | null>
): number | null {
  if (!mint) return null

  const cached = decimalsCache.get(mint)
  if (cached !== undefined) return cached

  let decimals: number | null = null
  try {
    const lending = getLendingAccountsForMint(new PublicKey(mint))
    decimals = lending?.decimal ?? null
  } catch {
    decimals = null
  }

  decimalsCache.set(mint, decimals)
  return decimals
}

function computeWinnerAprByDrawing(
  drawings: DrawingRow[]
): Map<string, number | null> {
  const winnerAprByDrawingId = new Map<string, number | null>()
  const winnerTicketsStmt = db.query<WinnerTicketsRow, [bigint, string]>(
    'SELECT tickets FROM proofs WHERE drawing_id = ? AND wallet = ? LIMIT 1'
  )
  const prevSnapshotStmt = db.query<PrevSnapshotRow, [string, bigint]>(
    `SELECT COALESCE(d.snapshot_at, d.committed_at) AS prev_snapshot_at
       FROM drawings d
      WHERE d.vault = ? AND d.id < ? AND d.revealed_at IS NOT NULL
      ORDER BY d.id DESC
      LIMIT 1`
  )

  const decimalsCache = new Map<string, number | null>()

  for (const drawing of drawings) {
    const drawingId = String(drawing.id)
    const winnerWallet = drawing.winner_wallet

    if (drawing.apr !== null) {
      winnerAprByDrawingId.set(drawingId, drawing.apr)
      continue
    }

    if (!winnerWallet || drawing.revealed_at === null) {
      winnerAprByDrawingId.set(drawingId, null)
      continue
    }

    const winnerTicketsRow = winnerTicketsStmt.get(drawing.id, winnerWallet)
    const effectiveStake = toFiniteNumber(winnerTicketsRow?.tickets)
    if (effectiveStake === null || effectiveStake <= 0) {
      winnerAprByDrawingId.set(drawingId, null)
      continue
    }

    const winSnapshotTs = getDrawingSnapshotTs(drawing)
    if (winSnapshotTs === null) {
      winnerAprByDrawingId.set(drawingId, null)
      continue
    }

    const prevSnapshotRow = prevSnapshotStmt.get(drawing.vault, drawing.id)
    const prevSnapshotTs = toFiniteNumber(prevSnapshotRow?.prev_snapshot_at)

    let roundSeconds: number
    if (prevSnapshotTs !== null) {
      roundSeconds = winSnapshotTs - prevSnapshotTs
      if (roundSeconds <= 0) roundSeconds = ROUND_SECONDS
    } else {
      roundSeconds = ROUND_SECONDS
    }
    const daysStaked = roundSeconds / SECONDS_PER_DAY

    const rewardRaw = toFiniteNumber(drawing.amount as unknown as SqlInt)
    if (rewardRaw === null || rewardRaw < 0) {
      winnerAprByDrawingId.set(drawingId, null)
      continue
    }

    const decimals = getMintDecimals(drawing.mint, decimalsCache)
    const reward =
      decimals === null ? rewardRaw : rewardRaw / 10 ** Math.max(0, decimals)

    const aprPercent = (reward / effectiveStake) * (365 / daysStaked) * 100
    winnerAprByDrawingId.set(
      drawingId,
      Number.isFinite(aprPercent) ? aprPercent : null
    )
  }

  return winnerAprByDrawingId
}

function computeVaultAverageFromApr(
  drawings: DrawingRow[],
  winnerAprByDrawingId: Map<string, number | null>
): Map<string, number | null> {
  const valuesByVault = new Map<string, number[]>()
  const allVaults = new Set<string>()

  for (const drawing of drawings) {
    allVaults.add(drawing.vault)
    const apr = winnerAprByDrawingId.get(String(drawing.id))
    if (apr === null || apr === undefined) continue
    const values = valuesByVault.get(drawing.vault)
    if (values) {
      values.push(apr)
    } else {
      valuesByVault.set(drawing.vault, [apr])
    }
  }

  const averageByVault = new Map<string, number | null>()
  for (const vault of allVaults) {
    const values = valuesByVault.get(vault) ?? []
    if (values.length === 0) {
      averageByVault.set(vault, null)
      continue
    }
    const sum = values.reduce((acc, value) => acc + value, 0)
    averageByVault.set(vault, sum / values.length)
  }

  return averageByVault
}

function formatDrawingWithWinnerApr(
  drawing: DrawingRow,
  winnerAprByDrawingId: Map<string, number | null>
) {
  return {
    ...formatDrawing(drawing),
    winner_apr_percent: winnerAprByDrawingId.get(String(drawing.id)) ?? null
  }
}

// Cron job for drawing
// GET /api/drawing/check/:wallet       — check if wallet is in the current (unrevealed) drawing
// GET /api/drawing?page=1&limit=10     — latest drawing results for all vaults with pagination
// GET /api/drawing/:vault?page=1&limit=10 — latest drawing results for a specific vault
export const drawingHandler = new Elysia({
  prefix: '/api/drawing',
  name: 'drawing'
})
  .use(
    cron({
      name: 'heartbeat',
      pattern: Patterns.everyMinute(),
      run: processDrawing
    })
  )
  .get(
    '/check/:wallet',
    ({ params }) => {
      // Find ongoing (unrevealed) drawings where wallet has a proof
      const rows = db
        .query<DrawingRow & Pick<ProofRow, 'tickets'>, [string]>(
          `SELECT d.id, d.vault, d.round, d.reward_type, d.total_tickets, d.snapshot_at,
                  d.mint,
                  d.revealed_at, d.winner_wallet, d.winner_index, d.commit_tx, d.reveal_tx,
                  d.amount, d.merkle_root,
                  p.tickets
           FROM drawings d
           JOIN proofs p ON p.drawing_id = d.id
           WHERE p.wallet = ? AND d.revealed_at IS NULL`
        )
        .all(params.wallet)

      if (rows.length === 0) return { participating: false, drawings: [] }

      return {
        participating: true,
        drawings: rows.map((r) => ({
          ...formatDrawing(r),
          your_tickets: r.tickets
        }))
      }
    },
    {
      params: t.Object({ wallet: t.String() })
    }
  )
  .get(
    '/',
    ({ query }) => {
      const page = Math.max(1, Number(query.page ?? 1))
      const limit = Math.min(100, Math.max(1, Number(query.limit ?? 10)))
      const offset = (page - 1) * limit

      const rows = db
        .query<DrawingRow, [number, number]>(
          'SELECT * FROM drawings WHERE reveal_tx IS NOT NULL ORDER BY id DESC LIMIT ? OFFSET ?'
        )
        .all(limit, offset)

      const total = db
        .query<{ count: bigint }, []>(
          'SELECT COUNT(*) as count FROM drawings WHERE reveal_tx IS NOT NULL'
        )
        .get()!.count

      const aggregateRows = db
        .query<DrawingRow, []>(
          `SELECT * FROM drawings
            WHERE reveal_tx IS NOT NULL
              AND winner_wallet IS NOT NULL`
        )
        .all()
      const winnerAprByDrawingId = computeWinnerAprByDrawing(aggregateRows)
      const averageAprByVault = computeVaultAverageFromApr(
        aggregateRows,
        winnerAprByDrawingId
      )

      return {
        drawings: rows.map((row) =>
          formatDrawingWithWinnerApr(row, winnerAprByDrawingId)
        ),
        pagination: { page, limit, total },
        winners_compound_average_apy_percent_by_vault:
          Object.fromEntries(averageAprByVault)
      }
    },
    {
      query: t.Object({
        page: t.Optional(t.String()),
        limit: t.Optional(t.String())
      })
    }
  )
  .get(
    '/:vault',
    ({ params, query }) => {
      const page = Math.max(1, Number(query.page ?? 1))
      const limit = Math.min(100, Math.max(1, Number(query.limit ?? 10)))
      const offset = (page - 1) * limit

      const rows = db
        .query<DrawingRow, [string, number, number]>(
          'SELECT * FROM drawings WHERE vault = ? ORDER BY id DESC LIMIT ? OFFSET ?'
        )
        .all(params.vault, limit, offset)

      const total = db
        .query<{ count: bigint }, [string]>(
          'SELECT COUNT(*) as count FROM drawings WHERE vault = ?'
        )
        .get(params.vault)!.count

      const aggregateRows = db
        .query<DrawingRow, [string]>(
          `SELECT * FROM drawings
            WHERE vault = ?
              AND reveal_tx IS NOT NULL
              AND winner_wallet IS NOT NULL`
        )
        .all(params.vault)
      const winnerAprByDrawingId = computeWinnerAprByDrawing(aggregateRows)
      const averageAprByVault = computeVaultAverageFromApr(
        aggregateRows,
        winnerAprByDrawingId
      )

      return {
        drawings: rows.map((row) =>
          formatDrawingWithWinnerApr(row, winnerAprByDrawingId)
        ),
        pagination: { page, limit, total },
        winners_compound_average_apy_percent:
          averageAprByVault.get(params.vault) ?? null
      }
    },
    {
      params: t.Object({ vault: t.String() }),
      query: t.Object({
        page: t.Optional(t.String()),
        limit: t.Optional(t.String())
      })
    }
  )
