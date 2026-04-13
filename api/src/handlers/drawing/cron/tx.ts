import { PublicKey, Transaction } from '@solana/web3.js'
import { getAssociatedTokenAddressSync } from '@solana/spl-token'
import {
  networkStateAccountAddress,
  randomnessAccountAddress
} from '@orao-network/solana-vrf'
import {
  signAndSend,
  getLendingAccountsForMint,
  ROUND_TIME
} from 'ts-sdk'
import type { VaultAccount } from 'ts-sdk'
import { connection, vault, vrfAuthority, orao } from '../../../consts'
import { db, type DrawingRow, type ProofRow } from '../../../db'
import { getPrice, maybeDevnet } from '../../stats/cron'
import { KissRng } from '../kiss-rng'
import {
  retryWithSleep,
  sleep,
  waitForFinalizedSignature,
  xorBytes
} from '../../../utils'
import { logError, logInfo, logWarn } from './logger'

const SECONDS_PER_DAY = 86_400
const ROUND_SECONDS = ROUND_TIME * 60

type SqlInt = number | bigint

interface WinnerTicketsRow {
  tickets: SqlInt
}

interface PrevSnapshotRow {
  prev_snapshot_at: SqlInt | null
}

function toFiniteNumber(value: SqlInt | null | undefined): number | null {
  if (value === null || value === undefined) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function computeDrawingAprValue(
  drawing: DrawingRow,
  winnerWallet: string
): number | null {
  const winnerTickets = db
    .query<WinnerTicketsRow, [bigint, string]>(
      'SELECT tickets FROM proofs WHERE drawing_id = ? AND wallet = ? LIMIT 1'
    )
    .get(drawing.id, winnerWallet)
  const effectiveStake = toFiniteNumber(winnerTickets?.tickets)
  if (effectiveStake === null || effectiveStake <= 0) return null

  const winSnapshotTs = toFiniteNumber(
    (drawing.snapshot_at ?? drawing.committed_at) as unknown as SqlInt
  )
  if (winSnapshotTs === null) return null

  const prevSnapshot = db
    .query<PrevSnapshotRow, [string, bigint]>(
      `SELECT COALESCE(d.snapshot_at, d.committed_at) AS prev_snapshot_at
         FROM drawings d
        WHERE d.vault = ? AND d.id < ? AND d.revealed_at IS NOT NULL
        ORDER BY d.id DESC
        LIMIT 1`
    )
    .get(drawing.vault, drawing.id)
  const prevSnapshotTs = toFiniteNumber(prevSnapshot?.prev_snapshot_at)

  let roundSeconds: number
  if (prevSnapshotTs !== null) {
    roundSeconds = winSnapshotTs - prevSnapshotTs
    if (roundSeconds <= 0) roundSeconds = ROUND_SECONDS
  } else {
    roundSeconds = ROUND_SECONDS
  }
  const daysStaked = roundSeconds / SECONDS_PER_DAY

  const rewardRaw = toFiniteNumber(drawing.amount as unknown as SqlInt)
  if (rewardRaw === null || rewardRaw < 0) return null

  let reward = rewardRaw
  if (drawing.mint) {
    try {
      const lending = getLendingAccountsForMint(new PublicKey(drawing.mint))
      if (lending) {
        reward = rewardRaw / 10 ** lending.decimal
      }
    } catch {
      // Keep raw reward when mint cannot be parsed.
    }
  }

  const apr = (reward / effectiveStake) * (365 / daysStaked) * 100
  return Number.isFinite(apr) ? apr : null
}

export async function commitDrawing(
  drawing: DrawingRow,
  vaultIndex: number,
  vaultAccount: VaultAccount,
  rewardType: number
): Promise<DrawingRow | null> {
  logInfo(
    `commit vaultIndex=${vaultIndex} round=${String(drawing.round)} rewardType=${rewardType}`
  )

  const merkleRoot = new Uint8Array(drawing.merkle_root!)
  const secretHash = new Uint8Array(drawing.secret_hash!)

  const vrfSeed = xorBytes(merkleRoot, secretHash)

  const mint = vaultAccount.mint
  const lendingAccounts = getLendingAccountsForMint(mint)
  if (!lendingAccounts) {
    logError('no lending accounts configured for mint; skipping vault', {
      mint: mint.toBase58()
    })
    return null
  }

  const vaultPda = vault.fetcher.getVaultAddress(vaultIndex)[0]
  const vaultFTokenAccount = getAssociatedTokenAddressSync(
    lendingAccounts.fTokenMint,
    vaultPda,
    true
  )

  const networkState = networkStateAccountAddress()
  const networkStateAcc = await orao.getNetworkState()
  const request = randomnessAccountAddress(Buffer.from(vrfSeed))

  const commitIx = await vault.commitIx({
    vrfAuthority: vrfAuthority.publicKey,
    vaultIndex,
    round: Number(drawing.round),
    rewardType,
    tickets: drawing.total_tickets,
    merkleRoot: Array.from(merkleRoot),
    secretHash: Array.from(secretHash),
    mint,
    vaultFTokenAccount,
    fTokenMint: lendingAccounts.fTokenMint,
    lending: lendingAccounts.lending,
    treasury: networkStateAcc.config.treasury,
    networkState,
    request
  })

  const sig = await signAndSend(connection, new Transaction().add(commitIx), [
    vrfAuthority
  ])
  logInfo(`commit transaction submitted signature=${sig}`)

  await waitForFinalizedSignature(sig, 60)

  const reward = await vault.fetcher.getReward(vaultPda, Number(drawing.round))
  const mintPrice = getPrice(maybeDevnet(mint.toBase58()))
  const amountUsd =
    mintPrice != null
      ? (Number(reward.amount) / 10 ** lendingAccounts.decimal) * mintPrice
      : null

  db.query(
    `UPDATE drawings
        SET reward_type = ?,
            vrf_seed = ?,
            amount = ?,
            amount_usd = ?,
            commit_tx = ?,
            request = ?,
            committed_at = unixepoch()
      WHERE id = ?`
  ).run(
    rewardType,
    Buffer.from(vrfSeed),
    reward.amount,
    amountUsd,
    sig,
    request.toBase58(),
    drawing.id
  )

  logInfo(`commit saved drawingId=${String(drawing.id)}`)

  return (
    db
      .query<DrawingRow, [bigint]>('SELECT * FROM drawings WHERE id = ?')
      .get(drawing.id) ?? null
  )
}

export async function tryRevealAndComplete(
  drawing: DrawingRow,
  vaultIndex: number,
  maxAttempts = 180
): Promise<void> {
  logInfo(
    `checking VRF vaultIndex=${vaultIndex} round=${String(drawing.round)}`
  )

  const vrfSeed = Buffer.from(drawing.vrf_seed!)

  const fulfilledRandomness = await retryWithSleep<Uint8Array>(
    async (attempt) => {
      const randomnessData = await orao.getRandomness(vrfSeed, 'finalized')
      const fulfilled = randomnessData.getFulfilledRandomness()
      if (fulfilled) {
        return new Uint8Array(fulfilled)
      }
      logInfo(
        `VRF not fulfilled yet attempt=${attempt + 1} maxAttempts=${maxAttempts}`
      )
      return null
    },
    maxAttempts,
    1000
  )

  if (fulfilledRandomness === null) {
    logInfo(
      `VRF not fulfilled after max attempts=${maxAttempts}, will retry next tick`
    )
    return
  }

  logInfo(`VRF fulfilled, computing winner drawingId=${String(drawing.id)}`)

  const onchainRandomness = fulfilledRandomness.subarray(0, 32)
  const secretSeed = new Uint8Array(drawing.secret_seed!)
  const combined = xorBytes(secretSeed, onchainRandomness)

  const rng = KissRng.fromSeed(combined)
  const rawValue = rng.nextU64()
  const winnerIndex = rawValue % drawing.total_tickets

  const proofs = db
    .query<ProofRow, [bigint]>(
      'SELECT wallet, tickets FROM proofs WHERE drawing_id = ? ORDER BY id'
    )
    .all(drawing.id)

  let cumulative = 0n
  let winnerWallet: string | null = null
  for (const proof of proofs) {
    cumulative += proof.tickets
    if (winnerIndex < cumulative) {
      winnerWallet = proof.wallet
      break
    }
  }

  if (!winnerWallet) {
    logError('could not resolve winner', { winnerIndex: String(winnerIndex) })
    return
  }

  const request = randomnessAccountAddress(vrfSeed)
  const revealIx = await vault.revealIx({
    authority: vrfAuthority.publicKey,
    vaultIndex,
    round: Number(drawing.round),
    secretSeed: Array.from(secretSeed),
    request,
    winner: new PublicKey(winnerWallet)
  })

  const tx = new Transaction().add(revealIx)

  try {
    const sig = await signAndSend(connection, tx, [vrfAuthority])
    logInfo(`reveal transaction submitted signature=${sig}`)
    await waitForFinalizedSignature(sig, 60)

    const apr = computeDrawingAprValue(drawing, winnerWallet)

    db.query(
      `UPDATE drawings
          SET winner_index = ?,
              winner_wallet = ?,
              randomness = ?,
              reveal_tx = ?,
              revealed_at = unixepoch(),
              apr = ?
        WHERE id = ?`
    ).run(
      winnerIndex,
      winnerWallet,
      Buffer.from(fulfilledRandomness),
      sig,
      apr,
      drawing.id
    )

    logInfo(`drawing completed drawingId=${String(drawing.id)}`)
    await sleep(2000)
  } catch (err: any) {
    const isAlreadyClaimed =
      err?.logs?.some((line: string) => line.includes('AlreadyClaimed')) ||
      err?.message?.includes('6010')

    if (!isAlreadyClaimed) throw err

    logWarn(
      `round already claimed onchain, recovering DB state drawingId=${String(drawing.id)}`
    )

    const vaultPda = vault.fetcher.getVaultAddress(vaultIndex)[0]
    const reward = await vault.fetcher.getReward(vaultPda, Number(drawing.round))
    const recoveredWinner = reward.claimer.toBase58()
    const apr = computeDrawingAprValue(drawing, recoveredWinner)

    db.query(
      `UPDATE drawings
          SET winner_index = ?,
              winner_wallet = ?,
              randomness = ?,
              revealed_at = unixepoch(),
              apr = ?
        WHERE id = ?`
    ).run(
      reward.winnerIndex,
      recoveredWinner,
      Buffer.from(fulfilledRandomness),
      apr,
      drawing.id
    )

    logWarn(
      `recovered drawing drawingId=${String(drawing.id)} winner=${recoveredWinner}`
    )
  }
}
