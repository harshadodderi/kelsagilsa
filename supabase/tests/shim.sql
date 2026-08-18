-- Local test shim. NOT part of the schema — see run-local-checks.sh.
--
-- Stands in for the two things a bare Postgres does not have: Supabase's
-- `auth` schema, and PostGIS. The geo stubs are deliberately crude; nothing in
-- the checks depends on real distances, only on the plumbing around them.

create schema if not exists auth;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text
);

-- Overridden per-test with `set local kelsagilsa.test_uid = '...'`.
create or replace function auth.uid()
returns uuid language sql stable as $$
  select nullif(current_setting('kelsagilsa.test_uid', true), '')::uuid;
$$;

create role anon;
create role authenticated;

-- --- PostGIS stubs ---------------------------------------------------------

create or replace function st_makepoint(lng double precision, lat double precision)
returns point language sql immutable as $$ select point(lng, lat); $$;

create or replace function st_setsrid(p point, srid int)
returns point language sql immutable as $$ select p; $$;

/*
 * A real geohash, so the prefix hierarchy in the migrations (precision 6 -> 5
 * -> city) is exercised for real even though the point type is fake.
 */
create or replace function st_geohash(p point, p_precision int)
returns text language plpgsql immutable as $$
declare
  base32 text := '0123456789bcdefghjkmnpqrstuvwxyz';
  lat_min double precision := -90;  lat_max double precision := 90;
  lng_min double precision := -180; lng_max double precision := 180;
  hash text := '';
  bit int := 0; chunk int := 0; even boolean := true;
  mid double precision;
  lng double precision := p[0];
  lat double precision := p[1];
begin
  while length(hash) < p_precision loop
    if even then
      mid := (lng_min + lng_max) / 2;
      if lng >= mid then chunk := chunk * 2 + 1; lng_min := mid;
      else chunk := chunk * 2; lng_max := mid; end if;
    else
      mid := (lat_min + lat_max) / 2;
      if lat >= mid then chunk := chunk * 2 + 1; lat_min := mid;
      else chunk := chunk * 2; lat_max := mid; end if;
    end if;

    even := not even;
    bit := bit + 1;
    if bit = 5 then
      hash := hash || substr(base32, chunk + 1, 1);
      bit := 0; chunk := 0;
    end if;
  end loop;
  return hash;
end;
$$;

create or replace function st_distance(a point, b point)
returns double precision language sql immutable as $$
  select (a <-> b) * 111000;
$$;

create or replace function st_dwithin(a point, b point, metres double precision)
returns boolean language sql immutable as $$
  select st_distance(a, b) <= metres;
$$;
