# Kelsagilsa — Build Plan v3 (risk-ordered)

> Paste this whole file into Claude Code as the project brief for the repo
> `Kelsagilsa`. This supersedes v2. The structure changed: v2 was ordered by
> feature, v3 is ordered by **which risk each stage kills**. Every phase has a
> kill criterion. If a phase fails it, you stop and change the mechanism — you
> do not proceed to the next phase and hope.
>
> §0 lists every change from v2, and §0.2 records the arguments that were
> already had, so they are not had again at 11 pm in month three.

---

## 0. What changed from v2

| # | Change | Reason |
|---|---|---|
| 1 | **Restructured into 7 risk-ordered phases with kill criteria**, replacing the 10-week feature timeline | v2 read as an engineering plan wearing a product plan's clothes. Each phase now buys down one specific risk and states what result would end the project |
| 2 | **Phase 0 classification sprint added before any code** | v2 buried manual collection inside the Week 3 "done when". A failed test cost three weeks instead of zero |
| 3 | **Phase 0 is scoped to the questions it can actually answer** | Collecting reports from friends, family and your building tests whether people who know you will be polite. It cannot tell you whether a stranger reports. §2.1 says this plainly so a warm-network pass does not become false confidence |
| 4 | **Confidence tiers replace the binary n≥3 / n≥10 gates** | A hard threshold publishes a fragile number with an authoritative face. And at low n the fix is not only the label — it is **widening the interval** (min–max instead of P25–P75), because most people do not read labels |
| 5 | **Organic report share is metric zero** | v2's coverage metric can be satisfied entirely by hand-collecting and will look healthy while the product acquires nothing on its own. Needs `reports.source` from the very first row — it cannot be reconstructed |
| 6 | **Booking-lite replaces the full state machine** | `request → accept → done` at roughly a fifth of the cost. Preserves verified reports, quote accuracy, scoped address and the privacy model. Full scheduling, disputes and two-sided completion machinery cut |
| 7 | **Provider confirmation becomes a weight multiplier, not a gate** | v2's 72h auto-confirm was machinery built to stop a provider stonewalling. Making confirmation raise weight 0.7 → 1.0 achieves the same thing with one boolean |
| 8 | **Provider analytics is the monetisation line** | "You are 18% above the local median for geyser install" is something a tradesperson cannot get anywhere else, does not touch ranking, and turns the benchmark from a thing done *to* them into a tool *for* them |
| 9 | **Phase 5 (chat, notifications, moderation) is conditional** | Not a guaranteed feature. It happens only if Phase 4 shows contact volume that needs mediating |
| 10 | **Timeline stated as 4–6 months, phase-gated** | Same hours, honest range, and no fixed end date — phases gate on results, not on weeks elapsed |

**Carried from v2 unchanged, and not open for renegotiation:** the phone-number
privacy model, `public_name`, job type as part of the statistical key, the
parts/travel decomposition, median and interquartile range over means, permanent
anonymity of reporters to providers, weighting rather than rejecting suspect
reports, booking-less reports feeding only the area benchmark, identity cost at
provider claim, the Week 0 legal gate, PWA-first, email OTP login, Cloudflare
Pages, client-side image compression.

### 0.1 The kill criteria, in one place

| Phase | Kills the risk that… | Stop if |
|---|---|---|
| **0** Classification sprint | …a job cannot be classified, or has no price spread worth publishing | >30% of observations need a follow-up question to classify, **or** IQR/median <0.2 for most job types |
| **1** Benchmark live | …you cannot ship a useful public price page | Nothing — this is a build phase. It gates on shipping, not on results |
| **2** Organic pull | …nobody reports without you asking | Organic report share <15% **and** <20 organic reports/week after 4 weeks live |
| **3** Supply | …tradespeople will not join a product that publishes their prices | Fewer than 8 claimed, verified providers after 30 door-knocking contacts |
| **4** Verified data | …the booking→report loop does not close | Reports ÷ accepted bookings <25% after 30 accepted bookings |
| **5** Mediation | (conditional) | Do not start unless Phase 4 passes |
| **6** Monetisation | …providers will not pay | Fewer than 3 of your first 20 providers convert on a paid pilot |

**A failed kill criterion is information, not defeat.** Phase 2 failing means the
loop needs a different mechanism, not that the idea is dead. Phase 3 failing
means you are pitching the wrong end of the market. Write down what you change
and re-run the phase once. Twice, and stop.

### 0.2 Arguments already settled — do not re-litigate

Three of these came from a critique of v2 that was mostly right. Recording both
the point and the resolution so the resolution survives.

**"You are optimising architecture before proving the assumption."** Partly
true, and Phase 0 is the fix. But the specific list offered — PostGIS, RLS,
chat, push, moderation, booking state machines, quote accuracy — mostly sits in
Phases 4–5, already downstream of validation. The genuinely front-loaded items
are in §4, and each is there for one reason: **cheap now, expensive or
impossible later.** *Premature* and *expensive-to-retrofit* are different
categories. Do not cut the second to look lean.

**"Drop bookings and let contact happen directly."** This does not compose with
"do not simplify the security model", which is correct and also came from the
same critique. Without a booking there is no thread, no scoped address, and no
reason for the platform to mediate — so contact means exchanging a phone number,
which is the exact thing §3.1 exists to prevent. It also removes verified
reports, so per-provider medians and quote accuracy become permanently
impossible. **Booking-lite (§8) is the resolution:** it keeps all of that at
about a fifth of the cost of the v2 state machine.

**"n=10 is not enough for a stable P25/P75."** Correct. Fixed in §7.3 by
widening the interval at low n rather than only labelling it.

---

## 1. The thesis, and the four things that can kill it

**The problem:** hiring a tradesperson in India is a negotiation with asymmetric
information. The customer has no idea what the job should cost. The provider
knows exactly. The result is haggling, mistrust, and overcharging that falls
hardest on people who can least afford it.

**The product, in the order it becomes possible:**

| # | Artefact | Needs | Phase |
|---|---|---|---|
| 1 | **Area benchmark** — "Tap leak repair, Bengaluru South: usually ₹250–₹400, 34 reports" | n per job type per area, from anyone | 1 |
| 2 | **Per-provider typical price** — "₹300 from 14 reports" | verified reports per provider per job type | 4 |
| 3 | **Quote accuracy** — "Quotes held on 12 of 14 jobs" | quoted-and-reported jobs per provider | 4 |
| 4 | **Provider analytics** — "You are 18% above the local median" | all of the above, at density | 6 |

### 1.1 The four risks

| Risk | Why it might kill this | Bought down in |
|---|---|---|
| **Data acquisition** — jobs cannot be classified, or prices have no useful spread | If "tap leak repair" spans ₹150 and ₹3,000 because of scope variance, no benchmark is publishable at any n | Phase 0 |
| **Organic pull** — nobody reports unless you personally ask | The moat is the dataset. A dataset you maintain by hand is a spreadsheet, not a company | Phase 2 |
| **Adversarial supply** — price opacity is profitable for tradespeople; you are asking them to publish the thing that makes them money | No supply, no marketplace, and a benchmark with no one to book | Phase 3 |
| **Regulatory** — GST §9(5), e-commerce entity form, intermediary safe harbour | Any of these can force an architectural change or personal liability | Phase 1 gate, §11 |

Everything below is downstream of this table.

### 1.2 The pitch that works on supply

Not "join our marketplace". This:

> *"Customers arrive already knowing your rate. No haggling on the doorstep, and
> no losing jobs to someone who quotes ₹200 and charges ₹800."*

That lands with the honest, mid-priced end of the market. Recruit there. A
provider whose price reads high will simply pause and leave — which is why
**the area benchmark includes paused providers' history and per-provider stats
do not.** Otherwise the visible median drifts down to a level nobody will
honour and every customer feels lied to.

---

## 2. Phase 0 — Classification sprint

**No app. A Google Form and a spreadsheet, 30 minutes to set up.** Not "no
tooling" — the form gives you the data structure you will build against anyway,
and typing 100 observations into a Form is faster than into a notebook.

**Scope:** one city (Bengaluru), one category (plumbing), 6–10 job types.
**Target:** 100 observations, 30–50 conversations.
**Budget:** ~8 hours across two weeks.

### 2.1 What this sprint can and cannot tell you

**It can answer:**

1. Can a job be classified into a job type from how a lay person describes it,
   without a follow-up question?
2. Is the within-job-type price spread in the useful band (§2.3)?
3. How much effort does one usable observation cost?
4. Does your job-type taxonomy survive contact with reality, or do 40% of
   observations land in "other"?

**It cannot answer: will a stranger report unprompted.** Friends, family, your
apartment group and your colleagues will tell you what they paid because they
know you and it is mildly interesting. That is politeness, not product-market
fit. **A pass here is not validation of the loop.** The loop is tested in
Phase 2, against people who owe you nothing, and it is entirely possible to pass
Phase 0 comfortably and fail Phase 2 completely. Expect that and do not let a
warm-network result buy you four months of building.

### 2.2 The form

Six fields. If it takes a respondent more than 90 seconds, cut a field.

| Field | Type |
|---|---|
| What was the job? | Free text — **deliberately unstructured**, this is the classification test |
| What did you pay in total? | Number |
| Were parts or materials included? | Yes ₹___ / No, labour only / Not sure |
| Roughly when? | Month picker |
| Which area? | Locality dropdown |
| Anything else about the job? | Optional free text |

Do **not** offer a job-type dropdown. The whole point is to find out whether you
can classify free-text descriptions into your taxonomy afterwards. Offering the
dropdown answers the question for the respondent and destroys the test.

### 2.3 The diagnostics

Classify each free-text description into your draft job types yourself, after
collection. Then:

**Classification rate.** Share you could assign confidently without needing to
ask a follow-up.

> **Pass ≥70%.** Below that, the taxonomy is wrong — usually too fine-grained,
> occasionally missing an obvious bucket. Fix and re-classify before building.

**Spread ratio, per job type.** `(P75 − P25) ÷ P50`, and read it as a Goldilocks
band, not "lower is better":

| Ratio | Meaning | Action |
|---|---|---|
| **< 0.2** | Everyone charges nearly the same | No asymmetry to solve. This job type does not need a benchmark — drop it from the launch set |
| **0.2 – 1.0** | Real variation, coherent job | **The target.** Publish this |
| **> 1.0** | The bucket is mixing different jobs | Split the job type, or add a size qualifier ("geyser install — up to 25L") |

This diagnostic is the most valuable output of the sprint. It tells you which
job types are worth a benchmark page and which are noise, before you build any
of them.

**Effort per observation.** Time yourself honestly, including chasing.

> Above 15 minutes per usable observation, the ask is too heavy. Cut fields.

### 2.4 Kill criterion

> Stop and rework if classification rate is **below 70%**, or if **most** job
> types fall outside the 0.2–1.0 spread band.

Neither result kills the idea; both mean the unit of measurement is wrong, and
building on a wrong unit is the single most expensive mistake available to you —
every number you ever publish inherits it, and historical data cannot be
reclassified by hand at volume.

### 2.5 What you carry forward

- The final job-type list, 6–10 entries, with the ones that failed the spread
  test removed.
- ~100 observations, which become your **seeded** rows (`source = 'seeded'`,
  §13.1) and give Phase 1 a benchmark that is not empty on day one.
- A realistic number for effort per report.
- The wording people actually use, which becomes your job-type labels. If
  everyone says "tap leaking" nobody is searching for "faucet repair".

---

## 3. Non-negotiables

Constraints that hold in every screen and every query, in every phase.

### 3.1 A phone number is disclosed by an act, never a default

No screen, no API response, no export surfaces a phone number automatically.
**There is no Call button anywhere in this app.**

```sql
revoke all on table users from anon, authenticated;
grant select (id, public_name, role, share_name_with_provider, created_at)
  on users to authenticated;
```

RLS controls which *rows* are visible; column grants control which *columns*.
You need both. `phone`, `name` and `location` become unreadable through the
table by anyone including the row's owner — which is why reading your own
profile goes through a `security definer` RPC (`get_my_profile()`).

**The test.** Signed in as user B:

```js
const { error } = await supabase.from('users').select('phone').eq('id', A_ID)
// must be: permission denied for column phone
```

Automated, in Phase 1. The one assertion that must never regress.

### 3.2 First names only

`public_name` is a **generated** column — `split_part(btrim(name), ' ', 1)`.
Generated, so it cannot drift and cannot be selected around. Surnames are never
published: not search, not a provider page, not the report feed. Admin
moderation is the sole exception.

### 3.3 The number measures the provider, not the job

```
service = amount_paid − coalesce(parts_amount, 0) − coalesce(travel_amount, 0)
```

`parts_amount` is a **tri-state**:

| Value | Customer answered | Counts toward |
|---|---|---|
| `0` | "No, labour only" | Service figure at the full amount |
| `> 0` | "Yes, ₹180 of it" | Service figure at `amount_paid − parts` |
| `null` | "Not sure" | Total figure only |

**Never force the number.** A cornered customer invents one, and an invented
split is indistinguishable from a real one once it is in the aggregate. "Not
sure" stays selectable forever.

### 3.4 Job type is part of the key, not a tag

Every report carries `job_type_id`. Every published figure is scoped to a job
type and either a provider or an area. There is no "plumber price" in this
product.

### 3.5 Never publish a figure more confident than the data

Confidence tiers in §7.3. The interval widens at low n; it is not merely
labelled. Sample size sits beside every number, always, at legible size.

### 3.6 The provider never learns who reported what

Not the name, not the booking, not the timing. Permanent, with no toggle. The
customer chooses only whether their first name appears in the **public** feed.

### 3.7 Nothing reaches a real user before the legal gate is closed

Terms, privacy notice, named grievance officer, takedown route. §11.

---

## 4. What gets built before validation, and why

Everything in this list is built in Phase 1, before Phase 2 has proved anything.
Each earns its place by being **cheap now and expensive or impossible later** —
not by being important.

| Built early | Cost now | Cost if deferred | Why it cannot wait |
|---|---|---|---|
| Column grants + generated `public_name` | ~1 day | A published surname cannot be un-published | Irreversible disclosure |
| `reports.source` tagging | 10 minutes | Unreconstructable | It is metric zero (§13.1) |
| `job_type_id` on every report | 0 | Hand-reclassifying historical rows | Every number inherits the key |
| `occurred_on` captured on every report | 0 | Cannot be backfilled | Recency weighting and the 12-month window |
| i18n scaffold, three locales, keys only | ~2 hours | ~2 weeks | Touches every string in every screen |
| Light **and** dark design tokens | ~3 hours | ~1 week | Touches every component |
| `web.output: 'static'` | 30 minutes | Re-architecting routes | The benchmark pages are the acquisition channel |
| Turnstile on the OTP endpoint | ~1 hour | An exhausted email tier and mail sent from your domain to strangers | It is an open endpoint the moment you deploy |

**Everything else waits.** If it is not on this list and not required by the
current phase, it is not built. That includes chat, push, moderation queues,
offline shells, travel tiering, ads, featured placement, and native apps.

---

## 5. Auth — email OTP

Login is by **email address**. Supabase does not send SMS itself, and
transactional SMS in India requires DLT registration with TRAI — entity, sender
ID and every template, each with its own approval cycle. Email needs none of it.

```js
// send — edit the Magic Link template to include {{ .Token }} so the user gets
// a 6-digit code rather than a link; they never leave the tab
await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })

// verify
await supabase.auth.verifyOtp({ email, token, type: 'email' })
```

**Configure Resend as custom SMTP before anyone but you signs in.** Supabase's
built-in sender is capped at a handful per hour and is for development only —
real signups fail silently.

### 5.1 Turnstile — Phase 1, not later

`signInWithOtp` is unauthenticated and sends mail from your domain to any
address supplied. Left open it is a free mail-bomb, an account-enumeration
oracle, and a way to burn 3,000 free emails in an afternoon.

- Enable **Cloudflare Turnstile** in Supabase Auth → Attack Protection.
- Add **5 sends per email per hour, 20 per IP per hour**.
- Log every send with IP and user-agent, retained 90 days (§10.4).

### 5.2 Reading the benchmark requires no account

This matters more in v3 than it did in v2, because Phase 2 measures organic
pull. A signup wall in front of a price page destroys the thing you are trying
to measure.

| Action | Account needed? |
|---|---|
| Read a benchmark page | **No** |
| Submit a booking-less report | **Yes** — but sign-in happens *after* the numbers are entered, never before |
| Everything else | Yes |

Hold the entered report in local state, sign the person in, then write it. A
person who abandons at the OTP screen has still told you what they paid — count
that abandonment in your metrics, because it is the cost of requiring an
account at all.

### 5.3 Roles

```sql
role text not null default 'customer'
  check (role in ('customer', 'provider', 'admin'))
```

**`role` decides which home screen you land on. It does not decide what you may
do.** A plumber can book an electrician; the booking policies must never gain a
`role` check. `admin` is the exception — it gates moderation RPCs and is never
settable from the client.

Everyone starts as `customer`. No role picker at signup: the customer path pays
off in thirty seconds, the provider path is ten minutes of setup, and ~95% of
signups are customers. Keep a quiet "I provide a service" link on sign-in for
those who arrive with intent. Early supply is recruited, not funnelled (§9).

### 5.4 Identity has to cost something — at claim, not signup

Email OTP makes an identity free. Fine for customers, fatal for providers: a
suspended provider re-registers in ninety seconds and reputation means nothing.

Put the cost at **provider claim**:

- **₹1 UPI verification** — a ₹1 collect request to their UPI ID, refunded. It
  binds the profile to a bank-verified name and cannot be repeated cheaply at
  scale.
- **Or manual** — you meet them, because you are door-knocking anyway.

```sql
alter table provider_profiles
  add column identity_method text check (identity_method in ('upi','manual')),
  add column identity_verified_at timestamptz,
  add column identity_ref_hash text;   -- sha256(vpa). Never the VPA itself
```

An unverified provider profile may exist but **never appears in search**.

> **Open question, answer in Phase 3.** ₹1 UPI verification may kill
> claim-through with tradespeople who are suspicious of any payment request from
> an app they have never heard of. Test manual verification on your first ten
> providers, and only automate if the manual version proves people will claim at
> all. If claim-through is under 50%, drop to manual-only and carry the cost.

### 5.5 Pausing, not deleting

```sql
alter table provider_profiles
  add column accepting_work boolean not null default true;
```

| Concept | Column | Controls |
|---|---|---|
| **View preference** | `users.role` | Which home screen you land on. Nothing else |
| **Availability** | `provider_profiles.accepting_work` | Whether you appear in search and receive requests |

Independent. A plumber browsing for an electrician has switched their *view* and
must stay in search throughout.

Enforce server-side in both search and the booking guard. Pausing does not touch
existing bookings, reports, stats, bio, portfolio or categories. **Never delete
a `provider_profiles` row to mean "stopped providing"** — it erases price
history other customers depend on.

Ask why once, skippable, never blocking, after the switch has already flipped:

> Too busy · Not enough requests · Taking a break · Prices not working for me ·
> Something went wrong · Other

"Not enough requests" and "prices not working for me" point at opposite fixes.
Never ask on switch-*on*. In the copy, say plainly that nothing is lost, and
never call it "deactivate" or "delete". It is a pause.

---

## 6. Data model

`reviews` from v1 is `reports` — the price is the point, the rating is optional
garnish.

### 6.1 Phase 1 — core and the price engine

```sql
users (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  public_name text generated always as (split_part(btrim(name), ' ', 1)) stored,
  phone text,                       -- optional, private, never granted
  role text not null default 'customer'
    check (role in ('customer','provider','admin')),
  location geography(point, 4326),  -- private
  area_geohash text,                -- ST_GeoHash(location, 6)
  share_name_with_provider boolean not null default false,
  suspended boolean not null default false,
  birth_year int,                   -- 18+ gate only. Never a full date of birth
  created_at timestamptz not null default now()
);

categories (id, slug, name, sort_order, icon_key);

job_types (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories (id),
  slug text not null unique,        -- 'tap-leak', 'drain-block', 'geyser-install'
  name text not null,               -- the words people actually used in Phase 0
  size_qualifier text,              -- 'up to 25L' where §2.3 forced a split
  typical_hint text,                -- shown while there is no data
  sort_order int not null default 0
);

reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references users (id) on delete set null,
  booking_id uuid unique references bookings (id),  -- NULL = unverified
  provider_id uuid references users (id),           -- NULL = area-only
  job_type_id uuid not null references job_types (id),
  area_geohash text not null,

  amount_paid    numeric(10,2) not null check (amount_paid > 0),
  parts_amount   numeric(10,2) check (parts_amount is null or parts_amount >= 0),
  travel_amount  numeric(10,2) check (travel_amount is null or travel_amount >= 0),
  service_amount numeric(10,2) generated always as
    (amount_paid - coalesce(parts_amount,0) - coalesce(travel_amount,0)) stored,

  rating int check (rating between 1 and 5),
  comment text,
  name_in_public_feed boolean not null default false,

  source text not null default 'organic'            -- §13.1, metric zero
    check (source in ('organic','seeded','solicited','recruited_provider')),
  weight numeric(3,2) not null default 1.0,         -- §9.2
  flagged boolean not null default false,
  hidden  boolean not null default false,
  occurred_on date not null,
  created_at timestamptz not null default now(),
  edited_until timestamptz
);

report_photos (report_id, storage_path, created_at);
```

**Hard constraint:** a report with `provider_id` set and `booking_id` null never
feeds per-provider stats. Otherwise anyone could name any provider and drop a
number on them.

```sql
area_job_stats (
  area_geohash text, job_type_id uuid, precision int,   -- 6, 5, or 0 = city
  n int, p25 numeric, p50 numeric, p75 numeric, min_amt numeric, max_amt numeric,
  updated_at timestamptz,
  primary key (area_geohash, job_type_id)
);

provider_job_stats (              -- Phase 4
  provider_id uuid, job_type_id uuid,
  n int, p25 numeric, p50 numeric, p75 numeric,
  total_p50 numeric, rated_n int, rating_avg numeric(3,2),
  quote_n int, quote_hits int,
  updated_at timestamptz,
  primary key (provider_id, job_type_id)
);
```

Both stats tables: **RLS on, zero policies.** Every reader is a
`security definer` RPC returning percentiles. Never expose a sum — a lifetime
billings total is not yours to publish.

### 6.2 Phase 3 — supply

```sql
provider_profiles (
  user_id uuid primary key references users (id) on delete cascade,
  bio text,
  service_area_radius_km numeric(6,2),
  claimed boolean not null default false,
  claim_token text unique,
  accepting_work boolean not null default true,
  identity_method text, identity_verified_at timestamptz, identity_ref_hash text,
  created_at timestamptz not null default now()
);

provider_categories (provider_id, category_id);   -- max 3, trigger-enforced
provider_status_changes (id, provider_id, accepting_work, reason, created_at);
```

### 6.3 Phase 4 — booking-lite

```sql
bookings (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references users (id),
  provider_id uuid not null references users (id),
  job_type_id uuid not null references job_types (id),
  status text not null default 'requested'
    check (status in ('requested','accepted','declined','done','expired','cancelled')),
  note text,                            -- free text, includes "when suits you"

  quoted_amount numeric(10,2),          -- provider sets at accept, immutable
  address_line text,                    -- revealed on accept, purged +30d
  address_purged_at timestamptz,

  done_at timestamptz,                  -- either party marks
  provider_confirmed_done boolean not null default false,  -- weight multiplier

  requested_at timestamptz not null default now(),
  accepted_at timestamptz, declined_at timestamptz,
  expired_at timestamptz, cancelled_at timestamptz
);
```

### 6.4 Throttles — triggers, with real error messages

| Limit | Ceiling |
|---|---|
| Reports per user per 24h | 5 |
| Booking-less reports per user per 24h | 2 |
| Open booking requests per customer | 5 |
| Booking requests per 24h | 15 |
| User reports (abuse) per day | 10 |
| Report edit window | 2 hours, then an "edited" marker |
| Categories per provider | 3 |
| Provider location changes | 1 per month, logged |

These raise Postgres exceptions. Catch and render them — a throttle must never
surface as "something went wrong".

---

## 7. The price engine

### 7.1 Percentiles, recomputed on write

A running sum cannot produce a median. Recompute the affected row from its
reports on every insert or update. At your scale that is tens of rows.

```sql
create or replace function recompute_provider_job_stats(p_provider uuid, p_job uuid)
returns void language sql security definer as $$
  insert into provider_job_stats as s (provider_id, job_type_id, n, p25, p50, p75,
                                       total_p50, rated_n, rating_avg, updated_at)
  select p_provider, p_job,
         count(*),
         percentile_cont(0.25) within group (order by service_amount),
         percentile_cont(0.50) within group (order by service_amount),
         percentile_cont(0.75) within group (order by service_amount),
         percentile_cont(0.50) within group (order by amount_paid),
         count(*) filter (where rating is not null),
         avg(rating) filter (where rating is not null),
         now()
  from reports
  where provider_id = p_provider
    and job_type_id = p_job
    and booking_id is not null              -- verified only
    and not hidden
    and weight >= 0.5
    and occurred_on >= current_date - interval '12 months'
  on conflict (provider_id, job_type_id) do update set ...;
$$;
```

Note what the `where` clause does: unverified, hidden, low-weight and stale rows
are excluded, and `n` counts what survived. **The number shown and the sample
size shown always describe the same set.** Never display a count that includes
rows you filtered out.

`percentile_cont` interpolates, which is what you want on small samples.

### 7.2 The area benchmark

Same maths, pooled by locality, and it accepts **everything**: booking-less
reports, reports about paused providers, reports about tradespeople who are not
on the platform at all, and your Phase 0 seed rows.

Resolve the area hierarchically, first level with enough data wins:

```
ST_GeoHash(location, 6)   ≈ 1.2 km × 0.6 km   → enough?
ST_GeoHash(location, 5)   ≈ 4.9 km × 4.9 km   → enough?
city                                           → enough?
else "No reports yet — be the first"
```

Always name the level you are showing — *"Bengaluru South"* — never widen
silently. Recompute nightly via `pg_cron` or a scheduled GitHub Action; this
does not need to be live.

### 7.3 Confidence tiers — replaces the binary threshold

The fix at low n is not only the label. **It is the interval.** P25/P75
estimated from eight observations is close to noise, and most people do not read
labels. Widen the interval instead, so the display is honest even when unread.

| n | Interval shown | Label | Midpoint? |
|---|---|---|---|
| **0–4** | none | "No reports yet — be the first" | no |
| **5–9** | **min–max** | "Early estimate · 6 reports" | no |
| **10–19** | P25–P75 | "Typical range · 12 reports" | yes |
| **20–49** | P25–P75 | "· 31 reports" | yes |
| **50+** | P25–P75 | "· 84 reports" | yes |

- Below n=5 nothing renders. Not greyed, not "coming soon" — the empty state is
  the report form.
- At 5–9 the min–max range is deliberately unhelpful-looking, because the data
  is. That is the point.
- The midpoint appears only from n=10, because a median from eight points
  invites a precision nobody has earned.
- These thresholds apply identically to area benchmarks and per-provider figures.
  One rule, no exceptions, no "but this provider is obviously good".

### 7.4 Instant payback on the report screen

The moment a report is submitted, before anything else:

> You paid **₹350** for a tap leak.
> Typical near you: **₹280 – ₹320** from 34 reports.
> A bit above the usual range.

Never editorialise past that. Do not say they were cheated — you do not know
what the job was. **This screen is the entire incentive design.** Build it in
Phase 1, not later, and if the benchmark for their job type is below n=5, say so
honestly and offer to email them when it fills.

### 7.5 Consistency, in words

Surface spread as **"usually ₹280–₹320"**, never a standard deviation. Someone
averaging ₹300 with tight variance is a different proposition from someone
averaging ₹300 across ₹100–₹900, and this is a stronger trust signal than stars
because it comes from money rather than opinion.

### 7.6 Booking-less reports

The bootstrap path, and what makes Phase 1 possible:

| Field | Behaviour |
|---|---|
| Job type | Required. Picker of 6–10, using Phase 0's wording |
| Amount paid | Required |
| Parts | Tri-state, never forced |
| When | Month picker, defaults to this month. Over 12 months is refused |
| Where | Device location if granted, else locality picker |
| Who | **Omit the field entirely in v0.** It cannot feed provider stats (§6.1) and asking for it implies otherwise |

Base weight 0.4 (§9.2). Two per user per 24h. These build the benchmark and
nothing else, and that is enough.

---

## 8. Booking-lite

The v2 state machine had six states, two-sided completion, a 72-hour
auto-confirm and a dispute path. This has four live states and one boolean, at
roughly a fifth of the cost, and loses nothing that matters.

```
requested ──┬──▶ accepted ──▶ done
            ├──▶ declined  (end)
            ├──▶ expired   (end, automatic at 24h)
            └──▶ cancelled (end)
                              accepted ──▶ cancelled (end)
```

### 8.1 What it keeps, and why that answers the "just drop bookings" argument

| Kept | Because |
|---|---|
| A thread that exists without a phone number | §3.1. Direct contact means exchanging numbers, which is the thing the privacy model exists to prevent |
| `booking_id` on a report | Without it there are no **verified** reports, so per-provider medians and quote accuracy are permanently impossible |
| `quoted_amount` at accept | The only thing making the displayed price mean something (§8.3) |
| A scoped `address_line` | Otherwise the address goes into free text and is never deleted |
| Provider acceptance | **This is the two-sidedness.** A competitor cannot bomb a provider who never accepted the job |

### 8.2 What it drops

Scheduling fields (a free-text "when suits you" in `note` is enough at this
volume), the `disputed` state (there is no money in escrow to dispute — a
disputed job is a support email), two-sided completion with auto-confirm, and
booking modification. Add them back if and only if support volume demands it.

### 8.3 Quote accuracy

Without this, the displayed price is a lead-generation magnet with no obligation
attached, and the incentive to keep it artificially low is exactly as strong as
the incentive to charge high.

**At accept**, optional but prominent:

> *Accepting: geyser installation, Indiranagar.*
> **What will you charge for labour?** ₹____
> Parts and travel are separate. Customers see whether your quotes hold.

Stored in `bookings.quoted_amount`, **immutable after accept** (enforce in the
status trigger).

**On report:**

```
hit = abs(service_amount − quoted_amount) ≤ 0.15 × quoted_amount
```

Displayed at n≥5 only, as **"Quotes held on 12 of 14 jobs"**. Never as a
percentage with a decimal. Only booking-backed reports count; a job with no
quote counts toward neither side of the fraction. Do not rank by it in v0 —
display it, and watch what happens.

### 8.4 Provider confirmation as a weight multiplier

v2 built a 72-hour auto-confirm to stop a provider stonewalling completion to
block a bad report. One boolean does the same job:

| State | Report weight multiplier |
|---|---|
| `done_at` set by either party | 0.7 |
| `provider_confirmed_done = true` | 1.0 |

A provider cannot block a report by refusing to confirm — they can only make it
count for less, and refusing to confirm every job they were paid for is itself
a signal that shows up in §9.4. Customers never see this multiplier.

### 8.5 Design for the decline

It will happen constantly early on, when providers are not in the habit of
opening the app.

- Return the customer to **the results they already saw** — job type and
  location preserved, never a fresh search.
- Say plainly they can request someone else. Do not editorialise about why.
- **Expire unanswered requests at 24 hours.** An unanswered request is worse
  than a declined one, because the customer is still waiting.

### 8.6 The regulatory hook

Booking-lite is deliberately closer to an introduction than a transaction: no
payment, no scheduling, no order confirmation, no completion guarantee. That
does not settle the GST §9(5) question (§11.3), but it is the version most
defensible if the answer is unfavourable, and it is the version you can strip to
a pure directory in a day rather than a month.

---

## 9. Abuse model

Assume every mechanism is attacked by someone with more time than money. The
goal is not impossibility — it is making attacks **cost more than they return**,
and **degrading rather than blocking**, because blocking punishes legitimate new
users at the moment of highest drop-off.

### 9.1 The attack table

| Attack | Cost today | Defence |
|---|---|---|
| **Self-review loop** — provider makes customer accounts, books themselves, reports ₹200 and 5 stars | ~₹0 | Weighting (§9.2) collapses it to ~0.1. Plus: the provider must accept the booking under their own account, device/IP overlap check, booking-graph check |
| **Doorstep coercion** — "5 stars and say ₹200", said while standing in your kitchen | ₹0 | Prompt at **+6h**, never at completion. Permanently anonymous to the provider (§3.6). The provider never sees which booking a report came from |
| **De-anonymisation by elimination** — provider with 3 jobs knows who wrote each report | ₹0 | Individual reports render only at n≥10. Below that, aggregate only |
| **Competitor bombing** — request, get accepted, report ₹4,000 and 1 star | ₹0 | Provider acceptance is the gate (§8.1). Weight 0.25 for a reporter with no prior unrelated activity. Outlier flag (§9.3). Right-of-reply |
| **Ban evasion** — suspended provider re-registers | ₹0 | Identity cost at claim (§5.4). A suspended `identity_ref_hash` cannot re-verify |
| **Location spoofing** — provider fakes coordinates, appears citywide | ₹0 | Provider location set server-side at claim, 1 change/month, logged. Customer spoofing is harmless — ignore it |
| **Benchmark poisoning** — flood booking-less reports to move an area median | ₹0 | 2/day cap, weight 0.4, and the benchmark's own n makes it the hardest thing to move once it is past n=20. Watch §9.4 |
| **Category spam** — one listing under every trade | ₹0 | Max 3 categories. A provider ranks in a job type only with ≥1 verified report in it |
| **OTP mail-bomb / enumeration** | ₹0 | Turnstile + per-email and per-IP limits (§5.1) |
| **Scraping** — enumerate every provider, price and name | ₹0 | Rate-limit `search_providers` per user, cap radius server-side, **round returned coordinates to ~500 m** |
| **Review extortion** — "discount or I report ₹900" | ₹0 | Right-of-reply, one, public, 300 chars. Persistent outlier reporters get weight-decayed |
| **Price laundering** — provider reports their own jobs as a customer to seed a low median | ₹0 | Weight 0 where reporter and provider share a `provider_categories` overlap |
| **Off-platform leakage** — contact made, job done, never reported | — | Structural. §7.4 and §8.3 are the only real answers. Do not try to police it |

### 9.2 The weighting function

One trigger on insert, nightly recompute for the recency term. Deliberately
simple — you must be able to explain it to a provider who asks why their listing
changed.

```
weight = 1.00
  × (booking_id is not null                                ? 1.00 : 0.40)
  × (provider_confirmed_done                               ? 1.00 : 0.70)   -- §8.4
  × (reporter has ≥1 prior completed booking with a
     DIFFERENT provider                                    ? 1.00 : 0.25)
  × (reporter account age ≥ 7 days                         ? 1.00 : 0.50)
  × (reporter shares no device/IP with the provider        ? 1.00 : 0.10)
  × (reporter and provider share no category overlap       ? 1.00 : 0.00)
  × (occurred_on within 6 months  ? 1.00
     : within 12 months           ? 0.60
     : 0.00)
clamp [0, 1]
```

- **Per-provider stats threshold: weight ≥ 0.5.**
- **Area benchmark threshold: weight ≥ 0.3**, because pooled thousands tolerate
  noise far better than an n=6 provider median does.
- Never tell a user their weight or why. This is the one place transparency
  helps the attacker more than the user.
- The booking-less multiplier means an unverified report cannot reach 0.5 and
  therefore can never touch a provider's number, by arithmetic rather than by a
  policy someone might loosen later.

### 9.3 Outlier flagging

Once a job type has **n≥5** for that provider or area, flag a new report whose
`service_amount` is above 4× or below ¼ of the current median. Compare
service-to-service, never total-to-total.

Flagged means: excluded from stats, queued for review, **not deleted**, and the
reporter is told nothing. A flagged report that survives review is reinstated at
full weight.

### 9.4 The Monday review — ten minutes, one admin page

- Reports with weight < 0.5, last 7 days
- Flagged outliers awaiting review
- Any median that moved more than 25% in a week
- Providers who never set `provider_confirmed_done` despite repeat bookings
- New provider claims awaiting verification
- **Accounts created in the last 7 days with exactly one booking, with one
  provider** — this query catches the self-review loop better than any heuristic
  you will write

---

## 10. Privacy and data protection

### 10.1 Posture

India's DPDP Rules were notified on 13 November 2025, with full compliance due
13 May 2027 and the Data Protection Board already constituted and accepting
complaints. You have runway on the machinery. You have **no** runway on the two
decisions that cannot be bolted on: consent architecture, and what erasure does
to your aggregate.

### 10.2 The erasure decision — settle it before the first report

A price report is simultaneously personal data about the reporter and the
irreplaceable asset of the product. Decide now and state it in the notice
**before** the first report is collected:

> On account deletion, the reporter link is severed and the report survives as
> an anonymous data point in the price aggregate. Free-text comments and photos
> are deleted.

Implementation: `reporter_id` → null, `comment` → null, photos purged, the row
and its numbers retained. Retrofitting after your first deletion request is
impossible, because by then you have promised something else.

### 10.3 Provider consent is separate

Publishing a provider's price history publishes personal data about an
identified individual. Its own screen at claim, in plain language:

> Amounts customers report paying you will be published as a range and a
> midpoint, with the number of reports. Your first name and locality appear.
> Your surname, phone number and exact address never do. You can stop taking new
> work at any time; past reports remain part of the area price data.

That last clause is the one that will cause arguments. Say it before they claim,
not after.

### 10.4 Retention

| Data | Retention |
|---|---|
| Booking address | 30 days after terminal state |
| OTP send logs (email, IP, UA) | 90 days |
| Search / location history | Not stored. Current location only, overwritten |
| Report comments and photos | Until account deletion, then purged |
| Report numbers | Indefinite, de-identified on deletion (§10.2) |
| Removed content + registration records | **180 days** — required by IT Rules 2021 |
| Moderation actions | 3 years |
| Identity verification | Hash and date only. Never the VPA, never a document |
| Chat, if Phase 5 happens | 90 days on terminal bookings |

### 10.5 Address

The provider has to find the house. In free-text chat that is unstructured,
un-retained on purpose, and un-deletable.

- `bookings.address_line`, written by the customer at request time.
- **Revealed only on `accepted`.** Not in search, not in the request preview.
- Nulled 30 days after terminal state by a nightly job.
- Never in an export, a notification body, or an email.

### 10.6 Photos

Compress client-side, always. A phone photo is 3–5 MB; at 1200 px JPEG q80 it is
~150 KB — the difference between hitting Supabase's 5 GB egress cap at 500 users
and at 15,000.

```ts
import * as ImageManipulator from 'expo-image-manipulator'
const compressed = await ImageManipulator.manipulateAsync(
  uri, [{ resize: { width: 1200 } }],
  { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
)
```

Re-encoding drops EXIF including GPS. **Verify it once on a real device photo**
and keep the check in the launch list — do not assume it. One-line warning on
the upload control: *"Avoid house numbers, faces and documents."*

### 10.7 Age

DPDP treats anyone under 18 as a child, with verifiable parental consent and
restrictions on tracking and targeted advertising. For a solo project: **18+
only** in the ToS, self-declared birth **year** at signup (store the year, never
a full date — an age plus a dated birthday is a date of birth), and no
personalised advertising ever.

---

## 11. The legal gate — closes before Phase 1 ships

Not an appendix. **No real user touches the product until this is done.** One
weekend plus one call with a CA.

> Not legal advice. Two items need a professional opinion and are marked.

### 11.1 IT Rules 2021 — safe harbour for user-generated reports

This is what stands between you and personal liability for a defamatory report
about a named tradesperson.

- [ ] **Terms of service** and **privacy notice**, linked from every footer
- [ ] **Named grievance officer** — name, email, physical address, displayed
      prominently. Acknowledge complaints within **24 hours**, dispose within
      **15 days**
- [ ] **Takedown route** — remove or disable unlawful content within **36 hours**
      of a court order or government notification
- [ ] **Retain removed content and registration records for 180 days**
- [ ] `moderation_actions` log with timestamps, so compliance is evidenceable

The grievance address is public. Use a virtual office or registered business
address, not your flat.

### 11.2 Consumer Protection (E-Commerce) Rules 2020 — **needs an opinion**

Rule 4(1) requires an e-commerce entity to be a **company incorporated under the
Companies Act** and to appoint a nodal contact resident in India. It also
requires a grievance officer who acknowledges within **48 hours** and redresses
within **one month**, and prominent display of legal name, address and contact
details.

You are an individual. Practical posture:

- **Phases 1–5, unmonetised, benchmark-led:** closer to an information service
  than a marketplace. Run it, publish the grievance route, take the risk
  knowingly.
- **Before Phase 6 takes a single rupee:** incorporate. A private limited is
  roughly ₹8,000–15,000 and a few weeks. Do not take subscription money as an
  individual.

### 11.3 GST §9(5) — **the sharpest question, answer before Phase 4**

Housekeeping services including plumbing and carpentry, when supplied *through*
an electronic commerce operator, make the **operator** liable to pay the GST
where the tradesperson is below the registration threshold. Your entire supply
base will be below the threshold.

Whether this bites turns on whether Kelsagilsa "supplies through". Booking-lite
is deliberately closer to an introduction than a transaction, and processes no
payment — that helps the argument but does not settle it.

**Ask the CA in Phase 0**, while the answer is still free to act on. If the
answer is unfavourable, the mitigation is architectural: strip to directory plus
benchmark plus a contact route, which is a day's work from booking-lite and a
month's work from the v2 state machine. **The benchmark — your best asset — is
unaffected either way.**

### 11.4 IS 19000:2022 — online consumer reviews

A **voluntary** BIS standard, with the government having repeatedly signalled it
would consider making compliance mandatory. Complying now is nearly free and is
your integrity story anyway:

- [ ] Verified-transaction reports labelled as such
- [ ] Publication date and rating on every report
- [ ] Paid or sponsored placement disclosed unmistakably
- [ ] Purchased or paid-for reports never published
- [ ] A named review administrator (you) and a documented moderation process
- [ ] Edits only within 2 hours, marked "edited" afterwards

### 11.5 Copy that has to exist

- **On every figure:** *"What people reported paying. Not a quote."*
- **On the benchmark page:** what is included and excluded, the time window, the
  sample size, the area level.
- **On search results:** the ranking parameters in one plain sentence.
- **If you ever sell placement:** "Featured" in unmistakable type, visually
  separate, capped at one slot — or sell analytics instead and never touch the
  ranking.

---

## 12. Design

Operator-grade clarity, first-time-user simplicity. Restraint, not density —
your user has a leaking tap, a cheap phone, and no patience.

### 12.1 Take

- One accent colour, used sparingly. One grid, one spacing scale.
- **Monospace for every number** — prices, distances, counts. `tabular-nums`.
- Numbers are the hero. The price is the largest element on a card.
- One primary action per screen. Phones are one column.
- "Typical price", never "median service charge".

### 12.2 Reject

- **Dark-only.** Your user is outdoors in Bangalore daylight on a cheap Android
  LCD with low peak brightness — the worst case for a dark interface. Ship both,
  default to system. Tokens theme-parameterised from day one.
- **Text-only category grids.** For low-literacy users, pictograms *are* the
  accessibility affordance. Icon plus label, always.

### 12.3 Localisation — Phase 1, with empty locales

- `i18n` wired with English, Kannada and Hindi keys, even if two ship empty.
- **Design every layout for +40% string length.**
- Never concatenate translated fragments; interpolate.
- A rupee figure needs no translation — numbers-first design helps enormously.
- Language picker on sign-in and in settings, never buried.

### 12.4 Mobile

- Design at 390 px; cap content at ~440 px centred on desktop.
- Bottom tab bar. **Every input ≥ 16 px** or iOS Safari zooms on focus and never
  back. Tap targets ≥ 44 px. Respect `env(safe-area-inset-bottom)`.
- No hover-only affordances.
- Every screen gets an empty, loading and error state as it is built — not at
  the end.

### 12.5 Web output and performance

- `web.output: 'static'` from day one. Pre-render `/prices/[city]/[job-type]`,
  `/prices/[city]`, and the legal pages. Do **not** pre-render per-provider
  pages — live data, unbounded route space.
- Nightly rebuild via GitHub Actions.
- Lazy-load every route outside the first screen.
- **Budget: first contentful paint under 2.5s on throttled Slow 4G.** Measure in
  DevTools before launch, not on office wifi.

---

## 13. Metrics

### 13.1 Metric zero — organic report share

> **Organic report share = reports you did not personally solicit ÷ all reports.**

A coverage metric ("% of job types with ≥20 reports") can be satisfied entirely
by hand-collecting, and will look healthy while the product acquires nothing on
its own. This one cannot.

Tag every report at write time. **It cannot be reconstructed later**, which is
why `reports.source` is in §4:

| Value | Meaning |
|---|---|
| `seeded` | You entered it from the Phase 0 sprint |
| `solicited` | You asked this specific person, or it came from a link you personally sent |
| `recruited_provider` | Came via a provider you personally onboarded |
| `organic` | Everything else — arrived without you asking |

Attribute `solicited` with a signed query param on any link you send personally;
default everything else to `organic`. Attribution is imperfect and that is fine —
you need direction, not precision. Be strict with yourself: if you posted the
link in a WhatsApp group you are a member of, that is `solicited`.

**Kill criterion (Phase 2):** after four weeks of the benchmark being live and
shared, organic share **below 15%** and fewer than **20 organic reports/week**
means the loop does not self-sustain. That is not necessarily the end — but it
means you are running a content business that needs a distribution strategy, not
a data-network business that compounds, and the plan from Phase 3 onward is
wrong.

### 13.2 The rest, weekly

| # | Metric | Watch for |
|---|---|---|
| 1 | **Organic report share** (§13.1) | The kill criterion above |
| 2 | **Report rate** — reports ÷ accepted bookings | Below 25% after 30 accepted bookings, the booking→report loop is broken |
| 3 | **Benchmark coverage** — (area, job type) pairs at n≥10 and at n≥20 | Track both. n≥20 is the number that makes a page worth linking |
| 4 | **Report form abandonment** — entered numbers ÷ submitted | High abandonment at the OTP step is the cost of requiring an account (§5.2). If it exceeds 40%, reconsider the account requirement |
| 5 | **Provider response time** — median hours, request to accept/decline | Above 12 hours means notifications are failing and customers are churning silently |
| 6 | **Claim-through** — claimed ÷ stubs created | Under 50% means §5.4's ₹1 verification is the problem. Drop to manual |
| 7 | **Quote population** — providers with ≥5 quoted-and-reported jobs | If providers skip quoting, the badge is not motivating them |

Metrics 1 and 2 decide whether the product is possible. Everything else is a
detail that tells you what to fix.

---

## 14. Monetisation — Phase 6

Not a revenue plan yet. A hypothesis to test on your first twenty providers,
after Phase 4 has produced data worth selling back.

### 14.1 The line to lead with: provider analytics

The one thing a tradesperson genuinely cannot get anywhere else:

> **Your position** — geyser install, Indiranagar
> You: **₹1,180** typical · Local median: **₹1,000**
> You are **18% above** the local median across 14 jobs.
> Providers within 10% of median get contacted 2.3× more often.

Why this and not the alternatives:

- It does not touch ranking, so it does not sell the transparency customers came
  for.
- It turns the benchmark from a thing done *to* tradespeople into a tool *for*
  them, which partly dissolves the adversarial-supply problem (§1.1).
- It is unbuildable by anyone without your dataset, which is the actual moat.
- It scales with the data rather than with headcount.

Structure it as: **free** — your listing, your median, your report count.
**Paid, ~₹199/month** — position versus local median per job type, trend over
time, demand signal (searches for your job types in your area, views → contacts),
quote-accuracy detail.

**Pilot before pricing.** Give it free to your first twenty providers for two
months, then ask them to pay. Fewer than 3 of 20 converting is the kill
criterion; it means the analytics are interesting but not valuable, and you
should test lead-generation pricing instead.

### 14.2 Fifty providers beats twenty-five thousand users

```
Ads:                     ~25,000 monthly users  →  ₹5,000 / month
Provider analytics:      50 providers × ₹199    →  ₹9,950 / month
```

Fifty providers is a realistic first-year target in one city. Twenty-five
thousand monthly users is not. This is why ads are excluded entirely (§15) — and
AdSense also drags in children's-advertising rules you do not want.

### 14.3 One honest second-order effect

A platform that tells every seller what the market rate is exerts convergence
pressure on prices. At your scale that is irrelevant and arguably good for
customers. At real scale, "we tell all suppliers in a market what to charge"
is close to facilitating price coordination, and is a question for a lawyer
before you get there. Note it now so it is not a surprise later.

---

## 15. Deliberately out of scope

Excluded with the reason, so it is not re-litigated at 11 pm.

| Excluded | Why | Revisit when |
|---|---|---|
| **Ads** | ~25,000 MAU for ₹5,000/month; AdSense pays out only near ₹8,500 and rejects new sites. Drags in children's-advertising rules | Probably never. §14 instead |
| **Featured placement** | Sells the exact thing users came for | Only if §14 fails outright, and then: one slot, labelled, separate |
| **Paid "verified" badge** | Asserting trust creates a duty of care you cannot insure | After incorporation, framed as "ID checked", never "safe" |
| **Per-booking fee** | Needs payment collection and changes your GST position materially | v2, with a CA |
| **Travel tiering** | A month of work; needs supply density to matter | After Phase 5. Rules preserved in §15.1 |
| **Chat / realtime** | Phase 5, conditional. Poll at 5s when you do build it — realtime is a week of channel-leak debugging | Phase 5, only if Phase 4 passes |
| **Full booking state machine** | Booking-lite covers it | If support volume demands scheduling or disputes |
| **Native apps** | $99/year, no Mac, no admin rights, no users | When install friction demonstrably costs you providers |
| **More than one category** | Fragments sample sizes at exactly the wrong moment | When plumbing has n≥100 in three areas |
| **Google sign-in** | One call, no schema change, zero urgency | Any time |

### 15.1 Travel tiering — preserved rules for when you build it

- **Provider opts in.** `travel_beyond_radius` defaults false. Opt-out defaults
  spam providers with jobs they cannot serve and they stop opening the app.
- **Per-km, not flat.** Flat is punitive at 1 km and uneconomic at 15.
- **The customer sees a rupee figure, never a rate.** "+ ₹90 travel".
- **Never blended into the main list.** Separate labelled block, below in-range
  results, ordered by distance within it.
- **Never widen automatically.** One tap to widen, one back. No slider.
- **`st_distance` is geodesic; roads are 20–40% longer.** Apply ~1.3 or label it
  an estimate.
- **`travel_amount` is subtracted before `service_amount`** or a provider who
  travels 8 km reads as more expensive than an identical one next door.

---

## 16. Traps

| Trap | What happens | Do this |
|---|---|---|
| Treating a warm-network Phase 0 pass as loop validation | Four months built on politeness | §2.1. The loop is tested in Phase 2, against strangers |
| Publishing P25–P75 at n=8 | A fragile number with an authoritative face | Widen the interval, not just the label (§7.3) |
| A binary n threshold | Same problem, hidden behind a caveat nobody reads | Confidence tiers |
| Using a mean and calling it "typical" | One ₹5,000 job destroys a ₹300 median at n=6 | `percentile_cont`, recomputed on write |
| Averaging across job types | Measures job mix, not price | `job_type_id` in every key |
| Skipping the Phase 0 spread diagnostic | You build benchmark pages for job types with no asymmetry to solve | §2.3, the 0.2–1.0 band |
| Measuring coverage instead of organic share | Looks healthy while you hand-maintain a spreadsheet | Metric zero (§13.1) |
| Forgetting `reports.source` on the first row | Metric zero becomes unreconstructable | §4 |
| Prompting for the report at completion | The provider is standing there. You built a coercion machine | +6h, permanently anonymous |
| Making anonymity a toggle | At n=3 a provider identifies every reporter by elimination | Anonymous by default; individual reports only at n≥10 |
| Deleting suspect reports instead of weighting them | Punishes legitimate new users, teaches attackers your detection | Weight to 0.1, keep the row, review it |
| A signup wall in front of a benchmark page | Destroys the exact thing Phase 2 measures | Read is anonymous; sign-in comes after the numbers are entered |
| `select('*')` on `users` | Hard permission error, not a trimmed result | Explicit column lists always |
| Reading a stats table directly | Denied — RLS on, zero policies | Use the RPCs. Never add a policy to make a screen easier |
| Publishing a sum | A lifetime billings total is not yours to publish | RPCs return percentiles only |
| Leaving `signInWithOtp` open | Free mail-bomb, enumeration oracle, exhausted tier | Turnstile + per-email and per-IP limits |
| Trusting client geolocation for **providers** | One profile appears citywide | Server-side at claim, 1 change/month, logged |
| Forcing a parts number | Invented splits poison the aggregate permanently | "Not sure" stays selectable |
| Adding a Call button | Defeats the privacy model in one component | Booking thread and a scoped address are the only channels |
| Rendering `name` publicly | Publishes surnames, which cannot be un-published | `public_name` everywhere but admin |
| Adding a `role` check to booking policies | Permanently breaks plumber-hires-electrician | Role picks the home screen, not permissions |
| Deleting `provider_profiles` to mean "stopped" | Destroys price history other customers depend on | Pause with `accepting_work` |
| Excluding paused providers from the **area** benchmark | Visible median drifts to a level nobody honours | Paused providers stay in the area pool, out of per-provider stats |
| Shipping dark-only | Worst legibility case for outdoor daylight on a cheap LCD | Both themes, default to system |
| Deferring i18n | Touches every screen when you retrofit | Scaffold in Phase 1, empty locales are fine |
| Client-rendering the benchmark pages | The SEO asset is invisible to search engines | `web.output: 'static'`, nightly rebuild |
| Uncompressed photo uploads | Blows the bandwidth tier ~25× faster | 1200 px, JPEG q80, client-side |
| No backups on free-tier Supabase | No PITR. The price history is unrecoverable | Weekly `pg_dump` via GitHub Actions |
| Free Supabase project pausing | App is dead when you go to demo it | Know the 7-day inactivity rule |
| Taking provider money as an individual | E-commerce rules require a company | Incorporate before Phase 6 |
| Building Phase 4 before the §11.3 answer | You may have to unbuild it | CA call in Phase 0 |
| Shipping without a grievance officer | You are personally liable for a defamatory report | §11 is a gate |
| Adding a second category early | Fragments sample sizes at exactly the wrong moment | Plumbing at n≥100 in three areas first |

---

## 17. Timeline

**4–6 months at 8–10 hours a week.** Phases gate on results, not on weeks
elapsed — a phase that fails its criterion does not roll forward.

| Phase | Rough effort | Gate |
|---|---|---|
| **0** Classification sprint + CA call | 2 weeks calendar, ~8 hrs | §2.4 |
| **1** Legal gate, auth, schema, privacy layer, benchmark live | 5–6 weeks | Shipping, not results |
| **2** Organic pull — measure, do not build | 4 weeks calendar, ~0 build | §13.1 |
| **3** Providers, claim, search | 3–4 weeks | 8 claimed + verified from 30 contacts |
| **4** Booking-lite, verified reports, quote accuracy, provider stats | 4–5 weeks | Reports ÷ accepted bookings ≥25% |
| **5** Chat, notifications, moderation — **conditional** | 3 weeks | Only if 4 passes |
| **6** Analytics pilot, incorporation | 3 weeks | 3 of 20 convert |

Phase 2 is the one you will want to skip. It is four weeks of watching a number
and fixing nothing, and it is the single highest-value phase in the document,
because it is where you find out whether anything downstream is worth building.
**Do not build during Phase 2.** If you cannot sit still, spend it recruiting
providers by hand for Phase 3 — that is preparation, not building, and it also
tests §1.2's pitch for free.

---

## 18. Definition of done

A person in Bangalore with a leaking tap can:

1. Find, from a search engine, **what a tap leak repair typically costs in their
   locality** — without an account, without a marketplace, without a provider
   existing.
2. Add what they paid, and immediately learn how it compared.
3. Install the app to their home screen and sign in with an email address in
   under a minute.
4. See plumbers near them, each with a typical price **for that job type**, an
   honest confidence level, and a visible sample size — read against the area
   benchmark.
5. Request one, see the price that provider quoted, get accepted, and know where
   things stand.
6. Have the work done, report what they paid, and have that number make the next
   person's decision better.

Steps 1 and 2 exist at the end of Phase 1. Steps 3–6 are the marketplace, and
they are only worth building because Phase 2 proved strangers care.

**If a feature does not serve one of those six steps, it is not in scope.**
