import { Text, View } from 'react-native'
import { useTheme, space, type as typeTokens } from '@/theme'
import { rupeeRange, rupees } from '@/lib/money'
import { t } from '@/lib/i18n'
import { tierLabelKey, type Tier } from '@/lib/confidence'

export interface PriceFigureProps {
  n: number
  tier: Tier
  low: number | null
  high: number | null
  mid: number | null
  /** The empty state is the report form, not a greyed-out box (§7.3). */
  onAddReport?: () => void
  emptyAction?: React.ReactNode
}

/**
 * The one component that decides how confident a published number looks.
 *
 * It renders exactly what the tier permits and nothing else:
 *
 *   n 0–4    nothing. Not greyed, not "coming soon" — the empty state is the
 *            report form
 *   n 5–9    min–max, no midpoint. Deliberately unhelpful-looking, because the
 *            data is
 *   n 10+    P25–P75 with a midpoint
 *
 * The sample size sits beside the number, always, at legible size (§3.5). Do
 * not add a prop that bypasses any of this.
 */
export function PriceFigure({ n, tier, low, high, mid, emptyAction }: PriceFigureProps) {
  const c = useTheme()
  const range = rupeeRange(low, high)

  if (tier === 'none' || range === null) {
    return (
      <View style={{ gap: space.sm }}>
        <Text style={{ ...typeTokens.body, color: c.textMuted }}>
          {t('benchmark.tier.none')}
        </Text>
        {emptyAction}
      </View>
    )
  }

  return (
    <View style={{ gap: space.xs }}>
      <Text
        accessibilityRole="header"
        style={{ ...typeTokens.price, ...typeTokens.mono, color: c.text }}
      >
        {range}
      </Text>

      {/* The midpoint appears only from n=10. A median from eight points
          invites a precision nobody has earned. */}
      {mid !== null && (
        <Text style={{ ...typeTokens.small, ...typeTokens.mono, color: c.textMuted }}>
          {t('benchmark.midpoint', { amount: rupees(mid) })}
        </Text>
      )}

      <Text style={{ ...typeTokens.small, color: c.textMuted }}>
        {t(tierLabelKey(tier) as Parameters<typeof t>[0], { n })}
      </Text>

      {/* §11.5 — on every figure, without exception. */}
      <Text style={{ ...typeTokens.small, color: c.textMuted }}>{t('legal.not_a_quote')}</Text>
    </View>
  )
}
