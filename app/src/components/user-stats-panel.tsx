import type React from 'react'
import { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { APP_COLORS } from '@/consts'
import { usePoints, useAllVaults, useUserTotalDepositsUsd, useUserRewards } from '@/lib/queries'
import { Button } from '@/components/ui/button'
import { UserRewardsModal } from '@/components/user-rewards-modal'

function fmtUsd(v: number) {
  const s = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(v)
  return s.replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')
}

function fmtPoints(v: number) {
  return new Intl.NumberFormat('en-US').format(v)
}

export function UserStatsPanel() {
  const { publicKey, connected } = useWallet()
  const wallet = publicKey?.toBase58() ?? null

  const { data: pointsData } = usePoints(wallet)
  const { data: vaults = [] } = useAllVaults()
  const { data: totalDepositsUsd } =
    useUserTotalDepositsUsd(vaults, publicKey)

  const isLoading = connected && (pointsData === undefined || totalDepositsUsd === undefined)
  const { data: rewards = [] } = useUserRewards()

  const [rewardsModalOpen, setRewardsModalOpen] = useState(false)

  const depositsDisplay = !connected
    ? '—'
    : fmtUsd(totalDepositsUsd ?? 0)

  const multiplierDisplay = !connected
    ? '—'
    : `${(pointsData?.multiplier ?? 1).toFixed(2)}x`

  const pointsDisplay = !connected
    ? '—'
    : fmtPoints(pointsData?.total_points ?? 0)

  function StatCard({
    label,
    value,
    icon
  }: {
    label: string
    value: string
    icon?: React.ReactNode
  }) {
    return (
      <article
        className="rounded-xl border p-4"
        style={{
          borderColor: APP_COLORS.page.cardBorder,
          backgroundColor: APP_COLORS.page.cardHeaderBackground
        }}
      >
        <p
          className="text-[10px] uppercase tracking-[0.12em] font-medium"
          style={{ color: APP_COLORS.page.cardLabel }}
        >
          {label}
        </p>
        <div className="mt-2 flex items-center gap-1.5 leading-none">
          {isLoading ? (
            <div className="h-4 w-16 rounded skeleton" style={{ backgroundColor: APP_COLORS.page.cardBorder }} />
          ) : (
            <>
              <p
                className="text-base font-semibold leading-none"
                style={{
                  color: !connected
                    ? APP_COLORS.page.cardLabel
                    : APP_COLORS.page.cardValue
                }}
              >
                {value}
              </p>
              {icon}
            </>
          )}
        </div>
      </article>
    )
  }

  return (
    <div className="flex flex-col gap-3 h-full">
      <p
        className="text-[10px] uppercase tracking-[0.12em]"
        style={{ color: APP_COLORS.page.cardLabel }}
      >
        Your Stats
      </p>
      <article
        className="rounded-xl border p-4 flex items-center justify-between h-[68px]"
        style={{
          borderColor: APP_COLORS.page.cardBorder,
          backgroundColor: APP_COLORS.page.cardHeaderBackground
        }}
      >
        <div>
          <p
            className="text-[10px] uppercase tracking-[0.12em]"
            style={{ color: APP_COLORS.page.cardLabel }}
          >
            Deposited
          </p>
          {isLoading ? (
            <div className="mt-1.5 h-4 w-20 rounded skeleton" style={{ backgroundColor: APP_COLORS.page.cardBorder }} />
          ) : (
            <p
              className="mt-1.5 text-base font-semibold leading-none"
              style={{
                color: !connected
                  ? APP_COLORS.page.cardLabel
                  : APP_COLORS.page.cardValue
              }}
            >
              {depositsDisplay}
            </p>
          )}
        </div>
        <Button
            variant="outline"
            size="sm"
            className={`flex items-center gap-2 h-auto py-2.5 px-5 rounded-lg text-sm font-semibold transition-opacity ${connected && rewards.length > 0 ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
            style={{
              borderColor: APP_COLORS.page.cardBorder,
              backgroundColor: APP_COLORS.page.cardBackground,
              color: APP_COLORS.page.cardLabel,
              boxShadow: `0 0 8px 2px ${APP_COLORS.page.cardLabel}55`
            }}
            onClick={() => setRewardsModalOpen(true)}
          >
            <span style={{ color: APP_COLORS.page.cardValue }}>{rewards.length}</span>
            <span className="text-xs uppercase tracking-[0.12em]">Rewards Won</span>
          </Button>
      </article>
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Multiplier" value={multiplierDisplay} />
        <StatCard label="Milk Earned" value={pointsDisplay} />
      </div>
      <UserRewardsModal
        open={rewardsModalOpen}
        onClose={() => setRewardsModalOpen(false)}
        rewards={rewards}
      />
    </div>
  )
}
