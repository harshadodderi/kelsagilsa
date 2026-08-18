/**
 * Bake the city-level benchmark figures into src/data/benchmarks.generated.ts,
 * so the pre-rendered price pages ship with their numbers in the HTML (§12.5).
 *
 *   npx tsx scripts/sync-benchmarks.ts
 *
 * Run before every web build. The nightly workflow does this after
 * run_nightly() has recomputed the stats, which is the order that matters:
 * recompute, then bake, then export.
 *
 * Only figures the confidence tiers permit are written out — this reads
 * get_city_benchmarks(), which applies the same withholding as every other
 * reader. Nothing here can publish a number the tier would not.
 */

import { writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const url = process.env.EXPO_PUBLIC_SUPABASE_URL
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

if (!url || !anon) {
  console.error('EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are required')
  process.exit(2)
}

interface CityRow {
  job_type_slug: string
  job_type_name: string
  n: number
  tier: string
  low: number | null
  high: number | null
  mid: number | null
}

async function main() {
  const db = createClient(url!, anon!)

  const { data: cities, error: citiesError } = await db
    .from('cities')
    .select('slug, name')
    .eq('live', true)
  if (citiesError) throw citiesError

  const baked: Record<string, Record<string, unknown>> = {}

  for (const city of cities ?? []) {
    const { data, error } = await db.rpc('get_city_benchmarks', { p_city_slug: city.slug })
    if (error) throw error

    baked[city.slug] = Object.fromEntries(
      (data as CityRow[]).map((row) => [
        row.job_type_slug,
        {
          jobTypeName: row.job_type_name,
          areaName: city.name,
          n: row.n,
          tier: row.tier,
          low: row.low,
          high: row.high,
          mid: row.mid,
        },
      ]),
    )
  }

  const header = `/**
 * Benchmark figures baked in at build time. GENERATED — do not edit.
 * Run \`npx tsx scripts/sync-benchmarks.ts\`; the nightly workflow does.
 *
 * City-level figures only: the widest honest answer, and the only one knowable
 * before a reader's browser says where it is. Pages refine to the reader's
 * locality client-side and name whichever level they show (§7.2).
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
export const BAKED_BENCHMARKS: Record<string, Record<string, BakedBenchmark>> = ${JSON.stringify(baked, null, 2)}

export const BAKED_AT: string | null = ${JSON.stringify(new Date().toISOString())}

export function bakedBenchmark(city: string, job: string): BakedBenchmark | null {
  return BAKED_BENCHMARKS[city]?.[job] ?? null
}
`

  writeFileSync('src/data/benchmarks.generated.ts', header)

  const total = Object.values(baked).reduce((sum, jobs) => sum + Object.keys(jobs).length, 0)
  console.log(`Baked ${total} city-level figures across ${cities?.length ?? 0} cities.`)
}

void main()
