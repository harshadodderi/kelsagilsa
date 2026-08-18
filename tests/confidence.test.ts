import { describe, expect, it } from 'vitest'
import {
  compareToRange,
  confidenceTier,
  displayableRange,
  type StoredStats,
} from '@/lib/confidence'

const stats = (n: number): StoredStats => ({ n, p25: 280, p50: 300, p75: 320, min: 150, max: 900 })

describe('confidence tiers (§7.3)', () => {
  it('renders nothing below n=5', () => {
    for (const n of [0, 1, 4]) {
      const r = displayableRange(stats(n))
      expect(r.tier).toBe('none')
      expect(r.low).toBeNull()
      expect(r.high).toBeNull()
      expect(r.mid).toBeNull()
    }
  })

  it('widens the INTERVAL at 5-9, not merely the label', () => {
    // The whole point of §7.3: most people do not read labels, so the honesty
    // has to be in the number itself.
    const r = displayableRange(stats(7))
    expect(r.tier).toBe('early')
    expect(r.low).toBe(150)
    expect(r.high).toBe(900)
    expect(r.low).not.toBe(280)
    expect(r.high).not.toBe(320)
  })

  it('withholds the midpoint below n=10', () => {
    expect(displayableRange(stats(9)).mid).toBeNull()
    expect(displayableRange(stats(10)).mid).toBe(300)
  })

  it('uses P25-P75 from n=10', () => {
    const r = displayableRange(stats(12))
    expect(r.tier).toBe('typical')
    expect(r.low).toBe(280)
    expect(r.high).toBe(320)
  })

  it('applies the same rule at every n, with no per-provider exception', () => {
    expect(confidenceTier(4)).toBe('none')
    expect(confidenceTier(5)).toBe('early')
    expect(confidenceTier(10)).toBe('typical')
    expect(confidenceTier(20)).toBe('established')
    expect(confidenceTier(50)).toBe('strong')
  })
})

describe('payback comparison (§7.4)', () => {
  it('reports unknown rather than guessing when nothing renders', () => {
    expect(compareToRange(350, displayableRange(stats(3)))).toBe('unknown')
  })

  it('compares against the widened interval at low n', () => {
    // 350 is above P75 but well inside min-max. At n=7 the honest answer is
    // "within", because that is what the data supports.
    expect(compareToRange(350, displayableRange(stats(7)))).toBe('within')
    expect(compareToRange(350, displayableRange(stats(30)))).toBe('above')
  })

  it('places amounts either side of the range', () => {
    const r = displayableRange(stats(30))
    expect(compareToRange(200, r)).toBe('below')
    expect(compareToRange(300, r)).toBe('within')
    expect(compareToRange(9000, r)).toBe('above')
  })
})
