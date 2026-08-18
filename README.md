# Kelsagilsa

What people actually paid.

Hiring a tradesperson in India is a negotiation with asymmetric information.
The customer has no idea what the job should cost; the provider knows exactly.
Kelsagilsa publishes what people report paying, scoped to a job type and a
locality, so the customer arrives already knowing the rate.

The full brief is [`docs/build-plan-v3.md`](docs/build-plan-v3.md). Section
references throughout the code (`§7.3`, `§9.2`) point at it. This README says
what exists in the repository and what state each phase is in.

## Where the project is

The plan is ordered by **which risk each phase kills**, not by feature. Every
phase has a kill criterion, and a failed criterion is information, not defeat —
you change the mechanism and re-run the phase once. Twice, and stop.

| Phase | Kills the risk that… | Status | Stop if |
|---|---|---|---|
| **0** Classification sprint | a job cannot be classified, or has no price spread worth publishing | tooling ready, sprint not run | classification <70%, or most job types outside the 0.2–1.0 spread band |
| **1** Benchmark live | you cannot ship a useful public price page | **built, ungated** — see the launch checklist below | nothing: it gates on shipping, not results |
| **2** Organic pull | nobody reports without you asking | not started | organic share <15% **and** <20 organic reports/week after 4 weeks |
| **3** Supply | tradespeople will not join a product that publishes their prices | schema written, unapplied | <8 claimed + verified providers from 30 door-knocking contacts |
| **4** Verified data | the booking→report loop does not close | schema written, unapplied | reports ÷ accepted bookings <25% after 30 accepted bookings |
| **5** Mediation | (conditional) | not started | do not start unless Phase 4 passes |
| **6** Monetisation | providers will not pay | not started | <3 of the first 20 providers convert |

**Phase 2 is the one you will want to skip.** It is four weeks of watching a
number and fixing nothing, and it is the highest-value phase in the plan. Do
not build during it. If you cannot sit still, recruit providers by hand for
Phase 3 — that is preparation, not building.

## Do Phase 0 first

No app. A Google Form and a spreadsheet. Six fields, and **no job-type
dropdown** — the whole point is finding out whether free-text descriptions can
be classified afterwards. Offering the dropdown answers the question for the
respondent and destroys the test.

Export the responses, add one column called `job_type` that you fill in
yourself, leaving it blank wherever you would have had to ask a follow-up, then:

```bash
npm run phase0 -- observations.csv
```

That prints the classification rate, the spread ratio per job type, and the
§2.4 verdict. It is the most valuable output of the sprint: it tells you which
job types are worth a benchmark page and which are noise, before you build any
of them.

What it **cannot** tell you is whether a stranger will report unprompted.
Friends, family and your apartment group will tell you what they paid because
they know you. That is politeness, not product-market fit — the loop is tested
in Phase 2, against people who owe you nothing.

## Layout

```
supabase/migrations/   the schema, phase by phase. 0001–0005, 0009 and 0010
                       are Phase 1; 0006 is Phase 3; 0007 is Phase 4
supabase/functions/    send-otp — the only route by which a code is sent
supabase/tests/        every migration applied to a throwaway Postgres, plus
                       behavioural assertions
app/                   expo-router routes. /prices/[city]/[job] is the
                       acquisition channel and is pre-rendered
src/lib/               pure logic, no React Native imports, unit-tested
src/data/              GENERATED — the launch set and the baked figures
src/theme/             light AND dark tokens, parameterised from day one
src/locales/           en, kn, hi — two of them intentionally near-empty
scripts/               Phase 0 diagnostics, seed import, build-time baking,
                       privacy verification, browser smoke
tests/                 vitest, on the pure logic
```

### How a price page gets its numbers

The pages are the acquisition channel, so they are real HTML with real figures
in it — not a shell that fetches. Three steps, in this order, nightly:

1. `run_nightly()` recomputes weights, then every stat.
2. `npm run sync:launch-set && npm run sync:benchmarks` writes the published job
   types and the **city-level** figures into `src/data/`.
3. `npm run build:web` pre-renders every `/prices/[city]/[job-type]`.

In the browser the page then asks for location and narrows to the reader's
locality, naming whichever level it ends up showing. Nothing is baked below the
city level, because that is the widest honest answer and the only one knowable
before a browser says where it is.

First contentful paint measures **~810ms** on throttled Slow 4G with 4× CPU
throttling, against the 2.5s budget. `npm run smoke:web` measures it.

### The parts that carry the product

- **`0003_price_engine.sql`** — percentiles recomputed on write (a running sum
  cannot produce a median), hierarchical area resolution, and the confidence
  tiers.
- **`src/lib/confidence.ts` / `PriceFigure.tsx`** — the only place that decides
  how confident a published number looks. Below n=5 nothing renders; at 5–9 the
  **interval itself widens** to min–max and the midpoint is withheld. The fix at
  low n is not the label, because most people do not read labels.
- **`0001_identity_and_privacy.sql`** — RLS for rows, column grants for columns,
  and you need both. `phone`, `name` and `location` are unreadable through the
  table by anyone including the row's owner, which is why `get_my_profile()`
  exists.
- **`0004_weighting_and_abuse.sql`** — suspect reports are weighted down and
  kept, never deleted. Deleting punishes legitimate new users and teaches
  attackers your detection.

## Running it

```bash
cp .env.example .env      # fill in the Supabase URL, anon key and Turnstile key
npm install
npm run typecheck && npm test        # types and the pure logic
npm run db:check                     # every migration + the database assertions
npm run build:web && npm run smoke:web   # both themes, in a real browser
```

Apply migrations in order. `0006` and `0007` are phase-gated and deliberately
not part of the Phase 1 apply — `0007` in particular should not be applied
before the §11.3 GST question has an answer, because you may have to unbuild it.

Deploy the send function, which is the only route by which a code is sent:

```bash
supabase functions deploy send-otp --no-verify-jwt
supabase secrets set OTP_EMAIL_PEPPER="$(openssl rand -hex 32)"
```

`--no-verify-jwt` is deliberate: signing in is what it does, so the caller
cannot already have a token.

### The scripts

| Command | What it does |
|---|---|
| `npm run phase0 -- observations.csv` | the Phase 0 diagnostics and the §2.4 verdict |
| `npm run seed:import -- observations.csv` | the sprint output in, as `source='seeded'` |
| `npm run sync:launch-set` | regenerate the published job types and cities |
| `npm run sync:benchmarks` | bake the city figures into the static build |
| `npm run mint:link "apartment group"` | a link whose reports are tagged `solicited` |
| `npm run verify:privacy` | the §3.1 assertions against a real project |
| `npm run db:check` | every migration, applied, plus behavioural assertions |
| `npm run smoke:web` | the built site in a browser, both themes, FCP |
| `npm run icons` | re-render the PWA icons from `public/favicon.svg` |

The Monday review (§9.4) is a page, not a query you remember: `/admin/review`,
unlinked, gated on `role = 'admin'` in the database. It opens with metric zero,
because that is the number that decides whether any of the rest matters.

## Before a real user touches it

The legal gate (§11) is a gate, not an appendix.

- [ ] Terms and privacy notice reviewed; erasure paragraph settled **before**
      the first report is collected — it cannot be retrofitted
- [ ] Grievance officer named, with an email and a physical address, replacing
      the placeholders in `app/legal/grievance.tsx`. Use a virtual office, not
      your flat
- [ ] CA asked about GST §9(5) and the E-Commerce Rules (§11.2, §11.3)
- [ ] Resend configured as custom SMTP — Supabase's built-in sender is capped
      at a handful per hour and real signups fail silently
- [ ] Turnstile enabled on Auth → Attack Protection, plus 5 sends per email per
      hour and 20 per IP per hour
- [ ] `npm run verify:privacy` green against the real project
- [ ] `send-otp` deployed and `OTP_EMAIL_PEPPER` set, or sends are unlimited
      and unlogged
- [x] First contentful paint under 2.5s on throttled Slow 4G — measured at
      ~810ms by `npm run smoke:web`, re-measured on every CI run
- [x] Both themes verified in a browser, not assumed
- [ ] Weekly `pg_dump` workflow has its secrets set — free-tier Supabase has no
      point-in-time recovery

## What is deliberately not here

Ads, featured placement, paid verified badges, per-booking fees, travel
tiering, chat, realtime, native apps, a second category, and the full booking
state machine. Each is excluded with a reason and a revisit condition in §15,
so none of it gets re-litigated at 11pm.

There is **no Call button anywhere in this app**, and there never will be. A
phone number is disclosed by an act, never a default.
