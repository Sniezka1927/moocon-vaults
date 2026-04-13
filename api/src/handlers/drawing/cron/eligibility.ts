import { PublicKey } from '@solana/web3.js'
import { Leaf, MerkleTree, getLendingAccountsForMint } from 'ts-sdk'
import type { VaultAccount } from 'ts-sdk'
import { vault } from '../../../consts'
import { db, type DrawingRow } from '../../../db'
import { sha256 } from '../../../utils'
import { logError, logInfo } from './logger'

export interface SnapshotEntry {
  wallet: string
  tickets: string
}

function normalizeEntries(entries: SnapshotEntry[]): SnapshotEntry[] {
  const byWallet = new Map<string, bigint>()

  for (const entry of entries) {
    if (!entry?.wallet || typeof entry.wallet !== 'string') continue
    let tickets: bigint
    try {
      tickets = BigInt(entry.tickets)
    } catch {
      continue
    }
    if (tickets <= 0n) continue

    const existing = byWallet.get(entry.wallet)
    if (existing === undefined) {
      byWallet.set(entry.wallet, tickets)
      continue
    }

    byWallet.set(entry.wallet, tickets < existing ? tickets : existing)
  }

  return Array.from(byWallet.entries())
    .map(([wallet, tickets]) => ({ wallet, tickets: tickets.toString() }))
    .sort((a, b) => a.wallet.localeCompare(b.wallet))
}

export function parseSnapshotEntries(raw: string | null | undefined): SnapshotEntry[] {
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return normalizeEntries(parsed as SnapshotEntry[])
  } catch {
    return []
  }
}

function serializeSnapshotEntries(entries: SnapshotEntry[]): string {
  return JSON.stringify(normalizeEntries(entries))
}

function holdersToSnapshotEntries(
  holders: Array<{ wallet: PublicKey; amount: bigint }>,
  denominator: bigint
): SnapshotEntry[] {
  const byWallet = new Map<string, bigint>()

  for (const holder of holders) {
    const wallet = holder.wallet.toBase58()
    const tickets = holder.amount / denominator
    if (tickets <= 0n) continue
    byWallet.set(wallet, (byWallet.get(wallet) ?? 0n) + tickets)
  }

  return Array.from(byWallet.entries())
    .map(([wallet, tickets]) => ({ wallet, tickets: tickets.toString() }))
    .sort((a, b) => a.wallet.localeCompare(b.wallet))
}

export function intersectSnapshotEntries(
  previous: SnapshotEntry[],
  current: SnapshotEntry[]
): SnapshotEntry[] {
  const currentMap = new Map<string, bigint>()
  for (const entry of current) {
    try {
      const tickets = BigInt(entry.tickets)
      if (tickets <= 0n) continue
      currentMap.set(entry.wallet, tickets)
    } catch {
      continue
    }
  }

  const intersected: SnapshotEntry[] = []
  for (const entry of previous) {
    let previousTickets: bigint
    try {
      previousTickets = BigInt(entry.tickets)
    } catch {
      continue
    }
    if (previousTickets <= 0n) continue

    const currentTickets = currentMap.get(entry.wallet)
    if (currentTickets === undefined || currentTickets <= 0n) continue

    intersected.push({
      wallet: entry.wallet,
      tickets: (currentTickets < previousTickets ? currentTickets : previousTickets).toString()
    })
  }

  return normalizeEntries(intersected)
}

function getTicketDenominator(v: VaultAccount): bigint {
  const lending = getLendingAccountsForMint(v.mint)
  if (!lending) {
    throw new Error(`missing lending accounts for mint=${v.mint.toBase58()}`)
  }

  return 10n ** BigInt(lending.decimal)
}

function getRollingBaseEntries(drawing: DrawingRow): SnapshotEntry[] {
  if (drawing.eligible_snapshot !== null) {
    return parseSnapshotEntries(drawing.eligible_snapshot)
  }
  return parseSnapshotEntries(drawing.initial_snapshot)
}

export async function createInitialSnapshot(
  vaultPda: PublicKey,
  v: VaultAccount
): Promise<DrawingRow | null> {
  const round = v.currentRound

  logInfo(`snapshot vault=${vaultPda.toBase58()} round=${String(round)}`)

  try {
    const denominator = getTicketDenominator(v)
    const holders = await vault.fetcher.getEligibleWallets(v.pMint)
    const entries = holdersToSnapshotEntries(holders, denominator)

    if (entries.length === 0) {
      logInfo(
        `no holders with tickets, skipping vault=${vaultPda.toBase58()} round=${String(round)}`
      )
      return null
    }

    const snapshot = serializeSnapshotEntries(entries)

    const result = db
      .query(
        `INSERT INTO drawings (
          vault, mint, round, reward_type, total_tickets, amount,
          initial_snapshot, eligible_snapshot, snapshot_at, committed_at,
          eligibility_blocked, last_eligibility_scan_at
        )
        VALUES (?, ?, ?, 0, 0, 0, ?, ?, unixepoch(), 0, 0, unixepoch())`
      )
      .run(vaultPda.toBase58(), v.mint.toBase58(), round, snapshot, snapshot)

    const drawingId = (result as any).lastInsertRowid as bigint
    logInfo(
      `initial snapshot saved drawingId=${String(drawingId)} holders=${entries.length}`
    )

    return (
      db
        .query<DrawingRow, [bigint]>('SELECT * FROM drawings WHERE id = ?')
        .get(drawingId) ?? null
    )
  } catch (err: any) {
    const message = String(err?.message ?? '')
    if (message.includes('UNIQUE constraint failed: drawings.vault, drawings.round')) {
      logInfo(
        `snapshot already exists vault=${vaultPda.toBase58()} round=${String(round)}`
      )
      return null
    }
    throw err
  }
}

function markEligibilityBlocked(drawingId: bigint): void {
  db.query('UPDATE drawings SET eligibility_blocked = 1 WHERE id = ?').run(drawingId)
}

export async function refreshRollingEligibility(
  drawing: DrawingRow,
  v: VaultAccount
): Promise<boolean> {
  try {
    const denominator = getTicketDenominator(v)
    const previous = getRollingBaseEntries(drawing)
    const holders = await vault.fetcher.getEligibleWallets(v.pMint)
    const current = holdersToSnapshotEntries(holders, denominator)
    const intersected = intersectSnapshotEntries(previous, current)

    db.query(
      `UPDATE drawings
          SET eligible_snapshot = ?,
              eligibility_blocked = 0,
              last_eligibility_scan_at = unixepoch()
        WHERE id = ?`
    ).run(serializeSnapshotEntries(intersected), drawing.id)

    logInfo(
      `eligibility scan updated drawingId=${String(drawing.id)} previous=${previous.length} current=${current.length} intersection=${intersected.length}`
    )
    return true
  } catch (err) {
    markEligibilityBlocked(drawing.id)
    logError(
      'eligibility scan failed; commit blocked until next successful scan',
      { drawingId: String(drawing.id), err }
    )
    return false
  }
}

export function materializeCommitArtifactsFromEligibleSnapshot(
  drawingId: bigint
): boolean {
  const drawing = db
    .query<DrawingRow, [bigint]>('SELECT * FROM drawings WHERE id = ?')
    .get(drawingId)

  if (!drawing) return false

  const entries = getRollingBaseEntries(drawing)
  if (entries.length === 0) {
    logInfo(
      `no eligible holders after rolling intersection drawingId=${String(drawingId)}`
    )
    return false
  }

  const leaves = entries
    .map((entry) => new Leaf(entry.wallet, BigInt(entry.tickets)))
    .sort((a, b) => {
      const aKey = typeof a.address === 'string' ? a.address : a.address.toBase58()
      const bKey = typeof b.address === 'string' ? b.address : b.address.toBase58()
      return aKey.localeCompare(bKey)
    })

  if (leaves.length === 0) {
    logInfo(
      `no merkle leaves after rolling intersection drawingId=${String(drawingId)}`
    )
    return false
  }

  const totalTickets = leaves.reduce((sum, leaf) => sum + leaf.tickets, 0n)
  if (totalTickets <= 0n) {
    logInfo(`total tickets is zero drawingId=${String(drawingId)}`)
    return false
  }

  const secretSeed = crypto.getRandomValues(new Uint8Array(32))
  const secretHash = sha256(secretSeed)

  const tree = new MerkleTree(Leaf.toBufferArray(leaves))
  const merkleRoot = Buffer.from(tree.root)

  db.run('BEGIN')
  try {
    db.query(
      `UPDATE drawings
          SET merkle_root = ?,
              secret_seed = ?,
              secret_hash = ?,
              total_tickets = ?
        WHERE id = ?`
    ).run(merkleRoot, Buffer.from(secretSeed), secretHash, totalTickets, drawingId)

    db.query('DELETE FROM proofs WHERE drawing_id = ?').run(drawingId)
    const insertProof = db.query(
      'INSERT INTO proofs (drawing_id, wallet, tickets, proof) VALUES (?, ?, ?, ?)'
    )

    for (const leaf of leaves) {
      const wallet =
        typeof leaf.address === 'string' ? leaf.address : leaf.address.toBase58()
      const proof = tree.prove(leaf.toBuffer())
      if (!proof) continue
      insertProof.run(drawingId, wallet, leaf.tickets, Buffer.from(proof))
    }

    db.run('COMMIT')

    logInfo(
      `commit artifacts materialized drawingId=${String(drawingId)} holders=${leaves.length} totalTickets=${String(totalTickets)}`
    )
    return true
  } catch (err) {
    db.run('ROLLBACK')
    throw err
  }
}
