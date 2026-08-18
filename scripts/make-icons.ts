/**
 * Render public/favicon.svg to the PNG sizes a browser needs to offer "add to
 * home screen" (§18, step 3: install the app to their home screen).
 *
 *   npx tsx scripts/make-icons.ts
 *
 * Uses the Chromium that is already installed rather than adding an image
 * library. Run it only when the mark changes; the PNGs are committed.
 */

import { chromium } from 'playwright'
import { readFile, writeFile } from 'node:fs/promises'

const SIZES = [
  { file: 'public/icon-192.png', size: 192 },
  { file: 'public/icon-512.png', size: 512 },
  { file: 'public/apple-touch-icon.png', size: 180 },
  { file: 'public/favicon-48.png', size: 48 },
]

async function main() {
  const svg = await readFile('public/favicon.svg', 'utf8')
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
  })

  try {
    for (const { file, size } of SIZES) {
      const page = await browser.newPage({ viewport: { width: size, height: size } })
      await page.setContent(
        `<html><body style="margin:0">${svg.replace('<svg', `<svg width="${size}" height="${size}"`)}</body></html>`,
      )
      await writeFile(file, await page.screenshot({ omitBackground: true }))
      await page.close()
      console.log(`wrote ${file} (${size}x${size})`)
    }
  } finally {
    await browser.close()
  }
}

void main()
