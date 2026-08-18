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
 * Note what this does NOT call: `supabase.auth.signInWithOtp`. Sends go
 * through the send-otp edge function, which applies the per-email and per-IP
 * limits and writes the send log before forwarding to GoTrue (§5.1). A limit
 * the client enforces is a limit an attacker skips, so the client does not
 * have one.
 */
export async function sendOtp(
  email: string,
  captchaToken?: string,
): Promise<{ error: { message: string } | null }> {
  try {
    const response = await fetch(`${url}/functions/v1/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: anonKey ?? '' },
      body: JSON.stringify({ email, captchaToken }),
    })

    const body = (await response.json().catch(() => ({}))) as { error?: string }
    if (!response.ok) {
      // 429 carries the throttle's own wording, already fit to show a person.
      return { error: { message: body.error ?? 'We could not send a code just now.' } }
    }
    return { error: null }
  } catch {
    return { error: { message: 'You appear to be offline.' } }
  }
}

export async function verifyOtp(email: string, token: string) {
  return supabase.auth.verifyOtp({ email, token, type: 'email' })
}
