import type { VaultAccount } from 'ts-sdk'

export function selectDueRewardTypeFromLast(
  v: VaultAccount,
  nowSec = Math.floor(Date.now() / 1000)
): number | null {
  const now = BigInt(nowSec)

  for (let i = v.distributionTiers.length - 1; i >= 0; i--) {
    const tier = v.distributionTiers[i]
    if (tier.rewardShare <= 0n) continue
    if (tier.interval <= 0n) continue

    if (now >= tier.distributedAt + tier.interval) {
      return i
    }
  }

  return null
}
