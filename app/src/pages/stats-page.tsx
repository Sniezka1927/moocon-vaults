import { APP_COLORS } from '@/consts'
import { StatsOverview } from '@/components/stats-overview'
import { StatsChart } from '@/components/stats-chart'
import { RewardsList } from '@/components/rewards-list'

export function StatsPage() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-10 md:px-8 md:py-14">
      <p
        className="mt-4 max-w-3xl text-sm md:text-base"
        style={{ color: APP_COLORS.page.description }}
      >
        Live metrics across all premium vaults — TVL, rewards distributed, and
        depositor activity.
      </p>

      <div className="mt-8 flex flex-col gap-6">
        <div
          className="rounded-2xl border flex flex-col md:flex-row overflow-hidden"
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
        <RewardsList />
      </div>
    </section>
  )
}
