/**
 * Rewrite src/data/launch-set.ts from what is actually published in the
 * database, so the pre-rendered route space and the launch set cannot drift
 * (§12.5).
 *
 *   npx tsx scripts/sync-launch-set.ts
 */

import { writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const url = process.env.EXPO_PUBLIC_SUPABASE_URL
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

if (!url || !anon) {
  console.error('EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are required')
  process.exit(2)
}

async function main() {
  const db = createClient(url!, anon!)

  const { data: jobs, error: jobsError } = await db
    .from('job_types')
    .select('slug')
    .eq('published', true)
    .order('sort_order')
  if (jobsError) throw jobsError

  const { data: cities, error: citiesError } = await db
    .from('cities')
    .select('slug')
    .eq('live', true)
  if (citiesError) throw citiesError

  const body = `/**
 * The pre-rendered route space. GENERATED — run \`npx tsx scripts/sync-launch-set.ts\`.
 *
 * Per-provider pages are deliberately absent: live data, unbounded route space.
 */
export const CITIES = [${(cities ?? []).map((c) => `'${c.slug}'`).join(', ')}] as const

export const JOB_TYPE_SLUGS = [
${(jobs ?? []).map((j) => `  '${j.slug}',`).join('\n')}
] as const

export type CitySlug = (typeof CITIES)[number]
`

  writeFileSync('src/data/launch-set.ts', body)
  console.log(`Wrote ${jobs?.length ?? 0} job types across ${cities?.length ?? 0} cities.`)
}

void main()
