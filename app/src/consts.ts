export const BRAND_NAME = 'Moocon' as const

export interface NavLink {
  label: string
  path: string
}

export const NAV_LINKS: NavLink[] = [
  { label: 'Vaults', path: '/' },
  { label: 'Profile', path: '/profile' },
  { label: 'Stats', path: '/stats' },
  { label: 'Referrals', path: '/rewards' }
]

export const COLOR_TOKENS = {
  primary: '#3B82F6',
  secondary: '#38BDF8',
  tertiary: '#818CF8',
  neutral: '#1E293B'
} as const

export const TYPOGRAPHY_TOKENS = {
  headline: {
    label: 'Headline',
    fontFamily: 'Space Grotesk'
  },
  body: {
    label: 'Body',
    fontFamily: 'Manrope'
  },
  label: {
    label: 'Label',
    fontFamily: 'Manrope'
  }
} as const

export const APP_COLORS = {
  app: {
    background: '#0A0F1E',
    foreground: '#E2E8F0'
  },
  header: {
    background: '#0B1120',
    brand: '#E2E8F0',
    brandHover: '#FFFFFF',
    navActive: '#60A5FA',
    navDefault: '#94A3B8',
    navHover: '#CBD5E1',
    menuButton: '#CBD5E1',
    menuButtonHoverBg: '#1E293B',
    menuButtonHoverText: '#FFFFFF',
    mobileActiveBg: '#1E293B',
    mobileDefault: '#94A3B8',
    mobileHoverBg: '#1E293B',
    mobileHoverText: '#CBD5E1'
  },
  footer: {
    background: '#0A0F1E',
    border: 'rgba(37, 99, 235, 0.25)',
    text: '#94A3B8',
    heading: '#F1F5F9',
    body: '#94A3B8',
    link: '#CBD5E1',
    linkHover: '#FFFFFF',
    chipBackground: '#1E293B',
    chipBorder: '#334155',
    chipText: '#60A5FA',
    metaLabel: '#94A3B8',
    metaValue: '#E2E8F0'
  },
  page: {
    eyebrow: '#60A5FA',
    title: '#F1F5F9',
    description: '#94A3B8',
    cardBorder: '#2563EB40',
    cardBackground: '#111827',
    cardHeaderBackground: '#1E293B',
    cardLabel: '#60A5FA',
    cardValue: '#E2E8F0',
    notesTitle: '#94A3B8',
    notesText: '#CBD5E1'
  },
  hero: {
    background: '#0B1120',
    orbitOuter: 'rgba(30, 58, 95, 0.5)',
    orbitInner: 'rgba(30, 58, 95, 0.45)',
    glow: 'rgba(59, 130, 246, 0.12)',
    badgeBorder: '#334155',
    badgeBackground: '#1E293B',
    badgeText: '#60A5FA',
    title: '#F1F5F9',
    titleAccent: '#60A5FA',
    subtitle: '#94A3B8',
    primaryCtaBackground: '#3B82F6',
    primaryCtaBackgroundHover: '#2563EB',
    primaryCtaText: '#FFFFFF',
    secondaryCtaBorder: '#334155',
    secondaryCtaBorderHover: '#475569',
    secondaryCtaText: '#F1F5F9',
    secondaryCtaBackgroundHover: '#1E293B',
    panelBackground: 'rgba(11, 17, 32, 0.88)',
    panelBorder: 'rgba(59, 130, 246, 0.15)',
    panelEdgeShadow: '#000000',
    panelLabel: '#94A3B8',
    panelValueDefault: '#FFFFFF',
    panelValueCyan: '#60A5FA',
    panelValuePink: '#93C5FD',
    dotGrid: 'rgba(59, 130, 246, 0.2)',
    dotGradientStart: 'rgba(59, 130, 246, 1)',
    dotGradientMid: 'rgba(96, 165, 250, 0.8)',
    dotGradientEnd: 'rgba(59, 130, 246, 0.15)',
    dotShadow: 'rgba(59, 130, 246, 0.6)',
    mechanicsBackground: '#0F172A',
    mechanicsEyebrow: '#93C5FD',
    mechanicsTitle: '#F1F5F9',
    mechanicsBody: '#94A3B8',
    mechanicsItemIconBackground: '#1E293B',
    mechanicsItemTitle: '#F1F5F9',
    mechanicsItemBody: '#94A3B8',
    mechanicsIconCyan: '#60A5FA',
    mechanicsIconPurple: '#818CF8',
    mechanicsIconPink: '#93C5FD',
    mechanicsFrameOuter: 'rgba(59, 130, 246, 0.12)',
    mechanicsFrameMiddle: 'rgba(59, 130, 246, 0.2)',
    mechanicsFrameInner: 'rgba(59, 130, 246, 0.25)',
    mechanicsFrameBadgeBackground: '#1E293B',
    mechanicsFrameBadgeBorder: 'rgba(96, 165, 250, 0.4)',
    mechanicsFrameBadgeIcon: '#60A5FA',
    mechanicsScoreValue: '#F1F5F9',
    mechanicsScoreLabel: '#94A3B8',
    highlightsBackground: '#0F172A',
    highlightsCardBackgroundStart: '#1E293B',
    highlightsCardBackgroundEnd: '#334155',
    highlightsCardBorder: 'rgba(59, 130, 246, 0.15)',
    highlightsTitle: '#F1F5F9',
    highlightsBody: '#94A3B8',
    highlightsMetricPurple: '#818CF8',
    highlightsMetricCyan: '#60A5FA',
    highlightsMetricWhite: '#F1F5F9',
    highlightsMetricLabel: '#94A3B8',
    highlightsPrimaryButtonBackground: '#3B82F6',
    highlightsPrimaryButtonBackgroundHover: '#2563EB',
    highlightsPrimaryButtonText: '#FFFFFF',
    highlightsSecondaryButtonBorder: '#475569',
    highlightsSecondaryButtonBorderHover: '#64748B',
    highlightsSecondaryButtonText: '#F1F5F9',
    highlightsBadgeIcon: '#60A5FA',
    highlightsBadgeText: '#93C5FD',
    highlightsWatermark: 'rgba(96, 165, 250, 0.08)'
  },
  vault: {
    tagPinkBorder: '#4338CA',
    tagPinkText: '#818CF8',
    tagDarkBackground: '#0F172A',
    tagDarkBorder: '#2563EB40',
    tagDarkText: '#60A5FA',
    stakeButtonBackground: '#0F1D3A',
    stakeButtonBorder: '#2563EB40',
    stakeButtonText: '#60A5FA',
    stakeButtonHoverBackground: '#1E293B'
  },
  loader: {
    dotCyan: '#38BDF8',
    dotPurple: '#3B82F6',
    line: '#38BDF8',
    glow: 'rgba(59, 130, 246, 0.12)',
    text: '#94A3B8'
  },
  shareCard: {
    glowPurple: 'rgba(59, 130, 246, 0.15)',
    glowCyan: 'rgba(56, 189, 248, 0.12)',
  },
  error: {
    text: '#f87171'
  },
  walletButton: {
    background: '#3B82F6',
    backgroundHover: '#2563EB',
    text: '#FFFFFF',
    textHover: '#FFFFFF',
    padding: '1.2rem',
    height: '1rem',
    fontSize: '0.75rem'
  }
} as const
