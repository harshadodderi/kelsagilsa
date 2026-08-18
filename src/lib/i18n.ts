import { en, type TranslationKey } from '@/locales/en'
import { kn } from '@/locales/kn'
import { hi } from '@/locales/hi'

export const LOCALES = { en: 'English', kn: 'ಕನ್ನಡ', hi: 'हिन्दी' } as const
export type Locale = keyof typeof LOCALES

const TABLES: Record<Locale, Partial<Record<TranslationKey, string>>> = { en, kn, hi }

let current: Locale = 'en'

export function setLocale(locale: Locale) {
  current = locale
}

export function getLocale(): Locale {
  return current
}

/**
 * Interpolate, never concatenate (§12.3). `t('benchmark.title', { jobType,
 * area })` keeps word order in the translator's hands, which matters in
 * Kannada and Hindi far more than it does in English.
 *
 * Falls back to English rather than to the key: a half-translated screen
 * should read as English, not as `benchmark.tier.early`.
 */
export function t(key: TranslationKey, params?: Record<string, string | number>): string {
  const template = TABLES[current][key] ?? en[key]
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  )
}
