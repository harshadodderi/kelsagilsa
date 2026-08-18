-- 0005 — Throttles, attribution, and the booking-less report path.
--
-- Phase 1. §6.4, §7.6, §13.1.
--
-- Throttles raise Postgres exceptions with real messages. A throttle must
-- never surface as "something went wrong" — the client catches these by
-- errcode and renders the message verbatim.

-- ---------------------------------------------------------------------------
-- Attribution (§13.1). Metric zero is organic report share, and it cannot be
-- reconstructed later.
--
-- Any link you personally send carries a token from this table, and every
-- report arriving through one is `solicited`. Be strict with yourself: if you
-- posted the link in a WhatsApp group you are a member of, that is solicited.
-- ---------------------------------------------------------------------------

create table solicit_links (
  token text primary key,
  note text,                            -- 'apartment group', 'plumber Ravi'
  source text not null default 'solicited'
    check (source in ('solicited', 'recruited_provider')),
  created_at timestamptz not null default now()
);

alter table solicit_links enable row level security;
revoke all on table solicit_links from anon, authenticated;

create or replace function resolve_source(p_token text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select l.source from solicit_links l where l.token = p_token),
    'organic');
$$;

grant execute on function resolve_source(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Throttles (§6.4)
-- ---------------------------------------------------------------------------

create or replace function reports_enforce_throttles()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_total int;
  v_bookingless int;
begin
  if new.reporter_id is null then
    return new;                          -- seeded rows, written by service role
  end if;

  select count(*),
         count(*) filter (where booking_id is null)
    into v_total, v_bookingless
  from reports
  where reporter_id = new.reporter_id
    and created_at > now() - interval '24 hours';

  if v_total >= 5 then
    raise exception 'You have added 5 reports today. Please come back tomorrow.'
      using errcode = 'KG001';
  end if;

  if new.booking_id is null and v_bookingless >= 2 then
    raise exception 'You can add 2 reports a day without a booking. Please come back tomorrow.'
      using errcode = 'KG002';
  end if;

  return new;
end;
$$;

create trigger reports_enforce_throttles_trg
  before insert on reports
  for each row execute function reports_enforce_throttles();

-- Edits only within 2 hours, marked "edited" afterwards (§11.4).
create or replace function reports_enforce_edit_window()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.reporter_id is not null
     and auth.uid() = new.reporter_id
     and old.edited_until is not null
     and now() > old.edited_until then
    raise exception 'Reports can be edited for 2 hours after they are added.'
      using errcode = 'KG003';
  end if;
  return new;
end;
$$;

create trigger reports_enforce_edit_window_trg
  before update of amount_paid, parts_amount, travel_amount, occurred_on,
                   job_type_id, comment, rating on reports
  for each row execute function reports_enforce_edit_window();

-- ---------------------------------------------------------------------------
-- The booking-less report (§7.6).
--
-- The bootstrap path, and what makes Phase 1 possible. Note what is NOT a
-- parameter: who did the work. It cannot feed provider stats (§6.1) and asking
-- for it implies otherwise.
-- ---------------------------------------------------------------------------

create or replace function submit_booking_less_report(
  p_job_slug text,
  p_amount_paid numeric,
  p_parts_amount numeric,       -- null means "Not sure". Never forced (§3.3)
  p_occurred_on date,
  p_area_geohash text,
  p_comment text default null,
  p_rating int default null,
  p_name_in_public_feed boolean default false,
  p_solicit_token text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_id uuid;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  select id into v_job_id from job_types where slug = p_job_slug and published;
  if v_job_id is null then
    raise exception 'Unknown job type.' using errcode = '22023';
  end if;

  if p_occurred_on < current_date - interval '12 months' then
    raise exception 'Reports older than 12 months are not accepted.'
      using errcode = 'KG004';
  end if;

  insert into reports (
    reporter_id, job_type_id, area_geohash,
    amount_paid, parts_amount, occurred_on,
    comment, rating, name_in_public_feed, source)
  values (
    auth.uid(), v_job_id, left(p_area_geohash, 6),
    p_amount_paid, p_parts_amount, p_occurred_on,
    p_comment, p_rating, p_name_in_public_feed, resolve_source(p_solicit_token))
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function submit_booking_less_report(
  text, numeric, numeric, date, text, text, int, boolean, text) from public, anon;
grant execute on function submit_booking_less_report(
  text, numeric, numeric, date, text, text, int, boolean, text) to authenticated;

-- ---------------------------------------------------------------------------
-- The public report feed.
--
-- First names only, and only where the reporter opted in. Individual reports
-- render only at n>=10 (§9.1, de-anonymisation by elimination) — below that,
-- aggregate only.
-- ---------------------------------------------------------------------------

create or replace function get_public_reports(p_area_geohash text, p_job_slug text)
returns table (
  reporter_public_name text,
  job_type_name text,
  amount_paid numeric,
  parts_known boolean,
  rating int,
  comment text,
  occurred_on date,
  verified boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job uuid;
  v_n int;
begin
  select id into v_job from job_types where slug = p_job_slug;
  if v_job is null then return; end if;

  select n into v_n from area_job_stats
  where area_geohash = left(p_area_geohash, 6) and job_type_id = v_job;

  if coalesce(v_n, 0) < 10 then
    return;                       -- aggregate only. No exceptions
  end if;

  return query
  select case when r.name_in_public_feed then u.public_name else null end,
         j.name,
         r.amount_paid,
         r.parts_amount is not null,
         r.rating,
         r.comment,
         r.occurred_on,
         r.booking_id is not null            -- §11.4: verified reports labelled
  from reports r
  join job_types j on j.id = r.job_type_id
  left join users u on u.id = r.reporter_id
  where r.job_type_id = v_job
    and left(r.area_geohash, 6) = left(p_area_geohash, 6)
    and not r.hidden and not r.flagged
    and r.weight >= 0.30
    and r.occurred_on >= current_date - interval '12 months'
  order by r.occurred_on desc
  limit 50;
end;
$$;

grant execute on function get_public_reports(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Metric zero (§13.1), weekly.
-- ---------------------------------------------------------------------------

create or replace function get_organic_share(p_days int default 7)
returns table (window_days int, total int, organic int, organic_share numeric)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Admin only. This is a business metric, not a public statistic, and it is
  -- the one number that decides whether the product is possible (§13.1).
  if not is_admin() then
    raise exception 'not permitted' using errcode = '42501';
  end if;

  return query
  select p_days,
         count(*)::int,
         count(*) filter (where source = 'organic')::int,
         case when count(*) = 0 then null
              else round(count(*) filter (where source = 'organic')::numeric
                         / count(*), 3) end
  from reports
  where created_at > now() - make_interval(days => p_days)
    -- Seeded rows are excluded from both sides: hand-collected observations
    -- must not be able to flatter or depress the share.
    and source <> 'seeded';
end;
$$;

revoke all on function get_organic_share(int) from public, anon;
grant execute on function get_organic_share(int) to authenticated;
