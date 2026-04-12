import Elysia, { t } from 'elysia'
import { db } from '../../db'
import type { ProofRow, DrawingRow } from '../../db'
import { toHexOrNull } from '../../utils'

// GET /api/proofs/:drawingId                — snapshot: config + context + participants
// GET /api/proofs/:drawingId/:wallet        — single wallet proof
// GET /api/proofs/vault/:vault/:round       — lookup by vault + round
export const proofsHandler = new Elysia({
  prefix: '/api/proofs',
  name: 'proofs'
})
  .get(
    '/:drawingId',
    ({ params }) => {
      const drawingId = BigInt(params.drawingId)

      const drawing = db
        .query<DrawingRow, [bigint]>('SELECT * FROM drawings WHERE id = ?')
        .get(drawingId)
      if (!drawing) return { error: 'Drawing not found' }

      const rows = db
        .query<ProofRow, [bigint]>(
          'SELECT wallet, tickets, proof FROM proofs WHERE drawing_id = ? ORDER BY id'
        )
        .all(drawingId)

      return {
        config: {
          vault: drawing.vault,
          mint: drawing.mint,
          round: drawing.round,
          reward_type: drawing.reward_type,
          total_tickets: drawing.total_tickets,
          merkle_root: toHexOrNull(drawing.merkle_root),
          winner_wallet: drawing.winner_wallet
        },
        context: {
          drawing_id: drawing.id,
          snapshot_at: drawing.snapshot_at ?? drawing.committed_at,
          revealed_at: drawing.revealed_at,
          amount: drawing.amount
        },
        participants: rows.map((r) => ({
          wallet: r.wallet,
          tickets: r.tickets,
          proof: Buffer.from(r.proof).toString('base64')
        }))
      }
    },
    {
      params: t.Object({ drawingId: t.String() })
    }
  )
  .get(
    '/vault/:vault/:round',
    ({ params }) => {
      const round = BigInt(params.round)

      const drawing = db
        .query<DrawingRow, [string, bigint]>('SELECT * FROM drawings WHERE vault = ? AND round = ?')
        .get(params.vault, round)
      if (!drawing) return { error: 'Drawing not found' }

      const rows = db
        .query<ProofRow, [bigint]>(
          'SELECT wallet, tickets, proof FROM proofs WHERE drawing_id = ? ORDER BY id'
        )
        .all(drawing.id)

      return {
        config: {
          vault: drawing.vault,
          mint: drawing.mint,
          round: drawing.round,
          reward_type: drawing.reward_type,
          total_tickets: drawing.total_tickets,
          merkle_root: toHexOrNull(drawing.merkle_root),
          winner_wallet: drawing.winner_wallet
        },
        context: {
          drawing_id: drawing.id,
          snapshot_at: drawing.snapshot_at ?? drawing.committed_at,
          revealed_at: drawing.revealed_at,
          amount: drawing.amount
        },
        participants: rows.map((r) => ({
          wallet: r.wallet,
          tickets: r.tickets,
          proof: Buffer.from(r.proof).toString('base64')
        }))
      }
    },
    {
      params: t.Object({ vault: t.String(), round: t.String() })
    }
  )
  .get(
    '/:drawingId/:wallet',
    ({ params }) => {
      const drawingId = BigInt(params.drawingId)

      const row = db
        .query<ProofRow, [bigint, string]>(
          'SELECT wallet, tickets, proof FROM proofs WHERE drawing_id = ? AND wallet = ?'
        )
        .get(drawingId, params.wallet)

      if (!row) return { error: 'Proof not found' }

      return {
        wallet: row.wallet,
        tickets: row.tickets,
        proof: Buffer.from(row.proof).toString('base64')
      }
    },
    {
      params: t.Object({ drawingId: t.String(), wallet: t.String() })
    }
  )
