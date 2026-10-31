-- Rank waitlisted requests by time waiting and recent use, then promote the
-- highest-ranked eligible request when an approved booking is cancelled.
-- Purpose remains visible to the owner but is deliberately not scored.

create or replace function public.calculate_waitlist_priority(
  p_user_id uuid,
  p_resource_id uuid,
  p_created_at timestamptz
)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select round(
    greatest(extract(epoch from (now() - p_created_at)) / 86400.0, 0)
    - 2 * (
      select count(*)::numeric
      from public.bookings used
      where used.user_id = p_user_id
        and used.resource_id = p_resource_id
        and used.status in ('RETURNED', 'CLOSED')
        and used.start_at >= now() - interval '30 days'
        and used.start_at < now()
    ),
    2
  );
$$;

revoke all on function public.calculate_waitlist_priority(uuid, uuid, timestamptz)
  from public, anon, authenticated;

-- Serialize approvals by resource so concurrent decisions cannot race a
-- waitlist promotion. The exclusion constraint remains the final guard.
create or replace function public.decide_booking(
  p_booking_id uuid,
  p_decision text,
  p_reason text
)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_booking public.bookings%rowtype;
  v_role text;
begin
  if v_user_id is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  if p_decision not in ('APPROVE', 'REJECT', 'WAITLIST') then
    raise exception 'VALIDATION_ERROR: Invalid decision';
  end if;

  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'VALIDATION_ERROR: A decision reason is required';
  end if;

  select b.* into v_booking
  from public.bookings b
  where b.id = p_booking_id
  for update;

  if not found then
    raise exception 'NOT_FOUND: Booking not found';
  end if;

  select p.role into v_role
  from public.profiles p
  where p.id = v_user_id;

  if not exists (
    select 1 from public.resources r
    where r.id = v_booking.resource_id
      and (r.owner_id = v_user_id or v_role in ('manager', 'admin'))
  ) then
    raise exception 'FORBIDDEN: Not authorized to review this booking';
  end if;

  if v_booking.status <> 'REQUESTED' then
    raise exception 'INVALID_TRANSITION: Booking is no longer awaiting review';
  end if;

  if p_decision = 'APPROVE' then
    perform 1
    from public.resources r
    where r.id = v_booking.resource_id
    for update;

    update public.bookings
    set status = 'APPROVED', decision_reason = trim(p_reason)
    where id = p_booking_id
    returning * into v_booking;
  elsif p_decision = 'REJECT' then
    update public.bookings
    set status = 'REJECTED', decision_reason = trim(p_reason)
    where id = p_booking_id
    returning * into v_booking;
  else
    update public.bookings
    set status = 'WAITLISTED',
        decision_reason = trim(p_reason),
        priority_score = public.calculate_waitlist_priority(
          v_booking.user_id, v_booking.resource_id, v_booking.created_at
        )
    where id = p_booking_id
    returning * into v_booking;
  end if;

  insert into public.audit_events (
    booking_id, resource_id, actor_id, action, reason, metadata
  )
  values (
    v_booking.id,
    v_booking.resource_id,
    v_user_id,
    'BOOKING_' || p_decision,
    trim(p_reason),
    case when p_decision = 'WAITLIST'
      then jsonb_build_object('priority_score', v_booking.priority_score)
      else '{}'::jsonb
    end
  );

  return v_booking;
end;
$$;

create or replace function public.cancel_booking(
  p_booking_id uuid,
  p_reason text
)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_booking public.bookings%rowtype;
  v_candidate public.bookings%rowtype;
  v_was_approved boolean;
begin
  if v_user_id is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  select b.* into v_booking
  from public.bookings b
  where b.id = p_booking_id
  for update;

  if not found then
    raise exception 'NOT_FOUND: Booking not found';
  end if;

  if v_booking.user_id <> v_user_id then
    raise exception 'FORBIDDEN: Only the requester can cancel';
  end if;

  if v_booking.status not in ('REQUESTED', 'APPROVED', 'WAITLISTED') then
    raise exception 'INVALID_TRANSITION: Booking cannot be cancelled now';
  end if;

  if v_booking.status = 'APPROVED' and v_booking.start_at <= now() then
    raise exception 'INVALID_TRANSITION: Booking has already started';
  end if;

  v_was_approved := v_booking.status = 'APPROVED';

  if v_was_approved then
    -- Use the same resource lock as booking requests and approvals so only one
    -- transaction can allocate the newly released time slot.
    perform 1
    from public.resources r
    where r.id = v_booking.resource_id
    for update;
  end if;

  update public.bookings
  set status = 'CANCELLED',
      decision_reason = nullif(trim(p_reason), '')
  where id = p_booking_id
  returning * into v_booking;

  insert into public.audit_events (
    booking_id, resource_id, actor_id, action, reason
  )
  values (
    v_booking.id, v_booking.resource_id, v_user_id,
    'BOOKING_CANCELLED', nullif(trim(p_reason), '')
  );

  if v_was_approved then
    update public.bookings b
    set priority_score = public.calculate_waitlist_priority(
      b.user_id, b.resource_id, b.created_at
    )
    where b.resource_id = v_booking.resource_id
      and b.status = 'WAITLISTED'
      and b.start_at > now()
      and b.start_at < v_booking.end_at
      and b.end_at > v_booking.start_at;

    select b.* into v_candidate
    from public.bookings b
    join public.resources r on r.id = b.resource_id
    where b.resource_id = v_booking.resource_id
      and b.status = 'WAITLISTED'
      and b.start_at > now()
      and r.is_active
      and b.start_at < v_booking.end_at
      and b.end_at > v_booking.start_at
      and not exists (
        select 1
        from public.bookings active
        where active.resource_id = b.resource_id
          and active.status in ('APPROVED', 'CHECKED_IN')
          and active.start_at < b.end_at
          and active.end_at > b.start_at
      )
    order by b.priority_score desc nulls last, b.created_at asc, b.id asc
    limit 1
    for update skip locked;

    if found then
      update public.bookings
      set status = 'APPROVED',
          decision_reason = 'Promoted from the waitlist after an approved booking was cancelled.'
      where id = v_candidate.id
      returning * into v_candidate;

      insert into public.audit_events (
        booking_id, resource_id, actor_id, action, reason, metadata
      )
      values (
        v_candidate.id,
        v_candidate.resource_id,
        v_user_id,
        'BOOKING_WAITLIST_PROMOTED',
        'An earlier approved booking was cancelled.',
        jsonb_build_object('priority_score', v_candidate.priority_score)
      );
    end if;
  end if;

  return v_booking;
end;
$$;

-- Include waitlisted requests in the owner's queue and return a current score.
create or replace function public.list_booking_summaries(p_scope text default 'mine')
returns table (
  id uuid,
  resource_id uuid,
  resource_name text,
  user_id uuid,
  requester_name text,
  start_at timestamptz,
  end_at timestamptz,
  purpose text,
  status text,
  decision_reason text,
  priority_score numeric,
  checked_in_at timestamptz,
  returned_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  if p_scope not in ('mine', 'owner_requests', 'owner_active') then
    raise exception 'VALIDATION_ERROR: Invalid booking list scope';
  end if;

  return query
    select b.id,
      b.resource_id,
      r.name,
      b.user_id,
      coalesce(nullif(p.full_name, ''), 'Student'),
      b.start_at,
      b.end_at,
      b.purpose,
      b.status,
      b.decision_reason,
      case when b.status = 'WAITLISTED'
        then public.calculate_waitlist_priority(b.user_id, b.resource_id, b.created_at)
        else b.priority_score
      end,
      b.checked_in_at,
      b.returned_at
    from public.bookings b
    join public.resources r on r.id = b.resource_id
    join public.profiles p on p.id = b.user_id
    where
      (p_scope = 'mine' and b.user_id = auth.uid())
      or (
        p_scope = 'owner_requests'
        and b.status in ('REQUESTED', 'VERIFYING', 'PENDING_REVIEW', 'WAITLISTED')
        and (
          r.owner_id = auth.uid()
          or exists (
            select 1 from public.profiles actor
            where actor.id = auth.uid()
              and actor.role in ('manager', 'admin')
          )
        )
      )
      or (
        p_scope = 'owner_active'
        and b.status in ('APPROVED', 'CHECKED_IN')
        and (
          r.owner_id = auth.uid()
          or exists (
            select 1 from public.profiles actor
            where actor.id = auth.uid()
              and actor.role in ('manager', 'admin')
          )
        )
      )
    order by
      case when p_scope = 'mine' then b.created_at end desc,
      case when p_scope = 'owner_requests' and b.status = 'REQUESTED' then 0
           when p_scope = 'owner_requests' and b.status = 'WAITLISTED' then 1
           else 2 end,
      case when p_scope = 'owner_requests' and b.status = 'WAITLISTED'
        then public.calculate_waitlist_priority(b.user_id, b.resource_id, b.created_at)
      end desc nulls last,
      b.created_at asc;
end;
$$;

revoke all on function public.decide_booking(uuid, text, text) from public, anon;
revoke all on function public.cancel_booking(uuid, text) from public, anon;
revoke all on function public.list_booking_summaries(text) from public, anon;
grant execute on function public.decide_booking(uuid, text, text) to authenticated;
grant execute on function public.cancel_booking(uuid, text) to authenticated;
grant execute on function public.list_booking_summaries(text) to authenticated;
