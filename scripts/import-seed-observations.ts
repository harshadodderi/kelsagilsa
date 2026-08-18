/**
 * Import the Phase 0 observations as `source = 'seeded'` (§2.5, §13.1).
 *
 *   npx tsx scripts/import-seed-observations.ts observations.csv
 *
 * Run this ONLY after phase0-diagnostics.ts passes and the launch set has been
 * edited into 0009_seed_taxonomy.sql. It writes with the service role, because
 * these rows have no reporter.
 *
 * Two things this deliberately does:
 *
 *  - tags every row `seeded`, so it never counts toward organic share. Metric
 *    zero is the one number that a hand-collected dataset must not be able to
 *    flatter (§13.1).
 *  - gives Phase 1 a benchmark that is not empty on day one, which is the
 *    whole reason the sprint output is worth importing at all.
 */

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
  process.exit(2)
}

const path = process.argv[2]
if (!path) {
  console.error('usage: npx tsx scripts/import-seed-observations.ts observations.csv')
  process.exit(2)
}

interface SeedRow {
  job_type_id: string
  area_geohash: string
  amount_paid: number
  parts_amount: number | null
  occurred_on: string
  source: 'seeded'
}

async function main() {
  const db = createClient(url!, serviceKey!, { auth: { persistSession: false } })

  const lines = readFileSync(path!, 'utf8').trim().split('\n')
  const header = lines[0]!.split(',').map((h) => h.trim().toLowerCase())
  const idx = (name: string) => header.indexOf(name)

  const { data: jobTypes, error: jobTypesError } = await db.from('job_types').select('id, slug')
  if (jobTypesError) throw jobTypesError
  const jobBySlug = new Map((jobTypes ?? []).map((j) => [j.slug, j.id]))

  const { data: areas, error: areasError } = await db.from('area_labels').select('geohash, name')
  if (areasError) throw areasError
  const geohashByArea = new Map((areas ?? []).map((a) => [a.name.toLowerCase(), a.geohash]))

  const rows: SeedRow[] = []
  const skipped: string[] = []

  for (const line of lines.slice(1)) {
    const cells = line.split(',')
    const slug = (cells[idx('job_type')] ?? '').trim()
    const area = (cells[idx('area')] ?? '').trim().toLowerCase()
    const amount = Number((cells[idx('amount')] ?? '').replace(/[^0-9.]/g, ''))
    const month = (cells[idx('month')] ?? '').trim()
    const partsRaw = (cells[idx('parts')] ?? '').trim().toLowerCase()

    const jobId = jobBySlug.get(slug)
    const geohash = geohashByArea.get(area)

    if (!jobId || !geohash || !Number.isFinite(amount) || !/^\d{4}-\d{2}$/.test(month)) {
      skipped.push(line)
      continue
    }

    rows.push({
      job_type_id: jobId,
      area_geohash: geohash,
      amount_paid: amount,
      // "Not sure" stays null all the way into the database (§3.3).
      parts_amount:
        partsRaw === '' || partsRaw.startsWith('not sure')
          ? null
          : partsRaw.startsWith('no')
            ? 0
            : Number(partsRaw.replace(/[^0-9.]/g, '')),
      occurred_on: `${month}-15`,
      source: 'seeded',
    })
  }

  const { error } = await db.from('reports').insert(rows)
  if (error) throw error

  console.log(`Imported ${rows.length} seeded observations.`)
  if (skipped.length) {
    console.log(`Skipped ${skipped.length} rows that did not resolve to a job type and area:`)
    for (const line of skipped) console.log(`  ${line}`)
  }
}

void main()
