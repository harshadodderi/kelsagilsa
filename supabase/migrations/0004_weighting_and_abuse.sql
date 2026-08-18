-- 0004 — Weighting, outlier flagging, and the signals they need.
--
-- Phase 1. §9.
--
-- The goal is not impossibility. It is making attacks cost more than they
-- return, and degrading rather than blocking — blocking punishes legitimate
-- new users at the moment of highest drop-off.
--
-- A suspect report is never deleted. It is weighted down, kept, and reviewed
-- (§9.3): deleting teaches the attacker your detection and loses the row.

-- ---------------------------------------------------------------------------
-- Device/IP overlap signal.
--
-- Written by the client session bootstrap through a security-definer RPC, so
-- the raw address is never stored and never readable. Cheap now, and
-- unreconstructable later — which is the §4 test.
-- ---------------------------------------------------------------------------

create table client_fingerprints (
  user_id uuid not null references users (id) on delete cascade,
  ip_hash text not null,               -- sha256(ip || pepper)
  ua_hash text not null,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  primary key (user_id, ip_hash, ua_hash)
);

create index client_fingerprints_ip_idx on client_fingerprints (ip_hash);

alter table client_fingerprints enable row level security;
revoke all on table client_fingerprints from anon, authenticated;

create or replace function record_my_fingerprint(p_ip_hash text, p_ua_hash text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;
  insert into client_fingerprints (user_id, ip_hash, ua_hash)
  values (auth.uid(), p_ip_hash, p_ua_hash)
  on conflict (user_id, ip_hash, ua_hash) do update set last_seen = now();
end;
$$;

revoke all on function record_my_fingerprint(text, text) from public, anon;
grant execute on function record_my_fingerprint(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- The weighting function (§9.2).
--
-- Deliberately simple: you must be able to explain it to a provider who asks
-- why their listing changed. It is extended in 0007 with the booking-backed
-- terms once bookings exist — the phase-1 version below already collapses the
-- attacks reachable in phase 1.
--
-- Never tell a user their weight or why. This is the one place where
-- transparency helps the attacker more than the user.
-- ---------------------------------------------------------------------------

create or replace function compute_report_weight(p_report reports)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  w numeric := 1.00;
  v_account_age interval;
begin
  -- Verified vs booking-less. 0.40 is chosen so that a booking-less report
  -- cannot reach the 0.50 per-provider threshold by any combination of the
  -- other terms — by arithmetic, not by a policy someone might loosen later.
  if p_report.booking_id is null then
    w := w * 0.40;
  end if;

  -- Account age.
  --
  -- This term, and the prior-booking term added in 0007, apply ONLY to reports
  -- that name a provider. That is a deliberate reading of §9.2, and it is
  -- load-bearing enough to write down:
  --
  --   Applied unconditionally, a booking-less report from a new account scores
  --   0.40 x 0.50 x 0.25 = 0.05, below the 0.30 area threshold. Since Phase 1
  --   has nothing BUT booking-less reports from new accounts, the area
  --   benchmark would be permanently empty and Phase 2 would measure nothing.
  --   Meanwhile §9.2 sets the booking-less multiplier at 0.40 and the area
  --   threshold at 0.30 precisely so that such a report does count.
  --
  -- Both terms exist to make reports about a PROVIDER expensive to forge:
  -- the self-review loop, competitor bombing, price laundering. An area-only
  -- report has no target, and benchmark poisoning is answered by the 2-per-day
  -- cap, the 0.40 multiplier, outlier flagging, and the aggregate's own n.
  --
  -- If Phase 2 shows area benchmarks being pushed around, tighten the cap
  -- before re-stacking these multipliers: a threshold that excludes every
  -- honest first-time reporter buys nothing.
  if p_report.provider_id is not null then
    select now() - u.created_at into v_account_age
    from users u where u.id = p_report.reporter_id;

    if v_account_age is null or v_account_age < interval '7 days' then
      w := w * 0.50;
    end if;
  end if;

  -- Device/IP overlap with the provider being reported on. Near-zero rather
  -- than zero, so the row still shows up in the Monday review as a signal.
  if p_report.provider_id is not null and p_report.reporter_id is not null
     and exists (
       select 1
       from client_fingerprints a
       join client_fingerprints b on b.ip_hash = a.ip_hash
       where a.user_id = p_report.reporter_id
         and b.user_id = p_report.provider_id)
  then
    w := w * 0.10;
  end if;

  -- Recency. Beyond twelve months a report stops counting entirely; the
  -- recompute window and this term agree, deliberately.
  w := w * case
    when p_report.occurred_on >= current_date - interval '6 months'  then 1.00
    when p_report.occurred_on >= current_date - interval '12 months' then 0.60
    else 0.00
  end;

  return greatest(0, least(1, round(w, 2)));
end;
$$;

-- ---------------------------------------------------------------------------
-- Outlier flagging (§9.3).
--
-- Once a job type has n>=5 for that provider or area, flag a new report whose
-- service_amount is above 4x or below a quarter of the current median.
-- Compare service to service, never total to total.
--
-- Flagged means: excluded from stats, queued for review, NOT deleted, and the
-- reporter is told nothing.
-- ---------------------------------------------------------------------------

create or replace function is_outlier(p_report reports)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_n int;
  v_median numeric;
  v_service numeric;
begin
  -- service_amount is a generated column, and generated columns are computed
  -- AFTER before-row triggers run — so `new.service_amount` is null here.
  -- Recompute it rather than comparing against a null, which would make every
  -- outlier check silently return null and every new report land unflagged.
  v_service := p_report.amount_paid
             - coalesce(p_report.parts_amount, 0)
             - coalesce(p_report.travel_amount, 0);
  if p_report.provider_id is not null then
    select n, p50 into v_n, v_median
    from provider_job_stats
    where provider_id = p_report.provider_id and job_type_id = p_report.job_type_id;
  end if;

  if coalesce(v_n, 0) < 5 then
    select n, p50 into v_n, v_median
    from area_job_stats
    where area_geohash = left(p_report.area_geohash, 6)
      and job_type_id = p_report.job_type_id;
  end if;

  if coalesce(v_n, 0) < 5 or coalesce(v_median, 0) <= 0 then
    return false;
  end if;

  return v_service > 4 * v_median
      or v_service < v_median / 4;
end;
$$;

-- ---------------------------------------------------------------------------
-- Applied before the row lands, so the recompute trigger in 0003 (which runs
-- after) already sees the final weight and flag.
-- ---------------------------------------------------------------------------

create or replace function reports_apply_weight_and_flags()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.weight := compute_report_weight(new);
  if tg_op = 'INSERT' then
    new.flagged := coalesce(is_outlier(new), false);
    new.edited_until := now() + interval '2 hours';   -- §6.4 edit window
  end if;
  return new;
end;
$$;

create trigger reports_apply_weight_and_flags_trg
  before insert or update of amount_paid, parts_amount, travel_amount,
                             occurred_on, booking_id, provider_id on reports
  for each row execute function reports_apply_weight_and_flags();

-- Nightly, because the recency term decays without any write happening.
create or replace function recompute_all_weights()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r reports;
begin
  for r in select * from reports where not hidden loop
    update reports set weight = compute_report_weight(r) where id = r.id;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Moderation log — evidenceable compliance (§11.1), 3 year retention (§10.4).
-- ---------------------------------------------------------------------------

create table moderation_actions (
  id bigserial primary key,
  actor_id uuid references users (id),
  action text not null,                 -- 'hide_report', 'reinstate_report', ...
  subject_table text not null,
  subject_id uuid not null,
  reason text,
  created_at timestamptz not null default now()
);

alter table moderation_actions enable row level security;
revoke all on table moderation_actions from anon, authenticated;

create or replace function is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from users where id = auth.uid() and role = 'admin');
$$;

-- A flagged report that survives review is reinstated at full weight (§9.3).
create or replace function moderate_report(p_report_id uuid, p_action text, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'not permitted' using errcode = '42501';
  end if;

  if p_action = 'reinstate' then
    update reports set flagged = false, hidden = false where id = p_report_id;
  elsif p_action = 'hide' then
    update reports set hidden = true where id = p_report_id;
  else
    raise exception 'unknown moderation action %', p_action using errcode = '22023';
  end if;

  insert into moderation_actions (actor_id, action, subject_table, subject_id, reason)
  values (auth.uid(), p_action, 'reports', p_report_id, p_reason);
end;
$$;

revoke all on function moderate_report(uuid, text, text) from public, anon;
grant execute on function moderate_report(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- The Monday review (§9.4) — one admin page, ten minutes.
-- ---------------------------------------------------------------------------

create or replace function admin_monday_review()
returns table (bucket text, subject_id uuid, detail text, at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'not permitted' using errcode = '42501';
  end if;

  return query
    select 'low_weight', r.id,
           format('weight %s, %s', r.weight, j.name), r.created_at
    from reports r join job_types j on j.id = r.job_type_id
    where r.weight < 0.5 and r.created_at > now() - interval '7 days'

  union all
    select 'flagged_outlier', r.id, j.name, r.created_at
    from reports r join job_types j on j.id = r.job_type_id
    where r.flagged and not r.hidden

  -- Accounts created in the last 7 days with exactly one booking, with one
  -- provider. This catches the self-review loop better than any heuristic you
  -- will write. Populated once bookings exist; harmless before then.
  union all
    select 'single_booking_new_account', u.id,
           'new account, one booking, one provider', u.created_at
    from users u
    where u.created_at > now() - interval '7 days'
      and (select count(*) from reports r where r.reporter_id = u.id) = 1
      and (select count(distinct r.provider_id) from reports r
           where r.reporter_id = u.id and r.provider_id is not null) = 1

  order by 4 desc;
end;
$$;

revoke all on function admin_monday_review() from public, anon;
grant execute on function admin_monday_review() to authenticated;
