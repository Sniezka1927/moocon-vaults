import { afterEach, describe, expect, test } from 'bun:test'
import { determineRewardType } from '../src/utils'

const originalNow = Date.now

function mockNow(unixSeconds: number) {
  Date.now = () => unixSeconds * 1000
}

function makeVaultWithTiers(
  tiers: Array<{
    distributedAt: bigint
    interval: bigint
    rewardShare: bigint
    accumulated?: bigint
  }>
) {
  return {
    distributionTiers: tiers.map((tier) => ({
      distributedAt: tier.distributedAt,
      interval: tier.interval,
      rewardShare: tier.rewardShare,
      accumulated: tier.accumulated ?? 0n
    }))
  } as any
}

afterEach(() => {
  Date.now = originalNow
})

describe('determineRewardType', () => {
  test('returns tier 0 when non-zero tier is not due yet', () => {
    mockNow(1_000)
    const vault = makeVaultWithTiers([
      { distributedAt: 0n, interval: 0n, rewardShare: 6_000n },
      { distributedAt: 900n, interval: 200n, rewardShare: 4_000n }
    ])

    expect(determineRewardType(vault)).toBe(0)
  })

  test('returns tier 1 when it is due', () => {
    mockNow(1_200)
    const vault = makeVaultWithTiers([
      { distributedAt: 0n, interval: 0n, rewardShare: 6_000n },
      { distributedAt: 900n, interval: 200n, rewardShare: 4_000n }
    ])

    expect(determineRewardType(vault)).toBe(1)
  })

  test('ignores tier with zero rewardShare', () => {
    mockNow(10_000)
    const vault = makeVaultWithTiers([
      { distributedAt: 0n, interval: 0n, rewardShare: 10_000n },
      { distributedAt: 0n, interval: 1n, rewardShare: 0n }
    ])

    expect(determineRewardType(vault)).toBe(0)
  })

  test('ignores tier with non-positive interval', () => {
    mockNow(10_000)
    const vault = makeVaultWithTiers([
      { distributedAt: 0n, interval: 0n, rewardShare: 10_000n },
      { distributedAt: 0n, interval: 0n, rewardShare: 4_000n }
    ])

    expect(determineRewardType(vault)).toBe(0)
  })

  test('returns highest index among due tiers', () => {
    mockNow(10_000)
    const vault = makeVaultWithTiers([
      { distributedAt: 0n, interval: 0n, rewardShare: 5_000n },
      { distributedAt: 0n, interval: 1n, rewardShare: 3_000n },
      { distributedAt: 0n, interval: 1n, rewardShare: 2_000n }
    ])

    expect(determineRewardType(vault)).toBe(2)
  })
})
