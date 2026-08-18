import { describe, expect, it } from 'vitest'
import { encodeGeohash } from '@/lib/geohash'

describe('geohash encoding', () => {
  it('matches known reference values', () => {
    expect(encodeGeohash(57.64911, 10.40744, 11)).toBe('u4pruydqqvj')
    expect(encodeGeohash(0, 0, 6)).toBe('s00000')
  })

  it('agrees with itself across precisions, so the hierarchy nests (§7.2)', () => {
    // The area resolution walks precision 6 -> 5 -> city by truncating, which
    // only works if the shorter hash is a prefix of the longer one.
    const p6 = encodeGeohash(12.9784, 77.6408, 6)
    const p5 = encodeGeohash(12.9784, 77.6408, 5)
    expect(p6.startsWith(p5)).toBe(true)
  })

  it('puts two ends of Bengaluru in different precision-6 cells', () => {
    const indiranagar = encodeGeohash(12.9784, 77.6408, 6)
    const rajajinagar = encodeGeohash(12.9915, 77.556, 6)
    expect(indiranagar).not.toBe(rajajinagar)
  })
})
