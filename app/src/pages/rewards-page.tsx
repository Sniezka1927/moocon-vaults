import { APP_COLORS } from '@/consts'

const REWARDS = [
  { label: 'Claimable', value: '2,480 MOO' },
  { label: 'Pending', value: '910 MOO' },
  { label: 'Next Epoch', value: '14h 20m' },
]

const NOTES = [
  'Reward multipliers are based on vault lock duration.',
  'Claims settle on Solana in a single signed transaction.',
]

export function RewardsPage() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-10 md:px-8 md:py-14">
      <p className="text-xs uppercase tracking-[0.16em]" style={{ color: APP_COLORS.page.eyebrow }}>
        Rewards
      </p>
      <h1 className="mt-3 text-3xl font-semibold md:text-5xl" style={{ color: APP_COLORS.page.title }}>
        Incentive Distribution
      </h1>
      <p className="mt-4 max-w-3xl text-sm md:text-base" style={{ color: APP_COLORS.page.description }}>
        Follow your earned incentives, eligibility tiers, and vesting schedule for protocol campaigns.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {REWARDS.map((item) => (
          <article
            key={item.label}
            className="rounded-2xl border p-5"
            style={{ borderColor: APP_COLORS.page.cardBorder, backgroundColor: APP_COLORS.page.cardBackground }}
          >
            <p className="text-xs uppercase tracking-[0.12em]" style={{ color: APP_COLORS.page.cardLabel }}>
              {item.label}
            </p>
            <p className="mt-2 text-2xl font-medium" style={{ color: APP_COLORS.page.cardValue }}>
              {item.value}
            </p>
          </article>
        ))}
      </div>

      <div
        className="mt-6 rounded-2xl border p-5"
        style={{ borderColor: APP_COLORS.page.cardBorder, backgroundColor: APP_COLORS.page.cardBackground }}
      >
        <h2 className="text-sm uppercase tracking-[0.12em]" style={{ color: APP_COLORS.page.notesTitle }}>
          Operational Notes
        </h2>
        <ul className="mt-3 space-y-2 text-sm" style={{ color: APP_COLORS.page.notesText }}>
          {NOTES.map((note) => (
            <li key={note}>• {note}</li>
          ))}
        </ul>
      </div>
    </section>
  )
}
