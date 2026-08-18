import type { TranslationKey } from './en'

/**
 * Kannada. Deliberately empty at Phase 1 — the scaffold is what costs two
 * hours now and two weeks later (§4, §12.3). Empty locales are fine; a missing
 * scaffold is not.
 *
 * Kannada strings run noticeably longer than English. Every layout is built
 * for +40%, so translations can land here without a layout pass.
 */
export const kn: Partial<Record<TranslationKey, string>> = {
  'app.tagline': 'ಜನರು ನಿಜವಾಗಿ ಪಾವತಿಸಿದ್ದು.',
  'common.language': 'ಭಾಷೆ',
}
