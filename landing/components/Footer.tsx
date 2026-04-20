import Image from 'next/image'

function XIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4 fill-current"
    >
      <path d="M18.244 2H21.55l-7.226 8.26L23 22h-6.74l-5.28-6.91L4.94 22H1.63l7.73-8.84L1 2h6.91l4.77 6.23L18.244 2Zm-1.16 18h1.833L6.915 3.895H4.947L17.083 20Z" />
    </svg>
  )
}

function GithubIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z" />
    </svg>
  )
}

function DocsIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className="h-4 w-4"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"
      />
    </svg>
  )
}

const SOCIAL_LINKS = [
  { label: 'X', href: 'https://x.com/Sniezka1927', Icon: XIcon },
  {
    label: 'GitHub',
    href: 'https://github.com/Sniezka1927/moocon-vaults',
    Icon: GithubIcon
  },
  { label: 'Docs', href: 'https://docs.moocon.xyz/', Icon: DocsIcon }
]

export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="relative z-10 w-full border-t border-[rgba(37,99,235,0.25)] bg-[#0A0F1E]/90 px-6 py-6 md:px-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-4 sm:flex-row sm:justify-between">
        {/* Left: logo + copyright */}
        <div className="flex items-center gap-3">
          <Image src="/logo-white.png" alt="Moocon" width={24} height={24} />
          <span className="text-[11px] uppercase tracking-[0.12em] text-muted">
            {year} &copy; Moocon
          </span>
        </div>

        {/* Right: social */}
        <div className="flex items-center gap-2">
          {SOCIAL_LINKS.map(({ label, href, Icon }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={label}
              className="flex h-8 w-8 items-center justify-center rounded border border-surface-border bg-surface text-primary-light transition-colors hover:text-white"
            >
              <Icon />
            </a>
          ))}
        </div>
      </div>
    </footer>
  )
}
