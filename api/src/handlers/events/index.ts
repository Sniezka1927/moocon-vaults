import { cron, Patterns } from '@elysiajs/cron'
import Elysia, { t } from 'elysia'
import { processEvents } from './cron'
import { db } from '../../db'
import type { DrawingRow, VaultEventRow } from '../../db'
import { formatDrawing, toHexOrNull } from '../../utils'

function formatEvent(e: VaultEventRow) {
  return {
    id: e.id,
    drawing_id: e.drawing_id,
    signature: e.signature,
    slot: e.slot,
    block_time: e.block_time,
    event_name: e.event_name,
    vault: e.vault,
    round: e.round,
    decoded: JSON.parse(e.decoded),
    amount: e.amount,
    merkle_root: e.merkle_root,
    secret_hash: e.secret_hash,
    vrf_seed: e.vrf_seed,
    secret_seed: e.secret_seed,
    randomness: e.randomness,
    winner_index: e.winner_index,
    created_at: e.created_at
  }
}

// Cron job for event indexing
// GET /api/events?page=1&limit=10          — paginated list of all vault events
// GET /api/events/:vault/:round            — drawing + on-chain events + match comparison
export const eventsHandler = new Elysia({
  prefix: '/api/events',
  name: 'events'
})
  .use(
    cron({
      name: 'events-heartbeat',
      pattern: Patterns.everyMinutes(1),
      run: processEvents
    })
  )
  .get(
    '/',
    ({ query }) => {
      const page = Math.max(1, Number(query.page ?? 1))
      const limit = Math.min(100, Math.max(1, Number(query.limit ?? 20)))
      const offset = (page - 1) * limit

      const rows = db
        .query<VaultEventRow, [number, number]>(
          'SELECT * FROM vault_events ORDER BY id DESC LIMIT ? OFFSET ?'
        )
        .all(limit, offset)

      const total = db
        .query<{ count: bigint }, []>(
          'SELECT COUNT(*) as count FROM vault_events'
        )
        .get()!.count

      return {
        events: rows.map(formatEvent),
        pagination: { page, limit, total }
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
    '/:vault/:round',
    ({ params }) => {
      const round = Number(params.round)

      const drawing = db
        .query<DrawingRow, [string, number]>(
          'SELECT * FROM drawings WHERE vault = ? AND round = ?'
        )
        .get(params.vault, round)

      if (!drawing) return { error: 'drawing not found' }

      const commitEvent = db
        .query<VaultEventRow, [string]>(
          "SELECT * FROM vault_events WHERE signature = ? AND event_name = 'commitEvent'"
        )
        .get(drawing.commit_tx ?? '')

      const revealEvent = db
        .query<VaultEventRow, [string]>(
          "SELECT * FROM vault_events WHERE signature = ? AND event_name = 'revealEvent'"
        )
        .get(drawing.reveal_tx ?? '')

      const drawingMerkleRoot = toHexOrNull(drawing.merkle_root)
      const drawingSecretHash = toHexOrNull(drawing.secret_hash)
      const drawingVrfSeed = toHexOrNull(drawing.vrf_seed)
      const drawingRandomness = toHexOrNull(drawing.randomness)

      const match = {
        merkle_root:
          commitEvent !== null && drawingMerkleRoot !== null
            ? drawingMerkleRoot === commitEvent.merkle_root
            : null,
        secret_hash:
          commitEvent !== null && drawingSecretHash !== null
            ? drawingSecretHash === commitEvent.secret_hash
            : null,
        vrf_seed:
          commitEvent !== null && drawingVrfSeed !== null
            ? drawingVrfSeed === commitEvent.vrf_seed
            : null,
        winner_index:
          revealEvent !== null && drawing.winner_index !== null
            ? String(drawing.winner_index) === String(revealEvent.winner_index)
            : null,
        randomness:
          revealEvent !== null && drawingRandomness !== null
            ? drawingRandomness === revealEvent.randomness
            : null
      }

      return {
        drawing: formatDrawing(drawing),
        commit_event: commitEvent ? formatEvent(commitEvent) : null,
        reveal_event: revealEvent ? formatEvent(revealEvent) : null,
        match
      }
    },
    {
      params: t.Object({ vault: t.String(), round: t.String() })
    }
  )
