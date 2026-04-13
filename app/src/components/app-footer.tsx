import { APP_COLORS, BRAND_NAME } from '@/consts'
import { BookOpenText, Github } from 'lucide-react'
import type { CSSProperties } from 'react'

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
      <path d="M18.244 2H21.55l-7.226 8.26L23 22h-6.74l-5.28-6.91L4.94 22H1.63l7.73-8.84L1 2h6.91l4.77 6.23L18.244 2Zm-1.16 18h1.833L6.915 3.895H4.947L17.083 20Z" />
    </svg>
  )
}

function TelegramIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  )
}

const SOCIAL_LINKS = [
  { label: 'X', href: 'https://x.com', Icon: XIcon },
  { label: 'Telegram', href: 'https://t.me', Icon: TelegramIcon },
  { label: 'GitHub', href: 'https://github.com', Icon: Github },
  { label: 'Docs', href: '#', Icon: BookOpenText },
]

export function AppFooter() {
  const year = new Date().getFullYear()
  const footerStyle = {
    '--footer-bg': APP_COLORS.footer.background,
    '--footer-border': APP_COLORS.footer.border,
    '--footer-text': APP_COLORS.footer.text,
    '--footer-link-hover': APP_COLORS.footer.linkHover,
    '--footer-chip-bg': APP_COLORS.footer.chipBackground,
    '--footer-chip-border': APP_COLORS.footer.chipBorder,
    '--footer-chip-text': APP_COLORS.footer.chipText,
  } as CSSProperties

  return (
    <footer
      className="w-full border-t border-[var(--footer-border)] bg-[var(--footer-bg)] px-6 py-4 md:px-10"
      style={footerStyle}
    >
      <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between">
        <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--footer-text)]">
          {year} © {BRAND_NAME}
        </span>

        <div className="flex items-center gap-2">
          {SOCIAL_LINKS.map(({ label, href, Icon }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={label}
              className="flex h-8 w-8 items-center justify-center rounded border border-[var(--footer-chip-border)] bg-[var(--footer-chip-bg)] text-[var(--footer-chip-text)] transition-colors hover:text-[var(--footer-link-hover)]"
            >
              <Icon className="h-4 w-4" />
            </a>
          ))}
        </div>
      </div>
    </footer>
  )
}
