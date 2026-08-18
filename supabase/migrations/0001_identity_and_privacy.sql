-- 0001 — Identity and the privacy layer.
--
-- Phase 1. Implements §3.1 (a phone number is disclosed by an act, never a
-- default), §3.2 (first names only) and §5.3 (roles pick a home screen, not
-- permissions).
--
-- The column grants in this file are the one assertion that must never
-- regress. See supabase/tests/privacy.test.sql and tests/privacy.contract.md.

create extension if not exists "postgis";
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------

create table users (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (btrim(name) <> ''),

  -- Generated, so it cannot drift out of sync with `name` and cannot be
  -- selected around. Surnames are never published (§3.2).
  public_name text generated always as (split_part(btrim(name), ' ', 1)) stored,

  phone text,                        -- optional, private, never granted
  role text not null default 'customer'
    check (role in ('customer', 'provider', 'admin')),

  location geography(point, 4326),   -- private
  area_geohash text,                 -- ST_GeoHash(location, 6)

  share_name_with_provider boolean not null default false,
  suspended boolean not null default false,

  -- 18+ gate only. The year, never a full date: an age plus a dated birthday
  -- is a date of birth (§10.7).
  birth_year int check (birth_year between 1900 and extract(year from now())::int),

  created_at timestamptz not null default now()
);

create index users_area_geohash_idx on users (area_geohash);

-- Keep area_geohash derived from location rather than client-supplied.
create or replace function users_sync_area_geohash()
returns trigger language plpgsql as $$
begin
  new.area_geohash := case
    when new.location is null then null
    else st_geohash(new.location::geometry, 6)
  end;
  return new;
end;
$$;

create trigger users_sync_area_geohash_trg
  before insert or update of location on users
  for each row execute function users_sync_area_geohash();

-- ---------------------------------------------------------------------------
-- Row-level security decides which ROWS are visible.
-- ---------------------------------------------------------------------------

alter table users enable row level security;

create policy users_select_self on users
  for select to authenticated
  using (id = auth.uid());

create policy users_insert_self on users
  for insert to authenticated
  with check (id = auth.uid());

create policy users_update_self on users
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- Column grants decide which COLUMNS are visible. You need both (§3.1).
--
-- `phone`, `name` and `location` become unreadable through the table by
-- anyone, including the row's owner — which is why reading your own profile
-- goes through get_my_profile() below.
-- ---------------------------------------------------------------------------

revoke all on table users from anon, authenticated;

grant select (id, public_name, role, share_name_with_provider, created_at)
  on users to authenticated;

-- Self-service writes are still needed for the profile screen. Grant them
-- per column too, so no future `update ... set role = 'admin'` is possible
-- from the client.
grant insert (id, name, phone, share_name_with_provider, birth_year)
  on users to authenticated;
grant update (name, phone, share_name_with_provider)
  on users to authenticated;

-- `role` is never settable from the client (§5.3). `suspended` never is
-- either. Neither appears in the insert or update grant above; both are set
-- by security-definer functions only.

-- ---------------------------------------------------------------------------
-- Reading your own profile
-- ---------------------------------------------------------------------------

create or replace function get_my_profile()
returns table (
  id uuid,
  name text,
  public_name text,
  phone text,
  role text,
  share_name_with_provider boolean,
  suspended boolean,
  area_geohash text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select u.id, u.name, u.public_name, u.phone, u.role,
         u.share_name_with_provider, u.suspended, u.area_geohash, u.created_at
  from users u
  where u.id = auth.uid();
$$;

revoke all on function get_my_profile() from public, anon;
grant execute on function get_my_profile() to authenticated;

-- Setting your own location. Customers may move freely; provider location is
-- pinned server-side at claim and rate-limited (§9.1, migration 0006).
create or replace function set_my_location(p_lat double precision, p_lng double precision)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_lat is null or p_lng is null then
    raise exception 'location required' using errcode = '22023';
  end if;
  if p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
    raise exception 'coordinates out of range' using errcode = '22023';
  end if;

  update users
     set location = st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
   where id = auth.uid();
end;
$$;

revoke all on function set_my_location(double precision, double precision) from public, anon;
grant execute on function set_my_location(double precision, double precision) to authenticated;

-- ---------------------------------------------------------------------------
-- Signup: create the profile row for the authenticated caller.
--
-- 18+ only, self-declared birth year (§10.7).
-- ---------------------------------------------------------------------------

create or replace function create_my_profile(p_name text, p_birth_year int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  if extract(year from now())::int - p_birth_year < 18 then
    raise exception 'Kelsagilsa is for adults over 18.' using errcode = '22023';
  end if;

  insert into users (id, name, birth_year)
  values (auth.uid(), p_name, p_birth_year)
  on conflict (id) do nothing;
end;
$$;

revoke all on function create_my_profile(text, int) from public, anon;
grant execute on function create_my_profile(text, int) to authenticated;

-- ---------------------------------------------------------------------------
-- OTP send log — 90 day retention (§5.1, §10.4).
-- ---------------------------------------------------------------------------

create table otp_send_log (
  id bigserial primary key,
  email_hash text not null,          -- sha256(lower(email)). Never the address
  ip inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index otp_send_log_email_hash_idx on otp_send_log (email_hash, created_at desc);
create index otp_send_log_ip_idx on otp_send_log (ip, created_at desc);

alter table otp_send_log enable row level security;
-- RLS on, zero policies: the edge function writes with the service role.
