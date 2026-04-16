import { useEffect, useState } from 'react'
import { useConnection } from '@solana/wallet-adapter-react'
import { getAssociatedTokenAddressSync, getAccount } from '@solana/spl-token'
import { APP_COLORS, COLOR_TOKENS } from '@/consts'
import { Button } from '@/components/ui/button'
import type { VaultWithAddress } from '@/lib/store/vault-store'
import { useMintStore } from '@/lib/store/mint-store'
import { getLendingAccountsForMint } from 'ts-sdk'
import { DepositWithdrawModal } from './deposit-withdraw-modal'

interface VaultCardProps {
  vault: VaultWithAddress
  metadata: { name: string; icon: string; decimals: number }
  isLast: boolean
  avgApr: number | null
}

export function VaultCard({ vault, metadata, isLast, avgApr }: VaultCardProps) {
  const { connection } = useConnection()
  const [tvl, setTvl] = useState<string | null>(null)
  const [tvlUsd, setTvlUsd] = useState<string | null>(null)
  const [countdown, setCountdown] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const tokenName = metadata.name
  const price = useMintStore((s) => s.getMint(vault.mint.toBase58()))?.price ?? null
  const tokenDecimals = Number.isInteger(metadata.decimals) && metadata.decimals >= 0
    ? Math.min(metadata.decimals, 18)
    : 6
  const tvlLabel = tvl === '—' ? '—' : tvl !== null ? `${tvl} ${tokenName}` : '...'

  useEffect(() => {
    const tick = () => {
      const now = BigInt(Math.floor(Date.now() / 1000))

      let soonest: bigint | null = null
      for (const tier of vault.distributionTiers) {
        if (tier.interval <= 0n || tier.rewardShare <= 0n) continue
        const next = tier.distributedAt > 0n
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
  }, [vault.distributionTiers])

  useEffect(() => {
    const lendingAccounts = getLendingAccountsForMint(vault.mint)
    if (!lendingAccounts) {
      setTvl('—')
      return
    }
    const fTokenAta = getAssociatedTokenAddressSync(lendingAccounts.fTokenMint, vault.address, true)
    getAccount(connection, fTokenAta)
      .then((account) => {
        const baseAmount = Number(account.amount)
        const rate = Number(vault.lastRate)
        const raw =
          (baseAmount * rate) /
          10 ** 12 /
          10 ** tokenDecimals

        if (!Number.isFinite(raw)) {
          setTvl('—')
          setTvlUsd(null)
          return
        }

        setTvl(raw.toLocaleString('en-US', { maximumFractionDigits: 2 }))
        if (price != null) {
          const tvlUsdValue = raw * price
          setTvlUsd(
            Number.isFinite(tvlUsdValue)
              ? tvlUsdValue.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
              : null
          )
        }
      })
      .catch(() => {
        setTvl('—')
        setTvlUsd(null)
      })
  }, [connection, vault.address, vault.mint, vault.lastRate, tokenDecimals, price])

  return (
    <tr
      style={{
        borderBottom: isLast ? 'none' : `1px solid ${APP_COLORS.page.cardBorder}`
      }}
    >
      {/* Asset */}
      <td className="py-4 px-6">
        <div className="flex items-center gap-3">
          <img
            src={metadata.icon}
            alt={tokenName}
            className="h-6 w-6 rounded-full object-contain"
          />
          <span className="text-sm font-semibold" style={{ color: APP_COLORS.page.cardValue }}>
            {tokenName}
          </span>
        </div>
      </td>

      {/* Total Supplied */}
      <td className="py-4 px-6 text-center">
        {tvlUsd !== null ? (
          <span
            className="text-sm font-medium"
            style={{ color: APP_COLORS.page.cardValue }}
          >
            {tvlUsd}
          </span>
        ) : tvl !== null && tvl === '—' ? (
          <span
            className="text-sm font-medium"
            style={{ color: APP_COLORS.page.cardValue }}
          >
            —
          </span>
        ) : (
          <div className="mx-auto h-4 w-20 rounded skeleton" style={{ backgroundColor: APP_COLORS.page.cardBorder }} />
        )}
      </td>

      {/* Avg APR */}
      <td className="py-4 px-6 text-center">
        <span className="text-sm font-semibold" style={{ color: COLOR_TOKENS.secondary }}>
          {avgApr !== null ? `${avgApr.toFixed(2)}%` : '—'}
        </span>
      </td>

      {/* Distribution in: */}
      <td className="py-4 px-6 text-center">
        <span className="text-sm font-mono font-medium" style={{ color: APP_COLORS.page.cardValue }}>
          {countdown || '—'}
        </span>
      </td>

      {/* Deposit */}
      <td className="py-4 px-6 text-right">
        <Button
          className="rounded-lg px-6 py-2 text-xs uppercase tracking-widest"
          style={{
            backgroundColor: APP_COLORS.walletButton.background,
            border: 'none',
            color: APP_COLORS.walletButton.text,
            fontWeight: 700
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = APP_COLORS.walletButton.backgroundHover
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = APP_COLORS.walletButton.background
          }}
          onClick={() => setModalOpen(true)}
        >
          Deposit
        </Button>
        <DepositWithdrawModal
          vault={vault}
          metadata={metadata}
          tvl={tvl}
          tvlUsd={tvlUsd}
          avgApr={avgApr}
          price={price}
          open={modalOpen}
          onClose={() => setModalOpen(false)}
        />
      </td>
    </tr>
  )
}
