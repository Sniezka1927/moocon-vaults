import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { Elysia } from 'elysia'
import { db } from '../src/db'
import { referralsHandler } from '../src/handlers/referrals'
import nacl from 'tweetnacl'
import bs58 from 'bs58'
import { getCreateReferralMessage, getReferralMessage } from 'ts-sdk'

const app = new Elysia().use(referralsHandler)

// --- Keypairs ---
const kpOwner = nacl.sign.keyPair()
const kpUser = nacl.sign.keyPair()
const kpUsed = nacl.sign.keyPair()
const kpFresh = nacl.sign.keyPair() // no DB entry — used for POST create success
const kpNoCode = nacl.sign.keyPair() // no DB entry — used for "create before use" test
const kpWrongKey = nacl.sign.keyPair() // different keypair for wrong-signature tests

const walletOwner = bs58.encode(kpOwner.publicKey)
const walletUser = bs58.encode(kpUser.publicKey)
const walletUsed = bs58.encode(kpUsed.publicKey)
const walletFresh = bs58.encode(kpFresh.publicKey)
const walletNoCode = bs58.encode(kpNoCode.publicKey)

// Unique codes per test run to avoid collisions
const ts = Date.now()
const CODE_OWNER = `REF_OWNER_${ts}`
const CODE_USER = `REF_USER_${ts}`
const CODE_USED = `REF_USED_${ts}`
const CODE_FRESH = `REF_FRESH_${ts}`

function signMessage(kp: nacl.SignKeyPair, msg: string): string {
  return bs58.encode(
    nacl.sign.detached(new TextEncoder().encode(msg), kp.secretKey)
  )
}

function signUse(kp: nacl.SignKeyPair, code: string, wallet: string): string {
  return signMessage(kp, getReferralMessage(code, wallet))
}

function signCreate(
  kp: nacl.SignKeyPair,
  code: string,
  wallet: string
): string {
  return signMessage(kp, getCreateReferralMessage(code, wallet))
}

beforeAll(() => {
  db.run('INSERT INTO referrals (user_id, code) VALUES (?, ?)', [
    walletOwner,
    CODE_OWNER
  ])
  db.run('INSERT INTO referrals (user_id, code) VALUES (?, ?)', [
    walletUser,
    CODE_USER
  ])
  db.run(
    'INSERT INTO referrals (user_id, code, referred_by) VALUES (?, ?, ?)',
    [walletUsed, CODE_USED, CODE_OWNER]
  )
})

afterAll(() => {
  for (const wallet of [walletOwner, walletUser, walletUsed, walletFresh]) {
    db.run('DELETE FROM referrals WHERE user_id = ?', [wallet])
  }
})

// ---------------------------------------------------------------------------
// GET /api/referrals?wallet=
// ---------------------------------------------------------------------------
describe('GET /api/referrals', () => {
  test('missing wallet param returns validation error', async () => {
    const res = await app.handle(new Request('http://localhost/api/referrals'))
    expect(res.status).toBe(422)
  })

  test('unknown wallet returns nulls and empty referrals', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/referrals?wallet=unknownWalletXYZ')
    )
    const body = await res.json()
    expect(body.code).toBeNull()
    expect(body.referredBy).toBeNull()
    expect(body.referrals).toEqual([])
  })

  test('known wallet returns code and referrals list', async () => {
    const res = await app.handle(
      new Request(`http://localhost/api/referrals?wallet=${walletOwner}`)
    )
    const body = await res.json()
    expect(body.code).toBe(CODE_OWNER)
    expect(body.referredBy).toBeNull()
    // walletUsed used CODE_OWNER
    expect(body.referrals).toContain(walletUsed)
  })

  test('wallet with referred_by set returns it', async () => {
    const res = await app.handle(
      new Request(`http://localhost/api/referrals?wallet=${walletUsed}`)
    )
    const body = await res.json()
    expect(body.code).toBe(CODE_USED)
    expect(body.referredBy).toBe(CODE_OWNER)
  })
})

// ---------------------------------------------------------------------------
// POST /api/referrals — create referral code
// ---------------------------------------------------------------------------
describe('POST /api/referrals — create code', () => {
  test('missing body fields returns validation error', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: walletFresh })
      })
    )
    expect(res.status).toBe(422)
  })

  test('invalid signature (garbage) returns 400', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: walletFresh,
          code: CODE_FRESH,
          signature: 'badsig'
        })
      })
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('invalid signature')
  })

  test('signature from wrong key returns 400', async () => {
    // Sign with kpWrongKey but claim to be walletFresh
    const sig = signCreate(kpWrongKey, CODE_FRESH, walletFresh)
    const res = await app.handle(
      new Request('http://localhost/api/referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: walletFresh,
          code: CODE_FRESH,
          signature: sig
        })
      })
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('invalid signature')
  })

  test('invalid wallet address returns 400', async () => {
    const sig = signCreate(kpFresh, CODE_FRESH, 'notavalidwallet')
    const res = await app.handle(
      new Request('http://localhost/api/referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: 'notavalidwallet',
          code: CODE_FRESH,
          signature: sig
        })
      })
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('invalid signature')
  })

  test('valid signature creates referral code', async () => {
    const sig = signCreate(kpFresh, CODE_FRESH, walletFresh)
    const res = await app.handle(
      new Request('http://localhost/api/referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: walletFresh,
          code: CODE_FRESH,
          signature: sig
        })
      })
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  test('duplicate wallet returns 400', async () => {
    const sig = signCreate(kpFresh, CODE_FRESH, walletFresh)
    const res = await app.handle(
      new Request('http://localhost/api/referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: walletFresh,
          code: CODE_FRESH,
          signature: sig
        })
      })
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('wallet already has a referral code')
  })

  test('duplicate code returns 400', async () => {
    const kpOther = nacl.sign.keyPair()
    const walletOther = bs58.encode(kpOther.publicKey)
    const sig = signCreate(kpOther, CODE_OWNER, walletOther) // CODE_OWNER already taken
    const res = await app.handle(
      new Request('http://localhost/api/referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: walletOther,
          code: CODE_OWNER,
          signature: sig
        })
      })
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('referral code already taken')
  })
})

// ---------------------------------------------------------------------------
// POST /api/referrals/use — use a referral code
// ---------------------------------------------------------------------------
describe('POST /api/referrals/use — use code', () => {
  test('missing body fields returns validation error', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/referrals/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: walletUser })
      })
    )
    expect(res.status).toBe(422)
  })

  test('invalid signature (garbage) returns 400', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/referrals/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: walletUser,
          code: CODE_OWNER,
          signature: 'badsig'
        })
      })
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('invalid signature')
  })

  test('signature from wrong key returns 400', async () => {
    const sig = signUse(kpWrongKey, CODE_OWNER, walletUser)
    const res = await app.handle(
      new Request('http://localhost/api/referrals/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: walletUser,
          code: CODE_OWNER,
          signature: sig
        })
      })
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('invalid signature')
  })

  test('code not found returns 400', async () => {
    const fakeCode = `NONEXISTENT_${ts}`
    const sig = signUse(kpUser, fakeCode, walletUser)
    const res = await app.handle(
      new Request('http://localhost/api/referrals/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: walletUser,
          code: fakeCode,
          signature: sig
        })
      })
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('referral code not found')
  })

  test('own code returns 400', async () => {
    const sig = signUse(kpOwner, CODE_OWNER, walletOwner)
    const res = await app.handle(
      new Request('http://localhost/api/referrals/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: walletOwner,
          code: CODE_OWNER,
          signature: sig
        })
      })
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('cannot use your own referral code')
  })

  test('no own code yet returns 400', async () => {
    const sig = signUse(kpNoCode, CODE_OWNER, walletNoCode)
    const res = await app.handle(
      new Request('http://localhost/api/referrals/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: walletNoCode,
          code: CODE_OWNER,
          signature: sig
        })
      })
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('create your own referral code before using one')
  })

  test('already used a code returns 400', async () => {
    const sig = signUse(kpUsed, CODE_USER, walletUsed) // walletUsed already has referred_by set
    const res = await app.handle(
      new Request('http://localhost/api/referrals/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: walletUsed,
          code: CODE_USER,
          signature: sig
        })
      })
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('already used a referral code')
  })

  test('valid use returns success and sets referred_by', async () => {
    // walletUser has CODE_USER, no referredBy — use CODE_OWNER
    const sig = signUse(kpUser, CODE_OWNER, walletUser)
    const res = await app.handle(
      new Request('http://localhost/api/referrals/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: walletUser,
          code: CODE_OWNER,
          signature: sig
        })
      })
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)

    // Verify DB updated
    const row = db
      .query<{ referred_by: string | null }, [string]>(
        'SELECT referred_by FROM referrals WHERE user_id = ?'
      )
      .get(walletUser)
    expect(row?.referred_by).toBe(CODE_OWNER)
  })

  test('GET referrals list reflects new referral after use', async () => {
    // walletUser just used CODE_OWNER, so walletOwner's referrals now includes walletUser
    const res = await app.handle(
      new Request(`http://localhost/api/referrals?wallet=${walletOwner}`)
    )
    const body = await res.json()
    expect(body.referrals).toContain(walletUser)
    expect(body.referrals).toContain(walletUsed)
    expect(body.referrals).toHaveLength(2)
  })

  test('idempotent: second use attempt returns already-used error', async () => {
    const sig = signUse(kpUser, CODE_USED, walletUser) // try using another code
    const res = await app.handle(
      new Request('http://localhost/api/referrals/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: walletUser,
          code: CODE_USED,
          signature: sig
        })
      })
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('already used a referral code')
  })
})
