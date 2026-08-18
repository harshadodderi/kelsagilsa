import type { TextStyle } from 'react-native'

/**
 * Design tokens, theme-parameterised from day one (§12.2).
 *
 * Both themes ship, defaulting to system. Dark-only is rejected: the user is
 * outdoors in Bangalore daylight on a cheap Android LCD with low peak
 * brightness, which is the worst case for a dark interface.
 *
 * One accent colour, used sparingly. One spacing scale. Restraint, not
 * density — the user has a leaking tap, a cheap phone, and no patience.
 */

export interface Palette {
  background: string
  surface: string
  surfaceMuted: string
  border: string
  text: string
  textMuted: string
  accent: string
  accentText: string
  /** Used only for the +/- verdict on the payback screen. Never for prices. */
  warn: string
}

export const light: Palette = {
  background: '#FBFAF8',
  surface: '#FFFFFF',
  surfaceMuted: '#F2F0EC',
  border: '#E2DED7',
  text: '#171512',
  textMuted: '#635E56',
  accent: '#0B5F53',
  accentText: '#FFFFFF',
  warn: '#8A4B10',
}

export const dark: Palette = {
  background: '#141311',
  surface: '#1D1B18',
  surfaceMuted: '#26241F',
  border: '#38342E',
  text: '#F4F1EC',
  textMuted: '#A9A299',
  accent: '#4FBFA8',
  accentText: '#0B1F1B',
  warn: '#E0A15E',
}

/** One grid, one spacing scale. */
export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const

export const radius = { sm: 6, md: 10, lg: 16 } as const

export const type: Record<
  'price' | 'priceSmall' | 'mono' | 'title' | 'body' | 'input' | 'small',
  TextStyle
> = {
  /** Numbers are the hero. The price is the largest element on a card. */
  price: { fontSize: 34, fontWeight: '700', fontVariant: ['tabular-nums'] },
  priceSmall: { fontSize: 22, fontWeight: '700', fontVariant: ['tabular-nums'] },
  /** Monospace for every number — prices, distances, counts (§12.1). */
  mono: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
  title: { fontSize: 24, fontWeight: '700' },
  body: { fontSize: 17 },
  /** Every input >= 16px or iOS Safari zooms on focus and never back (§12.4). */
  input: { fontSize: 17 },
  small: { fontSize: 14 },
}

export const layout = {
  /** Design at 390px; cap content at ~440px centred on desktop (§12.4). */
  maxContentWidth: 440,
  /** Tap targets >= 44px. */
  minTapTarget: 44,
} as const
