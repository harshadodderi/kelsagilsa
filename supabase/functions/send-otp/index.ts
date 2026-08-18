/**
 * send-otp — the only route by which a code is ever sent. §5.1.
 *
 * The client never calls `supabase.auth.signInWithOtp` directly. It calls
 * this, which:
 *
 *   1. counts sends per email and per IP in the last hour, and refuses past
 *      5 and 20 respectively;
 *   2. logs every attempt with a hashed address, the IP and the user agent,
 *      retained 90 days (§10.4);
 *   3. forwards the request to GoTrue with the Turnstile token attached.
 *
 * Turnstile is verified by GoTrue, not here: a Turnstile token is single-use,
 * so verifying it in this function would consume it and leave GoTrue's own
 * captcha check to fail. Enable it under Auth -> Attack Protection. The limits
 * in this function are a second line, not a substitute — an open endpoint with
 * only application-level limits is still an open endpoint.
 *
 * Deploy:
 *   supabase functions deploy send-otp --no-verify-jwt
 *   supabase secrets set OTP_EMAIL_PEPPER="$(openssl rand -hex 32)"
 *
 * --no-verify-jwt is correct and deliberate: signing in is what this does, so
 * the caller cannot already have a token.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const PEPPER = Deno.env.get('OTP_EMAIL_PEPPER') ?? ''

const CORS = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

/** The first hop is the client; the rest of the chain is proxy-appended. */
function callerIp(req: Request): string | null {
  const forwarded = req.headers.get('x-forwarded-for')
  const first = forwarded?.split(',')[0]?.trim()
  return first || req.headers.get('cf-connecting-ip') || null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  let email: string
  let captchaToken: string | undefined
  try {
    const body = await req.json()
    email = String(body.email ?? '').trim()
    captchaToken = body.captchaToken ? String(body.captchaToken) : undefined
  } catch {
    return json({ error: 'Bad request.' }, 400)
  }

  // Deliberately shallow. Address validity is GoTrue's job; this only stops
  // obvious junk from reaching the log.
  if (!email.includes('@') || email.length > 254) {
    return json({ error: 'Enter an email address.' }, 400)
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  const { data: emailHash, error: hashError } = await admin.rpc('hash_email', {
    p_email: email,
    p_pepper: PEPPER,
  })
  if (hashError) return json({ error: 'Something went wrong. Please try again.' }, 500)

  const { error: limitError } = await admin.rpc('record_otp_send', {
    p_email_hash: emailHash,
    p_ip: callerIp(req),
    p_user_agent: req.headers.get('user-agent'),
  })

  if (limitError) {
    // KG015/KG016 carry a message already written for a person (§6.4).
    const throttled = limitError.code === 'KG015' || limitError.code === 'KG016'
    return json(
      { error: throttled ? limitError.message : 'Something went wrong. Please try again.' },
      throttled ? 429 : 500,
    )
  }

  const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } })
  const { error: sendError } = await anon.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, captchaToken },
  })

  if (sendError) {
    // Never distinguish "no such account" from anything else: that difference
    // is the enumeration oracle this whole function exists to close.
    return json({ error: 'We could not send a code just now. Please try again.' }, 400)
  }

  return json({ ok: true })
})
