-- 0002 — Job types, reports, and the two stats tables.
--
-- Phase 1. §6.1.
--
-- `reports.booking_id` exists from the first row but its foreign key is added
-- in 0007, when bookings exist. The column cannot wait: a report written
-- before the column exists can never be re-classified as verified.

create table categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  sort_order int not null default 0,
  icon_key text not null              -- §12.2: icon plus label, always
);

create table job_types (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories (id),
  slug text not null unique,          -- 'tap-leak', 'drain-block', 'geyser-install'
  name text not null,                 -- the words people used in Phase 0 (§2.5)
  size_qualifier text,                -- where §2.3 forced a split
  typical_hint text,                  -- shown while there is no data
  sort_order int not null default 0,
  -- Job types that failed the Phase 0 spread test stay in the table (history
  -- references them) but are out of the launch set.
  published boolean not null default true
);

create index job_types_category_idx on job_types (category_id, sort_order);

alter table categories enable row level security;
alter table job_types enable row level security;

-- Reading the taxonomy requires no account (§5.2).
create policy categories_read_all on categories for select to anon, authenticated using (true);
create policy job_types_read_all  on job_types  for select to anon, authenticated using (true);

grant select on categories to anon, authenticated;
grant select on job_types to anon, authenticated;

-- ---------------------------------------------------------------------------
-- reports
--
-- `reviews` from v1 is `reports` — the price is the point, the rating is
-- optional garnish.
-- ---------------------------------------------------------------------------

create table reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references users (id) on delete set null,
  booking_id uuid unique,                            -- NULL = unverified
  provider_id uuid references users (id),            -- NULL = area-only
  job_type_id uuid not null references job_types (id),
  area_geohash text not null check (length(area_geohash) >= 5),

  amount_paid    numeric(10,2) not null check (amount_paid > 0),
  parts_amount   numeric(10,2) check (parts_amount is null or parts_amount >= 0),
  travel_amount  numeric(10,2) check (travel_amount is null or travel_amount >= 0),

  -- §3.3. The number measures the provider, not the job.
  service_amount numeric(10,2) generated always as
    (amount_paid - coalesce(parts_amount, 0) - coalesce(travel_amount, 0)) stored,

  rating int check (rating between 1 and 5),
  comment text check (comment is null or length(comment) <= 1000),
  name_in_public_feed boolean not null default false,

  -- Metric zero (§13.1). Cannot be reconstructed later, which is why it is
  -- here on the very first row.
  source text not null default 'organic'
    check (source in ('organic', 'seeded', 'solicited', 'recruited_provider')),

  weight numeric(3,2) not null default 1.0 check (weight between 0 and 1),  -- §9.2
  flagged boolean not null default false,
  hidden  boolean not null default false,

  occurred_on date not null,
  created_at timestamptz not null default now(),
  edited_until timestamptz,

  -- The parts split is never forced. A cornered customer invents one, and an
  -- invented split is indistinguishable from a real one once it is in the
  -- aggregate (§3.3). `null` means "Not sure" and is permanently valid.
  constraint report_split_within_total
    check (coalesce(parts_amount, 0) + coalesce(travel_amount, 0) < amount_paid),

  -- Over 12 months is refused (§7.6), and the future is not reportable.
  constraint report_occurred_in_window
    check (occurred_on <= current_date and occurred_on >= current_date - interval '18 months')
);

create index reports_area_job_idx     on reports (area_geohash, job_type_id) where not hidden;
create index reports_provider_job_idx on reports (provider_id, job_type_id) where not hidden;
create index reports_reporter_idx     on reports (reporter_id, created_at desc);
create index reports_source_idx       on reports (source, created_at desc);
create index reports_flagged_idx      on reports (created_at desc) where flagged;

-- §6.1 hard constraint: a report naming a provider without a booking never
-- feeds per-provider stats. Enforced in the recompute query (0003) by
-- `booking_id is not null`, and again by arithmetic — the booking-less weight
-- multiplier (0004) means such a report cannot reach the 0.5 threshold.

comment on column reports.provider_id is
  'Naming a provider does not make the report count for them. Only booking-backed reports feed provider_job_stats (§6.1, §9.2).';

alter table reports enable row level security;

-- A reporter can see their own reports. Nobody reads another person's directly;
-- the public feed and every published figure go through security-definer RPCs
-- so that column-level exposure is explicit.
create policy reports_select_own on reports
  for select to authenticated
  using (reporter_id = auth.uid());

grant select (id, reporter_id, booking_id, provider_id, job_type_id, area_geohash,
              amount_paid, parts_amount, travel_amount, service_amount,
              rating, comment, name_in_public_feed, occurred_on, created_at,
              edited_until)
  on reports to authenticated;

-- Deliberately not granted to any client: source, weight, flagged, hidden.
-- "Never tell a user their weight or why" (§9.2).

create table report_photos (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references reports (id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now()
);

create index report_photos_report_idx on report_photos (report_id);

alter table report_photos enable row level security;

create policy report_photos_select_own on report_photos
  for select to authenticated
  using (exists (select 1 from reports r
                  where r.id = report_photos.report_id
                    and r.reporter_id = auth.uid()));

grant select on report_photos to authenticated;

-- ---------------------------------------------------------------------------
-- Stats tables. RLS on, zero policies. Every reader is a security-definer RPC
-- returning percentiles. Never expose a sum — a lifetime billings total is
-- not yours to publish (§6.1).
-- ---------------------------------------------------------------------------

create table area_job_stats (
  area_geohash text not null,
  job_type_id uuid not null references job_types (id),
  precision int not null,                      -- 6, 5, or 0 = city
  n int not null default 0,
  p25 numeric, p50 numeric, p75 numeric,
  min_amt numeric, max_amt numeric,
  updated_at timestamptz not null default now(),
  primary key (area_geohash, job_type_id)
);

create table provider_job_stats (             -- Phase 4
  provider_id uuid not null references users (id) on delete cascade,
  job_type_id uuid not null references job_types (id),
  n int not null default 0,
  p25 numeric, p50 numeric, p75 numeric,
  min_amt numeric, max_amt numeric,
  total_p50 numeric,
  rated_n int not null default 0,
  rating_avg numeric(3,2),
  quote_n int not null default 0,
  quote_hits int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (provider_id, job_type_id)
);

alter table area_job_stats enable row level security;
alter table provider_job_stats enable row level security;

revoke all on table area_job_stats from anon, authenticated;
revoke all on table provider_job_stats from anon, authenticated;
