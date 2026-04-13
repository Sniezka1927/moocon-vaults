import { useWallet } from '@solana/wallet-adapter-react'
import { APP_COLORS } from '@/consts'

function ellipsify(value: string, chars = 4) {
  return `${value.slice(0, chars)}...${value.slice(-(chars + 1))}`
}

export function ProfilePage() {
  const { publicKey, connected } = useWallet()
  const address = publicKey?.toBase58()

  const stats = [
    { label: 'Status', value: connected ? 'Active' : 'Inactive' },
    { label: 'Address', value: connected && address ? ellipsify(address, 6) : 'Not connected' },
    { label: 'Tier', value: connected ? 'Genesis' : 'None' },
  ]

  return (
    <section className="mx-auto max-w-6xl px-4 py-10 md:px-8 md:py-14">
      <p className="text-xs uppercase tracking-[0.16em]" style={{ color: APP_COLORS.page.eyebrow }}>
        Profile
      </p>
      <h1 className="mt-3 text-3xl font-semibold md:text-5xl" style={{ color: APP_COLORS.page.title }}>
        {connected ? 'Wallet Connected' : 'Connect Your Wallet'}
      </h1>
      <p className="mt-4 max-w-3xl text-sm md:text-base" style={{ color: APP_COLORS.page.description }}>
        {connected && address
          ? `Connected address: ${ellipsify(address)}`
          : 'Connect a wallet to view your deposit exposure, claim status, and personalized vault activity.'}
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {stats.map((stat) => (
          <article
            key={stat.label}
            className="rounded-2xl border p-5"
            style={{ borderColor: APP_COLORS.page.cardBorder, backgroundColor: APP_COLORS.page.cardBackground }}
          >
            <p className="text-xs uppercase tracking-[0.12em]" style={{ color: APP_COLORS.page.cardLabel }}>
              {stat.label}
            </p>
            <p className="mt-2 text-2xl font-medium" style={{ color: APP_COLORS.page.cardValue }}>
              {stat.value}
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
          <li>• Wallet identity is used only for account-specific portfolio views.</li>
          <li>• No private key material is ever transmitted to this application.</li>
        </ul>
      </div>
    </section>
  )
}
