import { useSyncExternalStore } from 'react'
import { en, type TranslationKey } from '@/locales/en'
import { kn } from '@/locales/kn'
import { hi } from '@/locales/hi'

export const LOCALES = { en: 'English', kn: 'ಕನ್ನಡ', hi: 'हिन्दी' } as const
export type Locale = keyof typeof LOCALES

const TABLES: Record<Locale, Partial<Record<TranslationKey, string>>> = { en, kn, hi }

const STORAGE_KEY = 'kelsagilsa.locale'

let current: Locale = 'en'
const listeners = new Set<() => void>()

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && value in LOCALES
}

/**
 * Changing the language re-renders the tree.
 *
 * `t()` reads a module-level variable, which is what keeps call sites free of
 * prop drilling — but a plain variable cannot tell React that a screen is now
 * stale. useLocale() subscribes to this store so that a picker at the bottom
 * of a settings screen actually repaints the screen above it.
 */
export function setLocale(locale: Locale) {
  if (locale === current) return
  current = locale

  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, locale)
    } catch {
      // Private browsing, or storage disabled. The choice lasts the session.
    }
  }

  for (const listener of listeners) listener()
}

export function getLocale(): Locale {
  return current
}

/** The locale the person last chose, if any. Device language is the fallback. */
export function storedLocale(): Locale | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return isLocale(stored) ? stored : null
  } catch {
    return null
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * Subscribe a component to language changes. Mount it once near the root and
 * every screen below repaints; call it in any component that needs to know the
 * current language for its own sake, such as the picker.
 */
export function useLocale(): Locale {
  return useSyncExternalStore(subscribe, getLocale, getLocale)
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
