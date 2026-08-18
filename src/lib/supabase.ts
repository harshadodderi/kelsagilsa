import 'react-native-url-polyfill/auto'
import { createClient } from '@supabase/supabase-js'

const url = process.env.EXPO_PUBLIC_SUPABASE_URL
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // Fail loudly at boot rather than as a mystery 401 on the first query.
  console.warn('Supabase environment variables are missing. Copy .env.example to .env.')
}

export const supabase = createClient(url ?? 'http://localhost', anonKey ?? 'anon', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

/**
 * Login is by email address (§5). Supabase does not send SMS itself, and
 * transactional SMS in India needs DLT registration with TRAI — entity, sender
 * ID and every template, each with its own approval cycle. Email needs none of
 * it.
 *
 * Edit the Magic Link template to include {{ .Token }} so the person gets a
 * 6-digit code rather than a link: they never leave the tab, which is what
 * makes §5.2's "sign in after the numbers are entered" work at all.
 *
 * `captchaToken` is not optional in production. signInWithOtp is an open
 * endpoint the moment you deploy (§5.1).
 */
export async function sendOtp(email: string, captchaToken?: string) {
  return supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, captchaToken },
  })
}

export async function verifyOtp(email: string, token: string) {
  return supabase.auth.verifyOtp({ email, token, type: 'email' })
}
