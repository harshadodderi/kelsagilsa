/**
 * English. The reference locale — every key exists here first.
 *
 * Never concatenate translated fragments; interpolate (§12.3). Every layout is
 * designed for +40% string length, because Kannada and Hindi are longer than
 * English in almost every string below.
 */
export const en = {
  'app.name': 'Kelsagilsa',
  'app.tagline': 'What people actually paid.',

  // §11.5 — copy that has to exist.
  'legal.not_a_quote': 'What people reported paying. Not a quote.',
  'legal.window': 'Reports from the last 12 months.',
  'legal.excluded': 'Parts and travel are excluded, where the reporter told us.',
  'legal.grievance': 'Grievance officer',

  'benchmark.title': '{jobType} in {area}',
  'benchmark.usually': 'Usually {range}',
  'benchmark.midpoint': 'Most often around {amount}',
  'benchmark.tier.none': 'No reports yet — be the first',
  'benchmark.tier.early': 'Early estimate · {n} reports',
  'benchmark.tier.typical': 'Typical range · {n} reports',
  'benchmark.tier.plain': '{n} reports',
  'benchmark.level.locality': 'Showing {area}',
  'benchmark.level.district': 'Showing {area} — not enough reports in your locality yet',
  'benchmark.level.city': 'Showing all of {area} — not enough reports near you yet',
  'benchmark.empty.cta': 'Add what you paid',

  'report.title': 'What did you pay?',
  'report.job_type': 'What was the job?',
  'report.amount': 'What did you pay in total?',
  'report.parts.question': 'Were parts or materials included?',
  'report.parts.yes': 'Yes',
  'report.parts.no': 'No, labour only',
  'report.parts.unsure': 'Not sure',
  'report.parts.amount': 'How much of it was parts?',
  'report.when': 'Roughly when?',
  'report.where': 'Which area?',
  'report.name_in_feed': 'Show my first name with this report',
  'report.submit': 'Add my report',

  // §7.4 — instant payback. This screen is the entire incentive design.
  'payback.you_paid': 'You paid {amount} for {jobType}.',
  'payback.typical': 'Typical near you: {range} from {n} reports.',
  'payback.above': 'A bit above the usual range.',
  'payback.below': 'A bit below the usual range.',
  'payback.within': 'Right around the usual range.',
  'payback.no_data':
    "Nobody has reported this job in your area yet. Yours is the first — we'll email you when there is enough to compare against.",
  'payback.thanks': 'Thank you. This makes the next person’s decision better.',

  'auth.title': 'Sign in to add your report',
  'auth.why': 'Your report is saved. We just need an email address to attach it to.',
  'auth.email': 'Email address',
  'auth.send_code': 'Send me a code',
  'auth.code': '6-digit code',
  'auth.verify': 'Continue',
  'auth.no_account_needed': 'Reading prices never needs an account.',

  'provider.quotes_held': 'Quotes held on {hits} of {total} jobs',
  'provider.paused': 'Not taking new work right now',
  'provider.pause.title': 'You have paused new requests',
  'provider.pause.nothing_lost':
    'Nothing is lost. Your profile, your reports and your price history all stay exactly as they are.',
  'provider.pause.why': 'Mind saying why? One tap, and you can skip it.',
  'provider.pause.too_busy': 'Too busy',
  'provider.pause.not_enough_requests': 'Not enough requests',
  'provider.pause.taking_a_break': 'Taking a break',
  'provider.pause.prices_not_working': 'Prices not working for me',
  'provider.pause.something_went_wrong': 'Something went wrong',
  'provider.pause.other': 'Other',

  'error.generic': 'Something went wrong. Please try again.',
  'error.offline': 'You appear to be offline.',

  'common.retry': 'Try again',
  'common.loading': 'Loading…',
  'common.language': 'Language',
} as const

export type TranslationKey = keyof typeof en
