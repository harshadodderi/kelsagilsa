/**
 * The launch set: the job types that survived Phase 0, and the cities that are
 * live. This is also the pre-rendered route space (§12.5).
 *
 * GENERATED — run `npx tsx scripts/sync-launch-set.ts`; the nightly workflow
 * does. Edit the database, not this file.
 *
 * `name` is the label shown everywhere a job type appears: on the price page,
 * in the city index, and on the report form's picker. It is deliberately the
 * wording people actually used in the sprint rather than a tidied-up term — if
 * everyone says "tap leaking", nobody is searching for "faucet repair" (§2.5).
 *
 * Per-provider pages are deliberately absent: live data, unbounded route space.
 */
export interface JobType {
  slug: string
  name: string
  sizeQualifier: string | null
  typicalHint: string | null
}

export const CITIES = ['bengaluru'] as const

export const JOB_TYPES: JobType[] = [
  { slug: 'tap-leak', name: 'Leaking tap', sizeQualifier: null, typicalHint: 'Usually a washer or cartridge change' },
  { slug: 'pipe-leak', name: 'Leaking pipe', sizeQualifier: null, typicalHint: null },
  { slug: 'drain-block', name: 'Blocked drain', sizeQualifier: null, typicalHint: null },
  { slug: 'flush-repair', name: 'Flush tank not working', sizeQualifier: null, typicalHint: null },
  { slug: 'geyser-install', name: 'Geyser installation', sizeQualifier: 'up to 25L', typicalHint: 'Ask whether the wall bracket is included' },
  { slug: 'motor-repair', name: 'Water motor or pump repair', sizeQualifier: null, typicalHint: null },
  { slug: 'tap-fitting', name: 'New tap fitting', sizeQualifier: null, typicalHint: null },
  { slug: 'toilet-install', name: 'Toilet installation', sizeQualifier: null, typicalHint: null },
]

export const JOB_TYPE_SLUGS: string[] = JOB_TYPES.map((j) => j.slug)

export type CitySlug = (typeof CITIES)[number]

export function jobTypeName(slug: string): string {
  return JOB_TYPES.find((j) => j.slug === slug)?.name ?? slug.replace(/-/g, ' ')
}
