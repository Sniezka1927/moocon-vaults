import { useEffect, useState } from 'react'
import type { VaultWithAddress } from '@/lib/store/vault-store'

export function useVaultCountdown(
  distributionTiers: VaultWithAddress['distributionTiers']
): string {
  const [countdown, setCountdown] = useState('')

  useEffect(() => {
    const tick = () => {
      const now = BigInt(Math.floor(Date.now() / 1000))

      let soonest: bigint | null = null
      for (const tier of distributionTiers) {
        if (tier.interval <= 0n || tier.rewardShare <= 0n) continue
        const next =
          tier.distributedAt > 0n
            ? tier.distributedAt + tier.interval
            : now + tier.interval
        if (soonest === null || next < soonest) soonest = next
      }

      if (soonest === null) {
        setCountdown('—')
        return
      }

      const remaining = Number(soonest - now)
      if (remaining <= 0) {
        setCountdown('00:00')
        return
      }
      const m = Math.floor(remaining / 60).toString().padStart(2, '0')
      const s = (remaining % 60).toString().padStart(2, '0')
      setCountdown(`${m}:${s}`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [distributionTiers])

  return countdown
}
