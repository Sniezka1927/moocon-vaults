import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { Elysia } from 'elysia'
import { db } from '../src/db'
import { eventsHandler } from '../src/handlers/events'

const app = new Elysia().use(eventsHandler)

const ts = Date.now()
const VAULT = `eventsTestVault_${ts}`
const MINT = `eventsTestMint_${ts}`
const COMMIT_SIG = `commitSig_${ts}`
const MISMATCH_SIG = `mismatchSig_${ts}`

const MERKLE_HEX = Buffer.alloc(32, 0xab).toString('hex')
const SECRET_HEX = Buffer.alloc(32, 0xcd).toString('hex')
const VRF_HEX = Buffer.alloc(32, 0xef).toString('hex')
const MERKLE_BUF = Buffer.alloc(32, 0xab)
const SECRET_BUF = Buffer.alloc(32, 0xcd)
const VRF_BUF = Buffer.alloc(32, 0xef)

// Different values for mismatch test
const OTHER_MERKLE_HEX = Buffer.alloc(32, 0x11).toString('hex')

const drawingIds: bigint[] = []
const eventIds: bigint[] = []

beforeAll(() => {
  const decoded = JSON.stringify({ someField: 'value' })
  const rawLogs = JSON.stringify([])

  // Drawing 1: no events
  const r1 = db
    .query(
      `INSERT INTO drawings (vault, mint, round, reward_type, total_tickets, amount, merkle_root, secret_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(VAULT, MINT, 1, 0, 100, 0, MERKLE_BUF, SECRET_BUF)
  drawingIds.push((r1 as any).lastInsertRowid as bigint)

  // Drawing 2: has commit_tx pointing to a matching event
  const r2 = db
    .query(
      `INSERT INTO drawings (vault, mint, round, reward_type, total_tickets, amount, merkle_root, secret_hash, vrf_seed, commit_tx)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(VAULT, MINT, 2, 0, 200, 0, MERKLE_BUF, SECRET_BUF, VRF_BUF, COMMIT_SIG)
  drawingIds.push((r2 as any).lastInsertRowid as bigint)

  // Drawing 3: has commit_tx pointing to an event with MISMATCHED merkle_root
  const r3 = db
    .query(
      `INSERT INTO drawings (vault, mint, round, reward_type, total_tickets, amount, merkle_root, secret_hash, vrf_seed, commit_tx)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(VAULT, MINT, 3, 0, 300, 0, MERKLE_BUF, SECRET_BUF, VRF_BUF, MISMATCH_SIG)
  drawingIds.push((r3 as any).lastInsertRowid as bigint)

  // Insert 3 extra events for pagination tests (signature unique per ts)
  const insertEvent = db.query(
    `INSERT INTO vault_events (signature, event_name, vault, round, raw_logs, decoded, merkle_root, secret_hash, vrf_seed)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )

  const e1 = insertEvent.run(
    `pag1_${ts}`,
    'commitEvent',
    VAULT,
    1,
    rawLogs,
    decoded,
    MERKLE_HEX,
    SECRET_HEX,
    VRF_HEX
  )
  eventIds.push((e1 as any).lastInsertRowid as bigint)

  const e2 = insertEvent.run(
    `pag2_${ts}`,
    'commitEvent',
    VAULT,
    1,
    rawLogs,
    decoded,
    MERKLE_HEX,
    SECRET_HEX,
    VRF_HEX
  )
  eventIds.push((e2 as any).lastInsertRowid as bigint)

  // Event matching drawing 2's commit_tx — same hashes
  const e3 = db
    .query(
      `INSERT INTO vault_events (signature, event_name, vault, round, raw_logs, decoded, merkle_root, secret_hash, vrf_seed)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      COMMIT_SIG,
      'commitEvent',
      VAULT,
      2,
      rawLogs,
      decoded,
      MERKLE_HEX,
      SECRET_HEX,
      VRF_HEX
    )
  eventIds.push((e3 as any).lastInsertRowid as bigint)

  // Event matching drawing 3's commit_tx — DIFFERENT merkle_root
  const e4 = db
    .query(
      `INSERT INTO vault_events (signature, event_name, vault, round, raw_logs, decoded, merkle_root, secret_hash, vrf_seed)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      MISMATCH_SIG,
      'commitEvent',
      VAULT,
      3,
      rawLogs,
      decoded,
      OTHER_MERKLE_HEX,
      SECRET_HEX,
      VRF_HEX
    )
  eventIds.push((e4 as any).lastInsertRowid as bigint)
})

afterAll(() => {
  for (const id of eventIds) {
    db.run('DELETE FROM vault_events WHERE id = ?', [id])
  }
  for (const id of drawingIds) {
    db.run('DELETE FROM drawings WHERE id = ?', [id])
  }
})

// ---------------------------------------------------------------------------
// GET /api/events
// ---------------------------------------------------------------------------
describe('GET /api/events', () => {
  test('returns events with pagination metadata', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/events?limit=100')
    )
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(Array.isArray(body.events)).toBe(true)
    expect(body.events.length).toBeGreaterThanOrEqual(4)
    expect(body.pagination.limit).toBe(100)
    expect(Number(body.pagination.total)).toBeGreaterThanOrEqual(4)
  })

  test('events are ordered descending by id', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/events?limit=100')
    )
    const body = await res.json()

    for (let i = 1; i < body.events.length; i++) {
      expect(Number(body.events[i - 1].id)).toBeGreaterThan(
        Number(body.events[i].id)
      )
    }
  })

  test('pagination: page 1 limit 2 returns 2 items', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/events?page=1&limit=2')
    )
    const body = await res.json()

    expect(body.events).toHaveLength(2)
    expect(body.pagination.page).toBe(1)
    expect(body.pagination.limit).toBe(2)
  })

  test('pagination: page 2 returns different items than page 1', async () => {
    const r1 = await app.handle(
      new Request('http://localhost/api/events?page=1&limit=2')
    )
    const r2 = await app.handle(
      new Request('http://localhost/api/events?page=2&limit=2')
    )
    const b1 = await r1.json()
    const b2 = await r2.json()

    const ids1 = b1.events.map((e: any) => e.id)
    const ids2 = b2.events.map((e: any) => e.id)
    // No overlap between pages
    expect(ids1.some((id: any) => ids2.includes(id))).toBe(false)
  })

  test('limit clamped to 100 when over', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/events?limit=999')
    )
    const body = await res.json()
    expect(body.pagination.limit).toBe(100)
  })

  test('limit clamped to 1 when zero or below', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/events?limit=0')
    )
    const body = await res.json()
    expect(body.pagination.limit).toBe(1)
    expect(body.events).toHaveLength(1)
  })

  test('page clamped to 1 when zero or below', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/events?page=0&limit=100')
    )
    const body = await res.json()
    expect(body.pagination.page).toBe(1)
  })

  test('decoded field is parsed JSON object, not a string', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/events?limit=100')
    )
    const body = await res.json()

    const ourEvent = body.events.find((e: any) => e.vault === VAULT)
    expect(ourEvent).toBeDefined()
    expect(typeof ourEvent.decoded).toBe('object')
    expect(ourEvent.decoded.someField).toBe('value')
  })
})

// ---------------------------------------------------------------------------
// GET /api/events/:vault/:round
// ---------------------------------------------------------------------------
describe('GET /api/events/:vault/:round', () => {
  test('returns error for non-existent vault/round', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/events/nonExistentVault999/1')
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.error).toBe('drawing not found')
  })

  test('non-numeric round returns drawing not found', async () => {
    const res = await app.handle(
      new Request(`http://localhost/api/events/${VAULT}/notanumber`)
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.error).toBe('drawing not found')
  })

  test('drawing with no indexed events: all match fields are null', async () => {
    const res = await app.handle(
      new Request(`http://localhost/api/events/${VAULT}/1`)
    )
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.drawing.vault).toBe(VAULT)
    expect(body.drawing.mint).toBe(MINT)
    expect(body.drawing.round).toBe('1')
    expect(body.commit_event).toBeNull()
    expect(body.reveal_event).toBeNull()
    expect(body.match.merkle_root).toBeNull()
    expect(body.match.secret_hash).toBeNull()
    expect(body.match.vrf_seed).toBeNull()
    expect(body.match.winner_index).toBeNull()
    expect(body.match.randomness).toBeNull()
  })

  test('drawing with matching commit event: match fields are true', async () => {
    const res = await app.handle(
      new Request(`http://localhost/api/events/${VAULT}/2`)
    )
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.commit_event).not.toBeNull()
    expect(body.commit_event.event_name).toBe('commitEvent')
    expect(body.reveal_event).toBeNull()
    expect(body.match.merkle_root).toBe(true)
    expect(body.match.secret_hash).toBe(true)
    expect(body.match.vrf_seed).toBe(true)
    expect(body.match.winner_index).toBeNull()
    expect(body.match.randomness).toBeNull()
  })

  test('drawing with mismatched commit event: match.merkle_root is false', async () => {
    const res = await app.handle(
      new Request(`http://localhost/api/events/${VAULT}/3`)
    )
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.commit_event).not.toBeNull()
    // merkle_root differs: drawing has 0xab…, event has 0x11…
    expect(body.match.merkle_root).toBe(false)
    // secret_hash and vrf_seed still match
    expect(body.match.secret_hash).toBe(true)
    expect(body.match.vrf_seed).toBe(true)
  })
})
