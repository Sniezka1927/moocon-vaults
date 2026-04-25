import Image from 'next/image'

export function Hero() {
  return (
    <section className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-20 md:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-16 lg:flex-row lg:items-center lg:justify-between">
        {/* Text */}
        <div className="flex max-w-2xl flex-col items-center text-center lg:items-start lg:text-left">
          {/* Badge */}
          <div className="mb-6 flex items-center gap-2 rounded-full border border-surface-border bg-surface px-4 py-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-primary-light">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400" />
            </span>
            Devnet beta is live!
          </div>

          {/* Headline */}
          <h1 className="font-headline text-4xl font-bold uppercase leading-[1.1] tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
            <span className="bg-gradient-to-r from-white via-primary-light to-secondary bg-clip-text text-transparent">
              Earn Yield.
            </span>
            <br />
            <span className="text-[#F1F5F9]">Keep Your Principal.</span>
          </h1>

          {/* Subtitle */}
          <p className="mt-6 max-w-xl text-base leading-relaxed text-muted md:text-lg">
            Deposit tokens into Moocon Vaults. Yield is pooled and raffled to
            one winner every 30–60 minutes. Your capital stays safe — always.
          </p>

          {/* CTAs */}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href="https://app.moocon.xyz"
              className="inline-flex h-12 items-center justify-center rounded-full bg-primary px-8 text-sm font-semibold uppercase tracking-widest text-white transition-colors hover:bg-[#2563EB]"
            >
              Launch App
            </a>
            <a
              href="https://docs.moocon.xyz/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-center justify-center rounded-full border border-surface-border px-8 text-sm font-semibold uppercase tracking-widest text-[#F1F5F9] transition-colors hover:border-[#475569] hover:bg-surface"
            >
              Read Docs
            </a>
          </div>
        </div>

        {/* Logo */}
        <div className="relative hidden lg:block">
          <div className="animate-float">
            <Image
              src="/logo-white.png"
              alt="Moocon logo"
              width={280}
              height={280}
              className="drop-shadow-[0_0_60px_rgba(59,130,246,0.4)]"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
