/**
 * Every published figure goes through a security-definer RPC. The stats tables
 * have RLS on and zero policies (§6.1) — never add a policy to make a screen
 * easier.
 *
 * Note the shape of these calls: no `select('*')` anywhere, ever. On `users`
 * that is a hard permission error rather than a trimmed result (§16), and
 * relying on that is how the privacy layer stays load-bearing instead of
 * decorative.
 */

import { supabase } from './supabase'
import type { Tier } from './confidence'

export interface Benchmark {
  job_type_slug: string
  job_type_name: string
  area_name: string
  area_level: 'locality' | 'district' | 'city'
  n: number
  tier: Tier
  low: number | null
  high: number | null
  mid: number | null
  updated_at: string
}

export interface CityBenchmarkRow {
  job_type_slug: string
  job_type_name: string
  size_qualifier: string | null
  typical_hint: string | null
  n: number
  tier: Tier
  low: number | null
  high: number | null
  mid: number | null
}

export async function getAreaBenchmark(
  areaGeohash: string,
  jobSlug: string,
): Promise<Benchmark | null> {
  const { data, error } = await supabase
    .rpc('get_area_benchmark', { p_area_geohash: areaGeohash, p_job_slug: jobSlug })
    .maybeSingle<Benchmark>()

  if (error) throw error
  return data
}

export async function getCityBenchmarks(citySlug: string): Promise<CityBenchmarkRow[]> {
  const { data, error } = await supabase.rpc('get_city_benchmarks', { p_city_slug: citySlug })
  if (error) throw error
  return (data ?? []) as CityBenchmarkRow[]
}

export interface Comparison {
  n: number
  tier: Tier
  low: number | null
  high: number | null
  mid: number | null
  area_name: string
  area_level: string
  verdict: 'below' | 'within' | 'above' | 'unknown'
}

export async function compareToBenchmark(
  areaGeohash: string,
  jobSlug: string,
  serviceAmount: number,
): Promise<Comparison | null> {
  const { data, error } = await supabase
    .rpc('compare_to_benchmark', {
      p_area_geohash: areaGeohash,
      p_job_slug: jobSlug,
      p_service_amount: serviceAmount,
    })
    .maybeSingle<Comparison>()

  if (error) throw error
  return data
}

export interface BookingLessReport {
  jobSlug: string
  amountPaid: number
  /** null means "Not sure". Never forced (§3.3) — it stays selectable forever. */
  partsAmount: number | null
  occurredOn: string
  areaGeohash: string
  comment?: string | null
  rating?: number | null
  nameInPublicFeed?: boolean
  /** Present only on a link you personally sent. Everything else is organic (§13.1). */
  solicitToken?: string | null
}

export async function submitBookingLessReport(report: BookingLessReport): Promise<string> {
  const { data, error } = await supabase.rpc('submit_booking_less_report', {
    p_job_slug: report.jobSlug,
    p_amount_paid: report.amountPaid,
    p_parts_amount: report.partsAmount,
    p_occurred_on: report.occurredOn,
    p_area_geohash: report.areaGeohash,
    p_comment: report.comment ?? null,
    p_rating: report.rating ?? null,
    p_name_in_public_feed: report.nameInPublicFeed ?? false,
    p_solicit_token: report.solicitToken ?? null,
  })

  if (error) throw error
  return data as string
}

export interface MyProfile {
  id: string
  name: string
  public_name: string
  phone: string | null
  role: 'customer' | 'provider' | 'admin'
  share_name_with_provider: boolean
  suspended: boolean
  area_geohash: string | null
  created_at: string
}

/**
 * `name`, `phone` and `location` are ungranted columns on `users` — unreadable
 * through the table by anyone including the row's owner. Reading your own
 * profile therefore goes through a security-definer RPC (§3.1).
 */
export async function getMyProfile(): Promise<MyProfile | null> {
  const { data, error } = await supabase.rpc('get_my_profile').maybeSingle<MyProfile>()
  if (error) throw error
  return data
}

// ---------------------------------------------------------------------------
// Moderation. Every function here is gated on `role = 'admin'` inside the
// database (§5.3) — the screen checks too, but only so it can say something
// useful rather than fail with a permission error.
// ---------------------------------------------------------------------------

export interface ReviewItem {
  bucket:
    | 'low_weight'
    | 'flagged_outlier'
    | 'single_booking_new_account'
  subject_id: string
  detail: string
  at: string
}

/** §9.4 — ten minutes, one page. */
export async function getMondayReview(): Promise<ReviewItem[]> {
  const { data, error } = await supabase.rpc('admin_monday_review')
  if (error) throw error
  return (data ?? []) as ReviewItem[]
}

/**
 * A flagged report that survives review is reinstated at full weight; one that
 * does not is hidden, never deleted (§9.3). Both are logged to
 * moderation_actions, which is what makes compliance evidenceable (§11.1).
 */
export async function moderateReport(
  reportId: string,
  action: 'reinstate' | 'hide',
  reason: string,
): Promise<void> {
  const { error } = await supabase.rpc('moderate_report', {
    p_report_id: reportId,
    p_action: action,
    p_reason: reason,
  })
  if (error) throw error
}

export interface OrganicShare {
  window_days: number
  total: number
  organic: number
  organic_share: number | null
}

/** Metric zero (§13.1). */
export async function getOrganicShare(days = 7): Promise<OrganicShare | null> {
  const { data, error } = await supabase
    .rpc('get_organic_share', { p_days: days })
    .maybeSingle<OrganicShare>()
  if (error) throw error
  return data
}

export interface Coverage {
  pairs_total: number
  pairs_n10: number
  pairs_n20: number
}

export async function getCoverage(): Promise<Coverage | null> {
  const { data, error } = await supabase.rpc('get_coverage').maybeSingle<Coverage>()
  if (error) throw error
  return data
}
