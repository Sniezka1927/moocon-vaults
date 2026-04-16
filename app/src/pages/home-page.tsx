import { useEffect } from 'react'
import { APP_COLORS } from '@/consts'
import { useVaultsStore } from '@/lib/store/vault-store'
import { useMintStore } from '@/lib/store/mint-store'
import { VaultCard } from '@/components/vault-card'
import { useAllVaults } from '@/lib/queries/use-vaults'
import { useDrawings } from '@/lib/queries'
import { getLendingAccountsForMint } from 'ts-sdk'
import { StatsChart } from '@/components/stats-chart'
import { StatsOverview } from '@/components/stats-overview'
import { RewardsList } from '@/components/rewards-list'
import { UserStatsPanel } from '@/components/user-stats-panel'
import { ReferralPanel } from '@/components/referral-panel'

const SKELETON_LIST_ELEMENTS = 2

export function HomePage() {
  const { vaults, setVaults } = useVaultsStore()
  const { data, isLoading: vaultsLoading } = useAllVaults()
  const { data: drawingsData } = useDrawings(1, 100)
  const aprByVault = drawingsData?.winners_compound_average_apy_percent_by_vault ?? {}

  useEffect(() => {
    if (data) setVaults(data)
  }, [data, setVaults])

  const getMint = useMintStore((s) => s.getMint)
  const registeredVaults = vaults.flatMap((vault) => {
    const mint = getMint(vault.mint.toBase58())
    if (!mint) return []
    const parsedMintDecimals = Number(mint.decimals)
    const fallbackDecimals = getLendingAccountsForMint(vault.mint)?.decimal ?? 6
    const decimals = Number.isInteger(parsedMintDecimals) && parsedMintDecimals >= 0
      ? parsedMintDecimals
      : fallbackDecimals
    const metadata = { name: mint.symbol ?? 'Unknown', icon: mint.icon ?? '', decimals }
    return [{ vault, metadata }]
  })

  return (
    <section className="mx-auto max-w-6xl px-4 py-10 md:px-8 md:py-14">
      <h1
        className="text-2xl font-bold"
        style={{ color: APP_COLORS.page.title }}
      >
        Portfolio
      </h1>

      <div className="mt-6 flex flex-col md:flex-row gap-6">
        <div
          className="flex-1 rounded-xl border p-5"
          style={{
            borderColor: APP_COLORS.page.cardBorder,
            backgroundColor: APP_COLORS.page.cardBackground
          }}
        >
          <UserStatsPanel />
        </div>
        <div
          className="flex-1 rounded-xl border p-5"
          style={{
            borderColor: APP_COLORS.page.cardBorder,
            backgroundColor: APP_COLORS.page.cardBackground
          }}
        >
          <ReferralPanel />
        </div>
      </div>

      <h2
        className="mt-10 text-2xl font-bold"
        style={{ color: APP_COLORS.page.title }}
      >
        Earn
      </h2>
      <p
        className="mt-2 max-w-3xl text-base"
        style={{ color: APP_COLORS.page.description }}
      >
        Deposit assets and earn whale-sized yield with Moocon earn vaults.
      </p>

      <div
        className="mt-4 rounded-xl overflow-hidden"
        style={{
          backgroundColor: APP_COLORS.page.cardBackground,
          boxShadow:
            '0 1px 3px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)'
        }}
      >
        <table className="w-full border-collapse table-fixed">
          <colgroup>
            <col style={{ width: '20%' }} />
            <col style={{ width: '20%' }} />
            <col style={{ width: '20%' }} />
            <col style={{ width: '20%' }} />
            <col style={{ width: '20%' }} />
          </colgroup>
          <thead>
            <tr
              style={{
                borderBottom: `1px solid ${APP_COLORS.page.cardBorder}`,
                backgroundColor: APP_COLORS.page.cardHeaderBackground
              }}
            >
              {['Asset', 'Total Supplied', 'Avg APR', 'Distribution in:', ''].map(
                (col, i) => (
                  <th
                    key={col}
                    className={`py-3 px-6 text-xs uppercase tracking-widest font-medium ${i === 0 ? 'text-left' : 'text-center'}`}
                    style={{ color: APP_COLORS.page.cardLabel }}
                  >
                    {col}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {vaultsLoading && registeredVaults.length === 0
              ? Array.from({ length: SKELETON_LIST_ELEMENTS }).map((_, i) => (
                  <tr
                    key={i}
                    style={{
                      borderBottom:
                        i === SKELETON_LIST_ELEMENTS - 1
                          ? 'none'
                          : `1px solid ${APP_COLORS.page.cardBorder}`
                    }}
                  >
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="h-6 w-6 rounded-full skeleton" style={{ backgroundColor: APP_COLORS.page.cardBorder }} />
                        <div className="h-5 w-12 rounded skeleton" style={{ backgroundColor: APP_COLORS.page.cardBorder }} />
                      </div>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <div className="mx-auto h-5 w-20 rounded skeleton" style={{ backgroundColor: APP_COLORS.page.cardBorder }} />
                    </td>
                    <td className="py-4 px-6 text-center">
                      <div className="mx-auto h-5 w-16 rounded skeleton" style={{ backgroundColor: APP_COLORS.page.cardBorder }} />
                    </td>
                    <td className="py-4 px-6 text-center">
                      <div className="mx-auto h-5 w-16 rounded skeleton" style={{ backgroundColor: APP_COLORS.page.cardBorder }} />
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="ml-auto h-9 w-28 rounded-lg skeleton" style={{ backgroundColor: APP_COLORS.page.cardBorder }} />
                    </td>
                  </tr>
                ))
              : registeredVaults.map(({ vault, metadata }, i) => (
                  <VaultCard
                    key={vault.mint.toBase58()}
                    vault={vault}
                    metadata={metadata}
                    isLast={i === registeredVaults.length - 1}
                    avgApr={aprByVault[vault.address.toBase58()] ?? null}
                  />
                ))}
          </tbody>
        </table>
      </div>

      <div
        className="mt-6 rounded-xl border flex flex-col md:flex-row overflow-hidden"
        style={{
          borderColor: APP_COLORS.page.cardBorder,
          backgroundColor: APP_COLORS.page.cardBackground
        }}
      >
        <div className="flex-1 min-w-0 p-5">
          <StatsChart />
        </div>
        <div
          className="md:w-64 shrink-0 border-t md:border-t-0 md:border-l p-5"
          style={{ borderColor: APP_COLORS.page.cardBorder }}
        >
          <StatsOverview />
        </div>
      </div>

      <div className="mt-6">
        <RewardsList />
      </div>
    </section>
  )
}
