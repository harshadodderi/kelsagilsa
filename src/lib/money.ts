/**
 * Numbers are the hero (§12.1). Monospace, tabular figures, and no decimals —
 * nobody negotiates a tap repair in paise.
 */

const FORMAT = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })

export function rupees(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return '—'
  return `₹${FORMAT.format(Math.round(amount))}`
}

/**
 * "usually ₹280–₹320", never a standard deviation (§7.5). Someone averaging
 * ₹300 with tight variance is a different proposition from someone averaging
 * ₹300 across ₹100–₹900.
 */
export function rupeeRange(low: number | null, high: number | null): string | null {
  if (low === null || high === null) return null
  return `${rupees(low)}–${rupees(high)}`
}
