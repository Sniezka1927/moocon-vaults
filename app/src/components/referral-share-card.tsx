import { COLOR_TOKENS, BRAND_NAME } from '@/consts'
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
        background: '#050A18',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'Space Grotesk, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '60px 80px'
      }}
    >
      {/* ── Background layers ── */}

      {/* Gradient mesh — large blue orb top-right */}
      <div
        style={{
          position: 'absolute',
          top: -200,
          right: -150,
          width: 800,
          height: 800,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(37,99,235,0.35) 0%, rgba(37,99,235,0.08) 40%, transparent 70%)',
          pointerEvents: 'none'
        }}
      />
      {/* Secondary orb — bottom-left cyan */}
      <div
        style={{
          position: 'absolute',
          bottom: -250,
          left: -100,
          width: 700,
          height: 700,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(56,189,248,0.2) 0%, rgba(56,189,248,0.05) 40%, transparent 70%)',
          pointerEvents: 'none'
        }}
      />
      {/* Small accent orb — mid-left */}
      <div
        style={{
          position: 'absolute',
          top: 100,
          left: 300,
          width: 300,
          height: 300,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(129,140,248,0.15) 0%, transparent 70%)',
          pointerEvents: 'none'
        }}
      />

      {/* Scan lines overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.015) 3px, rgba(255,255,255,0.015) 4px)',
          pointerEvents: 'none'
        }}
      />

      {/* Dot grid */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'radial-gradient(circle, rgba(96,165,250,0.12) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          pointerEvents: 'none'
        }}
      />

      {/* Outer border — glowing */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          border: '1px solid rgba(59,130,246,0.2)',
          borderRadius: 0,
          pointerEvents: 'none'
        }}
      />
      {/* Inner border — double-stroke effect */}
      <div
        style={{
          position: 'absolute',
          inset: 12,
          border: '1px solid rgba(59,130,246,0.1)',
          borderRadius: 4,
          pointerEvents: 'none'
        }}
      />

      {/* Corner accents — top-left */}
      <div style={{ position: 'absolute', top: 24, left: 24, pointerEvents: 'none' }}>
        <div style={{ width: 40, height: 2, background: 'rgba(96,165,250,0.6)' }} />
        <div style={{ width: 2, height: 40, background: 'rgba(96,165,250,0.6)' }} />
      </div>
      {/* Corner accents — top-right */}
      <div style={{ position: 'absolute', top: 24, right: 24, pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
        <div style={{ width: 40, height: 2, background: 'rgba(96,165,250,0.6)' }} />
        <div style={{ width: 2, height: 40, background: 'rgba(96,165,250,0.6)', alignSelf: 'flex-end' }} />
      </div>
      {/* Corner accents — bottom-left */}
      <div style={{ position: 'absolute', bottom: 24, left: 24, pointerEvents: 'none', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
        <div style={{ width: 2, height: 40, background: 'rgba(96,165,250,0.6)' }} />
        <div style={{ width: 40, height: 2, background: 'rgba(96,165,250,0.6)' }} />
      </div>
      {/* Corner accents — bottom-right */}
      <div style={{ position: 'absolute', bottom: 24, right: 24, pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'flex-end' }}>
        <div style={{ width: 2, height: 40, background: 'rgba(96,165,250,0.6)', alignSelf: 'flex-end' }} />
        <div style={{ width: 40, height: 2, background: 'rgba(96,165,250,0.6)' }} />
      </div>

      {/* ── Logo watermark — right side ── */}
      <div
        style={{
          position: 'absolute',
          right: -40,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 520,
          height: 520,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none'
        }}
      >
        <img
          src={logoWhite}
          alt=""
          style={{
            height: 420,
            width: 420,
            objectFit: 'contain',
            opacity: 0.06,
            filter: 'drop-shadow(0 0 80px rgba(59,130,246,0.3))'
          }}
        />
      </div>

      {/* ── Content ── */}

      {/* Top badge */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 20px',
          borderRadius: 100,
          background: 'rgba(59,130,246,0.1)',
          border: '1px solid rgba(59,130,246,0.25)',
          alignSelf: 'flex-start',
          zIndex: 1,
          marginBottom: 36
        }}
      >
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3B82F6', boxShadow: '0 0 12px rgba(59,130,246,0.8)' }} />
        <span
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: '#93C5FD',
            letterSpacing: '0.1em',
            textTransform: 'uppercase'
          }}
        >
          {BRAND_NAME} Beta Access
        </span>
      </div>

      {/* Main row */}
      <div style={{ display: 'flex', alignItems: 'center', zIndex: 1, flex: 1 }}>
        {/* Left — code */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 24 }}>
          <span
            style={{
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: '#64748B'
            }}
          >
            Your Referral Code
          </span>

          {/* Neon code box */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '28px 48px',
              borderRadius: 16,
              background: 'linear-gradient(135deg, rgba(59,130,246,0.12) 0%, rgba(129,140,248,0.08) 100%)',
              border: '1px solid rgba(59,130,246,0.35)',
              boxShadow: '0 0 40px rgba(59,130,246,0.15), 0 0 80px rgba(59,130,246,0.08), inset 0 1px 0 rgba(255,255,255,0.05)',
              alignSelf: 'flex-start',
              position: 'relative'
            }}
          >
            {/* Inner glow behind text */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 16,
                background: 'radial-gradient(ellipse at center, rgba(59,130,246,0.1) 0%, transparent 70%)',
                pointerEvents: 'none'
              }}
            />
            <span
              style={{
                fontSize: 72,
                fontWeight: 800,
                color: '#FFFFFF',
                letterSpacing: '0.06em',
                textShadow: '0 0 30px rgba(59,130,246,0.6), 0 0 60px rgba(59,130,246,0.3)',
                position: 'relative'
              }}
            >
              {code}
            </span>
          </div>

          {/* Tagline */}
          <span
            style={{
              fontSize: 16,
              fontWeight: 500,
              color: '#475569',
              letterSpacing: '0.04em',
              marginTop: 8
            }}
          >
            Join the herd. Earn yield together.
          </span>
        </div>
      </div>

      {/* Bottom bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 1,
          marginTop: 24
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img
            src={logoWhite}
            alt=""
            style={{ height: 28, width: 28, objectFit: 'contain', opacity: 0.5 }}
          />
          <span
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: '#475569',
              letterSpacing: '0.08em',
              textTransform: 'uppercase'
            }}
          >
            {BRAND_NAME}
          </span>
        </div>
        <span
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: '#334155',
            letterSpacing: '0.06em'
          }}
        >
          moocon.xyz
        </span>
      </div>
    </div>
  )
}
