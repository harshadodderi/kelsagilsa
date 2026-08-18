-- 0003 — The price engine.
--
-- Phase 1. §7.
--
-- A running sum cannot produce a median. Every figure is recomputed from its
-- reports on write. At this scale that is tens of rows.
--
-- Two thresholds, and they are different on purpose (§9.2):
--   area benchmark      weight >= 0.30   pooled thousands tolerate noise
--   per-provider stats  weight >= 0.50   an n=6 median does not

-- ---------------------------------------------------------------------------
-- Places. The benchmark must always name the level it is showing (§7.2), so
-- every geohash prefix that gets published needs a human name.
-- ---------------------------------------------------------------------------

create table cities (
  slug text primary key,                 -- 'bengaluru'
  name text not null,                    -- 'Bengaluru'
  centre geography(point, 4326) not null,
  -- Precision-4 geohash of the centre. Cheap city test: does the report's
  -- geohash start with one of these? Stored as an array because a large city
  -- straddles cells.
  geohash4_prefixes text[] not null,
  live boolean not null default false     -- §15: one city at a time
);

create table area_labels (
  geohash text primary key,              -- precision 5 or 6
  precision int not null check (precision in (5, 6)),
  name text not null,                    -- 'Indiranagar', 'Bengaluru South'
  city_slug text not null references cities (slug)
);

create index area_labels_city_idx on area_labels (city_slug, precision);

alter table cities enable row level security;
alter table area_labels enable row level security;

create policy cities_read_all on cities for select to anon, authenticated using (true);
create policy area_labels_read_all on area_labels for select to anon, authenticated using (true);

grant select on cities to anon, authenticated;
grant select on area_labels to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Confidence tiers (§7.3).
--
-- The fix at low n is not only the label. It is the interval. Below n=10 the
-- range shown is min–max, deliberately unhelpful-looking, because the data is.
-- Below n=5 nothing renders at all.
--
-- One rule for area benchmarks and per-provider figures alike. No exceptions,
-- no "but this provider is obviously good".
-- ---------------------------------------------------------------------------

create or replace function confidence_tier(p_n int)
returns text language sql immutable as $$
  select case
    when coalesce(p_n, 0) < 5  then 'none'
    when p_n < 10 then 'early'
    when p_n < 20 then 'typical'
    when p_n < 50 then 'established'
    else 'strong'
  end;
$$;

-- Given the stored percentiles, produce what may actually be displayed.
-- `low`/`high` widen to min–max in the early tier; `mid` is withheld below
-- n=10, because a median from eight points invites a precision nobody has
-- earned.
create or replace function displayable_range(
  p_n int, p_p25 numeric, p_p50 numeric, p_p75 numeric,
  p_min numeric, p_max numeric
)
returns table (tier text, low numeric, high numeric, mid numeric)
language sql immutable as $$
  select t.tier,
         case t.tier when 'none' then null when 'early' then p_min else p_p25 end,
         case t.tier when 'none' then null when 'early' then p_max else p_p75 end,
         case when t.tier in ('none', 'early') then null else p_p50 end
  from (select confidence_tier(p_n) as tier) t;
$$;

-- ---------------------------------------------------------------------------
-- Recompute — area
--
-- Accepts everything (§7.2): booking-less reports, reports about paused
-- providers, reports about tradespeople who are not on the platform at all,
-- and the Phase 0 seed rows.
-- ---------------------------------------------------------------------------

create or replace function recompute_area_job_stats(p_area text, p_job uuid, p_precision int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into area_job_stats as s
    (area_geohash, job_type_id, precision, n, p25, p50, p75, min_amt, max_amt, updated_at)
  select p_area, p_job, p_precision,
         count(*),
         percentile_cont(0.25) within group (order by r.service_amount),
         percentile_cont(0.50) within group (order by r.service_amount),
         percentile_cont(0.75) within group (order by r.service_amount),
         min(r.service_amount),
         max(r.service_amount),
         now()
  from reports r
  where r.job_type_id = p_job
    and case
          when p_precision > 0
            then left(r.area_geohash, p_precision) = p_area
          -- precision 0 = city: pool every cell inside the city's precision-4
          -- footprint, not only the localities that happen to have a label.
          else exists (
            select 1 from cities c
            where c.slug = p_area
              and left(r.area_geohash, 4) = any (c.geohash4_prefixes))
        end
    and not r.hidden
    and not r.flagged
    and r.weight >= 0.30
    and r.occurred_on >= current_date - interval '12 months'
  on conflict (area_geohash, job_type_id) do update
    set precision = excluded.precision,
        n = excluded.n,
        p25 = excluded.p25, p50 = excluded.p50, p75 = excluded.p75,
        min_amt = excluded.min_amt, max_amt = excluded.max_amt,
        updated_at = excluded.updated_at;
end;
$$;

-- Recompute every level a single report touches: its precision-6 cell, its
-- precision-5 cell, and its city.
create or replace function recompute_area_levels_for(p_area_geohash text, p_job uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_city text;
begin
  perform recompute_area_job_stats(left(p_area_geohash, 6), p_job, 6);
  perform recompute_area_job_stats(left(p_area_geohash, 5), p_job, 5);

  select c.slug into v_city
  from cities c
  where left(p_area_geohash, 4) = any (c.geohash4_prefixes)
  limit 1;

  if v_city is not null then
    perform recompute_area_job_stats(v_city, p_job, 0);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Recompute — provider (Phase 4, defined here because it is the same maths)
--
-- Note what the where clause does: unverified, hidden, low-weight and stale
-- rows are excluded, and `n` counts what survived. The number shown and the
-- sample size shown always describe the same set (§7.1).
-- ---------------------------------------------------------------------------

create or replace function recompute_provider_job_stats(p_provider uuid, p_job uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into provider_job_stats as s
    (provider_id, job_type_id, n, p25, p50, p75, min_amt, max_amt,
     total_p50, rated_n, rating_avg, updated_at)
  select p_provider, p_job,
         count(*),
         percentile_cont(0.25) within group (order by r.service_amount),
         percentile_cont(0.50) within group (order by r.service_amount),
         percentile_cont(0.75) within group (order by r.service_amount),
         min(r.service_amount),
         max(r.service_amount),
         percentile_cont(0.50) within group (order by r.amount_paid),
         count(*) filter (where r.rating is not null),
         avg(r.rating) filter (where r.rating is not null),
         now()
  from reports r
  where r.provider_id = p_provider
    and r.job_type_id = p_job
    and r.booking_id is not null            -- verified only (§6.1)
    and not r.hidden
    and not r.flagged
    and r.weight >= 0.50
    and r.occurred_on >= current_date - interval '12 months'
  on conflict (provider_id, job_type_id) do update
    set n = excluded.n,
        p25 = excluded.p25, p50 = excluded.p50, p75 = excluded.p75,
        min_amt = excluded.min_amt, max_amt = excluded.max_amt,
        total_p50 = excluded.total_p50,
        rated_n = excluded.rated_n,
        rating_avg = excluded.rating_avg,
        updated_at = excluded.updated_at;
end;
$$;

-- Recompute on write. `after` so the row is visible to the aggregate.
create or replace function reports_recompute_stats()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  r := coalesce(new, old);
  perform recompute_area_levels_for(r.area_geohash, r.job_type_id);
  if r.provider_id is not null then
    perform recompute_provider_job_stats(r.provider_id, r.job_type_id);
  end if;

  -- An update can move a report between areas or job types; refresh the side
  -- it left as well.
  if tg_op = 'UPDATE' and old is not null then
    if old.area_geohash <> new.area_geohash or old.job_type_id <> new.job_type_id then
      perform recompute_area_levels_for(old.area_geohash, old.job_type_id);
    end if;
    if old.provider_id is not null and old.provider_id is distinct from new.provider_id then
      perform recompute_provider_job_stats(old.provider_id, old.job_type_id);
    end if;
  end if;

  return null;
end;
$$;

create trigger reports_recompute_stats_trg
  after insert or update or delete on reports
  for each row execute function reports_recompute_stats();

-- The recency term in the weighting function (§9.2) decays without any write
-- happening, so the whole table is refreshed nightly as well.
create or replace function recompute_all_stats()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
begin
  for rec in
    select distinct area_geohash, job_type_id from reports where not hidden
  loop
    perform recompute_area_levels_for(rec.area_geohash, rec.job_type_id);
  end loop;

  for rec in
    select distinct provider_id, job_type_id from reports
    where provider_id is not null and booking_id is not null and not hidden
  loop
    perform recompute_provider_job_stats(rec.provider_id, rec.job_type_id);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reading a benchmark. No account needed (§5.2) — a signup wall in front of a
-- price page destroys the exact thing Phase 2 measures.
--
-- Resolve the area hierarchically, first level with enough data wins, and
-- always name the level being shown. Never widen silently (§7.2).
-- ---------------------------------------------------------------------------

create or replace function get_area_benchmark(p_area_geohash text, p_job_slug text)
returns table (
  job_type_slug text,
  job_type_name text,
  area_name text,
  area_level text,          -- 'locality' | 'district' | 'city'
  n int,
  tier text,
  low numeric,
  high numeric,
  mid numeric,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job job_types%rowtype;
  v_city text;
begin
  select * into v_job from job_types where slug = p_job_slug;
  if not found then
    return;
  end if;

  select c.slug into v_city
  from cities c
  where left(p_area_geohash, 4) = any (c.geohash4_prefixes)
  limit 1;

  return query
  with candidates as (
    select 1 as rank, left(p_area_geohash, 6) as key, 'locality'::text as lvl
    union all
    select 2, left(p_area_geohash, 5), 'district'
    union all
    select 3, v_city, 'city'
  ),
  resolved as (
    select c.rank, c.lvl, s.*
    from candidates c
    join area_job_stats s
      on s.area_geohash = c.key and s.job_type_id = v_job.id
    where c.key is not null
      and s.n >= 5                    -- below the first tier nothing renders
    order by c.rank
    limit 1
  )
  select v_job.slug,
         v_job.name,
         coalesce(
           (select l.name from area_labels l where l.geohash = r.area_geohash),
           (select ct.name from cities ct where ct.slug = r.area_geohash),
           r.area_geohash),
         r.lvl,
         r.n,
         d.tier, d.low, d.high, d.mid,
         r.updated_at
  from resolved r
  cross join lateral displayable_range(r.n, r.p25, r.p50, r.p75, r.min_amt, r.max_amt) d;
end;
$$;

grant execute on function get_area_benchmark(text, text) to anon, authenticated;

-- Every published job type for a city, for the pre-rendered index page.
create or replace function get_city_benchmarks(p_city_slug text)
returns table (
  job_type_slug text,
  job_type_name text,
  size_qualifier text,
  typical_hint text,
  n int,
  tier text,
  low numeric,
  high numeric,
  mid numeric
)
language sql
security definer
set search_path = public
as $$
  select j.slug, j.name, j.size_qualifier, j.typical_hint,
         coalesce(s.n, 0), d.tier, d.low, d.high, d.mid
  from job_types j
  left join area_job_stats s
    on s.job_type_id = j.id and s.area_geohash = p_city_slug
  cross join lateral displayable_range(
    coalesce(s.n, 0), s.p25, s.p50, s.p75, s.min_amt, s.max_amt) d
  where j.published
  order by j.sort_order, j.name;
$$;

grant execute on function get_city_benchmarks(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- §7.4 — instant payback.
--
-- "You paid ₹350. Typical near you: ₹280–₹320 from 34 reports."
--
-- Returns the comparison and nothing more. Never editorialise past this: you
-- do not know what the job was.
-- ---------------------------------------------------------------------------

create or replace function compare_to_benchmark(
  p_area_geohash text, p_job_slug text, p_service_amount numeric
)
returns table (
  n int, tier text, low numeric, high numeric, mid numeric,
  area_name text, area_level text,
  verdict text            -- 'below' | 'within' | 'above' | 'unknown'
)
language sql
security definer
set search_path = public
as $$
  select b.n, b.tier, b.low, b.high, b.mid, b.area_name, b.area_level,
         case
           when b.low is null then 'unknown'
           when p_service_amount < b.low then 'below'
           when p_service_amount > b.high then 'above'
           else 'within'
         end
  from get_area_benchmark(p_area_geohash, p_job_slug) b;
$$;

grant execute on function compare_to_benchmark(text, text, numeric) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Coverage, for the weekly metrics review (§13.2 #3).
-- ---------------------------------------------------------------------------

create or replace function get_coverage()
returns table (pairs_total int, pairs_n10 int, pairs_n20 int)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- is_admin() is defined in 0004; this function is only ever called from the
  -- admin review page, which is applied after it.
  if not is_admin() then
    raise exception 'not permitted' using errcode = '42501';
  end if;

  return query
  select count(*)::int,
         count(*) filter (where n >= 10)::int,
         count(*) filter (where n >= 20)::int
  from area_job_stats
  where precision = 6;
end;
$$;

revoke all on function get_coverage() from public, anon;
grant execute on function get_coverage() to authenticated;
