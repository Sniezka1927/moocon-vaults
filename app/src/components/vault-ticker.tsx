import type { CSSProperties } from 'react'
import { APP_COLORS } from '@/consts'
import { useAllVaults } from '@/lib/queries/use-vaults'
import { useMintStore } from '@/lib/store/mint-store'
import { useVaultCountdown } from '@/lib/hooks/use-vault-countdown'
import type { VaultWithAddress } from '@/lib/store/vault-store'

const SECONDS_PER_ITEM = 6
const MIN_ITEMS_PER_COPY = 30

export function VaultTicker() {
  const { data: vaults = [] } = useAllVaults()

  if (vaults.length === 0) return null

  const repeats = Math.max(1, Math.ceil(MIN_ITEMS_PER_COPY / vaults.length))
  const itemsPerCopy = vaults.length * repeats
  const duration = `${itemsPerCopy * SECONDS_PER_ITEM}s`

  const trackStyle = {
    animationDuration: duration,
  } as CSSProperties

  return (
    <div
      className="vault-ticker fixed top-0 left-0 right-0 z-[60] w-full overflow-hidden border-b"
      style={{
        backgroundColor: APP_COLORS.footer.background,
        borderColor: APP_COLORS.footer.border,
      }}
    >
      <div
        className="vault-ticker-track flex w-max items-center py-2"
        style={trackStyle}
      >
        {[0, 1].map((copy) => (
          <div
            key={copy}
            className="flex shrink-0 items-center"
            aria-hidden={copy === 1}
          >
            {Array.from({ length: repeats }).flatMap((_, r) =>
              vaults.map((vault) => (
                <TickerItem
                  key={`${copy}-${r}-${vault.address.toBase58()}`}
                  vault={vault}
                />
              ))
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function TickerItem({ vault }: { vault: VaultWithAddress }) {
  const mint = useMintStore((s) => s.getMint(vault.mint.toBase58()))
  const countdown = useVaultCountdown(vault.distributionTiers)
  const symbol = mint?.symbol ?? `${vault.mint.toBase58().slice(0, 4)}…`
  const isReady = countdown === '00:00'

  return (
    <div className="flex shrink-0 items-center gap-3 px-6">
      {mint?.icon ? (
        <img
          src={mint.icon}
          alt=""
          className="h-5 w-5 rounded-full object-contain"
        />
      ) : null}
      <span
        className="text-[11px] font-semibold uppercase tracking-[0.18em]"
        style={{ color: APP_COLORS.page.cardLabel }}
      >
        {symbol}
      </span>
      <span
        className="text-[11px]"
        style={{ color: APP_COLORS.footer.text }}
      >
        ·
      </span>
      <span
        className="font-mono text-[12px] tabular-nums tracking-wider"
        style={{
          color: isReady ? APP_COLORS.hero.titleAccent : APP_COLORS.page.cardValue,
        }}
      >
        {isReady ? 'DRAWING…' : countdown || '—'}
      </span>
      <span
        className="ml-3 select-none text-[11px] font-bold"
        style={{ color: APP_COLORS.footer.border }}
      >
        //
      </span>
    </div>
  )
}
