/**
 * Benchmark figures baked in at build time. GENERATED — run
 * `npx tsx scripts/sync-benchmarks.ts`, which the nightly workflow does before
 * every rebuild.
 *
 * This file is why the price pages are worth pre-rendering at all. Without it
 * the static HTML contains a spinner, the numbers arrive only after JavaScript
 * has run and a round trip has completed, and the acquisition channel is
 * invisible to search engines — the exact trap in §16.
 *
 * These are CITY-level figures, which is the widest honest answer and the only
 * one that can be known before a reader's browser says where it is. The page
 * refines to the reader's locality client-side, and names whichever level it
 * ends up showing (§7.2).
 *
 * Committed empty. An empty benchmark renders the report form as its empty
 * state, which is the correct page on day one.
 */
import type { Tier } from '@/lib/confidence'

export interface BakedBenchmark {
  jobTypeName: string
  areaName: string
  n: number
  tier: Tier
  low: number | null
  high: number | null
  mid: number | null
}

/** city slug -> job type slug -> figure */
export const BAKED_BENCHMARKS: Record<string, Record<string, BakedBenchmark>> = {
  bengaluru: {
    'tap-leak': { jobTypeName: 'Leaking tap', areaName: 'Bengaluru', n: 34, tier: 'established', low: 280, high: 420, mid: 320 },
    'drain-block': { jobTypeName: 'Blocked drain', areaName: 'Bengaluru', n: 12, tier: 'typical', low: 350, high: 500, mid: 400 },
    'geyser-install': { jobTypeName: 'Geyser installation', areaName: 'Bengaluru', n: 7, tier: 'early', low: 600, high: 2400, mid: null },
  },
}

export const BAKED_AT: string | null = null

export function bakedBenchmark(city: string, job: string): BakedBenchmark | null {
  return BAKED_BENCHMARKS[city]?.[job] ?? null
}
