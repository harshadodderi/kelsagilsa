/**
 * The pre-rendered route space.
 *
 * `web.output: 'static'` means /prices/[city] and /prices/[city]/[job-type] are
 * built as real HTML at deploy time — they are the acquisition channel, and a
 * client-rendered price page is invisible to search engines (§12.5, §16).
 *
 * Regenerate with `npm run sync:launch-set` after Phase 0 decides the launch
 * set, and after any job type is published or unpublished. Per-provider pages
 * are deliberately NOT pre-rendered: live data, unbounded route space.
 */
export const CITIES = ['bengaluru'] as const

export const JOB_TYPE_SLUGS = [
  'tap-leak',
  'pipe-leak',
  'drain-block',
  'flush-repair',
  'geyser-install',
  'motor-repair',
  'tap-fitting',
  'toilet-install',
] as const

export type CitySlug = (typeof CITIES)[number]
