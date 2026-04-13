import { APP_COLORS, COLOR_TOKENS, BRAND_NAME } from '@/consts'
import logoWhite from '@/icons/logo-white.png'

interface ReferralShareCardProps {
  code: string
  cardRef: React.RefObject<HTMLDivElement | null>
}

export function ReferralShareCard({ code, cardRef }: ReferralShareCardProps) {
  return (
    <div
      ref={cardRef}
      style={{
        width: 1200,
        height: 630,
        background: `linear-gradient(135deg, ${APP_COLORS.app.background} 0%, ${APP_COLORS.page.cardBackground} 50%, #0E1A30 100%)`,
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'Space Grotesk, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        padding: '60px 70px'
      }}
    >
      {/* Glow effects */}
      <div
        style={{
          position: 'absolute',
          top: -120,
          right: -80,
          width: 500,
          height: 500,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${APP_COLORS.shareCard.glowPurple} 0%, transparent 70%)`,
          pointerEvents: 'none'
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: -100,
          left: -60,
          width: 400,
          height: 400,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${APP_COLORS.shareCard.glowCyan} 0%, transparent 70%)`,
          pointerEvents: 'none'
        }}
      />

      {/* Border overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          border: `2px solid ${APP_COLORS.page.cardBorder}`,
          borderRadius: 24,
          pointerEvents: 'none'
        }}
      />

      {/* Top left heading */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 14, zIndex: 1 }}
      >
        <span
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: APP_COLORS.app.foreground,
            letterSpacing: '0.04em'
          }}
        >
          {BRAND_NAME} Beta Access
        </span>
      </div>

      {/* Main content */}
      <div
        style={{
          display: 'flex',
          flex: 1,
          alignItems: 'center',
          zIndex: 1,
          marginTop: 20
        }}
      >
        {/* Left side */}
        <div
          style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 32 }}
        >
          <span
            style={{
              fontSize: 42,
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: APP_COLORS.page.cardLabel
            }}
          >
            Referral Code
          </span>

          {/* Code display */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '24px 44px',
              borderRadius: 16,
              background: 'rgba(189, 147, 249, 0.08)',
              border: '1px solid rgba(189, 147, 249, 0.25)',
              alignSelf: 'flex-start'
            }}
          >
            <span
              style={{
                fontSize: 64,
                fontWeight: 800,
                color: COLOR_TOKENS.primary,
                letterSpacing: '0.08em'
              }}
            >
              {code}
            </span>
          </div>
        </div>

        {/* Right side — logo */}
        <div
          style={{
            width: 450,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <img
            src={logoWhite}
            alt=""
            style={{
              height: 500,
              width: 500,
              objectFit: 'contain',
              opacity: 0.25,
              borderRadius: '50%',
              filter: `drop-shadow(0 0 40px ${APP_COLORS.shareCard.glowPurple})`
            }}
          />
        </div>
      </div>
    </div>
  )
}
