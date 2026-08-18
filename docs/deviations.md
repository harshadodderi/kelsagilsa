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

## 5. The local database harness shims PostGIS

`supabase/tests/run-local-checks.sh` runs every migration against a throwaway
Postgres with point arithmetic substituted for the handful of geo functions.
It proves the constraints, triggers, percentile maths, grants and the
security-definer boundary. It proves **nothing geographic** — verify the area
hierarchy and the provider radius against a real Supabase branch before Phase 1
ships.
