/**
 * Throttles raise Postgres exceptions (§6.4). Catch and render them — a
 * throttle must never surface as "something went wrong".
 *
 * The KG* SQLSTATEs are raised with a message already written for a human, so
 * the default here is to show the database's own message rather than to
 * re-invent it in two places and let the two drift.
 */

export const THROTTLE_CODES = {
  KG001: 'reports.per_day',
  KG002: 'reports.booking_less_per_day',
  KG003: 'reports.edit_window',
  KG004: 'reports.too_old',
  KG005: 'providers.category_limit',
  KG006: 'providers.location_change_limit',
  KG007: 'bookings.not_accepting',
  KG008: 'bookings.open_limit',
  KG009: 'bookings.per_day',
  KG010: 'bookings.not_open',
  KG011: 'bookings.quote_immutable',
  KG012: 'bookings.closed',
  KG013: 'reports.needs_done_booking',
  KG014: 'reports.too_soon',
} as const

export type ThrottleCode = keyof typeof THROTTLE_CODES

export interface PostgrestLikeError {
  code?: string
  message?: string
}

export function isThrottle(error: PostgrestLikeError | null | undefined): boolean {
  return !!error?.code && error.code in THROTTLE_CODES
}

/**
 * Returns a message fit to show a person. Only falls back to a generic string
 * for errors that genuinely are unexpected.
 */
export function userFacingMessage(
  error: PostgrestLikeError | null | undefined,
  fallback: string,
): string {
  if (!error) return fallback
  if (isThrottle(error) && error.message) return error.message

  // Permission denied on a column is the privacy layer doing its job (§3.1).
  // It is a bug in the caller, never something to explain to a user.
  if (error.code === '42501') return fallback

  return error.message?.trim() ? error.message : fallback
}
