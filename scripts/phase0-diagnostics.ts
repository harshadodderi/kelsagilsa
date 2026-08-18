/**
 * Phase 0 diagnostics — §2.3, §2.4.
 *
 * Usage:  npm run phase0 -- observations.csv
 *
 * Input is the Google Form export with ONE column added by hand: `job_type`,
 * which you fill in yourself after collection. Leave it blank (or write `?`)
 * for any observation you could not classify confidently without asking a
 * follow-up question. That blank is the measurement — do not go back and ask.
 *
 * Expected columns (extra columns are ignored, order does not matter):
 *
 *   description    the free-text "What was the job?" answer
 *   amount         total paid, a number
 *   parts          "" | "not sure" | a number
 *   month          YYYY-MM
 *   area           locality name
 *   job_type       YOUR classification, or blank if you could not
 *
 * This is the most valuable output of the sprint. It tells you which job types
 * are worth a benchmark page and which are noise, before you build any of
 * them.
 */

import { readFileSync } from 'node:fs'
import { summarise, sprintVerdict, type Summary } from '../src/lib/stats'

interface Row {
  description: string
  amount: number
  /** null means the respondent said "Not sure" — never forced (§3.3). */
  parts: number | null
  month: string
  area: string
  jobType: string | null
}

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (ch !== '\r') field += ch
  }
  if (field.length || row.length) {
    row.push(field)
    rows.push(row)
  }

  const header = (rows.shift() ?? []).map((h) => h.trim().toLowerCase())
  return rows
    .filter((r) => r.some((cell) => cell.trim() !== ''))
    .map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])))
}

function toRow(raw: Record<string, string>): Row | null {
  const amount = Number(raw.amount?.replace(/[^0-9.]/g, ''))
  if (!Number.isFinite(amount) || amount <= 0) return null

  const partsRaw = (raw.parts ?? '').toLowerCase()
  const parts =
    partsRaw === '' || partsRaw.startsWith('not sure') || partsRaw.startsWith('unsure')
      ? null
      : partsRaw.startsWith('no')
        ? 0
        : Number(partsRaw.replace(/[^0-9.]/g, ''))

  const jobType = (raw.job_type ?? '').trim()

  return {
    description: raw.description ?? '',
    amount,
    parts: Number.isFinite(parts as number) ? (parts as number | null) : null,
    month: raw.month ?? '',
    area: raw.area ?? '',
    jobType: jobType === '' || jobType === '?' ? null : jobType,
  }
}

function main() {
  const path = process.argv[2]
  if (!path) {
    console.error('usage: npm run phase0 -- observations.csv')
    process.exit(2)
  }

  const rows = parseCsv(readFileSync(path, 'utf8'))
    .map(toRow)
    .filter((r): r is Row => r !== null)

  if (rows.length === 0) {
    console.error('No usable observations found. Check the column names.')
    process.exit(2)
  }

  // Only the service figure is comparable across observations. Where the
  // respondent said "Not sure" about parts, the total is all you have — those
  // observations count toward the total figure only (§3.3), so they are
  // excluded from the spread diagnostic rather than silently treated as
  // labour-only.
  const byJobType = new Map<string, number[]>()
  let classified = 0
  let partsUnknown = 0

  for (const r of rows) {
    if (r.jobType === null) continue
    classified++
    if (r.parts === null) {
      partsUnknown++
      continue
    }
    const list = byJobType.get(r.jobType) ?? []
    list.push(r.amount - r.parts)
    byJobType.set(r.jobType, list)
  }

  const summaries = new Map<string, Summary>(
    [...byJobType.entries()].map(([job, values]) => [job, summarise(values)]),
  )

  const verdict = sprintVerdict(classified, rows.length, summaries)

  const pct = (v: number) => `${(v * 100).toFixed(0)}%`
  const num = (v: number | null) => (v === null ? '—' : `₹${Math.round(v)}`)

  console.log(`\nPhase 0 diagnostics — ${rows.length} observations\n`)
  console.log(`Classification rate   ${pct(verdict.classificationRate)}   (pass >= 70%)`)
  console.log(`  ${classified} classified, ${rows.length - classified} needed a follow-up`)
  console.log(`  ${partsUnknown} of the classified said "Not sure" about parts (total-only)\n`)

  console.log('Spread ratio per job type   (P75 - P25) / P50')
  console.log('  < 0.2  no asymmetry to solve — drop it from the launch set')
  console.log('  0.2-1  the target — publish this')
  console.log('  > 1.0  the bucket is mixing different jobs — split it\n')

  const rowsOut = [...summaries.entries()].sort((a, b) => b[1].n - a[1].n)
  console.log('  job type              n     P25      P50      P75    ratio   verdict')
  for (const [job, s] of rowsOut) {
    const ratio = s.spreadRatio === null ? '—' : s.spreadRatio.toFixed(2)
    const v = verdict.publishable.includes(job)
      ? 'publish'
      : verdict.drop.includes(job)
        ? 'DROP'
        : verdict.split.includes(job)
          ? 'SPLIT'
          : 'too few'
    console.log(
      `  ${job.padEnd(20)} ${String(s.n).padStart(2)}  ${num(s.p25).padStart(7)}  ` +
        `${num(s.p50).padStart(7)}  ${num(s.p75).padStart(7)}  ${ratio.padStart(6)}   ${v}`,
    )
  }

  console.log(`\n${verdict.passes ? 'PASS' : 'STOP'} — §2.4`)
  if (!verdict.classificationPasses) {
    console.log(
      '  Classification is below 70%. The taxonomy is wrong — usually too\n' +
        '  fine-grained, occasionally missing an obvious bucket. Fix it and\n' +
        '  re-classify before building anything.',
    )
  }
  if (!verdict.spreadPasses) {
    console.log(
      '  Most job types fall outside the 0.2-1.0 band. The unit of measurement\n' +
        '  is wrong, and every number you ever publish would inherit it.',
    )
  }
  if (verdict.passes) {
    console.log(
      `  Launch set: ${verdict.publishable.join(', ')}\n` +
        '  Update supabase/migrations/0009_seed_taxonomy.sql and\n' +
        '  src/data/launch-set.ts to match, using the words people actually\n' +
        '  used, then import the observations as source = seeded.',
    )
  }
  if (verdict.split.length) {
    console.log(`  Split or add a size qualifier: ${verdict.split.join(', ')}`)
  }
  console.log(
    '\n  Remember what this cannot tell you: whether a stranger reports\n' +
      '  unprompted. That is Phase 2, against people who owe you nothing (§2.1).\n',
  )
}

main()
