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
    .select('slug, name, size_qualifier, typical_hint')
    .eq('published', true)
    .order('sort_order')
  if (jobsError) throw jobsError

  const { data: cities, error: citiesError } = await db
    .from('cities')
    .select('slug')
    .eq('live', true)
  if (citiesError) throw citiesError

  const body = `/**
 * The launch set: the job types that survived Phase 0, and the cities that are
 * live. This is also the pre-rendered route space (§12.5).
 *
 * GENERATED — run \`npx tsx scripts/sync-launch-set.ts\`. Edit the database.
 *
 * \`name\` is the label shown everywhere a job type appears, and it is the
 * wording people actually used in the sprint rather than a tidied-up term (§2.5).
 *
 * Per-provider pages are deliberately absent: live data, unbounded route space.
 */
export interface JobType {
  slug: string
  name: string
  sizeQualifier: string | null
  typicalHint: string | null
}

export const CITIES = [${(cities ?? []).map((c) => `'${c.slug}'`).join(', ')}] as const

export const JOB_TYPES: JobType[] = ${JSON.stringify(
    (jobs ?? []).map((j) => ({
      slug: j.slug,
      name: j.name,
      sizeQualifier: j.size_qualifier ?? null,
      typicalHint: j.typical_hint ?? null,
    })),
    null,
    2,
  )}

export const JOB_TYPE_SLUGS: string[] = JOB_TYPES.map((j) => j.slug)

export type CitySlug = (typeof CITIES)[number]

export function jobTypeName(slug: string): string {
  return JOB_TYPES.find((j) => j.slug === slug)?.name ?? slug.replace(/-/g, ' ')
}
`

  writeFileSync('src/data/launch-set.ts', body)
  console.log(`Wrote ${jobs?.length ?? 0} job types across ${cities?.length ?? 0} cities.`)
}

void main()
