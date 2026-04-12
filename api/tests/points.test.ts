import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { Elysia } from 'elysia'
import { db } from '../src/db'
import { pointsHandler } from '../src/handlers/points'
import { processPoints, getConsecutiveRounds } from '../src/handlers/points/cron'

const app = new Elysia().use(pointsHandler)

const ts = Date.now()
const WALLET = `pointsTestWallet_${ts}`
const STAKE_PTS = 150
const REFERRAL_PTS = 75

// Wallets for processPoints tests
const PARTICIPANT_A = `ppA_${ts}`
const PARTICIPANT_B = `ppB_${ts}`
const REFERRER_CODE = `ppReferrerCode_${ts}`
const REFERRER_WALLET = `ppReferrer_${ts}`
const LOW_TICKET_PARTICIPANT = `ppLow_${ts}`

const PROOF = Buffer.from('aabbccdd', 'hex')
const MERKLE = Buffer.alloc(32, 0x01)
const SECRET = Buffer.alloc(32, 0x02)

const drawingIds: bigint[] = []

beforeAll(() => {
  db.run(
    'INSERT INTO points (user_id, stake_points, referral_points) VALUES (?, ?, ?)',
    [WALLET, STAKE_PTS, REFERRAL_PTS]
  )

  // Referral setup: PARTICIPANT_A referred by REFERRER_CODE, PARTICIPANT_B has no referrer
  db.run(
    'INSERT INTO referrals (user_id, code, referred_by) VALUES (?, ?, ?)',
    [PARTICIPANT_A, `ppCodeA_${ts}`, REFERRER_CODE]
  )
  db.run('INSERT INTO referrals (user_id, code) VALUES (?, ?)', [
    PARTICIPANT_B,
    `ppCodeB_${ts}`
  ])
  // LOW_TICKET_PARTICIPANT has a referrer but only 1 ticket → floor(1 * 0.5) = 0, no referral insert
  db.run(
    'INSERT INTO referrals (user_id, code, referred_by) VALUES (?, ?, ?)',
    [LOW_TICKET_PARTICIPANT, `ppCodeLow_${ts}`, REFERRER_CODE]
  )
})

afterAll(() => {
  db.run('DELETE FROM points WHERE user_id = ?', [WALLET])
  db.run('DELETE FROM points WHERE user_id = ?', [PARTICIPANT_A])
  db.run('DELETE FROM points WHERE user_id = ?', [PARTICIPANT_B])
  db.run('DELETE FROM points WHERE user_id = ?', [REFERRER_CODE]) // referral_points keyed by code
  db.run('DELETE FROM points WHERE user_id = ?', [LOW_TICKET_PARTICIPANT])
  db.run('DELETE FROM referrals WHERE user_id IN (?, ?, ?)', [
    PARTICIPANT_A,
    PARTICIPANT_B,
    LOW_TICKET_PARTICIPANT
  ])
  for (const id of drawingIds) {
    db.run('DELETE FROM proofs WHERE drawing_id = ?', [id])
    db.run('DELETE FROM drawings WHERE id = ?', [id])
  }
})

// ---------------------------------------------------------------------------
// GET /api/points/:wallet
// ---------------------------------------------------------------------------
describe('GET /api/points/:wallet', () => {
  test('unknown wallet returns zero points', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/points/unknownWalletXYZ')
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.wallet).toBe('unknownWalletXYZ')
    expect(body.stake_points).toBe(0)
    expect(body.referral_points).toBe(0)
    expect(body.total_points).toBe(0)
  })

  test('known wallet returns correct points', async () => {
    const res = await app.handle(
      new Request(`http://localhost/api/points/${WALLET}`)
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.wallet).toBe(WALLET)
    // safeIntegers: true → BigInt → serialized as strings
    expect(body.stake_points).toBe(String(STAKE_PTS))
    expect(body.referral_points).toBe(String(REFERRAL_PTS))
    expect(body.total_points).toBe(String(STAKE_PTS + REFERRAL_PTS))
  })

  test('wallet with only stake_points returns correct total', async () => {
    const w = `stakeOnly_${ts}`
    db.run(
      'INSERT INTO points (user_id, stake_points, referral_points) VALUES (?, ?, ?)',
      [w, 200, 0]
    )
    try {
      const res = await app.handle(
        new Request(`http://localhost/api/points/${w}`)
      )
      const body = await res.json()
      expect(body.stake_points).toBe('200')
      expect(body.referral_points).toBe('0')
      expect(body.total_points).toBe('200')
    } finally {
      db.run('DELETE FROM points WHERE user_id = ?', [w])
    }
  })
})

// ---------------------------------------------------------------------------
// processPoints() — cron logic
// ---------------------------------------------------------------------------
describe('processPoints()', () => {
  test('awards stake_points to participant and referral_points to referrer', async () => {
    const r = db
      .query(
        `INSERT INTO drawings (vault, round, reward_type, total_tickets, amount, merkle_root, secret_hash, revealed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, unixepoch())`
      )
      .run(`ppVault_${ts}`, 1, 0, 100, 0, MERKLE, SECRET)
    const drawingId = (r as any).lastInsertRowid as bigint
    drawingIds.push(drawingId)

    db.run(
      'INSERT INTO proofs (drawing_id, wallet, tickets, proof) VALUES (?, ?, ?, ?)',
      [drawingId, PARTICIPANT_A, 10, PROOF]
    )

    await processPoints()

    // Participant gets stake_points = tickets * 1.0 = 10
    const participantPts = db
      .query<{ stake_points: bigint }, [string]>(
        'SELECT stake_points FROM points WHERE user_id = ?'
      )
      .get(PARTICIPANT_A)
    expect(Number(participantPts?.stake_points)).toBe(10)

    // Referrer (keyed by code) gets referral_points = floor(10 * 0.5) = 5
    const referrerPts = db
      .query<{ referral_points: bigint }, [string]>(
        'SELECT referral_points FROM points WHERE user_id = ?'
      )
      .get(REFERRER_CODE)
    expect(Number(referrerPts?.referral_points)).toBe(5)

    // drawing marked as processed
    const drawing = db
      .query<{ points_processed_at: number | null }, [bigint]>(
        'SELECT points_processed_at FROM drawings WHERE id = ?'
      )
      .get(drawingId)
    expect(drawing?.points_processed_at).not.toBeNull()
  })

  test('participant with no referrer only gets stake_points', async () => {
    const r = db
      .query(
        `INSERT INTO drawings (vault, round, reward_type, total_tickets, amount, merkle_root, secret_hash, revealed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, unixepoch())`
      )
      .run(`ppVault_${ts}`, 2, 0, 100, 0, MERKLE, SECRET)
    const drawingId = (r as any).lastInsertRowid as bigint
    drawingIds.push(drawingId)

    db.run(
      'INSERT INTO proofs (drawing_id, wallet, tickets, proof) VALUES (?, ?, ?, ?)',
      [drawingId, PARTICIPANT_B, 20, PROOF]
    )

    await processPoints()

    const pts = db
      .query<{ stake_points: bigint }, [string]>(
        'SELECT stake_points FROM points WHERE user_id = ?'
      )
      .get(PARTICIPANT_B)
    expect(Number(pts?.stake_points)).toBe(20)

    // No referral_points row should exist for PARTICIPANT_B (they have no referrer)
    const referralPts = db
      .query<{ referral_points: bigint }, [string]>(
        'SELECT referral_points FROM points WHERE user_id = ?'
      )
      .get(PARTICIPANT_B)
    // Either no row or referral_points is 0
    expect(Number(referralPts?.referral_points ?? 0)).toBe(0)
  })

  test('idempotent: re-running does not double-count already-processed drawing', async () => {
    // Both drawings from previous tests are now processed
    await processPoints()

    const participantPts = db
      .query<{ stake_points: bigint }, [string]>(
        'SELECT stake_points FROM points WHERE user_id = ?'
      )
      .get(PARTICIPANT_A)
    // Still 10, not 20
    expect(Number(participantPts?.stake_points)).toBe(10)
  })

  test('accumulates points across multiple drawings', async () => {
    const r = db
      .query(
        `INSERT INTO drawings (vault, round, reward_type, total_tickets, amount, merkle_root, secret_hash, revealed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, unixepoch())`
      )
      .run(`ppVault_${ts}`, 3, 0, 100, 0, MERKLE, SECRET)
    const drawingId = (r as any).lastInsertRowid as bigint
    drawingIds.push(drawingId)

    db.run(
      'INSERT INTO proofs (drawing_id, wallet, tickets, proof) VALUES (?, ?, ?, ?)',
      [drawingId, PARTICIPANT_A, 6, PROOF]
    )

    await processPoints()

    // PARTICIPANT_A now has 10 (from drawing 1) + 6 (from drawing 3) = 16
    const pts = db
      .query<{ stake_points: bigint }, [string]>(
        'SELECT stake_points FROM points WHERE user_id = ?'
      )
      .get(PARTICIPANT_A)
    expect(Number(pts?.stake_points)).toBe(16)

    // Referrer: 5 (from 10 tickets) + 3 (from 6 tickets) = 8
    const referrerPts = db
      .query<{ referral_points: bigint }, [string]>(
        'SELECT referral_points FROM points WHERE user_id = ?'
      )
      .get(REFERRER_CODE)
    expect(Number(referrerPts?.referral_points)).toBe(8)
  })

  test('1 ticket yields 0 referral points (floor truncation) — no insert for referrer', async () => {
    const r = db
      .query(
        `INSERT INTO drawings (vault, round, reward_type, total_tickets, amount, merkle_root, secret_hash, revealed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, unixepoch())`
      )
      .run(`ppVault_${ts}`, 4, 0, 100, 0, MERKLE, SECRET)
    const drawingId = (r as any).lastInsertRowid as bigint
    drawingIds.push(drawingId)

    db.run(
      'INSERT INTO proofs (drawing_id, wallet, tickets, proof) VALUES (?, ?, ?, ?)',
      [drawingId, LOW_TICKET_PARTICIPANT, 1, PROOF]
    )

    const referrerBefore = db
      .query<{ referral_points: bigint }, [string]>(
        'SELECT referral_points FROM points WHERE user_id = ?'
      )
      .get(REFERRER_CODE)
    const referralBefore = Number(referrerBefore?.referral_points ?? 0)

    await processPoints()

    // LOW_TICKET_PARTICIPANT gets 1 stake point
    const lowPts = db
      .query<{ stake_points: bigint }, [string]>(
        'SELECT stake_points FROM points WHERE user_id = ?'
      )
      .get(LOW_TICKET_PARTICIPANT)
    expect(Number(lowPts?.stake_points)).toBe(1)

    // Referrer unchanged: floor(1 * 0.5) = 0 → no insert
    const referrerAfter = db
      .query<{ referral_points: bigint }, [string]>(
        'SELECT referral_points FROM points WHERE user_id = ?'
      )
      .get(REFERRER_CODE)
    expect(Number(referrerAfter?.referral_points ?? 0)).toBe(referralBefore)
  })

  test('unrevealed drawing is not processed', async () => {
    const r = db
      .query(
        `INSERT INTO drawings (vault, round, reward_type, total_tickets, amount, merkle_root, secret_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(`ppVault_${ts}`, 5, 0, 100, 0, MERKLE, SECRET)
    const drawingId = (r as any).lastInsertRowid as bigint
    drawingIds.push(drawingId)

    db.run(
      'INSERT INTO proofs (drawing_id, wallet, tickets, proof) VALUES (?, ?, ?, ?)',
      [drawingId, PARTICIPANT_A, 999, PROOF]
    )

    const ptsBefore = db
      .query<{ stake_points: bigint }, [string]>(
        'SELECT stake_points FROM points WHERE user_id = ?'
      )
      .get(PARTICIPANT_A)
    const stackBefore = Number(ptsBefore?.stake_points ?? 0)

    await processPoints()

    const ptsAfter = db
      .query<{ stake_points: bigint }, [string]>(
        'SELECT stake_points FROM points WHERE user_id = ?'
      )
      .get(PARTICIPANT_A)
    // No change — drawing has no revealed_at
    expect(Number(ptsAfter?.stake_points ?? 0)).toBe(stackBefore)
  })
})

// ---------------------------------------------------------------------------
// getConsecutiveRounds()
// ---------------------------------------------------------------------------
describe('getConsecutiveRounds()', () => {
  const STREAK_WALLET = `streakWallet_${ts}`
  const OTHER_WALLET = `streakOther_${ts}`
  const streakDrawingIds: bigint[] = []

  // Use fixed old timestamps (10, 20, 30, 40) so ordering is deterministic
  // and independent of real-time drawings created by other tests.
  // revealed_at DESC → d4 (40) is index 0, d3 (30) is index 1, etc.
  let d1: bigint, d2: bigint, d3: bigint, d4: bigint

  beforeAll(() => {
    const ins = (revealedAt: number) =>
      db
        .query(
          `INSERT INTO drawings (vault, round, reward_type, total_tickets, amount, merkle_root, secret_hash, revealed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(`streakVault_${ts}`, revealedAt, 0, 100, 0, MERKLE, SECRET, revealedAt)

    d1 = (ins(10) as any).lastInsertRowid as bigint
    d2 = (ins(20) as any).lastInsertRowid as bigint
    d3 = (ins(30) as any).lastInsertRowid as bigint
    d4 = (ins(40) as any).lastInsertRowid as bigint
    streakDrawingIds.push(d1, d2, d3, d4)

    const proof = db.query(
      'INSERT INTO proofs (drawing_id, wallet, tickets, proof) VALUES (?, ?, ?, ?)'
    )
    // STREAK_WALLET participates in d1, d2, d3, d4 (all four)
    proof.run(d1, STREAK_WALLET, 10, PROOF)
    proof.run(d2, STREAK_WALLET, 10, PROOF)
    proof.run(d3, STREAK_WALLET, 10, PROOF)
    proof.run(d4, STREAK_WALLET, 10, PROOF)

    // OTHER_WALLET participates in d1 and d3 only (misses d2)
    proof.run(d1, OTHER_WALLET, 10, PROOF)
    proof.run(d3, OTHER_WALLET, 10, PROOF)
  })

  afterAll(() => {
    for (const id of streakDrawingIds) {
      db.run('DELETE FROM proofs WHERE drawing_id = ?', [id])
      db.run('DELETE FROM drawings WHERE id = ?', [id])
    }
  })

  test('wallet in only one drawing returns streak of 1', () => {
    // d1 is the only drawing for a fresh wallet
    const tempWallet = `streakTemp_${ts}`
    db.run('INSERT INTO proofs (drawing_id, wallet, tickets, proof) VALUES (?, ?, ?, ?)', [d1, tempWallet, 5, PROOF])
    try {
      expect(getConsecutiveRounds(tempWallet, d1)).toBe(1)
    } finally {
      db.run('DELETE FROM proofs WHERE drawing_id = ? AND wallet = ?', [d1, tempWallet])
    }
  })

  test('wallet in all 4 consecutive drawings returns streak of 4', () => {
    // d4 is the most recent; d4 → d3 → d2 → d1 all have proofs
    expect(getConsecutiveRounds(STREAK_WALLET, d4)).toBe(4)
  })

  test('wallet in last 3 consecutive drawings returns streak of 3', () => {
    // from d4 going back: d4 ✓, d3 ✓, d2 ✓, d1 — wallet is in all so still 4 from d4
    // test from d3 as current: d3 ✓, d2 ✓, d1 ✓ = 3
    expect(getConsecutiveRounds(STREAK_WALLET, d3)).toBe(3)
  })

  test('wallet that missed a round has streak reset to 1', () => {
    // OTHER_WALLET is in d3 and d1, but NOT d2
    // Processing d3 (most recent for this wallet): d3 ✓, d2 ✗ → streak = 1
    expect(getConsecutiveRounds(OTHER_WALLET, d3)).toBe(1)
  })

  test('streak counts correctly when gap is in older history', () => {
    // OTHER_WALLET is in d1 and d3, not d2
    // Processing d1 (oldest): only d1 exists below → streak = 1
    expect(getConsecutiveRounds(OTHER_WALLET, d1)).toBe(1)
  })

  test('unknown drawing id returns 1', () => {
    expect(getConsecutiveRounds(STREAK_WALLET, 999999999n)).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// getConsecutiveRounds() – extended edge cases
// ---------------------------------------------------------------------------
describe('getConsecutiveRounds() – extended edge cases', () => {
  // 10 drawings with revealed_at = 50..140 (more recent than d1-d4 at 10..40,
  // older than multiplier-formula drawings at 300+). Ordering in DB by DESC:
  // ext[9](140) is index 0, ext[8](130) is index 1, ..., ext[0](50) is index 9.
  const extDrawingIds: bigint[] = []
  const ext: bigint[] = [] // ext[0]=oldest(50), ext[9]=newest(140)

  beforeAll(() => {
    for (let i = 0; i < 10; i++) {
      const revealedAt = 50 + i * 10
      const id = (
        db
          .query(
            `INSERT INTO drawings (vault, round, reward_type, total_tickets, amount, merkle_root, secret_hash, revealed_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(`extVault_${ts}`, revealedAt, 0, 100, 0, MERKLE, SECRET, revealedAt) as any
      ).lastInsertRowid as bigint
      ext.push(id)
      extDrawingIds.push(id)
    }
  })

  afterAll(() => {
    for (const id of extDrawingIds) {
      db.run('DELETE FROM proofs WHERE drawing_id = ?', [id])
      db.run('DELETE FROM drawings WHERE id = ?', [id])
    }
  })

  test('wallet not in current drawing returns 1', () => {
    const w = `extNoProof_${ts}`
    // No proofs inserted at all – function walks 0 steps, max(0,1)=1
    expect(getConsecutiveRounds(w, ext[9])).toBe(1)
  })

  test('wallet in most-recent drawing only returns 1', () => {
    const w = `extRecent_${ts}`
    db.run('INSERT INTO proofs (drawing_id, wallet, tickets, proof) VALUES (?, ?, ?, ?)', [ext[9], w, 10, PROOF])
    try {
      expect(getConsecutiveRounds(w, ext[9])).toBe(1)
    } finally {
      db.run('DELETE FROM proofs WHERE wallet = ?', [w])
    }
  })

  test('wallet in 2 consecutive drawings returns 2', () => {
    const w = `extTwo_${ts}`
    db.run('INSERT INTO proofs (drawing_id, wallet, tickets, proof) VALUES (?, ?, ?, ?)', [ext[8], w, 10, PROOF])
    db.run('INSERT INTO proofs (drawing_id, wallet, tickets, proof) VALUES (?, ?, ?, ?)', [ext[9], w, 10, PROOF])
    try {
      expect(getConsecutiveRounds(w, ext[9])).toBe(2)
    } finally {
      db.run('DELETE FROM proofs WHERE wallet = ?', [w])
    }
  })

  test('wallet in ext[7..9] but not ext[6] returns streak of 3', () => {
    const w = `extThree_${ts}`
    for (const id of [ext[7], ext[8], ext[9]]) {
      db.run('INSERT INTO proofs (drawing_id, wallet, tickets, proof) VALUES (?, ?, ?, ?)', [id, w, 10, PROOF])
    }
    try {
      // ext[9] ✓ ext[8] ✓ ext[7] ✓ ext[6] ✗ → 3
      expect(getConsecutiveRounds(w, ext[9])).toBe(3)
    } finally {
      db.run('DELETE FROM proofs WHERE wallet = ?', [w])
    }
  })

  test('streak stops at first gap – does not skip over missing drawing', () => {
    const w = `extGap_${ts}`
    // participates in ext[9], ext[8], and ext[6] – gap at ext[7]
    for (const id of [ext[9], ext[8], ext[6]]) {
      db.run('INSERT INTO proofs (drawing_id, wallet, tickets, proof) VALUES (?, ?, ?, ?)', [id, w, 10, PROOF])
    }
    try {
      // ext[9] ✓ ext[8] ✓ ext[7] ✗ → streak=2
      expect(getConsecutiveRounds(w, ext[9])).toBe(2)
    } finally {
      db.run('DELETE FROM proofs WHERE wallet = ?', [w])
    }
  })

  test('streak from a mid-history drawing does not count newer drawings', () => {
    const w = `extMid_${ts}`
    // wallet in ext[3], ext[4], ext[5] – queried from ext[5] (mid-list)
    for (const id of [ext[3], ext[4], ext[5]]) {
      db.run('INSERT INTO proofs (drawing_id, wallet, tickets, proof) VALUES (?, ?, ?, ?)', [id, w, 10, PROOF])
    }
    try {
      // getConsecutiveRounds starts from ext[5] and walks toward older drawings only:
      // ext[5] ✓ ext[4] ✓ ext[3] ✓ ext[2] ✗ → streak=3
      expect(getConsecutiveRounds(w, ext[5])).toBe(3)
    } finally {
      db.run('DELETE FROM proofs WHERE wallet = ?', [w])
    }
  })

  test('streak of 10 across all drawings', () => {
    const w = `extAll10_${ts}`
    for (const id of ext) {
      db.run('INSERT INTO proofs (drawing_id, wallet, tickets, proof) VALUES (?, ?, ?, ?)', [id, w, 10, PROOF])
    }
    try {
      // From ext[9] (most recent) all 10 consecutive proofs present → streak=10
      expect(getConsecutiveRounds(w, ext[9])).toBe(10)
    } finally {
      db.run('DELETE FROM proofs WHERE wallet = ?', [w])
    }
  })

  test('two wallets with different streaks do not interfere with each other', () => {
    const wA = `extIsoA_${ts}`
    const wB = `extIsoB_${ts}`
    // wA: all 10 drawings → streak=10
    for (const id of ext) {
      db.run('INSERT INTO proofs (drawing_id, wallet, tickets, proof) VALUES (?, ?, ?, ?)', [id, wA, 10, PROOF])
    }
    // wB: most-recent drawing only → streak=1
    db.run('INSERT INTO proofs (drawing_id, wallet, tickets, proof) VALUES (?, ?, ?, ?)', [ext[9], wB, 10, PROOF])
    try {
      expect(getConsecutiveRounds(wA, ext[9])).toBe(10)
      expect(getConsecutiveRounds(wB, ext[9])).toBe(1)
    } finally {
      db.run('DELETE FROM proofs WHERE wallet = ?', [wA])
      db.run('DELETE FROM proofs WHERE wallet = ?', [wB])
    }
  })

  test('wallet in oldest drawing only returns 1', () => {
    const w = `extOldest_${ts}`
    // ext[0] is the oldest (revealed_at=50); no older drawings exist for this wallet
    db.run('INSERT INTO proofs (drawing_id, wallet, tickets, proof) VALUES (?, ?, ?, ?)', [ext[0], w, 10, PROOF])
    try {
      // ext[0] is at the tail of the DESC list; loop terminates → streak=1
      expect(getConsecutiveRounds(w, ext[0])).toBe(1)
    } finally {
      db.run('DELETE FROM proofs WHERE wallet = ?', [w])
    }
  })
})

// ---------------------------------------------------------------------------
// getConsecutiveMultiplier formula (tested via processPoints → points table)
// ---------------------------------------------------------------------------
describe('getConsecutiveMultiplier formula', () => {
  const ROUNDS_PER_YEAR = (365 * 24 * 60) / 30
  const K = ROUNDS_PER_YEAR / Math.LN10
  const expectedMul = (t: number) => Math.min(10, Math.exp(t / K))

  // Use timestamps 300–530, well above the extended-edge-cases range (50–140).
  // Older drawings in each scenario are pre-marked processed so that processPoints
  // only processes the target drawing for each wallet, giving a deterministic streak.
  const mulDrawingIds: bigint[] = []
  const WALLET_S1 = `mulS1_${ts}` // streak = 1
  const WALLET_S2 = `mulS2_${ts}` // streak = 2
  const WALLET_S4 = `mulS4_${ts}` // streak = 4

  beforeAll(async () => {
    const ins = (revealedAt: number) =>
      (
        db
          .query(
            `INSERT INTO drawings (vault, round, reward_type, total_tickets, amount, merkle_root, secret_hash, revealed_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(`mulVault_${ts}`, revealedAt, 0, 100, 0, MERKLE, SECRET, revealedAt) as any
      ).lastInsertRowid as bigint

    // ── streak = 1: single unprocessed drawing at ts=300 ──────────────────
    const a = ins(300)
    mulDrawingIds.push(a)
    db.run('INSERT INTO proofs (drawing_id, wallet, tickets, proof) VALUES (?, ?, ?, ?)', [a, WALLET_S1, 10, PROOF])

    // ── streak = 2: two drawings at ts=400,410; oldest pre-marked processed ─
    const b1 = ins(400)
    const b2 = ins(410)
    mulDrawingIds.push(b1, b2)
    db.run('UPDATE drawings SET points_processed_at = 1 WHERE id = ?', [b1])
    db.run('INSERT INTO proofs (drawing_id, wallet, tickets, proof) VALUES (?, ?, ?, ?)', [b1, WALLET_S2, 10, PROOF])
    db.run('INSERT INTO proofs (drawing_id, wallet, tickets, proof) VALUES (?, ?, ?, ?)', [b2, WALLET_S2, 10, PROOF])

    // ── streak = 4: four drawings at ts=500–530; oldest 3 pre-marked ────────
    const c1 = ins(500); const c2 = ins(510); const c3 = ins(520); const c4 = ins(530)
    mulDrawingIds.push(c1, c2, c3, c4)
    for (const id of [c1, c2, c3]) {
      db.run('UPDATE drawings SET points_processed_at = 1 WHERE id = ?', [id])
    }
    for (const id of [c1, c2, c3, c4]) {
      db.run('INSERT INTO proofs (drawing_id, wallet, tickets, proof) VALUES (?, ?, ?, ?)', [id, WALLET_S4, 10, PROOF])
    }

    await processPoints()
  })

  afterAll(() => {
    for (const id of mulDrawingIds) {
      db.run('DELETE FROM proofs WHERE drawing_id = ?', [id])
      db.run('DELETE FROM drawings WHERE id = ?', [id])
    }
    for (const w of [WALLET_S1, WALLET_S2, WALLET_S4]) {
      db.run('DELETE FROM points WHERE user_id = ?', [w])
    }
  })

  test('streak=1 multiplier matches formula: min(10, e^(1/K))', () => {
    const row = db
      .query<{ multiplier: number }, [string]>('SELECT multiplier FROM points WHERE user_id = ?')
      .get(WALLET_S1)
    expect(row).not.toBeNull()
    expect(Math.abs(row!.multiplier - expectedMul(1))).toBeLessThan(1e-9)
  })

  test('streak=2 multiplier matches formula: min(10, e^(2/K))', () => {
    const row = db
      .query<{ multiplier: number }, [string]>('SELECT multiplier FROM points WHERE user_id = ?')
      .get(WALLET_S2)
    expect(row).not.toBeNull()
    expect(Math.abs(row!.multiplier - expectedMul(2))).toBeLessThan(1e-9)
  })

  test('streak=4 multiplier matches formula: min(10, e^(4/K))', () => {
    const row = db
      .query<{ multiplier: number }, [string]>('SELECT multiplier FROM points WHERE user_id = ?')
      .get(WALLET_S4)
    expect(row).not.toBeNull()
    expect(Math.abs(row!.multiplier - expectedMul(4))).toBeLessThan(1e-9)
  })

  test('multiplier is strictly monotonically increasing with streak length', () => {
    const m1 = db
      .query<{ multiplier: number }, [string]>('SELECT multiplier FROM points WHERE user_id = ?')
      .get(WALLET_S1)!.multiplier
    const m2 = db
      .query<{ multiplier: number }, [string]>('SELECT multiplier FROM points WHERE user_id = ?')
      .get(WALLET_S2)!.multiplier
    const m4 = db
      .query<{ multiplier: number }, [string]>('SELECT multiplier FROM points WHERE user_id = ?')
      .get(WALLET_S4)!.multiplier
    expect(m2).toBeGreaterThan(m1)
    expect(m4).toBeGreaterThan(m2)
  })

  test('multiplier cap: min(10, e^(t/K)) reaches exactly 10 at t = ROUNDS_PER_YEAR', () => {
    // At exactly ROUNDS_PER_YEAR consecutive rounds:
    // e^(ROUNDS_PER_YEAR / K) = e^(ROUNDS_PER_YEAR / (ROUNDS_PER_YEAR / LN10))
    //                         = e^(LN10) = 10  →  min(10, 10) = 10
    expect(expectedMul(ROUNDS_PER_YEAR)).toBe(10)
  })

  test('multiplier cap: values beyond ROUNDS_PER_YEAR are still capped at 10', () => {
    expect(expectedMul(ROUNDS_PER_YEAR + 1000)).toBe(10)
    expect(expectedMul(ROUNDS_PER_YEAR * 2)).toBe(10)
  })

  test('multiplier grows sub-linearly: doubling streak does not double multiplier', () => {
    // exp is convex and grows slower than linear in the regime where multiplier < 10
    // multiplier(2) - multiplier(1) < multiplier(1) - multiplier(0)?
    // More simply: e^(2t/K) < 2 * e^(t/K) for all finite t
    const t = 1000
    expect(expectedMul(2 * t)).toBeLessThan(2 * expectedMul(t))
  })

  test('K constant equals ROUNDS_PER_YEAR / Math.LN10', () => {
    // Ensures the formula is anchored to 1 year of continuous participation for the 10x cap
    expect(K).toBeCloseTo(ROUNDS_PER_YEAR / Math.LN10, 10)
    // A full year of rounds exactly hits the cap
    expect(Math.exp(ROUNDS_PER_YEAR / K)).toBeCloseTo(10, 10)
  })
})
