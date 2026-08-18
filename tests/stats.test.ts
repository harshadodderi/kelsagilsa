import { describe, expect, it } from 'vitest'
import { percentileCont, spreadVerdict, sprintVerdict, summarise } from '@/lib/stats'

describe('percentileCont matches Postgres percentile_cont', () => {
  it('interpolates, which is what you want on small samples (§7.1)', () => {
    const sorted = [100, 200, 300, 400]
    expect(percentileCont(sorted, 0.5)).toBe(250)
    expect(percentileCont(sorted, 0.25)).toBe(175)
    expect(percentileCont(sorted, 0.75)).toBe(325)
  })

  it('is not a mean — one outlier does not move it (§16)', () => {
    const withOutlier = [300, 300, 300, 300, 300, 5000].sort((a, b) => a - b)
    expect(percentileCont(withOutlier, 0.5)).toBe(300)
    const mean = withOutlier.reduce((a, b) => a + b, 0) / withOutlier.length
    expect(mean).toBeGreaterThan(1000)
  })

  it('handles the degenerate cases', () => {
    expect(percentileCont([], 0.5)).toBeNull()
    expect(percentileCont([42], 0.5)).toBe(42)
  })
})

describe('spread ratio, read as a Goldilocks band (§2.3)', () => {
  it('drops job types where everyone charges nearly the same', () => {
    // Ratio < 0.2: no asymmetry to solve, so no benchmark worth publishing.
    const s = summarise([300, 300, 305, 310, 310, 300, 305])
    expect(s.spreadRatio).toBeLessThan(0.2)
    expect(spreadVerdict(s)).toBe('no-asymmetry')
  })

  it('publishes job types with real variation', () => {
    const s = summarise([200, 250, 300, 350, 400, 450, 500])
    expect(spreadVerdict(s)).toBe('publish')
  })

  it('flags a bucket that is mixing different jobs', () => {
    // Ratio > 1.0: "tap leak repair" spanning ₹150 and ₹3,000 is scope
    // variance, not price variance. Split it or add a size qualifier.
    const s = summarise([150, 200, 250, 900, 1800, 3000, 2500])
    expect(s.spreadRatio).toBeGreaterThan(1)
    expect(spreadVerdict(s)).toBe('mixed-bucket')
  })

  it('refuses to judge a job type with too few observations', () => {
    expect(spreadVerdict(summarise([300, 400]))).toBe('insufficient')
  })
})

describe('the Phase 0 kill criterion (§2.4)', () => {
  const good = summarise([200, 250, 300, 350, 400, 450, 500])
  const flat = summarise([300, 300, 305, 310, 310, 300, 305])

  it('fails below a 70% classification rate', () => {
    const v = sprintVerdict(60, 100, new Map([['tap-leak', good]]))
    expect(v.classificationPasses).toBe(false)
    expect(v.passes).toBe(false)
  })

  it('fails when most job types fall outside the band', () => {
    const v = sprintVerdict(
      80,
      100,
      new Map([
        ['tap-leak', good],
        ['drain-block', flat],
        ['geyser-install', flat],
      ]),
    )
    expect(v.classificationPasses).toBe(true)
    expect(v.spreadPasses).toBe(false)
    expect(v.drop).toEqual(['drain-block', 'geyser-install'])
  })

  it('passes when classification holds and most job types are publishable', () => {
    const v = sprintVerdict(
      82,
      100,
      new Map([
        ['tap-leak', good],
        ['pipe-leak', good],
        ['drain-block', flat],
      ]),
    )
    expect(v.passes).toBe(true)
    expect(v.publishable).toEqual(['tap-leak', 'pipe-leak'])
    expect(v.drop).toEqual(['drain-block'])
  })
})
