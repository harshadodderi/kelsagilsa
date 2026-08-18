-- 0006 — Supply. PHASE 3: do not apply until Phase 2 has passed its gate
-- (§13.1: organic share >= 15% and >= 20 organic reports/week).
--
-- §5.4, §5.5, §6.2.

create table provider_profiles (
  user_id uuid primary key references users (id) on delete cascade,
  bio text check (bio is null or length(bio) <= 500),
  service_area_radius_km numeric(6,2) check (service_area_radius_km between 0 and 30),

  claimed boolean not null default false,
  claim_token text unique,

  -- Availability. Independent of users.role, which only picks a home screen.
  accepting_work boolean not null default true,

  -- Identity has to cost something — at claim, not signup (§5.4).
  identity_method text check (identity_method in ('upi', 'manual')),
  identity_verified_at timestamptz,
  identity_ref_hash text,               -- sha256(vpa). Never the VPA itself

  location geography(point, 4326),      -- set server-side at claim (§9.1)
  location_changed_at timestamptz,

  created_at timestamptz not null default now()
);

create index provider_profiles_location_idx on provider_profiles using gist (location);

-- A suspended identity cannot re-verify: ban evasion costs a new bank-verified
-- name rather than ninety seconds (§9.1).
create unique index provider_profiles_identity_ref_idx
  on provider_profiles (identity_ref_hash)
  where identity_ref_hash is not null;

create table provider_categories (
  provider_id uuid not null references provider_profiles (user_id) on delete cascade,
  category_id uuid not null references categories (id),
  primary key (provider_id, category_id)
);

-- Max 3 categories (§6.4, §9.1 category spam).
create or replace function provider_categories_limit()
returns trigger language plpgsql as $$
begin
  if (select count(*) from provider_categories
       where provider_id = new.provider_id) >= 3 then
    raise exception 'You can list up to 3 categories.' using errcode = 'KG005';
  end if;
  return new;
end;
$$;

create trigger provider_categories_limit_trg
  before insert on provider_categories
  for each row execute function provider_categories_limit();

-- Never delete a provider_profiles row to mean "stopped providing" — it erases
-- price history other customers depend on (§5.5). Pause instead, and record
-- why, once, skippably, after the switch has already flipped.
create table provider_status_changes (
  id bigserial primary key,
  provider_id uuid not null references provider_profiles (user_id) on delete cascade,
  accepting_work boolean not null,
  reason text check (reason is null or reason in (
    'too_busy', 'not_enough_requests', 'taking_a_break',
    'prices_not_working', 'something_went_wrong', 'other')),
  created_at timestamptz not null default now()
);

alter table provider_profiles enable row level security;
alter table provider_categories enable row level security;
alter table provider_status_changes enable row level security;

revoke all on table provider_profiles from anon, authenticated;
revoke all on table provider_categories from anon, authenticated;
revoke all on table provider_status_changes from anon, authenticated;

grant select (user_id, bio, service_area_radius_km, accepting_work, claimed, created_at)
  on provider_profiles to anon, authenticated;
grant update (bio, service_area_radius_km, accepting_work) on provider_profiles to authenticated;

create policy provider_profiles_read_claimed on provider_profiles
  for select to anon, authenticated
  using (claimed and identity_verified_at is not null);

create policy provider_profiles_update_own on provider_profiles
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy provider_categories_read on provider_categories
  for select to anon, authenticated using (true);
grant select on provider_categories to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Pausing (§5.5)
-- ---------------------------------------------------------------------------

create or replace function set_accepting_work(p_accepting boolean, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update provider_profiles
     set accepting_work = p_accepting
   where user_id = auth.uid();

  if not found then
    raise exception 'no provider profile' using errcode = '42501';
  end if;

  insert into provider_status_changes (provider_id, accepting_work, reason)
  values (auth.uid(), p_accepting, case when p_accepting then null else p_reason end);
end;
$$;

revoke all on function set_accepting_work(boolean, text) from public, anon;
grant execute on function set_accepting_work(boolean, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Provider location: server-side at claim, 1 change per month, logged (§9.1).
-- ---------------------------------------------------------------------------

create table provider_location_changes (
  id bigserial primary key,
  provider_id uuid not null references provider_profiles (user_id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table provider_location_changes enable row level security;
revoke all on table provider_location_changes from anon, authenticated;

create or replace function set_provider_location(p_lat double precision, p_lng double precision)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from provider_location_changes
              where provider_id = auth.uid()
                and created_at > now() - interval '30 days') then
    raise exception 'Your service location can be changed once a month.'
      using errcode = 'KG006';
  end if;

  update provider_profiles
     set location = st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
         location_changed_at = now()
   where user_id = auth.uid();

  insert into provider_location_changes (provider_id) values (auth.uid());
end;
$$;

revoke all on function set_provider_location(double precision, double precision) from public, anon;
grant execute on function set_provider_location(double precision, double precision) to authenticated;

-- ---------------------------------------------------------------------------
-- Claim. Identity cost goes here, not at signup (§5.4).
--
-- Open question for Phase 3: if claim-through is under 50%, drop to
-- manual-only and carry the cost (§13.2 #6).
-- ---------------------------------------------------------------------------

create or replace function claim_provider_profile(
  p_claim_token text, p_identity_method text, p_identity_ref_hash text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
begin
  select user_id into v_user from provider_profiles
  where claim_token = p_claim_token and not claimed;

  if v_user is null then
    raise exception 'This claim link is not valid.' using errcode = '22023';
  end if;

  if exists (select 1 from provider_profiles p
             join users u on u.id = p.user_id
             where p.identity_ref_hash = p_identity_ref_hash and u.suspended) then
    raise exception 'This identity cannot be verified.' using errcode = '42501';
  end if;

  update provider_profiles
     set claimed = true,
         claim_token = null,
         identity_method = p_identity_method,
         identity_ref_hash = p_identity_ref_hash,
         identity_verified_at = now()
   where user_id = v_user;

  update users set role = 'provider' where id = v_user;
end;
$$;

revoke all on function claim_provider_profile(text, text, text) from public, anon;
grant execute on function claim_provider_profile(text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Search.
--
-- An unverified provider profile may exist but never appears in search (§5.4).
-- Paused providers do not appear either (§5.5) — but their history stays in
-- the area benchmark (§1.2), which is a different query.
--
-- Coordinates are rounded to ~500 m before they leave the database (§9.1).
-- Ranking parameters are one plain sentence in the UI (§11.5).
-- ---------------------------------------------------------------------------

create or replace function search_providers(
  p_lat double precision, p_lng double precision,
  p_job_slug text, p_radius_km numeric default 5
)
returns table (
  provider_id uuid,
  public_name text,
  bio text,
  distance_km numeric,
  n int, tier text, low numeric, high numeric, mid numeric,
  quote_n int, quote_hits int,
  rating_avg numeric, rated_n int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job uuid;
  v_point geography;
  v_radius numeric := least(coalesce(p_radius_km, 5), 15);   -- capped server-side
begin
  select id into v_job from job_types where slug = p_job_slug;
  if v_job is null then return; end if;

  v_point := st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography;

  return query
  select p.user_id,
         u.public_name,
         p.bio,
         round((st_distance(p.location, v_point) / 1000)::numeric, 1),
         s.n, d.tier, d.low, d.high, d.mid,
         s.quote_n, s.quote_hits, s.rating_avg, s.rated_n
  from provider_profiles p
  join users u on u.id = p.user_id
  join provider_job_stats s on s.provider_id = p.user_id and s.job_type_id = v_job
  cross join lateral displayable_range(s.n, s.p25, s.p50, s.p75, s.min_amt, s.max_amt) d
  where p.claimed
    and p.identity_verified_at is not null
    and p.accepting_work
    and not u.suspended
    and p.location is not null
    and st_dwithin(p.location, v_point, v_radius * 1000)
    -- A provider ranks in a job type only with >=1 verified report in it
    -- (§9.1, category spam).
    and s.n >= 1
  order by st_distance(p.location, v_point)
  limit 50;
end;
$$;

grant execute on function search_providers(double precision, double precision, text, numeric)
  to anon, authenticated;
