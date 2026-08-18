/**
 * Confidence tiers — §7.3.
 *
 * This mirrors `confidence_tier()` and `displayable_range()` in
 * supabase/migrations/0003_price_engine.sql. The database already withholds
 * the midpoint and widens the interval; this exists so that a client bug can
 * never render a figure more confident than the tier allows, and so the same
 * rule is testable without a database.
 *
 * The fix at low n is not only the label. It is the interval. Most people do
 * not read labels.
 */

export type Tier = 'none' | 'early' | 'typical' | 'established' | 'strong'

export interface StoredStats {
  n: number
  p25: number | null
  p50: number | null
  p75: number | null
  min: number | null
  max: number | null
}

export interface DisplayableRange {
  tier: Tier
  /** Null in the `none` tier: nothing renders below n=5. */
  low: number | null
  high: number | null
  /** Withheld below n=10. A median from eight points invites a precision nobody has earned. */
  mid: number | null
  n: number
}

export function confidenceTier(n: number): Tier {
  if (!Number.isFinite(n) || n < 5) return 'none'
  if (n < 10) return 'early'
  if (n < 20) return 'typical'
  if (n < 50) return 'established'
  return 'strong'
}

export function displayableRange(s: StoredStats): DisplayableRange {
  const tier = confidenceTier(s.n)

  if (tier === 'none') {
    return { tier, low: null, high: null, mid: null, n: s.n }
  }

  // At 5–9 the min–max range is deliberately unhelpful-looking, because the
  // data is. That is the point.
  if (tier === 'early') {
    return { tier, low: s.min, high: s.max, mid: null, n: s.n }
  }

  return { tier, low: s.p25, high: s.p75, mid: s.p50, n: s.n }
}

/**
 * The sample size sits beside every number, always, at legible size (§3.5).
 * These are i18n keys plus a count, never pre-built sentences — never
 * concatenate translated fragments (§12.3).
 */
export function tierLabelKey(tier: Tier): string {
  switch (tier) {
    case 'none':
      return 'benchmark.tier.none'
    case 'early':
      return 'benchmark.tier.early'
    case 'typical':
      return 'benchmark.tier.typical'
    default:
      // At 20+ the count carries it on its own. No adjective.
      return 'benchmark.tier.plain'
  }
}

export type Verdict = 'below' | 'within' | 'above' | 'unknown'

/**
 * §7.4 — instant payback. Returns where a paid amount sits against the range,
 * and nothing more.
 *
 * Never editorialise past this. Do not say they were cheated: you do not know
 * what the job was.
 */
export function compareToRange(serviceAmount: number, range: DisplayableRange): Verdict {
  if (range.low === null || range.high === null) return 'unknown'
  if (serviceAmount < range.low) return 'below'
  if (serviceAmount > range.high) return 'above'
  return 'within'
}
