-- 0009 — Draft taxonomy and places.
--
-- This is the DRAFT list that Phase 0 tests, not the launch set. §2.5 says the
-- launch set is whatever survives the sprint: job types below the 0.2 spread
-- ratio are unpublished (no asymmetry to solve), job types above 1.0 are split
-- or given a size qualifier, and every `name` is replaced with the words
-- people actually used.
--
-- Run scripts/phase0-diagnostics.ts against the sprint export, then edit this
-- file before Phase 1 ships. Do not launch the draft.

insert into categories (slug, name, sort_order, icon_key) values
  ('plumbing', 'Plumbing', 1, 'pipe');
-- One category only, deliberately. A second one fragments sample sizes at
-- exactly the wrong moment (§15). Revisit when plumbing has n>=100 in three
-- areas.

insert into job_types (category_id, slug, name, size_qualifier, typical_hint, sort_order)
select c.id, v.slug, v.name, v.size_qualifier, v.hint, v.sort_order
from categories c,
  (values
    ('tap-leak',        'Leaking tap',              null,       'Usually a washer or cartridge change', 1),
    ('pipe-leak',       'Leaking pipe',             null,       null, 2),
    ('drain-block',     'Blocked drain',            null,       null, 3),
    ('flush-repair',    'Flush tank not working',   null,       null, 4),
    ('geyser-install',  'Geyser installation',      'up to 25L', 'Ask whether the wall bracket is included', 5),
    ('motor-repair',    'Water motor or pump repair', null,     null, 6),
    ('tap-fitting',     'New tap fitting',          null,       null, 7),
    ('toilet-install',  'Toilet installation',      null,       null, 8)
  ) as v(slug, name, size_qualifier, hint, sort_order)
where c.slug = 'plumbing';

-- ---------------------------------------------------------------------------
-- Bengaluru. One city (§2).
--
-- The geohash prefixes are computed from the centroid rather than typed, so a
-- transposed digit cannot quietly send every city-level lookup to an empty
-- cell.
-- ---------------------------------------------------------------------------

insert into cities (slug, name, centre, geohash4_prefixes, live)
select 'bengaluru', 'Bengaluru', centre,
       array(select distinct st_geohash(p::geometry, 4) from unnest(array[
         st_setsrid(st_makepoint(77.5946, 12.9716), 4326)::geography,  -- centre
         st_setsrid(st_makepoint(77.4900, 12.9200), 4326)::geography,  -- west
         st_setsrid(st_makepoint(77.7500, 12.9600), 4326)::geography,  -- east
         st_setsrid(st_makepoint(77.6000, 13.1000), 4326)::geography,  -- north
         st_setsrid(st_makepoint(77.6100, 12.8300), 4326)::geography   -- south
       ]) p),
       true
from (select st_setsrid(st_makepoint(77.5946, 12.9716), 4326)::geography as centre) s;

-- Locality labels. The benchmark must always name the level it is showing, so
-- every cell that can be published needs a human name (§7.2).
insert into area_labels (geohash, precision, name, city_slug)
select st_geohash(st_setsrid(st_makepoint(v.lng, v.lat), 4326)::geometry, 6), 6, v.name, 'bengaluru'
from (values
  ('Indiranagar',       77.6408, 12.9784),
  ('Koramangala',       77.6245, 12.9352),
  ('Jayanagar',         77.5833, 12.9250),
  ('JP Nagar',          77.5850, 12.9100),
  ('HSR Layout',        77.6446, 12.9121),
  ('Whitefield',        77.7500, 12.9698),
  ('Rajajinagar',       77.5560, 12.9915),
  ('Malleshwaram',      77.5710, 13.0033),
  ('Basavanagudi',      77.5730, 12.9420),
  ('Marathahalli',      77.6970, 12.9560),
  ('Bellandur',         77.6780, 12.9260),
  ('Hebbal',            77.5910, 13.0350),
  ('Yelahanka',         77.5960, 13.1000),
  ('Banashankari',      77.5560, 12.9250),
  ('Electronic City',   77.6770, 12.8450),
  ('Kalyan Nagar',      77.6410, 13.0230)
) as v(name, lng, lat)
on conflict (geohash) do nothing;

-- Precision-5 district labels, the level the benchmark widens to when a
-- locality is thin. Named after the cell's best-known locality rather than
-- invented, so "Bengaluru South" never appears without meaning something.
insert into area_labels (geohash, precision, name, city_slug)
select distinct on (left(a.geohash, 5))
       left(a.geohash, 5), 5, 'Around ' || a.name, 'bengaluru'
from area_labels a
where a.precision = 6
on conflict (geohash) do nothing;
