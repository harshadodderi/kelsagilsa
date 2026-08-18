import { useEffect, useRef, useState } from 'react'
import { Platform, Text, View } from 'react-native'
import { space, type as typeTokens, useTheme } from '@/theme'

const SITE_KEY = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        options: {
          sitekey: string
          theme?: 'light' | 'dark' | 'auto'
          callback: (token: string) => void
          'expired-callback'?: () => void
          'error-callback'?: () => void
        },
      ) => string
      remove: (id: string) => void
    }
  }
}

let scriptPromise: Promise<void> | null = null

function loadScript(): Promise<void> {
  if (typeof document === 'undefined') return Promise.reject(new Error('no document'))
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise((resolve, reject) => {
    if (window.turnstile) return resolve()
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('turnstile failed to load'))
    document.head.appendChild(script)
  })

  return scriptPromise
}

/**
 * Cloudflare Turnstile, on the one screen that sends mail (§5.1).
 *
 * The widget hands back a single-use token that travels to the send-otp edge
 * function and on to GoTrue, which is what verifies it. Nothing here decides
 * whether a send is allowed — this component only obtains the token.
 *
 * With no site key configured it renders a visible warning rather than
 * silently allowing sends: an unprotected OTP endpoint should be impossible to
 * ship by accident.
 */
export function Turnstile({ onToken }: { onToken: (token: string | null) => void }) {
  const c = useTheme()
  const ref = useRef<View | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (Platform.OS !== 'web' || !SITE_KEY) return

    let widgetId: string | undefined
    let cancelled = false

    void loadScript()
      .then(() => {
        const element = ref.current as unknown as HTMLElement | null
        if (cancelled || !element || !window.turnstile) return
        widgetId = window.turnstile.render(element, {
          sitekey: SITE_KEY,
          theme: 'auto',
          callback: (token) => onToken(token),
          // A token is valid for five minutes; past that the person must solve
          // it again rather than have a stale token rejected by GoTrue.
          'expired-callback': () => onToken(null),
          'error-callback': () => setFailed(true),
        })
      })
      .catch(() => setFailed(true))

    return () => {
      cancelled = true
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId)
    }
  }, [onToken])

  if (!SITE_KEY) {
    return (
      <Text style={{ ...typeTokens.small, color: c.warn }}>
        Turnstile is not configured. Set EXPO_PUBLIC_TURNSTILE_SITE_KEY before deploying —
        this endpoint sends mail from your domain to any address supplied.
      </Text>
    )
  }

  if (failed) {
    return (
      <Text style={{ ...typeTokens.small, color: c.warn }}>
        The security check could not load. Please refresh and try again.
      </Text>
    )
  }

  return <View ref={ref} style={{ minHeight: 65, marginVertical: space.sm }} />
}
