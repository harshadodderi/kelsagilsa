-- 0010 — OTP send limits and the send log.
--
-- Phase 1. §5.1, §10.4.
--
-- `signInWithOtp` is unauthenticated and sends mail from your domain to any
-- address supplied. Left open it is a free mail-bomb, an account-enumeration
-- oracle, and a way to burn 3,000 free emails in an afternoon.
--
-- Three defences, and all three are needed:
--   1. Turnstile, enabled in Supabase Auth -> Attack Protection, verified by
--      GoTrue itself. Nothing in this file can substitute for it.
--   2. The per-email and per-IP limits below.
--   3. The send log, so an attack is visible after the fact.
--
-- The limits live in the database rather than in the client because a limit a
-- client enforces is a limit an attacker skips.

-- The address is never stored — only sha256(lower(trim(email)) || pepper).
-- That is enough to count sends per address and useless for enumerating who
-- has an account.
create or replace function hash_email(p_email text, p_pepper text)
returns text language sql immutable as $$
  select encode(digest(lower(btrim(p_email)) || p_pepper, 'sha256'), 'hex');
$$;

-- Returns nothing on success; raises with a message fit to show a person when
-- a limit is hit. The row is written either way, because a blocked attempt is
-- the one you most want in the log.
create or replace function record_otp_send(
  p_email_hash text, p_ip inet, p_user_agent text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_by_email int;
  v_by_ip int;
begin
  select count(*) into v_by_email
  from otp_send_log
  where email_hash = p_email_hash
    and created_at > now() - interval '1 hour';

  select count(*) into v_by_ip
  from otp_send_log
  where p_ip is not null and ip = p_ip
    and created_at > now() - interval '1 hour';

  insert into otp_send_log (email_hash, ip, user_agent)
  values (p_email_hash, p_ip, left(p_user_agent, 500));

  -- 5 sends per email per hour, 20 per IP per hour (§5.1).
  if v_by_email >= 5 then
    raise exception 'We have sent several codes to this address already. Please try again in an hour.'
      using errcode = 'KG015';
  end if;

  if v_by_ip >= 20 then
    raise exception 'Too many sign-in attempts from this connection. Please try again in an hour.'
      using errcode = 'KG016';
  end if;
end;
$$;

-- Service role only: this is called by the send-otp edge function, which is
-- the only thing that knows the caller's IP.
revoke all on function record_otp_send(text, inet, text) from public, anon, authenticated;

-- The weekly review wants to see an attack without reading raw rows.
create or replace function get_otp_send_summary(p_hours int default 24)
returns table (sends int, distinct_addresses int, distinct_ips int, worst_ip_sends int)
language sql
security definer
set search_path = public
as $$
  select count(*)::int,
         count(distinct email_hash)::int,
         count(distinct ip)::int,
         coalesce(max(per_ip), 0)::int
  from otp_send_log,
       lateral (select count(*) as per_ip from otp_send_log inner_log
                where inner_log.ip = otp_send_log.ip
                  and inner_log.created_at > now() - make_interval(hours => p_hours)) c
  where created_at > now() - make_interval(hours => p_hours);
$$;

revoke all on function get_otp_send_summary(int) from public, anon;
