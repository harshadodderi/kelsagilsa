import { ScrollViewStyleReset } from 'expo-router/html'
import type { PropsWithChildren } from 'react'

/**
 * The HTML shell every static page is rendered into (§12.5).
 *
 * This file runs in Node at build time only — it never ships to the browser,
 * so nothing here can use hooks or browser globals.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en-IN">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />

        {/*
          `maximum-scale` is deliberately absent. Locking zoom would fail
          anyone who needs to enlarge a price, and the >=16px inputs already
          stop iOS Safari zooming on focus (§12.4).
        */}
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />

        {/* Both themes ship, defaulting to system (§12.2). */}
        <meta name="color-scheme" content="light dark" />
        <meta name="theme-color" media="(prefers-color-scheme: light)" content="#FBFAF8" />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#141311" />

        {/* Installable to the home screen (§18, step 3). */}
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="icon" href="/favicon-48.png" sizes="48x48" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

        <ScrollViewStyleReset />

        <style dangerouslySetInnerHTML={{ __html: BACKGROUND }} />
      </head>
      <body>{children}</body>
    </html>
  )
}

/**
 * Painted before React mounts, so a dark-mode reader does not get a white
 * flash on a slow connection — which is exactly the connection this is built
 * for.
 */
const BACKGROUND = `
body { background-color: #FBFAF8; }
@media (prefers-color-scheme: dark) {
  body { background-color: #141311; }
}
`
