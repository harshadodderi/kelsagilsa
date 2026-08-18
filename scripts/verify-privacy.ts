/**
 * §3.1 — the one assertion that must never regress.
 *
 *   Signed in as user B, selecting user A's phone number must fail with
 *   "permission denied for column phone". Not an empty result. Not a null.
 *   A hard error.
 *
 * An empty result would mean RLS is doing the work alone, and RLS controls
 * which ROWS are visible, not which COLUMNS. A future policy that widens row
 * visibility for one screen would then quietly publish phone numbers. The
 * column grant is what makes that impossible, and this script is what proves
 * the column grant is still there.
 *
 * Run it against a real project before every deploy:
 *
 *   npx tsx scripts/verify-privacy.ts
 *
 * Requires, in the environment:
 *   EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY
 *   KG_TEST_EMAIL_A, KG_TEST_EMAIL_B   two seeded accounts
 *   KG_TEST_PASSWORD_A, KG_TEST_PASSWORD_B
 */

import { createClient } from '@supabase/supabase-js'

const url = process.env.EXPO_PUBLIC_SUPABASE_URL
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

if (!url || !anon) {
  console.error('EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are required')
  process.exit(2)
}

const failures: string[] = []

function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures.push(name)
}

async function main() {
  const client = createClient(url!, anon!)

  const { data: signIn, error: signInError } = await client.auth.signInWithPassword({
    email: process.env.KG_TEST_EMAIL_B!,
    password: process.env.KG_TEST_PASSWORD_B!,
  })

  if (signInError || !signIn.session) {
    console.error('Could not sign in as the test user B:', signInError?.message)
    process.exit(2)
  }

  const otherId = process.env.KG_TEST_USER_A_ID!

  // 1. The assertion from §3.1, verbatim.
  {
    const { error } = await client.from('users').select('phone').eq('id', otherId)
    check(
      'selecting another user\'s phone is denied at the column level',
      !!error && /permission denied for column/i.test(error.message),
      error?.message ?? 'no error was raised',
    )
  }

  // 2. Your OWN phone is denied through the table too. This is the part people
  //    "fix" by mistake: the profile screen is supposed to go through
  //    get_my_profile(), not through a relaxed grant.
  {
    const { error } = await client.from('users').select('phone').eq('id', signIn.user!.id)
    check(
      'selecting your own phone through the table is denied as well',
      !!error && /permission denied for column/i.test(error.message),
      error?.message ?? 'no error was raised',
    )
  }

  // 3. select('*') on users is a hard permission error, not a trimmed result (§16).
  {
    const { error } = await client.from('users').select('*').limit(1)
    check('select(*) on users is a hard error', !!error, error?.message ?? 'no error was raised')
  }

  // 4. The granted columns still work, or the app is broken in the other direction.
  {
    const { error } = await client.from('users').select('id, public_name, role').limit(1)
    check('granted columns are still readable', !error, error?.message ?? '')
  }

  // 5. public_name never contains a surname (§3.2).
  {
    const { data } = await client.from('users').select('public_name').limit(50)
    const withSpace = (data ?? []).filter((r) => (r.public_name ?? '').includes(' '))
    check('public_name is a first name only', withSpace.length === 0)
  }

  // 6. The stats tables are unreadable directly: RLS on, zero policies (§6.1).
  for (const table of ['area_job_stats', 'provider_job_stats']) {
    const { data, error } = await client.from(table).select('n').limit(1)
    check(`${table} is not directly readable`, !!error || (data ?? []).length === 0)
  }

  // 7. A report's weight and source are never exposed to a client (§9.2, §13.1).
  {
    const { error } = await client.from('reports').select('weight, source').limit(1)
    check(
      'report weight and source are ungranted',
      !!error && /permission denied for column/i.test(error.message),
      error?.message ?? 'no error was raised',
    )
  }

  await client.auth.signOut()

  if (failures.length) {
    console.error(`\n${failures.length} privacy assertion(s) failed. Do not deploy.`)
    process.exit(1)
  }
  console.log('\nAll privacy assertions hold.')
}

void main()
