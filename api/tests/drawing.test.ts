import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { Elysia } from 'elysia'
import { db } from '../src/db'
import { drawingHandler } from '../src/handlers/drawing'

const app = new Elysia().use(drawingHandler)
// --- Seed data ---
const VAULT_A = 'vaultA111'
const VAULT_B = 'vaultB222'
const VAULT_C = 'vaultC333'
const MINT_A = 'mintA111'
const MINT_B = 'mintB222'
const MINT_C = 'mintC333'
const WALLET = 'walletParticipant111'
const MERKLE = Buffer.alloc(32, 0xcc)
const SECRET = Buffer.alloc(32, 0xdd)
const PROOF = Buffer.from('aabbccdd', 'hex')
const SNAPSHOT_1 = 1_000
const SNAPSHOT_2 = 2_000
const SNAPSHOT_3 = 3_000

const drawingIds: bigint[] = []

beforeAll(() => {
  // Drawing 1: vault A, unrevealed (ongoing) — used by check/:wallet test
  const r1 = db
    .query(
      `INSERT INTO drawings (
        vault, mint, round, reward_type, total_tickets, amount, merkle_root, secret_hash,
        snapshot_at, committed_at
      )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(VAULT_A, MINT_A, 1, 0, 200, 0, MERKLE, SECRET, SNAPSHOT_1, SNAPSHOT_1)
  drawingIds.push((r1 as any).lastInsertRowid as bigint)

  // Drawing 2: vault A, revealed (completed, has reveal_tx)
  const r2 = db
    .query(
      `INSERT INTO drawings (
        vault, mint, round, reward_type, total_tickets, amount, merkle_root, secret_hash,
        winner_wallet, winner_index, snapshot_at, committed_at, revealed_at, reveal_tx
      )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      VAULT_A,
      MINT_A,
      2,
      1,
      300,
      1000,
      MERKLE,
      SECRET,
      WALLET,
      42,
      SNAPSHOT_2,
      SNAPSHOT_2,
      SNAPSHOT_2 + 100,
      'revealTx2'
    )
  drawingIds.push((r2 as any).lastInsertRowid as bigint)

  // Drawing 3: vault B, revealed (completed, has reveal_tx)
  const r3 = db
    .query(
      `INSERT INTO drawings (
        vault, mint, round, reward_type, total_tickets, amount, merkle_root, secret_hash,
        winner_wallet, winner_index, snapshot_at, committed_at, revealed_at, reveal_tx
      )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      VAULT_B,
      MINT_B,
      1,
      0,
      150,
      0,
      MERKLE,
      SECRET,
      WALLET,
      5,
      SNAPSHOT_2,
      SNAPSHOT_2,
      SNAPSHOT_2 + 100,
      'revealTx3'
    )
  drawingIds.push((r3 as any).lastInsertRowid as bigint)

  // Drawing 4: vault C, revealed — gives global list >= 3 revealed drawings
  const r4 = db
    .query(
      `INSERT INTO drawings (
        vault, mint, round, reward_type, total_tickets, amount, merkle_root, secret_hash,
        winner_wallet, winner_index, snapshot_at, committed_at, revealed_at, reveal_tx
      )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      VAULT_C,
      MINT_C,
      1,
      0,
      100,
      0,
      MERKLE,
      SECRET,
      WALLET,
      1,
      SNAPSHOT_2,
      SNAPSHOT_2,
      SNAPSHOT_2 + 100,
      'revealTx4'
    )
  drawingIds.push((r4 as any).lastInsertRowid as bigint)

  // Drawing 5: vault A, revealed — adds second winner APR datapoint for vault average
  const r5 = db
    .query(
      `INSERT INTO drawings (
        vault, mint, round, reward_type, total_tickets, amount, merkle_root, secret_hash,
        winner_wallet, winner_index, snapshot_at, committed_at, revealed_at, reveal_tx
      )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      VAULT_A,
      MINT_A,
      3,
      0,
      400,
      2000,
      MERKLE,
      SECRET,
      WALLET,
      10,
      SNAPSHOT_3,
      SNAPSHOT_3,
      SNAPSHOT_3 + 100,
      'revealTx5'
    )
  drawingIds.push((r5 as any).lastInsertRowid as bigint)

  // Add wallet as participant in drawing 1 (ongoing), drawing 2 and drawing 5 (completed)
  const ins = db.query(
    'INSERT INTO proofs (drawing_id, wallet, tickets, proof) VALUES (?, ?, ?, ?)'
  )
  ins.run(drawingIds[0], WALLET, 50, PROOF)
  ins.run(drawingIds[1], WALLET, 80, PROOF)
  ins.run(drawingIds[4], WALLET, 100, PROOF)
})

afterAll(() => {
  for (const id of drawingIds) {
    db.query('DELETE FROM proofs WHERE drawing_id = ?').run(id)
    db.query('DELETE FROM drawings WHERE id = ?').run(id)
  }
})

describe('GET /api/drawing/check/:wallet', () => {
  test('returns participating=true for wallet in ongoing drawing', async () => {
    const res = await app.handle(
      new Request(`http://localhost/api/drawing/check/${WALLET}`)
    )
    const body = await res.json()

    expect(body.participating).toBe(true)
    // Only unrevealed drawings — drawing 1 (vaultA) should match, not drawing 2 (revealed)
    expect(body.drawings).toHaveLength(1)
    expect(body.drawings[0].vault).toBe(VAULT_A)
    expect(body.drawings[0].mint).toBe(MINT_A)
    expect(body.drawings[0].your_tickets).toBe('50')
  })

  test('returns participating=false for unknown wallet', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/drawing/check/unknownWallet')
    )
    const body = await res.json()

    expect(body.participating).toBe(false)
    expect(body.drawings).toHaveLength(0)
  })
})

describe('GET /api/drawing — all vaults paginated', () => {
  test('returns drawings ordered by id desc', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/drawing?limit=100')
    )
    const body = await res.json()

    expect(body.drawings.length).toBeGreaterThanOrEqual(4)
    // Verify descending order
    for (let i = 1; i < body.drawings.length; i++) {
      expect(Number(body.drawings[i - 1].id)).toBeGreaterThan(
        Number(body.drawings[i].id)
      )
    }
  })

  test('pagination works', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/drawing?page=1&limit=2')
    )
    const body = await res.json()

    expect(body.drawings).toHaveLength(2)
    expect(body.pagination.page).toBe(1)
    expect(body.pagination.limit).toBe(2)
    expect(Number(body.pagination.total)).toBeGreaterThanOrEqual(4)
  })

  test('includes winner_apr_percent per drawing and per-vault winner average map', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/drawing?limit=100')
    )
    const body = await res.json()

    const round2 = body.drawings.find((d: any) => Number(d.round) === 2)
    const round3 = body.drawings.find((d: any) => Number(d.round) === 3)
    expect(round2?.winner_apr_percent).toBeCloseTo(21_900_000, 6)
    expect(round3?.winner_apr_percent).toBeCloseTo(63_072_000, 6)

    expect(
      body.winners_compound_average_apy_percent_by_vault[VAULT_A]
    ).toBeCloseTo(42_486_000, 6)
  })
})

describe('GET /api/drawing/:vault — per-vault paginated', () => {
  test('returns only drawings for specified vault', async () => {
    const res = await app.handle(
      new Request(`http://localhost/api/drawing/${VAULT_A}?limit=100`)
    )
    const body = await res.json()

    expect(body.drawings.length).toBe(3)
    for (const d of body.drawings) {
      expect(d.vault).toBe(VAULT_A)
      expect(d.mint).toBe(MINT_A)
    }
    expect(body.winners_compound_average_apy_percent).toBeCloseTo(
      42_486_000,
      6
    )
  })

  test('returns drawings for vault B', async () => {
    const res = await app.handle(
      new Request(`http://localhost/api/drawing/${VAULT_B}?limit=100`)
    )
    const body = await res.json()

    expect(body.drawings.length).toBe(1)
    expect(body.drawings[0].vault).toBe(VAULT_B)
    expect(body.drawings[0].mint).toBe(MINT_B)
    expect(body.drawings[0].winner_apr_percent).toBeNull()
    expect(body.winners_compound_average_apy_percent).toBeNull()
  })

  test('returns empty for non-existent vault', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/drawing/nonExistentVault')
    )
    const body = await res.json()

    expect(body.drawings).toHaveLength(0)
    expect(body.pagination.total).toBe('0')
    expect(body.winners_compound_average_apy_percent).toBeNull()
  })
})
