const STEPS = [
  {
    num: 1,
    title: "Deposit",
    desc: "Deposit USDC or WSOL into a Moocon Vault.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-7 w-7">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
  },
  {
    num: 2,
    title: "Earn",
    desc: "Tokens earn yield automatically via Jupiter Lending.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-7 w-7">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
      </svg>
    ),
  },
  {
    num: 3,
    title: "Pool",
    desc: "Yield pools together across all depositors in the vault.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-7 w-7">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
      </svg>
    ),
  },
  {
    num: 4,
    title: "Win",
    desc: "One depositor wins all pooled yield every 30–60 minutes.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-7 w-7">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .982-3.172M12 3.75a3 3 0 1 1-3 3m6 0a3 3 0 1 0-3-3m0 0v3.172" />
      </svg>
    ),
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative z-10 py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        {/* Header */}
        <div className="mb-16 text-center">
          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-primary-light">
            How it Works
          </span>
          <h2 className="mt-3 font-headline text-3xl font-bold uppercase tracking-tight text-[#F1F5F9] md:text-4xl">
            From Deposit to Prize in Minutes
          </h2>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <div key={step.num} className="relative flex flex-col items-center">
              {/* Connector line (hidden on mobile and last item) */}
              {i < STEPS.length - 1 && (
                <div className="absolute right-0 top-12 hidden h-px w-6 translate-x-full bg-gradient-to-r from-primary/40 to-transparent lg:block" />
              )}

              <div className="glass-card glass-card-hover flex h-full w-full flex-col items-center p-8 text-center">
                {/* Icon */}
                <div className="mb-4 text-primary-light">{step.icon}</div>
                {/* Title */}
                <h3 className="mb-2 font-headline text-lg font-bold uppercase tracking-tight text-[#F1F5F9]">
                  {step.title}
                </h3>
                {/* Desc */}
                <p className="text-sm leading-relaxed text-muted">
                  {step.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
