# Where the code departs from the plan, and why

§0.2 of the plan records the arguments already had so they are not had again.
This file does the same job for decisions made while building, so nobody
rediscovers them by breaking something.

## 1. The account-age and prior-booking multipliers apply only to reports that name a provider

**Plan:** §9.2 lists the weighting terms as a flat product applied to every
report.

**Problem:** applied flatly, a booking-less report from a new account scores
`0.40 × 0.50 × 0.25 = 0.05`, well below the 0.30 area-benchmark threshold in
the same section. Phase 1 has nothing *but* booking-less reports from new
accounts, so the area benchmark would be permanently empty — and Phase 2 would
then measure organic pull against a product with no numbers on it. The same
section sets the booking-less multiplier at 0.40 and the area threshold at 0.30
specifically so that such a report *does* count, so the two readings are in
direct conflict.

**Resolution:** both terms exist to make reports about a **provider** expensive
to forge — the self-review loop, competitor bombing, price laundering. An
area-only report has no target. Benchmark poisoning is answered instead by the
2-per-day cap, the 0.40 multiplier, outlier flagging, and the aggregate's own n,
which is what §9.1 already says about it.

Implemented in `0004_weighting_and_abuse.sql` and `0007_booking_lite.sql`, with
the reasoning in a comment at the point of decision.

**If Phase 2 shows area medians being pushed around:** tighten the daily cap
first. A threshold that excludes every honest first-time reporter buys nothing.

## 2. `is_outlier()` recomputes the service amount rather than reading it

`reports.service_amount` is a generated column, and generated columns are
computed **after** before-row triggers run. Reading `new.service_amount` in the
flagging trigger yields null, every comparison against it yields null, and every
report lands unflagged — silently, with nothing in the logs.

The function recomputes `amount_paid − parts − travel` locally instead. Caught
by `supabase/tests/price-engine.test.sql`, which is the reason that file asserts
on a 30× outlier rather than trusting the trigger to exist.

## 3. `erasure_log.purge_after` is computed at sweep time, not stored

`erased_at + interval '180 days'` is *stable*, not *immutable*, so Postgres
refuses it as a generated column. The 180-day window is applied in
`run_retention_sweep()` instead. Same retention, no schema trick.

## 4. Phase 3 and Phase 4 migrations exist but are not applied

`0006_providers.sql` and `0007_booking_lite.sql` are written and syntax-checked,
and are deliberately **not** part of the Phase 1 apply. `0007` in particular
must not be applied before the §11.3 GST question has an answer — building
Phase 4 before that answer is on the plan's own trap list, because you may have
to unbuild it.

They are in the repository rather than in a branch because the phase-1 schema
has to be shaped to receive them: `reports.booking_id` exists from the first
row, without its foreign key, precisely so that no report ever needs
reclassifying as verified.

## 5. The colour scheme hook is ours, not React Native Web's

`useColorScheme` from react-native-web seeds its state during the static render
and does not re-read the media query when the page hydrates. Every page is
served as pre-rendered HTML (§12.5), so a reader whose device is in dark mode
got the light palette — on a page whose `<body>` background had correctly gone
dark, which made it look like a half-broken theme rather than a bug.

`src/theme/useColorScheme.ts` reads the media query through
`useSyncExternalStore`, which re-syncs on hydration. Native still uses React
Native's hook.

Found by looking at a screenshot, not by a test: the smoke test was asserting
"no console errors in dark", which a wrong-but-valid palette passes happily. It
now asserts the rendered text colour matches the theme's token, which is the
thing that was actually wrong.

## 6. The metric RPCs are admin-gated, not merely un-granted

`get_organic_share`, `get_coverage` and `get_report_rate` were written with
`revoke all ... from public, anon`, which left them callable by nobody at all —
including the admin page that needs them. Granting execute to `authenticated`
without a check would have published the business metrics to every signed-in
user. They now check `is_admin()` internally and are granted to
`authenticated`, matching how `moderate_report` and `admin_monday_review`
already worked.

## 7. Report photos are schema-only in Phase 1

`report_photos`, the storage path column and the erasure behaviour all exist,
because erasure had to be settled before the first report (§10.2). No upload UI
is built: it needs a storage bucket, its own policies, and the EXIF check on a
real device (§10.6), none of which serve the six steps in §18 at this phase.
Build it when a report needs a photo to be believed.

## 8. Sends go through an edge function, not `signInWithOtp`

§5.1 asks for Turnstile plus 5 sends per email per hour and 20 per IP per hour.
Per-IP limiting is impossible in a client — the client does not know its own
address, and a limit it enforces is a limit an attacker skips. So the client
calls `supabase/functions/send-otp`, which counts against `otp_send_log`, writes
the log entry, and forwards to GoTrue with the Turnstile token attached.

Turnstile is verified by GoTrue rather than by the function, because the token
is single-use: verifying it in the function would consume it and GoTrue's own
check would then fail. The function is the second line; Auth → Attack
Protection is the first.

## 9. The local database harness shims PostGIS

`supabase/tests/run-local-checks.sh` runs every migration against a throwaway
Postgres with point arithmetic substituted for the handful of geo functions.
It proves the constraints, triggers, percentile maths, grants and the
security-definer boundary. It proves **nothing geographic** — verify the area
hierarchy and the provider radius against a real Supabase branch before Phase 1
ships.
