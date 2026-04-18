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

const SOCIAL_LINKS = [
  { label: 'X', href: 'https://x.com/Sniezka1927', Icon: XIcon },
  { label: 'GitHub', href: 'https://github.com/Sniezka1927/moocon-vaults', Icon: Github },
  { label: 'Docs', href: 'https://docs.moocon.xyz/', Icon: BookOpenText },
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
