import { APP_COLORS } from '@/consts'
import type { CSSProperties } from 'react'

const HERO_DOTS = [
  { left: '6%', top: '14%', size: 3, duration: 16, delay: -2.4, opacity: 0.55 },
  { left: '14%', top: '34%', size: 2, duration: 20, delay: -6.2, opacity: 0.45 },
  { left: '21%', top: '62%', size: 3, duration: 18, delay: -4.1, opacity: 0.6 },
  { left: '29%', top: '22%', size: 2, duration: 22, delay: -8.4, opacity: 0.42 },
  { left: '35%', top: '75%', size: 4, duration: 19, delay: -3.5, opacity: 0.62 },
  { left: '43%', top: '15%', size: 3, duration: 21, delay: -10.2, opacity: 0.5 },
  { left: '49%', top: '52%', size: 2, duration: 15, delay: -5.6, opacity: 0.48 },
  { left: '56%', top: '28%', size: 3, duration: 23, delay: -7.3, opacity: 0.58 },
  { left: '63%', top: '68%', size: 2, duration: 17, delay: -1.9, opacity: 0.4 },
  { left: '71%', top: '18%', size: 4, duration: 24, delay: -11.4, opacity: 0.63 },
  { left: '78%', top: '47%', size: 2, duration: 16, delay: -3.8, opacity: 0.46 },
  { left: '86%', top: '73%', size: 3, duration: 20, delay: -9.1, opacity: 0.52 },
  { left: '92%', top: '29%', size: 2, duration: 18, delay: -2.7, opacity: 0.44 },
] as const

export function HeroBackground() {
  const style = {
    '--hero-bg': APP_COLORS.hero.background,
    '--hero-dot-grid': APP_COLORS.hero.dotGrid,
    '--hero-dot-start': APP_COLORS.hero.dotGradientStart,
    '--hero-dot-mid': APP_COLORS.hero.dotGradientMid,
    '--hero-dot-end': APP_COLORS.hero.dotGradientEnd,
    '--hero-dot-shadow': APP_COLORS.hero.dotShadow,
  } as CSSProperties

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" style={style}>
      <div className="absolute inset-0 bg-[var(--hero-bg)]" />
      <div className="hero-dot-grid absolute inset-0" />
      <div className="hero-dots absolute inset-0" aria-hidden>
        {HERO_DOTS.map((dot) => (
          <span
            key={dot.left}
            className="hero-dot"
            style={{
              left: dot.left,
              top: dot.top,
              width: dot.size,
              height: dot.size,
              animationDuration: `${dot.duration}s`,
              animationDelay: `${dot.delay}s`,
              opacity: dot.opacity,
            }}
          />
        ))}
      </div>
    </div>
  )
}
