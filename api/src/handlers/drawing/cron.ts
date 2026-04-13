import { PublicKey, Transaction } from '@solana/web3.js'
import { getAssociatedTokenAddressSync } from '@solana/spl-token'
import {
  networkStateAccountAddress,
  randomnessAccountAddress
} from '@orao-network/solana-vrf'
import {
  Leaf,
  MerkleTree,
  signAndSend,
  getLendingAccountsForMint
} from 'ts-sdk'
import type { VaultAccount } from 'ts-sdk'
import { connection, vault, vrfAuthority, orao } from '../../consts'
import { db } from '../../db'
import { getPrice, maybeDevnet } from '../stats/cron'
import { KissRng } from './kiss-rng'
import type { DrawingRow, ProofRow } from '../../db'
import {
  determineRewardType,
  getLatestDrawing,
  retryWithSleep,
  sha256,
  sleep,
  waitForFinalizedSignature,
  xorBytes
} from '../../utils'
import { ROUND_TIME } from 'ts-sdk'

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

async function takeSnapshot(
  vaultIndex: number,
  vaultPda: PublicKey,
  v: VaultAccount
) {
  const round = v.currentRound
  const rewardType = determineRewardType(v)

  console.log(
    `snapshot vaultIndex=${vaultIndex} round=${String(round)} rewardType=${rewardType}`
  )

  const holders = await vault.fetcher.getEligibleWallets(v.pMint)
  if (holders.length === 0) {
    console.log(
      `no holders, skipping vaultIndex=${vaultIndex} round=${String(round)}`
    )
    return
  }

  const denominator = 10n ** BigInt(getLendingAccountsForMint(v.mint)!.decimal)

  const entries = holders
    .map((h) => ({
      wallet: h.wallet.toBase58(),
      tickets: String(h.amount / denominator)
    }))
    .filter((e) => BigInt(e.tickets) > 0n)

  if (entries.length === 0) {
    console.log(
      `no tickets, skipping vaultIndex=${vaultIndex} round=${String(round)}`
    )
    return
  }

  const initialSnapshot = JSON.stringify(entries)

  const result = db
    .query(
      `INSERT INTO drawings (
        vault, mint, round, reward_type, total_tickets, amount,
        initial_snapshot, snapshot_at, committed_at
      )
      VALUES (?, ?, ?, ?, 0, 0, ?, unixepoch(), 0)`
    )
    .run(
      vaultPda.toBase58(),
      v.mint.toBase58(),
      round,
      rewardType,
      initialSnapshot
    )

  const drawingId = (result as any).lastInsertRowid
  console.log(
    `initial snapshot saved drawingId=${String(drawingId)} holders=${entries.length}`
  )
}

async function finalizeSnapshot(
  drawing: DrawingRow,
  vaultIndex: number,
  v: VaultAccount
): Promise<boolean> {
  console.log(
    `finalizing snapshot drawingId=${String(drawing.id)} round=${String(drawing.round)}`
  )

  const initialEntries: { wallet: string; tickets: string }[] = JSON.parse(
    drawing.initial_snapshot!
  )
  const initialMap = new Map(
    initialEntries.map((e) => [e.wallet, BigInt(e.tickets)])
  )

  const holders = await vault.fetcher.getEligibleWallets(v.pMint)
  const denominator = 10n ** BigInt(getLendingAccountsForMint(v.mint)!.decimal)

  // Intersect: only wallets in both snapshots, use min tickets
  const leaves: Leaf[] = []
  for (const h of holders) {
    const wallet = h.wallet.toBase58()
    const currentTickets = h.amount / denominator
    const initialTickets = initialMap.get(wallet)
    if (
      initialTickets === undefined ||
      initialTickets <= 0n ||
      currentTickets <= 0n
    )
      continue
    leaves.push(
      new Leaf(
        wallet,
        currentTickets < initialTickets ? currentTickets : initialTickets
      )
    )
  }

  leaves.sort((a, b) => {
    const aKey =
      typeof a.address === 'string' ? a.address : a.address.toBase58()
    const bKey =
      typeof b.address === 'string' ? b.address : b.address.toBase58()
    return aKey.localeCompare(bKey)
  })

  if (leaves.length === 0) {
    console.log(
      `no eligible holders after intersection, drawingId=${String(drawing.id)}`
    )
    return false
  }

  const totalTickets = leaves.reduce((sum, l) => sum + l.tickets, 0n)

  const secretSeed = crypto.getRandomValues(new Uint8Array(32))
  const secretHash = sha256(secretSeed)

  const tree = new MerkleTree(Leaf.toBufferArray(leaves))
  const merkleRoot = Buffer.from(tree.root)

  db.query(
    `UPDATE drawings
       SET merkle_root = ?, secret_seed = ?, secret_hash = ?, total_tickets = ?
     WHERE id = ?`
  ).run(
    merkleRoot,
    Buffer.from(secretSeed),
    secretHash,
    totalTickets,
    drawing.id
  )

  const insertProof = db.query(
    'INSERT INTO proofs (drawing_id, wallet, tickets, proof) VALUES (?, ?, ?, ?)'
  )
  for (const leaf of leaves) {
    const walletStr =
      typeof leaf.address === 'string' ? leaf.address : leaf.address.toBase58()
    const proof = tree.prove(leaf.toBuffer())
    if (!proof) continue
    insertProof.run(drawing.id, walletStr, leaf.tickets, Buffer.from(proof))
  }

  console.log(
    `snapshot finalized drawingId=${String(drawing.id)} initial=${initialEntries.length} final=${
      leaves.length
    } totalTickets=${String(totalTickets)}`
  )
  return true
}

async function commitDrawing(
  drawing: DrawingRow,
  vaultIndex: number,
  vaultAccount: VaultAccount
): Promise<DrawingRow | null> {
  console.log(`commit vaultIndex=${vaultIndex} round=${String(drawing.round)}`)

  const merkleRoot = new Uint8Array(drawing.merkle_root!)
  const secretHash = new Uint8Array(drawing.secret_hash!)

  // vrfSeed = merkleRoot XOR secretHash (matches onchain computation)
  const vrfSeed = xorBytes(merkleRoot, secretHash)

  const mint = vaultAccount.mint
  const lendingAccounts = getLendingAccountsForMint(mint)
  if (!lendingAccounts) {
    console.error(
      { mint: mint.toBase58() },
      'no lending accounts configured for mint; skipping vault'
    )
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
    rewardType: Number(drawing.reward_type),
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
  console.log(`commit transaction submitted signature=${sig}`)

  await waitForFinalizedSignature(sig, 60)

  const reward = await vault.fetcher.getReward(vaultPda, Number(drawing.round))
  const mintPrice = getPrice(maybeDevnet(mint.toBase58()))
  const amountUsd =
    mintPrice != null
      ? (Number(reward.amount) / 10 ** lendingAccounts.decimal) * mintPrice
      : null
  db.query(
    'UPDATE drawings SET vrf_seed = ?, amount = ?, amount_usd = ?, commit_tx = ?, request = ?, committed_at = unixepoch() WHERE id = ?'
  ).run(
    Buffer.from(vrfSeed),
    reward.amount,
    amountUsd,
    sig,
    request.toBase58(),
    drawing.id
  )

  console.log(`commit saved drawingId=${String(drawing.id)}`)
  return (
    db
      .query<DrawingRow, [bigint]>('SELECT * FROM drawings WHERE id = ?')
      .get(drawing.id) ?? null
  )
}

async function tryRevealAndComplete(
  drawing: DrawingRow,
  vaultIndex: number,
  maxAttempts = 180
) {
  console.log(
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
      console.log(
        `VRF not fulfilled yet attempt=${attempt + 1} maxAttempts=${maxAttempts}`
      )
      return null
    },
    maxAttempts,
    1000
  )

  if (fulfilledRandomness === null) {
    console.log(
      `VRF not fulfilled after max attempts=${maxAttempts}, will retry next tick`
    )
    return
  }

  console.log(`VRF fulfilled, computing winner drawingId=${String(drawing.id)}`)

  // Extract first 32 bytes of 64-byte randomness (matching reveal.rs)
  const onchainRandomness = fulfilledRandomness.subarray(0, 32)
  const secretSeed = new Uint8Array(drawing.secret_seed!)

  // combined = secretSeed XOR onchainRandomness
  const combined = xorBytes(secretSeed, onchainRandomness)

  // KISS PRNG → winner index
  const rng = KissRng.fromSeed(combined)
  const rawValue = rng.nextU64()
  console.debug(
    { rawValue: String(rawValue), totalTickets: String(drawing.total_tickets) },
    'winner index input'
  )
  const winnerIndex = rawValue % drawing.total_tickets

  // Resolve winner wallet from proofs (ordered by rowid = insertion order = sorted wallet order)
  const proofs = db
    .query<ProofRow, [bigint]>(
      'SELECT wallet, tickets FROM proofs WHERE drawing_id = ? ORDER BY id'
    )
    .all(drawing.id)

  let cumulative = 0n
  let winnerWallet: string | null = null
  for (const p of proofs) {
    cumulative += p.tickets
    if (winnerIndex < cumulative) {
      winnerWallet = p.wallet
      break
    }
  }

  if (!winnerWallet) {
    console.error(
      { winnerIndex: String(winnerIndex) },
      'could not resolve winner'
    )
    return
  }

  console.log(
    `winner resolved winnerWallet=${winnerWallet} winnerIndex=${String(winnerIndex)}`
  )

  // Reveal with the resolved winner wallet.
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
    console.log(`reveal transaction submitted signature=${sig}`)
    await waitForFinalizedSignature(sig, 60)
    const apr = computeDrawingAprValue(drawing, winnerWallet)

    // Update drawing → COMPLETED
    db.query(
      `UPDATE drawings SET winner_index = ?, winner_wallet = ?, randomness = ?, reveal_tx = ?, revealed_at = unixepoch(), apr = ?
        WHERE id = ?`
    ).run(
      winnerIndex,
      winnerWallet,
      Buffer.from(fulfilledRandomness),
      sig,
      apr,
      drawing.id
    )

    console.log(`drawing completed drawingId=${String(drawing.id)}`)
    await sleep(2000)
  } catch (err: any) {
    const isAlreadyClaimed =
      err?.logs?.some((l: string) => l.includes('AlreadyClaimed')) ||
      err?.message?.includes('6010')
    if (isAlreadyClaimed) {
      console.warn(
        `round already claimed onchain, recovering DB state drawingId=${String(drawing.id)}`
      )
      const vaultPda = vault.fetcher.getVaultAddress(vaultIndex)[0]
      const reward = await vault.fetcher.getReward(
        vaultPda,
        Number(drawing.round)
      )
      const recoveredWinner = reward.claimer.toBase58()
      const apr = computeDrawingAprValue(drawing, recoveredWinner)
      db.query(
        `UPDATE drawings SET winner_index = ?, winner_wallet = ?, randomness = ?, revealed_at = unixepoch(), apr = ?
          WHERE id = ?`
      ).run(
        reward.winnerIndex,
        recoveredWinner,
        Buffer.from(fulfilledRandomness),
        apr,
        drawing.id
      )
      console.warn(
        `recovered drawing drawingId=${String(drawing.id)} winner=${recoveredWinner}`
      )
      return
    }
    throw err
  }
}

// ---------------------------------------------------------------------------
// Per-vault state machine
// ---------------------------------------------------------------------------

async function processVault(vaultIndex: number, v: VaultAccount) {
  const vaultPda = vault.fetcher.getVaultAddress(vaultIndex)[0]
  const latest = getLatestDrawing(vaultPda.toBase58())

  if (!latest || latest.revealed_at !== null) {
    // No drawing or last one completed → take new snapshot
    await takeSnapshot(vaultIndex, vaultPda, v)
    return
  }

  if (latest.vrf_seed === null) {
    // Snapshot exists but not committed → finalize, commit, and attempt reveal
    if (latest.merkle_root === null) {
      const finalized = await finalizeSnapshot(latest, vaultIndex, v)
      if (!finalized) {
        db.query('DELETE FROM drawings WHERE id = ?').run(latest.id)
        console.log(
          `deleted empty drawing drawingId=${String(latest.id)}, retaking snapshot`
        )
        await takeSnapshot(vaultIndex, vaultPda, v)
        return
      }
      // Re-read drawing after finalize
      const updated = db
        .query<DrawingRow, [bigint]>('SELECT * FROM drawings WHERE id = ?')
        .get(latest.id)
      if (!updated) return
      Object.assign(latest, updated)
    }

    const committedDrawing = await commitDrawing(latest, vaultIndex, v)
    if (committedDrawing) {
      console.log(`round before reveal currentRound=${String(v.currentRound)}`)
      await tryRevealAndComplete(committedDrawing, vaultIndex, 180)
      v = await vault.fetcher.getVaultByIndex(vaultIndex)
      console.log(`round after refresh currentRound=${String(v.currentRound)}`)
      await takeSnapshot(vaultIndex, vaultPda, v)
    }

    return
  }

  // Committed but not revealed → try reveal
  await tryRevealAndComplete(latest, vaultIndex, 180)
  v = await vault.fetcher.getVaultByIndex(vaultIndex)
  console.log(`round after reveal check currentRound=${String(v.currentRound)}`)
  await takeSnapshot(vaultIndex, vaultPda, v)
}

// ---------------------------------------------------------------------------
// Entry point (called by Elysia cron every 10 minutes)
// ---------------------------------------------------------------------------
export const processDrawing = async () => {
  console.log('tick')

  try {
    const vaults = await vault.fetcher.getAllVaults(true)

    for (let i = 0; i < vaults.length; i++) {
      try {
        await processVault(i, vaults[i])
      } catch (err) {
        console.error({ vaultIndex: i, err }, 'vault processing error')
      }
    }
  } catch (err) {
    console.error({ err }, 'fatal drawing cron error')
  }
}
