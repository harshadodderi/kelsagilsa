/**
 * Mint a link that tags whatever it brings in as `solicited` (§13.1).
 *
 *   npx tsx scripts/mint-solicit-link.ts "apartment group" [recruited_provider]
 *
 * Metric zero is organic report share, and it is only honest if you are strict
 * with yourself about what counts as asking. Use one of these for every link
 * you send personally — including one you post in a WhatsApp group you are a
 * member of, which is soliciting, not organic.
 *
 * Attribution is imperfect and that is fine. You need direction, not precision.
 */

import { randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const site = process.env.KG_SITE_URL ?? 'https://kelsagilsa.com'

if (!url || !serviceKey) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
  process.exit(2)
}

const note = process.argv[2]
const source = process.argv[3] ?? 'solicited'

if (!note) {
  console.error('usage: npx tsx scripts/mint-solicit-link.ts "<note>" [solicited|recruited_provider]')
  process.exit(2)
}

if (source !== 'solicited' && source !== 'recruited_provider') {
  console.error('source must be "solicited" or "recruited_provider"')
  process.exit(2)
}

async function main() {
  const db = createClient(url!, serviceKey!, { auth: { persistSession: false } })
  const token = randomBytes(9).toString('base64url')

  const { error } = await db.from('solicit_links').insert({ token, note, source })
  if (error) throw error

  console.log(`\n  ${site}/report?k=${token}\n`)
  console.log(`  note:   ${note}`)
  console.log(`  source: ${source}`)
  console.log('\n  Reports arriving through this link are excluded from organic share.')
}

void main()
