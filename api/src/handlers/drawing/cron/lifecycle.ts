import type { VaultAccount } from 'ts-sdk'
import { vault } from '../../../consts'
import { db, type DrawingRow } from '../../../db'
import { getDrawingById, getLatestDrawing } from '../../../utils'
import {
  createInitialSnapshot,
  materializeCommitArtifactsFromEligibleSnapshot,
  refreshRollingEligibility
} from './eligibility'
import { logInfo } from './logger'
import { selectDueRewardTypeFromLast } from './tier-gate'
import { commitDrawing, tryRevealAndComplete } from './tx'

function isBlocked(value: number | bigint | null | undefined): boolean {
  if (value === null || value === undefined) return false
  return Number(value) === 1
}

async function maybeStartNextRoundSnapshot(
  vaultIndex: number,
  latest: DrawingRow,
  vaultPda: string
): Promise<void> {
  const refreshed = getDrawingById(latest.id)
  if (!refreshed || refreshed.revealed_at === null) return

  const freshVault = await vault.fetcher.getVaultByIndex(vaultIndex)
  await createInitialSnapshot(vault.fetcher.getVaultAddress(vaultIndex)[0], freshVault)

  logInfo(
    `next snapshot attempted after reveal vault=${vaultPda} round=${String(freshVault.currentRound)}`
  )
}

export async function processVaultLifecycle(
  vaultIndex: number,
  v: VaultAccount
): Promise<void> {
  const vaultPda = vault.fetcher.getVaultAddress(vaultIndex)[0]
  const vaultAddress = vaultPda.toBase58()

  let latest = getLatestDrawing(vaultAddress)

  if (!latest || latest.revealed_at !== null) {
    await createInitialSnapshot(vaultPda, v)
    return
  }

  if (latest.vrf_seed !== null) {
    await tryRevealAndComplete(latest, vaultIndex, 180)
    await maybeStartNextRoundSnapshot(vaultIndex, latest, vaultAddress)
    return
  }

  const scanned = await refreshRollingEligibility(latest, v)
  if (!scanned) return

  latest = getDrawingById(latest.id) ?? latest

  if (isBlocked(latest.eligibility_blocked)) {
    logInfo(`commit blocked drawingId=${String(latest.id)} waiting for clean scan`)
    return
  }

  const rewardType = selectDueRewardTypeFromLast(v)
  if (rewardType === null) {
    logInfo(
      `commit gate not reached vault=${vaultAddress} round=${String(latest.round)} (no due tier)`
    )
    return
  }

  const finalized = materializeCommitArtifactsFromEligibleSnapshot(latest.id)
  if (!finalized) {
    db.query('DELETE FROM drawings WHERE id = ?').run(latest.id)
    logInfo(
      `deleted empty drawing drawingId=${String(latest.id)}, retaking snapshot`
    )
    await createInitialSnapshot(vaultPda, v)
    return
  }

  latest = getDrawingById(latest.id)
  if (!latest) return

  const committed = await commitDrawing(latest, vaultIndex, v, rewardType)
  if (!committed) return

  await tryRevealAndComplete(committed, vaultIndex, 180)
  await maybeStartNextRoundSnapshot(vaultIndex, committed, vaultAddress)
}
