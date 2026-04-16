import Elysia, { t } from 'elysia'
import { db } from '../../db'
import type { ReferralRow } from '../../db'
import nacl from 'tweetnacl'
import { PublicKey, Transaction } from '@solana/web3.js'
import bs58 from 'bs58'
import { getAssociatedTokenAddressSync } from '@solana/spl-token'
import {
  getLendingAccountsForMint,
  getReferralMessage,
  getCreateReferralMessage,
  MIN_TICKETS_FOR_REFERRAL
} from 'ts-sdk'
import { connection, vault } from '../../consts'

async function getUserTotalTickets(walletAddress: string): Promise<bigint> {
  const walletPk = new PublicKey(walletAddress)
  const vaults = await vault.fetcher.getAllVaults()
  let total = 0n
  for (const v of vaults) {
    const lendingAccounts = getLendingAccountsForMint(v.mint)
    if (!lendingAccounts) continue
    const denominator = 10n ** BigInt(lendingAccounts.decimal)
    const ata = getAssociatedTokenAddressSync(v.pMint, walletPk, false)
    try {
      const bal = await connection.getTokenAccountBalance(ata)
      const rawAmount = BigInt(bal.value.amount)
      total += rawAmount / denominator
    } catch {
      // ATA doesn't exist = no deposit in this vault
    }
  }
  return total
}

function verifySignature(
  wallet: string,
  message: string,
  signature: string
): boolean {
  try {
    const messageBytes = new TextEncoder().encode(message)
    const signatureBytes = bs58.decode(signature)
    const publicKeyBytes = new PublicKey(wallet).toBytes()
    return nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      publicKeyBytes
    )
  } catch {
    return false
  }
}

const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr')

function verifyLedgerSignature(
  wallet: string,
  expectedMessage: string,
  serializedTx: string
): boolean {
  try {
    const txBytes = bs58.decode(serializedTx)
    console.log('[ledger-verify] txBytes length:', txBytes.length)

    const tx = Transaction.from(txBytes)
    console.log('[ledger-verify] instructions:', tx.instructions.length)
    console.log('[ledger-verify] signatures count:', tx.signatures.length)

    const memoIx = tx.instructions.find(ix => ix.programId.equals(MEMO_PROGRAM_ID))
    console.log('[ledger-verify] all programIds:', tx.instructions.map(ix => ix.programId.toBase58()))

    if (!memoIx) {
      console.log('[ledger-verify] FAIL: no memo instruction found')
      return false
    }

    const ix = memoIx
    const memoText = ix.data.toString('utf-8')
    console.log('[ledger-verify] memo:', memoText)
    console.log('[ledger-verify] expected:', expectedMessage)

    if (memoText !== expectedMessage) {
      console.log('[ledger-verify] FAIL: memo mismatch')
      return false
    }

    const walletPk = new PublicKey(wallet)
    console.log('[ledger-verify] feePayer:', tx.feePayer?.toBase58())
    console.log('[ledger-verify] wallet:', wallet)

    if (!tx.feePayer || !tx.feePayer.equals(walletPk)) {
      console.log('[ledger-verify] FAIL: feePayer mismatch')
      return false
    }

    const sig = tx.signatures[0]?.signature
    console.log('[ledger-verify] has signature:', !!sig, 'length:', sig?.length)

    if (!sig) {
      console.log('[ledger-verify] FAIL: no signature')
      return false
    }

    const msgBytes = tx.serializeMessage()
    console.log('[ledger-verify] message bytes length:', msgBytes.length)

    const valid = nacl.sign.detached.verify(
      msgBytes,
      sig,
      walletPk.toBytes()
    )
    console.log('[ledger-verify] nacl verify result:', valid)
    return valid
  } catch (e) {
    console.log('[ledger-verify] EXCEPTION:', e)
    return false
  }
}

// GET  /api/referrals?wallet=xxx  → { code, referredBy, referrals: string[] }
// POST /api/referrals              → create referral code  { wallet, code, signature }
// POST /api/referrals/use          → use a referral code   { wallet, code, signature }
export const referralsHandler = new Elysia({
  prefix: '/api/referrals',
  name: 'referrals'
})
  .get(
    '/',
    ({ query }) => {
      const { wallet } = query
      const row = db
        .query<ReferralRow, [string]>(
          'SELECT * FROM referrals WHERE user_id = ?'
        )
        .get(wallet)

      const referrals = db
        .query<{ user_id: string }, [string]>(
          'SELECT user_id FROM referrals WHERE referred_by = ?'
        )
        .all(row?.code ?? '')

      return {
        code: row?.code ?? null,
        referredBy: row?.referred_by ?? null,
        referrals: referrals.map((r) => r.user_id)
      }
    },
    { query: t.Object({ wallet: t.String() }) }
  )

  .post(
    '/',
    async ({ body, set }) => {
      const { wallet, code, signature } = body
      const expectedMessage = getCreateReferralMessage(code, wallet)
      const isValid = body.ledger
        ? verifyLedgerSignature(wallet, expectedMessage, signature)
        : verifySignature(wallet, expectedMessage, signature)

      if (!isValid) {
        set.status = 400
        return { error: 'invalid signature' }
      }

      const existing = db
        .query<ReferralRow, [string]>(
          'SELECT * FROM referrals WHERE user_id = ?'
        )
        .get(wallet)
      if (existing?.code) {
        set.status = 400
        return { error: 'wallet already has a referral code' }
      }

      const takenCode = db
        .query<{ code: string }, [string]>(
          'SELECT code FROM referrals WHERE code = ?'
        )
        .get(code)
      if (takenCode) {
        set.status = 400
        return { error: 'referral code already taken' }
      }

      if (process.env.NODE_ENV !== 'test') {
        const tickets = await getUserTotalTickets(wallet)
        if (tickets < MIN_TICKETS_FOR_REFERRAL) {
          set.status = 400
          return {
            error: `insufficient tickets: need ${MIN_TICKETS_FOR_REFERRAL}, have ${tickets}`
          }
        }
      }

      if (existing) {
        db.run('UPDATE referrals SET code = ? WHERE user_id = ?', [
          code,
          wallet
        ])
      } else {
        db.run('INSERT INTO referrals (user_id, code) VALUES (?, ?)', [
          wallet,
          code
        ])
      }
      return { success: true }
    },
    {
      body: t.Object({
        wallet: t.String(),
        code: t.String(),
        signature: t.String(),
        ledger: t.Optional(t.Boolean())
      })
    }
  )

  .post(
    '/use',
    ({ body, set }) => {
      const { wallet, code, signature } = body
      const expectedMessage = getReferralMessage(code, wallet)
      const isValid = body.ledger
        ? verifyLedgerSignature(wallet, expectedMessage, signature)
        : verifySignature(wallet, expectedMessage, signature)

      if (!isValid) {
        set.status = 400
        return { error: 'invalid signature' }
      }

      const codeRow = db
        .query<ReferralRow, [string]>('SELECT * FROM referrals WHERE code = ?')
        .get(code)
      if (!codeRow) {
        set.status = 400
        return { error: 'referral code not found' }
      }

      if (codeRow.user_id === wallet) {
        set.status = 400
        return { error: 'cannot use your own referral code' }
      }

      const userRow = db
        .query<ReferralRow, [string]>(
          'SELECT * FROM referrals WHERE user_id = ?'
        )
        .get(wallet)
      if (userRow) {
        if (userRow.referred_by !== null) {
          set.status = 400
          return { error: 'already used a referral code' }
        }
        db.run('UPDATE referrals SET referred_by = ? WHERE user_id = ?', [
          code,
          wallet
        ])
      } else {
        db.run(
          'INSERT INTO referrals (user_id, referred_by) VALUES (?, ?)',
          [wallet, code]
        )
      }
      return { success: true }
    },
    {
      body: t.Object({
        wallet: t.String(),
        code: t.String(),
        signature: t.String(),
        ledger: t.Optional(t.Boolean())
      })
    }
  )
