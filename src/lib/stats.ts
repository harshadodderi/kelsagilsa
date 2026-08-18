/**
 * Percentiles and the Phase 0 spread diagnostic (§2.3).
 *
 * `percentileCont` matches Postgres `percentile_cont`: it interpolates, which
 * is what you want on small samples. The Phase 0 script and the database must
 * agree, or the job types you keep are not the job types you measured.
 */

export function percentileCont(sorted: readonly number[], p: number): number | null {
  const n = sorted.length
  if (n === 0) return null
  if (n === 1) return sorted[0]!

  const pos = (n - 1) * p
  const lower = Math.floor(pos)
  const upper = Math.ceil(pos)
  if (lower === upper) return sorted[lower]!
  return sorted[lower]! + (pos - lower) * (sorted[upper]! - sorted[lower]!)
}

export interface Summary {
  n: number
  p25: number | null
  p50: number | null
  p75: number | null
  min: number | null
  max: number | null
  /** (P75 − P25) ÷ P50. Null when there is no median to divide by. */
  spreadRatio: number | null
}

export function summarise(values: readonly number[]): Summary {
  const sorted = [...values].filter((v) => Number.isFinite(v)).sort((a, b) => a - b)
  const p25 = percentileCont(sorted, 0.25)
  const p50 = percentileCont(sorted, 0.5)
  const p75 = percentileCont(sorted, 0.75)

  return {
    n: sorted.length,
    p25,
    p50,
    p75,
    min: sorted.length ? sorted[0]! : null,
    max: sorted.length ? sorted[sorted.length - 1]! : null,
    spreadRatio: p25 !== null && p50 !== null && p75 !== null && p50 > 0 ? (p75 - p25) / p50 : null,
  }
}

/**
 * §2.3 reads the spread ratio as a Goldilocks band, not "lower is better".
 *
 *   < 0.2   everyone charges nearly the same — no asymmetry to solve.
 *           Drop the job type from the launch set.
 *   0.2–1.0 real variation, coherent job. Publish this.
 *   > 1.0   the bucket is mixing different jobs. Split it, or add a size
 *           qualifier ("geyser install — up to 25L").
 */
export type SpreadVerdict = 'no-asymmetry' | 'publish' | 'mixed-bucket' | 'insufficient'

export function spreadVerdict(summary: Summary, minimumN = 5): SpreadVerdict {
  if (summary.n < minimumN || summary.spreadRatio === null) return 'insufficient'
  if (summary.spreadRatio < 0.2) return 'no-asymmetry'
  if (summary.spreadRatio > 1.0) return 'mixed-bucket'
  return 'publish'
}

/**
 * §2.4 kill criterion. Neither result kills the idea; both mean the unit of
 * measurement is wrong, and building on a wrong unit is the single most
 * expensive mistake available — every number you ever publish inherits it.
 */
export interface SprintVerdict {
  classificationRate: number
  classificationPasses: boolean
  publishable: string[]
  drop: string[]
  split: string[]
  tooFewObservations: string[]
  spreadPasses: boolean
  passes: boolean
}

export function sprintVerdict(
  classified: number,
  totalObservations: number,
  perJobType: ReadonlyMap<string, Summary>,
): SprintVerdict {
  const classificationRate = totalObservations === 0 ? 0 : classified / totalObservations

  const publishable: string[] = []
  const drop: string[] = []
  const split: string[] = []
  const tooFewObservations: string[] = []

  for (const [jobType, summary] of perJobType) {
    switch (spreadVerdict(summary)) {
      case 'publish':
        publishable.push(jobType)
        break
      case 'no-asymmetry':
        drop.push(jobType)
        break
      case 'mixed-bucket':
        split.push(jobType)
        break
      default:
        tooFewObservations.push(jobType)
    }
  }

  const decided = publishable.length + drop.length + split.length
  // "most job types fall outside the 0.2–1.0 band" is the stop condition.
  const spreadPasses = decided > 0 && publishable.length > decided / 2
  const classificationPasses = classificationRate >= 0.7

  return {
    classificationRate,
    classificationPasses,
    publishable,
    drop,
    split,
    tooFewObservations,
    spreadPasses,
    passes: classificationPasses && spreadPasses,
  }
}
