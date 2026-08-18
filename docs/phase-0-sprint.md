# Phase 0 — the classification sprint

No app. A Google Form and a spreadsheet, 30 minutes to set up.

**Scope:** one city (Bengaluru), one category (plumbing), 6–10 job types.
**Target:** 100 observations, 30–50 conversations.
**Budget:** ~8 hours across two weeks.

## The form — six fields

If it takes a respondent more than 90 seconds, cut a field.

| Field | Type |
|---|---|
| What was the job? | Free text — **deliberately unstructured** |
| What did you pay in total? | Number |
| Were parts or materials included? | Yes ₹___ / No, labour only / Not sure |
| Roughly when? | Month picker |
| Which area? | Locality dropdown |
| Anything else about the job? | Optional free text |

Do **not** offer a job-type dropdown. The free-text answer *is* the
classification test.

Keep "Not sure" on the parts question forever. A cornered customer invents a
number, and an invented split is indistinguishable from a real one once it is
in the aggregate.

## Classifying

Export to CSV with these column names (extra columns are ignored):

```
description,amount,parts,month,area,job_type
```

Fill `job_type` in yourself, afterwards, in one sitting. Leave it **blank** for
any observation where you would have needed to ask a follow-up question. That
blank is the measurement — resist going back to ask.

```bash
npm run phase0 -- observations.csv
```

## The three diagnostics

**Classification rate** — pass at ≥70%. Below that the taxonomy is wrong,
usually too fine-grained, occasionally missing an obvious bucket.

**Spread ratio, `(P75 − P25) ÷ P50`** — a Goldilocks band, not "lower is
better":

| Ratio | Meaning | Action |
|---|---|---|
| < 0.2 | everyone charges nearly the same | no asymmetry to solve — drop it |
| 0.2–1.0 | real variation, coherent job | **the target** — publish it |
| > 1.0 | the bucket mixes different jobs | split it, or add a size qualifier |

**Effort per observation** — time yourself honestly, including chasing. Above
15 minutes per usable observation the ask is too heavy; cut fields.

## The kill criterion

Stop and rework if classification is below 70%, or if most job types fall
outside the 0.2–1.0 band. Neither result kills the idea. Both mean the unit of
measurement is wrong, and building on a wrong unit is the single most expensive
mistake available — every number you ever publish inherits it, and historical
data cannot be reclassified by hand at volume.

## What you carry forward

1. The final job-type list, with the ones that failed the spread test removed.
   Edit it into `supabase/migrations/0009_seed_taxonomy.sql` and
   `src/data/launch-set.ts`.
2. ~100 observations, imported as `source = 'seeded'` via
   `npm run seed:import -- observations.csv`, so Phase 1 has a benchmark that is
   not empty on day one.
3. A realistic number for effort per report.
4. **The wording people actually use**, which becomes your job-type labels. If
   everyone says "tap leaking", nobody is searching for "faucet repair".

## And the CA call

Book it during these two weeks, while the answer is still free to act on. Ask
about GST §9(5) — housekeeping services supplied *through* an electronic
commerce operator, where the operator becomes liable for the GST and your whole
supply base is below the registration threshold. If the answer is unfavourable
the mitigation is architectural, and it is a day's work from booking-lite
rather than a month's work from a full state machine.

## What this sprint cannot tell you

Whether a stranger will report unprompted. A pass here is not validation of the
loop. It is entirely possible to pass Phase 0 comfortably and fail Phase 2
completely — expect that, and do not let a warm-network result buy you four
months of building.
