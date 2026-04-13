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
  primary: '#BD93F9',
  secondary: '#8BE9FD',
  tertiary: '#FF79C6',
  neutral: '#1E1F29'
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
    background: '#080D1E',
    foreground: '#E8EDF7'
  },
  header: {
    background: '#0C1020',
    brand: '#E8EDF7',
    brandHover: '#FFFFFF',
    navActive: '#3FD2F8',
    navDefault: '#8192B7',
    navHover: '#B5C0DE',
    menuButton: '#C9D3EC',
    menuButtonHoverBg: '#1B2442',
    menuButtonHoverText: '#FFFFFF',
    mobileActiveBg: '#12203A',
    mobileDefault: '#8E9DBF',
    mobileHoverBg: '#101932',
    mobileHoverText: '#C1CAE2'
  },
  footer: {
    background: '#0A0F20',
    border: 'rgba(78, 94, 136, 0.4)',
    text: '#7E90B8',
    heading: '#F1F4FB',
    body: '#9CA8C7',
    link: '#C9D2EB',
    linkHover: '#FFFFFF',
    chipBackground: '#141C34',
    chipBorder: '#2C3A63',
    chipText: '#75D4E8',
    metaLabel: '#8A96B8',
    metaValue: '#D6DEF2'
  },
  page: {
    eyebrow: '#6BC8E4',
    title: '#E8EDF7',
    description: '#99A8CC',
    cardBorder: '#1A3A5C',
    cardBackground: '#0B1628',
    cardHeaderBackground: '#0D1E36',
    cardLabel: '#4DB8D4',
    cardValue: '#C8E8F8',
    notesTitle: '#9AA9CB',
    notesText: '#B5C0DE'
  },
  hero: {
    background: '#0C1020',
    orbitOuter: 'rgba(26, 39, 70, 0.5)',
    orbitInner: 'rgba(24, 35, 63, 0.45)',
    glow: 'rgba(77, 216, 255, 0.12)',
    badgeBorder: '#28406B',
    badgeBackground: '#101A34',
    badgeText: '#65D2F3',
    title: '#F4F7FF',
    titleAccent: '#57D2F3',
    subtitle: '#8F9AB7',
    primaryCtaBackground: '#BD93F9',
    primaryCtaBackgroundHover: '#CAA7FC',
    primaryCtaText: '#3F2B70',
    secondaryCtaBorder: '#303D62',
    secondaryCtaBorderHover: '#3E4E7D',
    secondaryCtaText: '#F2F5FF',
    secondaryCtaBackgroundHover: '#111A34',
    panelBackground: 'rgba(12, 16, 32, 0.88)',
    panelBorder: 'rgba(74, 68, 81, 0.3)',
    panelEdgeShadow: '#000000',
    panelLabel: '#CCC3D3',
    panelValueDefault: '#FFFFFF',
    panelValueCyan: '#75D4E8',
    panelValuePink: '#FFAFD7',
    dotGrid: 'rgba(86, 144, 218, 0.26)',
    dotGradientStart: 'rgba(121, 222, 255, 1)',
    dotGradientMid: 'rgba(81, 169, 255, 0.8)',
    dotGradientEnd: 'rgba(81, 169, 255, 0.15)',
    dotShadow: 'rgba(109, 196, 255, 0.7)',
    mechanicsBackground: '#121628',
    mechanicsEyebrow: '#AFA3D6',
    mechanicsTitle: '#F0F3FA',
    mechanicsBody: '#9CA5C2',
    mechanicsItemIconBackground: '#1F2439',
    mechanicsItemTitle: '#F1F4FB',
    mechanicsItemBody: '#A0A9C4',
    mechanicsIconCyan: '#75D4E8',
    mechanicsIconPurple: '#B395F7',
    mechanicsIconPink: '#FFAFD7',
    mechanicsFrameOuter: 'rgba(64, 75, 116, 0.25)',
    mechanicsFrameMiddle: 'rgba(78, 92, 136, 0.4)',
    mechanicsFrameInner: 'rgba(62, 103, 156, 0.45)',
    mechanicsFrameBadgeBackground: '#1F2338',
    mechanicsFrameBadgeBorder: 'rgba(132, 147, 189, 0.55)',
    mechanicsFrameBadgeIcon: '#C7AEFF',
    mechanicsScoreValue: '#F4F7FF',
    mechanicsScoreLabel: '#919DC1',
    highlightsBackground: '#0F1324',
    highlightsCardBackgroundStart: '#1A1E33',
    highlightsCardBackgroundEnd: '#242A45',
    highlightsCardBorder: 'rgba(75, 90, 132, 0.28)',
    highlightsTitle: '#F0F3FA',
    highlightsBody: '#B2B9CE',
    highlightsMetricPurple: '#C8A8FF',
    highlightsMetricCyan: '#75D4E8',
    highlightsMetricWhite: '#F4F7FF',
    highlightsMetricLabel: '#A4ABC1',
    highlightsPrimaryButtonBackground: '#BA9AF4',
    highlightsPrimaryButtonBackgroundHover: '#C7ACF8',
    highlightsPrimaryButtonText: '#3B2B67',
    highlightsSecondaryButtonBorder: '#545D7B',
    highlightsSecondaryButtonBorderHover: '#646F93',
    highlightsSecondaryButtonText: '#F1F4FB',
    highlightsBadgeIcon: '#BBA3FF',
    highlightsBadgeText: '#DFD1FF',
    highlightsWatermark: 'rgba(146, 158, 196, 0.12)'
  },
  vault: {
    tagPinkBorder: '#9B5580',
    tagPinkText: '#C87DAF',
    tagDarkBackground: '#0D2035',
    tagDarkBorder: '#1A3A5C',
    tagDarkText: '#6BBAD4',
    stakeButtonBackground: '#0D2035',
    stakeButtonBorder: '#1A3A5C',
    stakeButtonText: '#75D4E8',
    stakeButtonHoverBackground: '#112840'
  },
  loader: {
    dotCyan: '#8BE9FD',
    dotPurple: '#BD93F9',
    line: '#8BE9FD',
    glow: 'rgba(77, 216, 255, 0.12)',
    text: '#8192B7'
  },
  shareCard: {
    glowPurple: 'rgba(189, 147, 249, 0.15)',
    glowCyan: 'rgba(139, 233, 253, 0.12)',
  },
  walletButton: {
    background: '#8BE9FD',
    backgroundHover: '#A3EFFE',
    text: '#0A4050',
    textHover: '#083340',
    padding: '1.2rem',
    height: '1rem',
    fontSize: '0.75rem'
  }
} as const
