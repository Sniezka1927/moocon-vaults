import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { APP_COLORS } from '@/consts'
import { useMintStore } from '@/lib/store/mint-store'
import { Button } from '@/components/ui/button'
import { useAllVaults } from '@/lib/queries'
import {
  useClaimReward,
  useClaimAllRewards
} from '@/lib/queries/use-vault-actions'
import type { RewardAccount } from 'ts-sdk'

interface UserRewardsModalProps {
  open: boolean
  onClose: () => void
  rewards: RewardAccount[]
}

export function UserRewardsModal({
  open,
  onClose,
  rewards
}: UserRewardsModalProps) {
  const { data: vaults = [] } = useAllVaults()
  const getMint = useMintStore((s) => s.getMint)
  const claimReward = useClaimReward()
  const claimAll = useClaimAllRewards()
  const [claimingRound, setClaimingRound] = useState<number | null>(null)
  const [claimingAll, setClaimingAll] = useState(false)

  const isAnyPending = claimingRound !== null || claimingAll

  const claimablePairs = rewards
    .map((reward) => ({
      reward,
      vault: vaults.find((v) => v.address.equals(reward.vault))
    }))
    .filter(
      (p): p is { reward: RewardAccount; vault: NonNullable<typeof p.vault> } =>
        Boolean(p.vault)
    )

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-50"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
        />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl p-6 shadow-xl outline-none"
          style={{
            backgroundColor: APP_COLORS.page.cardBackground,
            border: `1px solid ${APP_COLORS.page.cardBorder}`
          }}
        >
          <div className="mb-4 flex items-center justify-between">
            <Dialog.Title
              className="text-sm font-semibold uppercase tracking-[0.12em]"
              style={{ color: APP_COLORS.page.cardLabel }}
            >
              Your Rewards
            </Dialog.Title>
            <div className="flex items-center gap-3">
              {rewards.length >= 2 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-lg text-xs"
                  style={{
                    backgroundColor: APP_COLORS.vault.stakeButtonBackground,
                    borderColor: APP_COLORS.vault.stakeButtonBorder,
                    color: APP_COLORS.vault.stakeButtonText
                  }}
                  disabled={isAnyPending}
                  onClick={() => {
                    setClaimingAll(true)
                    claimAll.mutate(claimablePairs, {
                      onSettled: () => setClaimingAll(false)
                    })
                  }}
                >
                  {claimingAll ? 'Claiming...' : 'Claim All'}
                </Button>
              )}
              <Dialog.Close asChild>
                <button
                  className="text-lg leading-none opacity-60 hover:opacity-100 transition-opacity"
                  style={{ color: APP_COLORS.page.cardValue }}
                  aria-label="Close"
                >
                  ✕
                </button>
              </Dialog.Close>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {rewards.map((reward, i) => {
              const vault = vaults.find((v) => v.address.equals(reward.vault))
              const tokenMeta = vault
                ? getMint(vault.mint.toBase58())
                : undefined
              const decimals = tokenMeta?.decimals ?? 6
              const amount = (
                Number(reward.amount) /
                10 ** decimals
              ).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: decimals
              })
              const isClaiming = claimingRound === reward.round

              return (
                <div
                  key={i}
                  className="rounded-xl border p-3 flex items-center justify-between"
                  style={{
                    borderColor: APP_COLORS.page.cardBorder,
                    backgroundColor: APP_COLORS.page.cardHeaderBackground
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    {tokenMeta?.icon && (
                      <img
                        src={tokenMeta.icon}
                        className="w-6 h-6 rounded-full object-cover shrink-0"
                        alt={tokenMeta.symbol ?? ''}
                      />
                    )}
                    <div className="flex flex-col gap-0.5">
                      <span
                        className="text-[10px] uppercase tracking-[0.12em]"
                        style={{ color: APP_COLORS.page.cardLabel }}
                      >
                        Round {reward.round}
                      </span>
                      <span
                        className="text-base font-semibold leading-none"
                        style={{ color: APP_COLORS.page.cardValue }}
                      >
                        {amount} {tokenMeta?.symbol}
                      </span>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-lg shrink-0"
                    style={{
                      backgroundColor: APP_COLORS.vault.stakeButtonBackground,
                      borderColor: APP_COLORS.vault.stakeButtonBorder,
                      color: APP_COLORS.vault.stakeButtonText
                    }}
                    disabled={isAnyPending || !vault}
                    onClick={() => {
                      if (!vault) return
                      setClaimingRound(reward.round)
                      claimReward.mutate(
                        { reward, vault },
                        { onSettled: () => setClaimingRound(null) }
                      )
                    }}
                  >
                    {isClaiming ? 'Claiming...' : 'Claim'}
                  </Button>
                </div>
              )
            })}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
