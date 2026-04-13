import { describe, expect, test } from 'bun:test'
import { selectDueRewardTypeFromLast } from '../src/handlers/drawing/cron/tier-gate'

function makeVaultWithTiers(
  tiers: Array<{ distributedAt: bigint; interval: bigint; rewardShare: bigint }>
) {
  return {
    distributionTiers: tiers.map((tier) => ({
      distributedAt: tier.distributedAt,
      interval: tier.interval,
      rewardShare: tier.rewardShare,
      accumulated: 0n
    }))
  } as any
}

describe('selectDueRewardTypeFromLast', () => {
  test('checks tiers from last to first and picks the last due tier', () => {
    const vault = makeVaultWithTiers([
      { distributedAt: 0n, interval: 100n, rewardShare: 7_000n },
      { distributedAt: 0n, interval: 100n, rewardShare: 3_000n }
    ])

    expect(selectDueRewardTypeFromLast(vault, 500)).toBe(1)
  })

  test('falls back to earlier tier when the last tier is not due', () => {
    const vault = makeVaultWithTiers([
      { distributedAt: 0n, interval: 100n, rewardShare: 7_000n },
      { distributedAt: 450n, interval: 100n, rewardShare: 3_000n }
    ])

    expect(selectDueRewardTypeFromLast(vault, 500)).toBe(0)
  })

  test('ignores zero-share and non-positive-interval tiers', () => {
    const vault = makeVaultWithTiers([
      { distributedAt: 0n, interval: 100n, rewardShare: 8_000n },
      { distributedAt: 0n, interval: 0n, rewardShare: 2_000n }
    ])

    expect(selectDueRewardTypeFromLast(vault, 500)).toBe(0)
  })

  test('returns null when no tier is due', () => {
    const vault = makeVaultWithTiers([
      { distributedAt: 480n, interval: 100n, rewardShare: 8_000n },
      { distributedAt: 490n, interval: 100n, rewardShare: 2_000n }
    ])

    expect(selectDueRewardTypeFromLast(vault, 500)).toBeNull()
  })
})
