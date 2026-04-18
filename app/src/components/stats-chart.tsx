import { useState } from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts'
import { APP_COLORS, COLOR_TOKENS } from '@/consts'
import { useStats } from '@/lib/queries'

type Interval = '1h' | '4h' | '1d'

const INTERVALS: { label: string; value: Interval }[] = [
  { label: '1H', value: '1h' },
  { label: '4H', value: '4h' },
  { label: '1D', value: '1d' }
]

function fmtDate(ts: number, interval: Interval) {
  const d = new Date(ts * 1000)
  if (interval === '1d')
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return d.toLocaleTimeString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function fmtXAxisDate(ts: number, interval: Interval) {
  const d = new Date(ts * 1000)
  if (interval === '1d')
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric'
  })
}

function fmtShortUSD(v: number) {
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(1)}B`
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`
  return `$${v.toFixed(0)}`
}

function fmtUSD(v: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(v)
}

function fmtShortNumber(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`
  return `${Math.round(v)}`
}

const GRID_COLOR = 'rgba(30, 58, 95, 0.5)'
const AXIS_COLOR = APP_COLORS.page.cardLabel
const TOOLTIP_BG = '#0F172A'
const TOOLTIP_BORDER = APP_COLORS.page.cardBorder

function ChartTooltip({
  active,
  payload,
  label
}: {
  active?: boolean
  payload?: Array<{
    value: number
    color?: string
    name?: string
    dataKey?: string
    payload?: { tooltipLabel?: string }
  }>
  label?: string
}) {
  if (!active || !payload?.length) return null

  const valueFormatters: Record<string, (v: number) => string> = {
    tvl_usd: fmtUSD,
    total_rewards_usd: fmtUSD,
    unique_users: (v) => v.toLocaleString()
  }

  return (
    <div
      className="border px-3 py-2 text-xs"
      style={{
        backgroundColor: TOOLTIP_BG,
        borderColor: TOOLTIP_BORDER,
        color: APP_COLORS.page.cardValue
      }}
    >
      <p style={{ color: AXIS_COLOR }}>
        {payload[0]?.payload?.tooltipLabel ?? label}
      </p>
      <div className="mt-1 flex flex-col gap-1">
        {payload.map((entry) => {
          const key = entry.dataKey ?? ''
          const fmt = valueFormatters[key] ?? ((v: number) => v.toString())
          return (
            <p
              key={key}
              className="font-medium"
              style={{ color: entry.color ?? APP_COLORS.page.cardValue }}
            >
              {entry.name}: {fmt(entry.value)}
            </p>
          )
        })}
      </div>
    </div>
  )
}

export function StatsChart() {
  const [interval, setInterval] = useState<Interval>('1h')
  const { data } = useStats({ interval, limit: 200 })

  const points = data?.data ?? []
  const chartData = points
    .map((p) => ({
      ...p,
      label: fmtXAxisDate(p.recorded_at, interval),
      tooltipLabel: fmtDate(p.recorded_at, interval)
    }))
    .reverse()

  const xAxisInterval = Math.max(0, Math.ceil(chartData.length / 10) - 1)

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <p
          className="text-sm font-medium"
          style={{ color: APP_COLORS.page.cardValue }}
        >
          Metrics
        </p>
        <div className="flex flex-1 items-center gap-3 text-xs">
          <span
            className="flex items-center gap-1.5"
            style={{ color: APP_COLORS.page.cardLabel }}
          >
            <span
              className="inline-block h-2.5 w-2.5"
              style={{ backgroundColor: COLOR_TOKENS.tertiary, opacity: 0.55 }}
            />
            Unique Wallets
          </span>
          <span
            className="flex items-center gap-1.5"
            style={{ color: APP_COLORS.page.cardLabel }}
          >
            <span
              className="inline-block h-0.5 w-4"
              style={{ backgroundColor: COLOR_TOKENS.primary }}
            />
            TVL (USD)
          </span>
          <span
            className="flex items-center gap-1.5"
            style={{ color: APP_COLORS.page.cardLabel }}
          >
            <span
              className="inline-block h-0.5 w-4"
              style={{ backgroundColor: COLOR_TOKENS.secondary }}
            />
            Rewards (USD)
          </span>
        </div>
        <div className="flex gap-1">
          {INTERVALS.map((i) => (
            <button
              key={i.value}
              onClick={() => setInterval(i.value)}
              className="px-2.5 py-1 text-xs font-medium transition-colors"
              style={
                interval === i.value
                  ? { backgroundColor: COLOR_TOKENS.primary, color: '#0F172A' }
                  : {
                      backgroundColor: 'transparent',
                      color: AXIS_COLOR,
                      border: `1px solid ${APP_COLORS.page.cardBorder}`
                    }
              }
            >
              {i.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart
            data={chartData}
            margin={{ top: 8, right: 6, left: 0, bottom: 4 }}
          >
            <defs>
              <linearGradient id="tvlGrad" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor={COLOR_TOKENS.primary}
                  stopOpacity={0.24}
                />
                <stop
                  offset="95%"
                  stopColor={COLOR_TOKENS.primary}
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={GRID_COLOR}
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{ fill: AXIS_COLOR, fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              minTickGap={24}
              interval={xAxisInterval}
            />
            <YAxis
              yAxisId="usd"
              tickFormatter={fmtShortUSD}
              tick={{ fill: AXIS_COLOR, fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={62}
            />
            <YAxis
              yAxisId="users"
              orientation="right"
              tickFormatter={fmtShortNumber}
              tick={{ fill: AXIS_COLOR, fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={46}
            />
            <Tooltip content={<ChartTooltip />} />
            <Bar
              yAxisId="users"
              dataKey="unique_users"
              name="Unique Wallets"
              fill={COLOR_TOKENS.tertiary}
              opacity={0.48}
              radius={[2, 2, 0, 0]}
              barSize={8}
            />
            <Area
              yAxisId="usd"
              type="monotone"
              dataKey="tvl_usd"
              name="TVL (USD)"
              stroke={COLOR_TOKENS.primary}
              strokeWidth={2}
              fill="url(#tvlGrad)"
              dot={false}
              activeDot={{ r: 3 }}
            />
            <Line
              yAxisId="usd"
              type="monotone"
              dataKey="total_rewards_usd"
              name="Rewards (USD)"
              stroke={COLOR_TOKENS.secondary}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
