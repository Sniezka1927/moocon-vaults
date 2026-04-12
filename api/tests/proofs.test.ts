import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { Elysia } from 'elysia'
import { db } from '../src/db'
import { proofsHandler } from '../src/handlers/proofs'

const app = new Elysia().use(proofsHandler)

// Seed data
const VAULT = 'vaultPda123'
const MINT = 'mintPda123'
const WALLET_A = '11111111111111111111111111111111'
const WALLET_B = '22222222222222222222222222222222'
const MERKLE_ROOT = Buffer.alloc(32, 0xaa)
const SECRET_HASH = Buffer.alloc(32, 0xbb)
const PROOF_A = Buffer.from('deadbeef', 'hex')
const PROOF_B = Buffer.from('cafebabe', 'hex')

let drawingId: bigint

beforeAll(() => {
  const res = db
    .query(
      `INSERT INTO drawings (vault, mint, round, reward_type, total_tickets, amount, merkle_root, secret_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(VAULT, MINT, 1, 0, 100, 0, MERKLE_ROOT, SECRET_HASH)

  drawingId = (res as any).lastInsertRowid as bigint

  const insertProof = db.query(
    'INSERT INTO proofs (drawing_id, wallet, tickets, proof) VALUES (?, ?, ?, ?)'
  )
  insertProof.run(drawingId, WALLET_A, 60, PROOF_A)
  insertProof.run(drawingId, WALLET_B, 40, PROOF_B)
})

afterAll(() => {
  db.query('DELETE FROM proofs WHERE drawing_id = ?').run(drawingId)
  db.query('DELETE FROM drawings WHERE id = ?').run(drawingId)
})

describe('GET /api/proofs/:drawingId — snapshot', () => {
  test('returns config, context, and participants', async () => {
    const res = await app.handle(
      new Request(`http://localhost/api/proofs/${drawingId}`)
    )
    expect(res.status).toBe(200)

    const body = await res.json()

    // config
    expect(body.config.vault).toBe(VAULT)
    expect(body.config.mint).toBe(MINT)
    expect(body.config.round).toBe('1')
    expect(body.config.total_tickets).toBe('100')
    expect(body.config.merkle_root).toBe(MERKLE_ROOT.toString('hex'))
    expect(body.config.winner_wallet).toBeNull()

    // context
    expect(body.context.drawing_id).toBe(drawingId.toString())
    expect(Number(body.context.snapshot_at)).toBeGreaterThan(0)
    expect(body.context.revealed_at).toBeNull()
    expect(body.context.amount).toBe('0')

    // participants
    expect(body.participants).toHaveLength(2)

    expect(body.participants[0].wallet).toBe(WALLET_A)
    expect(body.participants[0].tickets).toBe('60')
    expect(body.participants[0].proof).toBe(PROOF_A.toString('base64'))

    expect(body.participants[1].wallet).toBe(WALLET_B)
    expect(body.participants[1].tickets).toBe('40')
    expect(body.participants[1].proof).toBe(PROOF_B.toString('base64'))
  })

  test('returns error for non-existent drawing', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/proofs/999999')
    )
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.error).toBe('Drawing not found')
  })
})

describe('GET /api/proofs/:drawingId/:wallet', () => {
  test('returns proof for a specific wallet', async () => {
    const res = await app.handle(
      new Request(`http://localhost/api/proofs/${drawingId}/${WALLET_A}`)
    )
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.wallet).toBe(WALLET_A)
    expect(body.tickets).toBe('60')
    expect(body.proof).toBe(PROOF_A.toString('base64'))
  })

  test('returns proof for second wallet', async () => {
    const res = await app.handle(
      new Request(`http://localhost/api/proofs/${drawingId}/${WALLET_B}`)
    )
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.wallet).toBe(WALLET_B)
    expect(body.tickets).toBe('40')
  })

  test('returns error for non-existent wallet', async () => {
    const res = await app.handle(
      new Request(`http://localhost/api/proofs/${drawingId}/nonExistentWallet`)
    )
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.error).toBe('Proof not found')
  })

  test('returns error for non-existent drawing', async () => {
    const res = await app.handle(
      new Request(`http://localhost/api/proofs/999999/${WALLET_A}`)
    )
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.error).toBe('Proof not found')
  })
})
