const QUESTIONS = [
  {
    q: 'Is my deposit safe?',
    a: 'Yes. Your principal never enters the lottery. Only the pooled yield from Jupiter Lending is raffled as prizes. You can withdraw your full deposit at any time.'
  },
  {
    q: 'How are winners chosen?',
    a: 'Winners are selected using ORAO VRF on-chain randomness combined with a Commit-Reveal scheme. All participants are snapshotted into a Merkle tree, and anyone can verify the result with their Merkle proof. No single party can predict or influence the outcome.'
  },
  {
    q: 'What tokens can I deposit?',
    a: 'Currently USDC and WSOL are supported. Any token supported by Jupiter Lending can be added in the future.'
  },
  {
    q: 'How long are prize rounds?',
    a: 'Each round lasts 30–60 minutes on Devnet. One depositor wins the entire pooled yield at the end of every round.'
  },
  {
    q: 'What are points and multipliers?',
    a: 'You earn stake points by holding pTokens (your deposit receipt). Referring friends earns referral points. Multipliers boost both your points earned and the number of drawing tickets you hold, improving your odds.'
  }
]

export function FAQ() {
  return (
    <section id="faq" className="relative z-10 py-24 md:py-32">
      <div className="mx-auto max-w-3xl px-4 md:px-8">
        {/* Header */}
        <div className="mb-16 text-center">
          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-primary-light">
            FAQ
          </span>
          <h2 className="mt-3 font-headline text-3xl font-bold uppercase tracking-tight text-[#F1F5F9] md:text-4xl">
            Common Questions
          </h2>
        </div>

        {/* Accordion */}
        <div className="flex flex-col gap-3">
          {QUESTIONS.map((item) => (
            <details key={item.q} className="glass-card group">
              <summary className="flex cursor-pointer items-center justify-between px-6 py-5">
                <span className="pr-4 text-sm font-semibold text-[#F1F5F9] md:text-base">
                  {item.q}
                </span>
                <svg
                  className="faq-chevron h-5 w-5 shrink-0 text-muted"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
                    clipRule="evenodd"
                  />
                </svg>
              </summary>
              <div className="border-t border-white/5 px-6 pb-5 pt-4">
                <p className="text-sm leading-relaxed text-muted">{item.a}</p>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
