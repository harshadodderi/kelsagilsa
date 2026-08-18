-- 0007 — Booking-lite. PHASE 4: do not apply before the §11.3 GST answer.
--
-- §8. Four live states and one boolean:
--
--   requested ──┬──▶ accepted ──▶ done
--               ├──▶ declined  (end)
--               ├──▶ expired   (end, automatic at 24h)
--               └──▶ cancelled (end)
--                                 accepted ──▶ cancelled (end)

create table bookings (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references users (id),
  provider_id uuid not null references users (id),
  job_type_id uuid not null references job_types (id),

  status text not null default 'requested'
    check (status in ('requested', 'accepted', 'declined', 'done', 'expired', 'cancelled')),

  note text check (note is null or length(note) <= 500),  -- includes "when suits you"

  quoted_amount numeric(10,2) check (quoted_amount is null or quoted_amount > 0),

  -- Revealed only on accept, purged 30 days after terminal state (§10.5).
  address_line text,
  address_purged_at timestamptz,

  done_at timestamptz,
  provider_confirmed_done boolean not null default false,   -- weight multiplier

  requested_at timestamptz not null default now(),
  accepted_at timestamptz,
  declined_at timestamptz,
  expired_at timestamptz,
  cancelled_at timestamptz,

  constraint booking_not_self check (customer_id <> provider_id)
);

create index bookings_customer_idx on bookings (customer_id, requested_at desc);
create index bookings_provider_idx on bookings (provider_id, requested_at desc);
create index bookings_open_idx on bookings (requested_at) where status = 'requested';

alter table reports add constraint reports_booking_fk
  foreign key (booking_id) references bookings (id);

alter table bookings enable row level security;
revoke all on table bookings from anon, authenticated;

-- The booking policies must NEVER gain a role check. A plumber can book an
-- electrician (§5.3).
create policy bookings_read_party on bookings
  for select to authenticated
  using (customer_id = auth.uid() or provider_id = auth.uid());

grant select (id, customer_id, provider_id, job_type_id, status, note,
              quoted_amount, done_at, provider_confirmed_done,
              requested_at, accepted_at, declined_at, expired_at, cancelled_at)
  on bookings to authenticated;

-- address_line is deliberately outside that grant. It is read through
-- get_booking_address(), which returns it only to the provider and only once
-- the booking is accepted (§10.5).
create or replace function get_booking_address(p_booking uuid)
returns text
language sql
security definer
set search_path = public
as $$
  select b.address_line
  from bookings b
  where b.id = p_booking
    and b.status in ('accepted', 'done')
    and (b.provider_id = auth.uid() or b.customer_id = auth.uid());
$$;

grant execute on function get_booking_address(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Request (§6.4 throttles: 5 open, 15 per 24h)
-- ---------------------------------------------------------------------------

create or replace function request_booking(
  p_provider_id uuid, p_job_slug text, p_note text, p_address_line text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job uuid;
  v_id uuid;
begin
  select id into v_job from job_types where slug = p_job_slug and published;
  if v_job is null then
    raise exception 'Unknown job type.' using errcode = '22023';
  end if;

  if not exists (select 1 from provider_profiles p join users u on u.id = p.user_id
                 where p.user_id = p_provider_id
                   and p.claimed and p.identity_verified_at is not null
                   and p.accepting_work and not u.suspended) then
    raise exception 'This person is not taking new work right now.'
      using errcode = 'KG007';
  end if;

  if (select count(*) from bookings
      where customer_id = auth.uid() and status = 'requested') >= 5 then
    raise exception 'You have 5 requests waiting for an answer already.'
      using errcode = 'KG008';
  end if;

  if (select count(*) from bookings
      where customer_id = auth.uid()
        and requested_at > now() - interval '24 hours') >= 15 then
    raise exception 'You have sent a lot of requests today. Please try tomorrow.'
      using errcode = 'KG009';
  end if;

  insert into bookings (customer_id, provider_id, job_type_id, note, address_line)
  values (auth.uid(), p_provider_id, v_job, p_note, p_address_line)
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function request_booking(uuid, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Accept, with the quote (§8.3).
--
-- Without the quote the displayed price is a lead-generation magnet with no
-- obligation attached. Optional but prominent, and immutable after accept.
-- ---------------------------------------------------------------------------

create or replace function accept_booking(p_booking uuid, p_quoted_amount numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update bookings
     set status = 'accepted',
         accepted_at = now(),
         quoted_amount = p_quoted_amount
   where id = p_booking
     and provider_id = auth.uid()
     and status = 'requested';

  if not found then
    raise exception 'This request is no longer open.' using errcode = 'KG010';
  end if;
end;
$$;

grant execute on function accept_booking(uuid, numeric) to authenticated;

-- quoted_amount is immutable after accept. Enforced here rather than trusted
-- to the RPC, because the number is the whole point of §8.3.
create or replace function bookings_guard_transitions()
returns trigger language plpgsql as $$
begin
  if old.status = 'accepted' and old.quoted_amount is distinct from new.quoted_amount then
    raise exception 'A quote cannot be changed after accepting.' using errcode = 'KG011';
  end if;

  if old.status in ('declined', 'expired', 'cancelled')
     and new.status <> old.status then
    raise exception 'This request is closed.' using errcode = 'KG012';
  end if;

  return new;
end;
$$;

create trigger bookings_guard_transitions_trg
  before update on bookings
  for each row execute function bookings_guard_transitions();

create or replace function decline_booking(p_booking uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update bookings set status = 'declined', declined_at = now()
   where id = p_booking and provider_id = auth.uid() and status = 'requested';
end;
$$;

create or replace function cancel_booking(p_booking uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update bookings set status = 'cancelled', cancelled_at = now()
   where id = p_booking
     and (customer_id = auth.uid() or provider_id = auth.uid())
     and status in ('requested', 'accepted');
end;
$$;

-- Either party marks done. The provider confirming raises the report's weight
-- from 0.7 to 1.0 — they cannot block a report by refusing, only make it count
-- for less, and refusing every job they were paid for is itself a signal that
-- shows up in the Monday review (§8.4, §9.4).
create or replace function mark_booking_done(p_booking uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update bookings
     set status = 'done',
         done_at = coalesce(done_at, now()),
         provider_confirmed_done = provider_confirmed_done or (provider_id = auth.uid())
   where id = p_booking
     and (customer_id = auth.uid() or provider_id = auth.uid())
     and status in ('accepted', 'done');
end;
$$;

grant execute on function decline_booking(uuid) to authenticated;
grant execute on function cancel_booking(uuid) to authenticated;
grant execute on function mark_booking_done(uuid) to authenticated;

-- An unanswered request is worse than a declined one, because the customer is
-- still waiting (§8.5). Nightly.
create or replace function expire_stale_bookings()
returns int language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  with expired as (
    update bookings set status = 'expired', expired_at = now()
     where status = 'requested'
       and requested_at < now() - interval '24 hours'
    returning 1)
  select count(*) into v_count from expired;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- The verified report.
--
-- Prompted at +6h, never at completion. The provider is standing in your
-- kitchen at completion — prompting there builds a coercion machine (§9.1).
-- ---------------------------------------------------------------------------

create or replace function submit_verified_report(
  p_booking uuid,
  p_amount_paid numeric,
  p_parts_amount numeric,
  p_travel_amount numeric,
  p_occurred_on date,
  p_rating int default null,
  p_comment text default null,
  p_name_in_public_feed boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  b bookings%rowtype;
  v_area text;
  v_id uuid;
begin
  select * into b from bookings
  where id = p_booking and customer_id = auth.uid() and status = 'done';

  if not found then
    raise exception 'You can add a report once the job is marked done.'
      using errcode = 'KG013';
  end if;

  if b.done_at > now() - interval '6 hours' then
    raise exception 'You can add this report 6 hours after the job.'
      using errcode = 'KG014';
  end if;

  select area_geohash into v_area from users where id = auth.uid();
  if v_area is null then
    raise exception 'Set your location first.' using errcode = '22023';
  end if;

  insert into reports (
    reporter_id, booking_id, provider_id, job_type_id, area_geohash,
    amount_paid, parts_amount, travel_amount, occurred_on,
    rating, comment, name_in_public_feed, source)
  values (
    auth.uid(), b.id, b.provider_id, b.job_type_id, v_area,
    p_amount_paid, p_parts_amount, p_travel_amount, p_occurred_on,
    p_rating, p_comment, p_name_in_public_feed, 'organic')
  returning id into v_id;

  perform recompute_quote_accuracy(b.provider_id, b.job_type_id);
  return v_id;
end;
$$;

grant execute on function submit_verified_report(
  uuid, numeric, numeric, numeric, date, int, text, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Quote accuracy (§8.3).
--
--   hit = abs(service_amount − quoted_amount) <= 0.15 × quoted_amount
--
-- Displayed at n>=5 only, as "Quotes held on 12 of 14 jobs". Never as a
-- percentage with a decimal. A job with no quote counts toward neither side.
-- Do not rank by it in v0 — display it, and watch what happens.
-- ---------------------------------------------------------------------------

create or replace function recompute_quote_accuracy(p_provider uuid, p_job uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update provider_job_stats s
     set quote_n = q.total, quote_hits = q.hits
    from (
      select count(*)::int as total,
             count(*) filter (
               where abs(r.service_amount - b.quoted_amount) <= 0.15 * b.quoted_amount
             )::int as hits
      from reports r
      join bookings b on b.id = r.booking_id
      where r.provider_id = p_provider
        and r.job_type_id = p_job
        and b.quoted_amount is not null
        and not r.hidden and not r.flagged
        and r.weight >= 0.50
        and r.occurred_on >= current_date - interval '12 months'
    ) q
   where s.provider_id = p_provider and s.job_type_id = p_job;
end;
$$;

-- ---------------------------------------------------------------------------
-- The weighting function, completed (§9.2).
--
-- Phase 1's version could not see bookings. These three terms are what make
-- the self-review loop and price laundering uneconomic.
-- ---------------------------------------------------------------------------

create or replace function compute_report_weight(p_report reports)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  w numeric := 1.00;
  v_account_age interval;
  v_confirmed boolean;
begin
  if p_report.booking_id is null then
    w := w * 0.40;
  else
    select provider_confirmed_done into v_confirmed
    from bookings where id = p_report.booking_id;
    if not coalesce(v_confirmed, false) then
      w := w * 0.70;                                          -- §8.4
    end if;
  end if;

  -- A reporter with no prior completed booking with a DIFFERENT provider is
  -- the shape of both competitor bombing and the self-review loop.
  --
  -- Provider-directed reports only — see the long note in 0004 on why these
  -- two terms do not apply to area-only reports.
  if p_report.provider_id is not null then
    if not exists (
         select 1 from bookings b
         where b.customer_id = p_report.reporter_id
           and b.status = 'done'
           and b.provider_id is distinct from p_report.provider_id)
    then
      w := w * 0.25;
    end if;

    select now() - u.created_at into v_account_age
    from users u where u.id = p_report.reporter_id;

    if v_account_age is null or v_account_age < interval '7 days' then
      w := w * 0.50;
    end if;
  end if;

  if p_report.provider_id is not null and p_report.reporter_id is not null
     and exists (
       select 1
       from client_fingerprints a
       join client_fingerprints b on b.ip_hash = a.ip_hash
       where a.user_id = p_report.reporter_id
         and b.user_id = p_report.provider_id)
  then
    w := w * 0.10;
  end if;

  -- Price laundering: a provider reporting their own jobs as a customer to
  -- seed a low median. Weight 0 where reporter and provider share a category.
  if p_report.provider_id is not null and exists (
       select 1
       from provider_categories a
       join provider_categories b on b.category_id = a.category_id
       where a.provider_id = p_report.reporter_id
         and b.provider_id = p_report.provider_id)
  then
    w := w * 0.00;
  end if;

  w := w * case
    when p_report.occurred_on >= current_date - interval '6 months'  then 1.00
    when p_report.occurred_on >= current_date - interval '12 months' then 0.60
    else 0.00
  end;

  return greatest(0, least(1, round(w, 2)));
end;
$$;

-- Report rate — metric #2, the other one that decides whether the product is
-- possible (§13.2). Below 25% after 30 accepted bookings the loop is broken.
create or replace function get_report_rate()
returns table (accepted_bookings int, reports_from_bookings int, rate numeric)
language sql
security definer
set search_path = public
as $$
  select a.c, b.c,
         case when a.c = 0 then null else round(b.c::numeric / a.c, 3) end
  from (select count(*)::int c from bookings
         where status in ('accepted', 'done')) a,
       (select count(*)::int c from reports where booking_id is not null) b;
$$;

revoke all on function get_report_rate() from public, anon;
