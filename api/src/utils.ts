import { createHash } from 'crypto'
import { db, type DrawingRow } from './db'
import { connection } from './consts'
import { VaultAccount } from 'ts-sdk'

export function toHexOrNull(buf: Uint8Array | null): string | null {
  return buf ? Buffer.from(buf).toString('hex') : null
}

export function formatDrawing(d: DrawingRow) {
  return {
    id: d.id,
    vault: d.vault,
    mint: d.mint,
    round: d.round,
    reward_type: d.reward_type,
    total_tickets: d.total_tickets,
    winner_index: d.winner_index,
    winner_wallet: d.winner_wallet,
    commit_tx: d.commit_tx,
    reveal_tx: d.reveal_tx,
    amount: d.amount,
    merkle_root: toHexOrNull(d.merkle_root),
    secret_seed: toHexOrNull(d.secret_seed),
    secret_hash: toHexOrNull(d.secret_hash),
    vrf_seed: toHexOrNull(d.vrf_seed),
    request: d.request,
    snapshot_at: d.snapshot_at ?? d.committed_at,
    revealed_at: d.revealed_at,
    apr: d.apr
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function xorBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(32)
  for (let i = 0; i < 32; i++) out[i] = a[i] ^ b[i]
  return out
}

export function sha256(data: Uint8Array): Buffer {
  return createHash('sha256').update(data).digest()
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function retryWithSleep<T>(
  fn: (attempt: number) => Promise<T | null>,
  maxAttempts: number,
  delayMs: number,
  tag: string = 'retryWithSleep'
): Promise<T | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const result = await fn(attempt)
      if (result !== null) return result
    } catch (err) {
      console.error(
        { tag, attempt: attempt + 1, maxAttempts, err },
        'retry attempt failed'
      )
    }

    if (attempt < maxAttempts - 1) {
      await sleep(delayMs)
    }
  }

  return null
}

export async function waitForFinalizedSignature(
  signature: string,
  maxAttempts = 60
): Promise<void> {
  const finalized = await retryWithSleep<boolean>(
    async () => {
      const status = (
        await connection.getSignatureStatuses([signature], {
          searchTransactionHistory: true
        })
      ).value[0]

      if (status?.err) {
        throw new Error(`commit tx failed: ${JSON.stringify(status.err)}`)
      }

      if (
        status &&
        (status.confirmationStatus === 'finalized' ||
          status.confirmations === null)
      ) {
        return true
      }
      return null
    },
    maxAttempts,
    1000
  )

  if (!finalized) {
    throw new Error(`commit tx not finalized after ${maxAttempts} attempts`)
  }
}

export function determineRewardType(v: VaultAccount): number {
  // Check tiers from the end to the beginning and pick the first due one.
  const now = BigInt(Math.floor(Date.now() / 1000))

  for (let i = v.distributionTiers.length - 1; i >= 0; i--) {
    const tier = v.distributionTiers[i]
    if (tier.rewardShare <= 0n || tier.interval <= 0n) continue
    if (now >= tier.distributedAt + tier.interval) {
      return i
    }
  }

  return 0
}

export function getLatestDrawing(vaultPda: string): DrawingRow | null {
  return db
    .query<DrawingRow, [string]>(
      'SELECT * FROM drawings WHERE vault = ? ORDER BY round DESC LIMIT 1'
    )
    .get(vaultPda)
}

export function getDrawingById(id: bigint): DrawingRow | null {
  return (
    db.query<DrawingRow, [bigint]>('SELECT * FROM drawings WHERE id = ?').get(id) ??
    null
  )
}
