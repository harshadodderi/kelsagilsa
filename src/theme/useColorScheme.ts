import { useSyncExternalStore } from 'react'
import { Platform, useColorScheme as useRNColorScheme } from 'react-native'

export type ColorScheme = 'light' | 'dark'

const QUERY = '(prefers-color-scheme: dark)'

function subscribe(onChange: () => void) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {}
  const media = window.matchMedia(QUERY)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

function snapshot(): ColorScheme {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light'
  return window.matchMedia(QUERY).matches ? 'dark' : 'light'
}

/** Static rendering has no browser to ask. Light is the safe assumption. */
function serverSnapshot(): ColorScheme {
  return 'light'
}

/**
 * The system colour scheme, read directly from the media query on web.
 *
 * React Native Web's own useColorScheme seeds its state during the static
 * render and does not re-read it when the page hydrates, so a page served as
 * pre-rendered HTML stays light for a reader whose device is dark — which is
 * exactly how this app is served (§12.5). useSyncExternalStore re-reads on
 * hydration, which is the behaviour we need.
 *
 * Verified in a real browser by scripts/smoke-web.ts, which asserts the dark
 * palette actually reaches the page. "Ship both themes" is only true if the
 * dark one has been looked at (§12.2).
 */
export function useColorScheme(): ColorScheme {
  const web = useSyncExternalStore(subscribe, snapshot, serverSnapshot)
  const native = useRNColorScheme()

  return Platform.OS === 'web' ? web : native === 'dark' ? 'dark' : 'light'
}
