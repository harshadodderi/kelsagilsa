-- 0008 — Retention, erasure, and the nightly jobs.
--
-- §10.2, §10.4, §11.1.
--
-- The erasure decision is settled BEFORE the first report is collected,
-- because retrofitting it after the first deletion request is impossible —
-- by then you have promised something else.
--
--   On account deletion, the reporter link is severed and the report survives
--   as an anonymous data point in the price aggregate. Free-text comments and
--   photos are deleted.
--
-- That sentence is in the privacy notice (app/legal/privacy.tsx) in exactly
-- these terms.

create or replace function erase_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  -- The numbers survive, de-identified. Everything a person wrote does not.
  update reports
     set reporter_id = null,
         comment = null,
         name_in_public_feed = false
   where reporter_id = v_user;

  delete from report_photos p
   using reports r
   where p.report_id = r.id and r.reporter_id is null and r.booking_id is null;

  delete from client_fingerprints where user_id = v_user;

  -- IT Rules 2021: registration records are retained for 180 days after
  -- withdrawal (§10.4, §11.1). The row below is the only thing kept, and it
  -- holds no contact details.
  insert into erasure_log (user_id, erased_at) values (v_user, now());

  delete from users where id = v_user;
  -- auth.users is deleted by the client calling the admin API afterwards; the
  -- cascade above is what removes personal data from the application schema.
end;
$$;

create table erasure_log (
  user_id uuid primary key,
  erased_at timestamptz not null default now()
  -- 180 days is applied at sweep time rather than as a generated column:
  -- timestamptz arithmetic is stable, not immutable, so Postgres will not
  -- store it.
);

alter table erasure_log enable row level security;
revoke all on table erasure_log from anon, authenticated;

revoke all on function erase_my_account() from public, anon;
grant execute on function erase_my_account() to authenticated;

-- ---------------------------------------------------------------------------
-- Nightly retention sweep (§10.4)
-- ---------------------------------------------------------------------------

create or replace function run_retention_sweep()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- OTP send logs: 90 days.
  delete from otp_send_log where created_at < now() - interval '90 days';

  -- Moderation actions: 3 years.
  delete from moderation_actions where created_at < now() - interval '3 years';

  -- Registration records of erased accounts: 180 days.
  delete from erasure_log where erased_at < now() - interval '180 days';

  -- Booking address: 30 days after terminal state. The provider has long since
  -- found the house. `bookings` does not exist until Phase 4, so this one is
  -- guarded rather than assumed — the sweep must not stop being run in the
  -- months before Phase 4 lands.
  if to_regclass('public.bookings') is not null then
    execute $q$
      update bookings
         set address_line = null, address_purged_at = now()
       where address_line is not null
         and status in ('declined', 'expired', 'cancelled', 'done')
         and coalesce(done_at, cancelled_at, declined_at, expired_at)
             < now() - interval '30 days'
    $q$;
    execute 'select expire_stale_bookings()';
  end if;
end;
$$;

revoke all on function run_retention_sweep() from public, anon;

-- ---------------------------------------------------------------------------
-- Nightly schedule.
--
-- Order matters: weights decay first, then every stat is recomputed from the
-- new weights, then stale requests expire, then the retention sweep runs.
-- ---------------------------------------------------------------------------

create or replace function run_nightly()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform recompute_all_weights();
  perform recompute_all_stats();
  perform run_retention_sweep();
end;
$$;

revoke all on function run_nightly() from public, anon;

-- Enable with pg_cron where available; otherwise the scheduled GitHub Action
-- in .github/workflows/nightly.yml calls run_nightly() over RPC.
--
--   select cron.schedule('kelsagilsa-nightly', '30 20 * * *', 'select run_nightly()');
--
-- 20:30 UTC is 02:00 IST.
