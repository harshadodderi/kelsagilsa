/**
 * Drive the exported static site in a real browser.
 *
 * `npm run build:web && npm run smoke:web`
 *
 * What this checks, and why each one is here rather than in a unit test:
 *
 *  - every route renders without a console error, in BOTH themes, because
 *    "ship both, default to system" (§12.2) is only true if the dark one has
 *    actually been looked at;
 *  - no horizontal scroll at 390px, the width the design targets (§12.4);
 *  - every tap target is at least 44px and every input at least 16px, or iOS
 *    Safari zooms on focus and never comes back;
 *  - the legal footer is present on every page, since safe harbour depends on
 *    the terms, the privacy notice and the grievance route being reachable
 *    from everywhere (§11.1);
 *  - first contentful paint on a throttled connection, against the 2.5s budget
 *    (§12.5). Measured here rather than on office wifi, which is the whole
 *    point of having a number.
 */

import { chromium, type Browser, type ConsoleMessage, type Page } from 'playwright'
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'

const ROOT = 'dist'
const PORT = 4173

const ROUTES = [
  '/',
  '/prices/bengaluru',
  '/prices/bengaluru/tap-leak',
  '/report',
  '/legal/terms',
  '/legal/privacy',
  '/legal/grievance',
  // Not linked from anywhere, but it must degrade to a message rather than a
  // crash for anyone who types it (§9.4).
  '/admin/review',
]

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
}

const failures: string[] = []

function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures.push(`${name}${detail ? `: ${detail}` : ''}`)
}

async function serve() {
  const server = createServer(async (req, res) => {
    const url = (req.url ?? '/').split('?')[0]!
    const candidates = [
      join(ROOT, normalize(url)),
      join(ROOT, normalize(url), 'index.html'),
      join(ROOT, `${normalize(url)}.html`),
    ]

    for (const candidate of candidates) {
      try {
        if ((await stat(candidate)).isFile()) {
          res.writeHead(200, { 'Content-Type': TYPES[extname(candidate)] ?? 'application/octet-stream' })
          res.end(await readFile(candidate))
          return
        }
      } catch {
        // try the next candidate
      }
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('not found')
  })

  await new Promise<void>((resolve) => server.listen(PORT, resolve))
  return server
}

/** Anything the page logged that a user would consider broken. */
function collectErrors(page: Page, sink: string[]) {
  page.on('console', (message: ConsoleMessage) => {
    if (message.type() !== 'error') return
    const text = message.text()
    // The build has no Supabase project behind it, so data calls legitimately
    // fail. Everything else is a real defect.
    if (/supabase|Failed to fetch|net::ERR|ERR_NAME_NOT_RESOLVED/i.test(text)) return
    sink.push(text)
  })
  page.on('pageerror', (error) => sink.push(String(error)))
}

async function checkRoute(browser: Browser, route: string, theme: 'light' | 'dark') {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    colorScheme: theme,
    deviceScaleFactor: 2,
  })
  const page = await context.newPage()
  const errors: string[] = []
  collectErrors(page, errors)

  await page.goto(`http://localhost:${PORT}${route}`, { waitUntil: 'networkidle' })

  check(`${route} [${theme}] renders without console errors`, errors.length === 0, errors[0] ?? '')

  /*
   * Both themes ship, defaulting to system (§12.2). Asserting "no console
   * errors in dark" proved not to be the same thing: the page rendered the
   * light palette under a dark media query and nothing complained. So check
   * the pixels — the text colour must actually be the one the theme defines.
   */
  const textColour = await page.evaluate(() => {
    const heading = document.querySelector('h1') ?? document.body
    return getComputedStyle(heading).color
  })
  const expected = theme === 'dark' ? 'rgb(244, 241, 236)' : 'rgb(23, 21, 18)'
  check(`${route} [${theme}] renders the ${theme} palette`, textColour === expected, textColour)

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  check(`${route} [${theme}] does not scroll horizontally at 390px`, overflow <= 0, `${overflow}px over`)

  if (theme === 'light') {
    const small = await page.evaluate(() => {
      const bad: string[] = []
      for (const el of Array.from(document.querySelectorAll('input, textarea'))) {
        const size = parseFloat(getComputedStyle(el).fontSize)
        if (size < 16) bad.push(`${el.tagName.toLowerCase()} at ${size}px`)
      }
      for (const el of Array.from(document.querySelectorAll('[role="button"], button, a'))) {
        const box = el.getBoundingClientRect()
        // Ignore inline text links, which are not tap targets in their own right.
        if (box.height > 0 && box.height < 44 && getComputedStyle(el).display !== 'inline') {
          bad.push(`${el.tagName.toLowerCase()} ${Math.round(box.height)}px tall`)
        }
      }
      return bad
    })
    check(`${route} inputs >= 16px and tap targets >= 44px`, small.length === 0, small.join(', '))

    const hasFooter = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a')).some((a) =>
        (a.getAttribute('href') ?? '').includes('/legal/grievance'),
      ),
    )
    check(`${route} reaches the grievance route`, hasFooter)
  }

  await context.close()
}

async function measureFcp(browser: Browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()

  // Slow 4G, roughly: 400kbps down, 400ms round trip.
  const client = await context.newCDPSession(page)
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    downloadThroughput: (400 * 1024) / 8,
    uploadThroughput: (400 * 1024) / 8,
    latency: 400,
  })
  await client.send('Emulation.setCPUThrottlingRate', { rate: 4 })

  await page.goto(`http://localhost:${PORT}/prices/bengaluru/tap-leak`, { waitUntil: 'load' })

  const fcp = await page.evaluate(
    () =>
      performance.getEntriesByName('first-contentful-paint')[0]?.startTime ??
      performance.getEntriesByType('paint')[0]?.startTime ??
      0,
  )

  console.log(`\n  first contentful paint, throttled Slow 4G + 4x CPU: ${Math.round(fcp)}ms`)
  check('first contentful paint under 2.5s (§12.5)', fcp > 0 && fcp < 2500, `${Math.round(fcp)}ms`)

  await context.close()
}

async function main() {
  const server = await serve()
  /*
   * Use whichever browser is already on the machine: the sandbox image ships
   * one at a known path, a CI runner has Playwright's own download. Never
   * fetch another.
   */
  const preinstalled = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium'
  const browser = await chromium.launch(
    existsSync(preinstalled) ? { executablePath: preinstalled } : {},
  )

  try {
    for (const route of ROUTES) {
      for (const theme of ['light', 'dark'] as const) {
        await checkRoute(browser, route, theme)
      }
    }
    await measureFcp(browser)
  } finally {
    await browser.close()
    server.close()
  }

  if (failures.length) {
    console.error(`\n${failures.length} check(s) failed.`)
    process.exit(1)
  }
  console.log('\nAll browser checks passed.')
}

void main()
