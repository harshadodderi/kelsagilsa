/**
 * Geohash encoding, client-side.
 *
 * Precision 6 ≈ 1.2 km × 0.6 km, precision 5 ≈ 4.9 km × 4.9 km (§7.2).
 *
 * The client encodes so that a benchmark can be read without an account and
 * without sending raw coordinates anywhere. Provider location is a different
 * matter entirely: it is set server-side at claim and never trusted from the
 * client (§9.1). Customer spoofing is harmless — ignore it.
 */

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz'

export function encodeGeohash(lat: number, lng: number, precision = 6): string {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error('encodeGeohash: coordinates required')
  }

  let latMin = -90
  let latMax = 90
  let lngMin = -180
  let lngMax = 180

  let hash = ''
  let bit = 0
  let chunk = 0
  let evenBit = true

  while (hash.length < precision) {
    if (evenBit) {
      const mid = (lngMin + lngMax) / 2
      if (lng >= mid) {
        chunk = (chunk << 1) + 1
        lngMin = mid
      } else {
        chunk = chunk << 1
        lngMax = mid
      }
    } else {
      const mid = (latMin + latMax) / 2
      if (lat >= mid) {
        chunk = (chunk << 1) + 1
        latMin = mid
      } else {
        chunk = chunk << 1
        latMax = mid
      }
    }

    evenBit = !evenBit
    if (++bit === 5) {
      hash += BASE32[chunk]
      bit = 0
      chunk = 0
    }
  }

  return hash
}
