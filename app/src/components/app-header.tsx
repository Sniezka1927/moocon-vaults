import { Link } from 'react-router'
import type { CSSProperties, ReactNode } from 'react'
import { APP_COLORS, NavLink } from '@/consts'
import logoWhite from '@/icons/logo-white.png'

interface AppHeaderProps {
  brandName: string
  links: (NavLink & { active: boolean })[]
  showMenu: boolean
  onToggleMenu: () => void
  onNavigate: () => void
  walletSlot?: ReactNode
}

export function AppHeader({
  brandName,
  links,
  showMenu,
  onToggleMenu,
  onNavigate,
  walletSlot
}: AppHeaderProps) {
  const showDesktopWallet = Boolean(walletSlot)
  const headerStyle = {
    '--header-bg': APP_COLORS.header.background,
    '--header-brand': APP_COLORS.header.brand,
    '--header-brand-hover': APP_COLORS.header.brandHover,
    '--header-nav-active': APP_COLORS.header.navActive,
    '--header-nav-default': APP_COLORS.header.navDefault,
    '--header-nav-hover': APP_COLORS.header.navHover,
    '--header-menu-button': APP_COLORS.header.menuButton,
    '--header-menu-hover-bg': APP_COLORS.header.menuButtonHoverBg,
    '--header-menu-hover-text': APP_COLORS.header.menuButtonHoverText,
    '--header-mobile-active-bg': APP_COLORS.header.mobileActiveBg,
    '--header-mobile-default': APP_COLORS.header.mobileDefault,
    '--header-mobile-hover-bg': APP_COLORS.header.mobileHoverBg,
    '--header-mobile-hover-text': APP_COLORS.header.mobileHoverText
  } as CSSProperties

  return (
    <header className="relative z-50 bg-[var(--header-bg)]" style={headerStyle}>
      <div className="w-full bg-[var(--header-bg)] px-5 py-5 md:px-10">
        <div className="flex items-center justify-between gap-4">
          <Link
            to="/"
            className="flex items-center gap-2 text-2xl font-black uppercase tracking-tight text-[var(--header-brand)] transition-colors hover:text-[var(--header-brand-hover)] md:text-[2.4rem]"
            onClick={onNavigate}
          >
            <img
              src={logoWhite}
              alt="logo"
              className="h-16 w-16 object-contain"
            />
            {brandName}
          </Link>

          {showDesktopWallet ? (
            <div className="flex items-center justify-end">{walletSlot}</div>
          ) : null}
        </div>
      </div>
    </header>
  )
}
