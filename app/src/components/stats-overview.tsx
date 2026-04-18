import { APP_COLORS } from '@/consts'
import { useStats } from '@/lib/queries'

function fmtCurrency(v: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(v)
}

function fmtUsers(v: number) {
  return new Intl.NumberFormat('en-US').format(v)
}

export function StatsOverview() {
  const { data } = useStats({ interval: '1d', limit: 1 })
  const latest = data?.data[0]

  const cards = [
    {
      label: 'Current TVL',
      value: latest ? fmtCurrency(latest.tvl_usd) : '—'
    },
    {
      label: 'Total Rewards Distributed',
      value: latest ? fmtCurrency(latest.total_rewards_usd) : '—'
    },
    {
      label: 'Total Depositors',
      value: latest ? fmtUsers(latest.unique_users) : '—'
    }
  ]

  return (
    <div className="flex flex-col gap-3 h-full">
      {cards.map((card) => (
        <article
          key={card.label}
          className="rounded-xl border p-4 border-l-2"
          style={{
            borderColor: APP_COLORS.page.cardBorder,
            borderLeftColor: APP_COLORS.page.cardLabel,
            backgroundColor: APP_COLORS.page.cardHeaderBackground
          }}
        >
          <p
            className="text-[10px] uppercase tracking-[0.12em]"
            style={{ color: APP_COLORS.page.cardLabel }}
          >
            {card.label}
          </p>
          <p
            className="mt-1.5 text-base font-semibold leading-none"
            style={{
              color: APP_COLORS.page.cardValue
            }}
          >
            {card.value}
          </p>
        </article>
      ))}
    </div>
  )
}
