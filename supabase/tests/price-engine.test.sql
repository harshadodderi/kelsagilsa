-- Behavioural checks on the price engine, the weighting rules and the privacy
-- layer. Run by supabase/tests/run-local-checks.sh.
--
-- These assert the things that would be expensive to discover in production:
-- a benchmark that publishes at n=4, a booking-less report that reaches a
-- provider's median, a throttle that does not fire, a column grant that has
-- quietly been widened.

\set ON_ERROR_STOP on

begin;

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------

create temporary table ctx (geohash text, job uuid, reporter uuid);

insert into auth.users (id) select gen_random_uuid() from generate_series(1, 3);

do $$
declare
  v_geohash text;
  v_job uuid;
  v_reporter uuid;
begin
  -- Indiranagar, so the seeded area label and the city prefix both resolve.
  v_geohash := st_geohash(st_setsrid(st_makepoint(77.6408, 12.9784), 4326), 6);
  select id into v_job from job_types where slug = 'tap-leak';

  select id into v_reporter from auth.users limit 1;
  insert into users (id, name, birth_year) values (v_reporter, 'Asha Kumari', 1990);

  insert into ctx values (v_geohash, v_job, v_reporter);
end;
$$;

-- ---------------------------------------------------------------------------
-- §3.2 — public_name is a first name, generated, and cannot drift
-- ---------------------------------------------------------------------------

do $$
declare v_public text;
begin
  select public_name into v_public from users where name = 'Asha Kumari';
  assert v_public = 'Asha', format('public_name published a surname: %s', v_public);

  update users set name = 'Asha Devi Kumari' where name = 'Asha Kumari';
  select public_name into v_public from users where name = 'Asha Devi Kumari';
  assert v_public = 'Asha', 'public_name did not follow the rename';
end;
$$;

-- ---------------------------------------------------------------------------
-- §3.1 — column grants, not just RLS
-- ---------------------------------------------------------------------------

do $$
declare
  v_grants text[];
begin
  select array_agg(column_name::text order by column_name)
    into v_grants
  from information_schema.column_privileges
  where table_name = 'users' and grantee = 'authenticated' and privilege_type = 'SELECT';

  assert not ('phone' = any (v_grants)), 'phone is readable by authenticated';
  assert not ('name' = any (v_grants)), 'full name is readable by authenticated';
  assert not ('location' = any (v_grants)), 'location is readable by authenticated';
  assert 'public_name' = any (v_grants), 'public_name should be readable';

  select array_agg(column_name::text)
    into v_grants
  from information_schema.column_privileges
  where table_name = 'reports' and grantee = 'authenticated' and privilege_type = 'SELECT';

  -- Never tell a user their weight or why (§9.2). Never let metric zero be
  -- reverse-engineered from the client either (§13.1).
  assert not ('weight' = any (v_grants)), 'report weight is exposed';
  assert not ('source' = any (v_grants)), 'report source is exposed';
end;
$$;

-- Stats tables: RLS on, zero policies (§6.1).
do $$
declare v_policies int;
begin
  select count(*) into v_policies from pg_policies
  where tablename in ('area_job_stats', 'provider_job_stats');
  assert v_policies = 0, format('stats tables have %s policies, expected 0', v_policies);
end;
$$;

-- ---------------------------------------------------------------------------
-- §7.3 — the confidence tiers, at every boundary
-- ---------------------------------------------------------------------------

-- Four reports: below the floor, so nothing renders at all.
insert into reports (reporter_id, job_type_id, area_geohash, amount_paid, occurred_on, parts_amount, source)
select null, c.job, c.geohash, v.amount, current_date - 30, 0, 'seeded'
from ctx c, (values (250), (300), (350), (400)) as v(amount);

do $$
declare v_rows int;
begin
  select count(*) into v_rows
  from ctx c, get_area_benchmark(c.geohash, 'tap-leak');
  assert v_rows = 0, 'a benchmark rendered at n=4';
end;
$$;

-- Three more: n=7, the early tier. min-max, and no midpoint.
insert into reports (reporter_id, job_type_id, area_geohash, amount_paid, occurred_on, parts_amount, source)
select null, c.job, c.geohash, v.amount, current_date - 30, 0, 'seeded'
from ctx c, (values (150), (900), (300)) as v(amount);

do $$
declare b record;
begin
  select * into b from ctx c, get_area_benchmark(c.geohash, 'tap-leak');

  assert b.n = 7, format('expected n=7, got %s', b.n);
  assert b.tier = 'early', format('expected the early tier, got %s', b.tier);
  assert b.low = 150 and b.high = 900,
    format('the interval did not widen to min-max: %s-%s', b.low, b.high);
  assert b.mid is null, 'a midpoint was published below n=10';
  assert b.area_name = 'Indiranagar', format('area named %s', b.area_name);
  assert b.area_level = 'locality', format('area level %s', b.area_level);
end;
$$;

-- Five more: n=12, the typical tier. P25-P75, and a midpoint.
insert into reports (reporter_id, job_type_id, area_geohash, amount_paid, occurred_on, parts_amount, source)
select null, c.job, c.geohash, v.amount, current_date - 30, 0, 'seeded'
from ctx c, (values (280), (320), (290), (310), (305)) as v(amount);

do $$
declare b record;
begin
  select * into b from ctx c, get_area_benchmark(c.geohash, 'tap-leak');

  assert b.n = 12, format('expected n=12, got %s', b.n);
  assert b.tier = 'typical', format('expected the typical tier, got %s', b.tier);
  assert b.mid is not null, 'no midpoint at n=12';
  assert b.low > 150 and b.high < 900,
    format('the interval did not narrow to P25-P75: %s-%s', b.low, b.high);
end;
$$;

-- ---------------------------------------------------------------------------
-- The sample size and the number describe the same set (§7.1)
-- ---------------------------------------------------------------------------

do $$
declare
  v_n int;
  v_counted int;
begin
  select s.n into v_n
  from ctx c join area_job_stats s
    on s.area_geohash = c.geohash and s.job_type_id = c.job;

  select count(*) into v_counted
  from ctx c join reports r
    on r.area_geohash = c.geohash and r.job_type_id = c.job
  where not r.hidden and not r.flagged and r.weight >= 0.30
    and r.occurred_on >= current_date - interval '12 months';

  assert v_n = v_counted,
    format('published n=%s but only %s rows survived the filters', v_n, v_counted);
end;
$$;

-- ---------------------------------------------------------------------------
-- §9.3 — outliers are flagged, excluded, and kept
-- ---------------------------------------------------------------------------

do $$
declare
  v_flagged boolean;
  v_n_before int;
  v_n_after int;
  v_id uuid;
begin
  select s.n into v_n_before from ctx c join area_job_stats s
    on s.area_geohash = c.geohash and s.job_type_id = c.job;

  insert into reports (reporter_id, job_type_id, area_geohash, amount_paid, occurred_on, parts_amount, source)
  select null, c.job, c.geohash, 9000, current_date - 10, 0, 'seeded' from ctx c
  returning id, flagged into v_id, v_flagged;

  assert v_flagged, 'a 30x outlier was not flagged';

  select s.n into v_n_after from ctx c join area_job_stats s
    on s.area_geohash = c.geohash and s.job_type_id = c.job;
  assert v_n_after = v_n_before, 'a flagged outlier moved the published n';

  -- Not deleted: deleting teaches the attacker your detection and loses the row.
  assert exists (select 1 from reports where id = v_id), 'the flagged row was deleted';
end;
$$;

-- ---------------------------------------------------------------------------
-- §6.1 / §9.2 — a booking-less report can never touch a provider's number
-- ---------------------------------------------------------------------------

do $$
declare
  v_provider uuid;
  v_weight numeric;
  v_provider_n int;
begin
  select id into v_provider from auth.users
  where id not in (select reporter from ctx) limit 1;
  insert into users (id, name, birth_year) values (v_provider, 'Ravi Shankar', 1985);

  insert into reports (reporter_id, provider_id, job_type_id, area_geohash,
                       amount_paid, occurred_on, parts_amount, source)
  select c.reporter, v_provider, c.job, c.geohash, 200, current_date - 5, 0, 'organic'
  from ctx c
  returning weight into v_weight;

  -- By arithmetic, not by a policy someone might loosen later.
  assert v_weight < 0.5,
    format('a booking-less report reached weight %s, at or above the provider threshold', v_weight);

  select coalesce(sum(n), 0) into v_provider_n from provider_job_stats
  where provider_id = v_provider;
  assert v_provider_n = 0,
    format('a booking-less report fed provider stats: n=%s', v_provider_n);
end;
$$;

-- ---------------------------------------------------------------------------
-- §6.4 — throttles fire, with a message fit to show a person
-- ---------------------------------------------------------------------------

do $$
declare
  v_message text;
  v_code text;
begin
  -- The reporter already has one booking-less report from the check above.
  insert into reports (reporter_id, job_type_id, area_geohash, amount_paid, occurred_on, parts_amount)
  select c.reporter, c.job, c.geohash, 300, current_date - 3, 0 from ctx c;

  begin
    insert into reports (reporter_id, job_type_id, area_geohash, amount_paid, occurred_on, parts_amount)
    select c.reporter, c.job, c.geohash, 300, current_date - 2, 0 from ctx c;
    assert false, 'the third booking-less report in 24h was accepted';
  exception
    when sqlstate 'KG002' then
      get stacked diagnostics v_message = message_text, v_code = returned_sqlstate;
      assert v_message like '%2 reports a day%',
        format('throttle message is not fit to show a person: %s', v_message);
  end;
end;
$$;

-- ---------------------------------------------------------------------------
-- §7.6 — reports older than 12 months are refused, not silently down-weighted
-- ---------------------------------------------------------------------------

do $$
declare v_weight numeric;
begin
  insert into reports (reporter_id, job_type_id, area_geohash, amount_paid, occurred_on, parts_amount, source)
  select null, c.job, c.geohash, 300, current_date - interval '14 months', 0, 'seeded' from ctx c
  returning weight into v_weight;

  assert v_weight = 0, format('a 14-month-old report kept weight %s', v_weight);
end;
$$;

-- ---------------------------------------------------------------------------
-- §7.2 — the area widens hierarchically, and never silently
-- ---------------------------------------------------------------------------

do $$
declare
  b record;
  v_neighbour text;
begin
  -- A cell with no reports of its own, inside the same precision-5 district.
  select left(c.geohash, 5) || 'z' into v_neighbour from ctx c;

  select * into b from get_area_benchmark(v_neighbour, 'tap-leak');
  assert b.area_level = 'district',
    format('expected to widen to the district, got %s', b.area_level);
  assert b.area_name is not null and b.area_name <> '',
    'widened without naming the level being shown';
end;
$$;

-- ---------------------------------------------------------------------------
-- §10.2 — erasure severs the link and keeps the number
-- ---------------------------------------------------------------------------

do $$
declare
  v_user uuid;
  v_report uuid;
  v_amount numeric;
  v_comment text;
  v_reporter uuid;
begin
  select id into v_user from auth.users
  where id not in (select id from users) limit 1;
  insert into users (id, name, birth_year) values (v_user, 'Meera Nair', 1992);

  insert into reports (reporter_id, job_type_id, area_geohash, amount_paid,
                       occurred_on, parts_amount, comment)
  select v_user, c.job, c.geohash, 275, current_date - 4, 0, 'quick and tidy' from ctx c
  returning id into v_report;

  perform set_config('kelsagilsa.test_uid', v_user::text, true);
  perform erase_my_account();

  select amount_paid, comment, reporter_id into v_amount, v_comment, v_reporter
  from reports where id = v_report;

  assert v_amount = 275, 'erasure destroyed the price data';
  assert v_comment is null, 'erasure kept the free-text comment';
  assert v_reporter is null, 'erasure kept the reporter link';
  assert exists (select 1 from erasure_log where user_id = v_user),
    'no registration record was retained for the 180-day window';
end;
$$;

-- ---------------------------------------------------------------------------
-- §9.1 — individual reports render only at n>=10
-- ---------------------------------------------------------------------------

do $$
declare
  v_rows int;
  v_thin text;
begin
  select left(c.geohash, 5) || 'y' into v_thin from ctx c;

  insert into reports (reporter_id, job_type_id, area_geohash, amount_paid, occurred_on, parts_amount, source)
  select null, c.job, v_thin, v.amount, current_date - 20, 0, 'seeded'
  from ctx c, (values (300), (310), (320), (330), (340), (350)) as v(amount);

  select count(*) into v_rows from get_public_reports(v_thin, 'tap-leak');
  assert v_rows = 0,
    format('%s individual reports rendered at n=6 — a provider identifies each reporter by elimination', v_rows);
end;
$$;

-- ---------------------------------------------------------------------------
-- §13.1 — metric zero is admin-only, and seeded rows count toward neither side
-- ---------------------------------------------------------------------------

do $$
declare
  v_admin uuid;
  v_share record;
  v_denied boolean := false;
begin
  select id into v_admin from auth.users
  where id not in (select id from users) limit 1;

  if v_admin is null then
    insert into auth.users (id) values (gen_random_uuid()) returning id into v_admin;
  end if;

  insert into users (id, name, birth_year) values (v_admin, 'Ops Person', 1988);

  -- As an ordinary signed-in user: denied.
  perform set_config('kelsagilsa.test_uid', v_admin::text, true);
  begin
    perform * from get_organic_share(7);
  exception
    when sqlstate '42501' then v_denied := true;
  end;
  assert v_denied, 'a non-admin could read metric zero';

  -- As an admin: allowed, and seeded rows are excluded from the denominator.
  update users set role = 'admin' where id = v_admin;
  select * into v_share from get_organic_share(7);

  assert v_share.total = (
    select count(*) from reports
    where created_at > now() - interval '7 days' and source <> 'seeded'),
    'organic share counted seeded rows';
end;
$$;

rollback;

\echo 'price-engine.test.sql: all assertions passed'
