import { AppFooter } from '@/components/app-footer'
import { AppHeader } from '@/components/app-header'
import { HeroBackground } from '@/components/hero-section'
import { APP_COLORS, BRAND_NAME, NAV_LINKS } from '@/consts'

import { WalletButton } from '@/lib/solana/provider'
import { useAllVaults } from '@/lib/queries/use-vaults'
import { useVaultSubscriptions } from '@/lib/queries/use-vault-subscriptions'
import { useMemo, useState } from 'react'
import { useLocation } from 'react-router'
import type { CSSProperties, ReactNode } from 'react'

export function AppLayout({ children }: { children: ReactNode }) {
  const { data: vaults = [] } = useAllVaults()
  useVaultSubscriptions(vaults)
  const [showMenu, setShowMenu] = useState(false)
  const { pathname } = useLocation()

  const links = useMemo(
    () =>
      NAV_LINKS.map((link) => ({
        ...link,
        active:
          link.path === '/' ? pathname === '/' : pathname.startsWith(link.path)
      })),
    [pathname]
  )

  function handleNavigate() {
    setShowMenu(false)
  }

  const style = {
    backgroundColor: APP_COLORS.app.background,
    color: APP_COLORS.app.foreground,
    '--wallet-btn-bg': APP_COLORS.walletButton.background,
    '--wallet-btn-bg-hover': APP_COLORS.walletButton.backgroundHover,
    '--wallet-btn-text': APP_COLORS.walletButton.text,
    '--wallet-btn-text-hover': APP_COLORS.walletButton.textHover,
    '--wallet-btn-padding': APP_COLORS.walletButton.padding,
    '--wallet-btn-height': APP_COLORS.walletButton.height,
    '--wallet-btn-font-size': APP_COLORS.walletButton.fontSize
  } as CSSProperties

  return (
    <div
      className="relative flex h-screen flex-col overflow-hidden"
      style={style}
    >
      <HeroBackground />
      <main className="relative flex-1 overflow-y-auto">
        <AppHeader
          brandName={BRAND_NAME}
          links={links}
          showMenu={showMenu}
          onToggleMenu={() => setShowMenu((v) => !v)}
          onNavigate={handleNavigate}
          walletSlot={<WalletButton />}
        />
        {children}
        <AppFooter />
      </main>

      <a
        href="https://jup.ag/lend"
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 border border-[#2563EB40] bg-[#0F172A]/80 px-3.5 py-2 backdrop-blur-sm transition-colors hover:bg-[#0F172A]"
      >
        <img src="https://static.jup.ag/jup/icon.png" alt="Jupiter" className="h-5 w-5 rounded-full" />
        <span className="whitespace-nowrap text-[13px] font-medium text-[#94A3B8]">Built on Jupiter Lend</span>
      </a>
    </div>
  )
}
