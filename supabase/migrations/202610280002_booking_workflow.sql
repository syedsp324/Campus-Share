
-- CampusShare booking workflow migration.
-- All privileged booking changes are validated inside PostgreSQL.

-- 1. Submit a booking request.
create or replace function public.request_booking(
  p_resource_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_purpose text,
  p_purpose_note text default null,
  p_team_name text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_resource public.resources%rowtype;
  v_booking public.bookings%rowtype;
  v_week_start timestamptz;
  v_week_end timestamptz;
  v_hours numeric;
  v_active_count integer;
begin
  -- Only signed-in students can submit requests.
  if v_user_id is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  if p_start_at is null or p_end_at is null
     or p_start_at <= now() or p_end_at <= p_start_at then
    raise exception 'VALIDATION_ERROR: Invalid booking dates';
  end if;

  if p_purpose not in ('COURSEWORK', 'RESEARCH', 'STUDENT_PROJECT', 'OTHER') then
    raise exception 'VALIDATION_ERROR: Invalid purpose';
  end if;

  -- Lock the resource row while checking its booking limits.
  select r.* into v_resource
  from public.resources r
  where r.id = p_resource_id and r.is_active = true
  for update;

  if not found then
    raise exception 'NOT_FOUND: Resource unavailable';
  end if;

  if p_end_at - p_start_at >
     make_interval(hours => v_resource.max_booking_length_hours) then
    raise exception 'VALIDATION_ERROR: Booking exceeds maximum duration';
  end if;

  -- Prevent a user from creating too many simultaneous active bookings.
  select count(*) into v_active_count
  from public.bookings b
  where b.user_id = v_user_id
    and b.status in (
      'REQUESTED', 'VERIFYING', 'PENDING_REVIEW',
      'APPROVED', 'CHECKED_IN', 'OVERDUE'
    );

  if v_active_count >= v_resource.max_active_bookings_per_user then
    raise exception 'QUOTA_EXCEEDED: Too many active bookings';
  end if;

  -- Use the start date's calendar week for a simple weekly-hours limit.
  v_week_start := date_trunc('week', p_start_at);
  v_week_end := v_week_start + interval '1 week';

  select coalesce(sum(
    extract(epoch from (
      least(b.end_at, v_week_end) - greatest(b.start_at, v_week_start)
    )) / 3600
  ), 0)
  into v_hours
  from public.bookings b
  where b.user_id = v_user_id
    and b.resource_id = p_resource_id
    and b.status in ('APPROVED', 'CHECKED_IN', 'OVERDUE')
    and b.start_at < v_week_end
    and b.end_at > v_week_start;

  if v_hours + extract(epoch from (p_end_at - p_start_at)) / 3600 >
     v_resource.max_hours_per_user_per_week then
    raise exception 'QUOTA_EXCEEDED: Weekly resource hours exceeded';
  end if;

  -- Save the request as REQUESTED; the requester cannot self-approve.
  insert into public.bookings (
    resource_id, user_id, start_at, end_at,
    purpose, purpose_note, team_name, status
  )
  values (
    p_resource_id, v_user_id, p_start_at, p_end_at,
    p_purpose, p_purpose_note, p_team_name, 'REQUESTED'
  )
  returning * into v_booking;

  -- Keep an audit trail of the submitted request.
  insert into public.audit_events (
    booking_id, resource_id, actor_id, action
  )
  values (
    v_booking.id, p_resource_id, v_user_id, 'BOOKING_REQUESTED'
  );

  return v_booking;
end;
$$;


-- 2. Let the resource owner or an authorized manager decide.
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
  v_new_status text;
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

  -- Lock the request so two reviewers cannot decide it simultaneously.
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
    -- The exclusion constraint remains the final protection against overlaps.
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
    set status = 'WAITLISTED', decision_reason = trim(p_reason)
    where id = p_booking_id
    returning * into v_booking;
  end if;

  insert into public.audit_events (
    booking_id, resource_id, actor_id, action, reason
  )
  values (
    v_booking.id, v_booking.resource_id, v_user_id,
    'BOOKING_' || p_decision, trim(p_reason)
  );

  return v_booking;
end;
$$;


-- 3. Allow a requester to cancel a request or an upcoming approval.
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

  return v_booking;
end;
$$;


-- Expose only these specific operations to signed-in users.
revoke all on function public.request_booking(uuid, timestamptz, timestamptz, text, text, text)
  from public, anon;
revoke all on function public.decide_booking(uuid, text, text)
  from public, anon;
revoke all on function public.cancel_booking(uuid, text)
  from public, anon;

grant execute on function public.request_booking(uuid, timestamptz, timestamptz, text, text, text)
  to authenticated;
grant execute on function public.decide_booking(uuid, text, text)
  to authenticated;
grant execute on function public.cancel_booking(uuid, text)
  to authenticated;