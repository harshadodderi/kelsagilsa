# The weekly review — ten minutes, one page

Two metrics decide whether the product is possible. Everything else is a detail
that tells you what to fix.

## Metric zero — organic report share

> reports you did not personally solicit ÷ all reports

```sql
select * from get_organic_share(7);
```

A coverage metric ("% of job types with ≥20 reports") can be satisfied entirely
by hand-collecting, and will look healthy while the product acquires nothing on
its own. This one cannot.

Every report is tagged at write time, because it cannot be reconstructed later:

| `reports.source` | Meaning |
|---|---|
| `seeded` | you entered it from the Phase 0 sprint |
| `solicited` | you asked this person, or it came from a link you personally sent |
| `recruited_provider` | came via a provider you personally onboarded |
| `organic` | everything else — arrived without you asking |

Links you send personally carry a token from the `solicit_links` table, which
is what makes the tagging automatic rather than a thing you remember. Be strict
with yourself: **a link you posted in a WhatsApp group you are a member of is
`solicited`.**

**Phase 2 kill criterion.** After four weeks of the benchmark being live and
shared: organic share below 15% **and** fewer than 20 organic reports a week
means the loop does not self-sustain. That is not necessarily the end, but it
means you are running a content business that needs a distribution strategy,
not a data-network business that compounds — and the plan from Phase 3 onward
is wrong.

## Metric two — report rate

> reports ÷ accepted bookings

```sql
select * from get_report_rate();
```

Below 25% after 30 accepted bookings, the booking→report loop is broken. This
only becomes measurable in Phase 4.

## The rest

| # | Metric | Watch for |
|---|---|---|
| 3 | Benchmark coverage — (area, job type) pairs at n≥10 and n≥20 (`get_coverage()`) | track both; n≥20 is what makes a page worth linking |
| 4 | Report form abandonment — entered numbers ÷ submitted | above 40% at the OTP step, reconsider requiring an account at all |
| 5 | Provider response time — median hours, request to accept/decline | above 12 hours means notifications are failing and customers churn silently |
| 6 | Claim-through — claimed ÷ stubs created | under 50% means the ₹1 UPI verification is the problem. Drop to manual |
| 7 | Quote population — providers with ≥5 quoted-and-reported jobs | if providers skip quoting, the badge is not motivating them |

## The Monday review

```sql
select * from admin_monday_review();
```

Six buckets, all in one query:

- reports with weight < 0.5 in the last 7 days
- flagged outliers awaiting review
- any median that moved more than 25% in a week
- providers who never confirm a job done despite repeat bookings
- new provider claims awaiting verification
- **accounts created in the last 7 days with exactly one booking, with one
  provider** — this one catches the self-review loop better than any heuristic
  you will write

A flagged report that survives review is reinstated at full weight. Nothing in
this queue is ever deleted: weighting it down keeps the row, keeps the
evidence, and does not teach the attacker what you detect.
