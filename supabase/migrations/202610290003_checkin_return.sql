
-- CampusShare: secure check-in and return workflow.
-- Each operation records the condition report, status change, and audit event atomically.

-- Validate condition report content before saving it.
create or replace function public.submit_condition_report(
  p_booking_id uuid,
  p_phase text,
  p_overall text,
  p_notes text,
  p_checklist jsonb
)
returns public.condition_reports
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_booking public.bookings%rowtype;
  v_report public.condition_reports%rowtype;
begin
  if v_user_id is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  if p_phase not in ('BEFORE', 'AFTER')
     or p_overall not in ('GOOD', 'MINOR_WEAR', 'DAMAGED', 'MISSING_PARTS')
     or jsonb_typeof(p_checklist) <> 'array' then
    raise exception 'VALIDATION_ERROR: Invalid condition report';
  end if;

  -- Lock the booking so concurrent reports cannot race a state transition.
  select b.* into v_booking
  from public.bookings b
  where b.id = p_booking_id
  for update;

  if not found then
    raise exception 'NOT_FOUND: Booking not found';
  end if;

  if not exists (
    select 1 from public.resources r
    where r.id = v_booking.resource_id
      and (
        r.owner_id = v_user_id
        or v_booking.user_id = v_user_id
      )
  ) then
    raise exception 'FORBIDDEN: Not a booking participant';
  end if;

  -- Before reports are accepted for approved/check-in bookings;
  -- after reports are accepted only once the resource is checked in.
  if p_phase = 'BEFORE'
     and v_booking.status not in ('APPROVED', 'CHECKED_IN') then
    raise exception 'INVALID_TRANSITION: Booking is not ready for a before report';
  end if;

  if p_phase = 'AFTER' and v_booking.status <> 'CHECKED_IN' then
    raise exception 'INVALID_TRANSITION: Booking is not checked in';
  end if;

  -- Keep reports tied to the signed-in participant and phase.
  insert into public.condition_reports (
    booking_id, submitted_by, phase, overall, notes, checklist
  )
  values (
    p_booking_id, v_user_id, p_phase, p_overall,
    nullif(trim(p_notes), ''), p_checklist
  )
  returning * into v_report;

  insert into public.audit_events (
    booking_id, resource_id, actor_id, action, metadata
  )
  values (
    p_booking_id, v_booking.resource_id, v_user_id,
    'CONDITION_REPORT_SUBMITTED',
    jsonb_build_object('phase', p_phase, 'overall', p_overall)
  );

  return v_report;
end;
$$;


-- Check a resource out to its requester.
create or replace function public.check_in_booking(
  p_booking_id uuid,
  p_overall text,
  p_notes text default null,
  p_checklist jsonb default '[]'::jsonb
)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_booking public.bookings%rowtype;
  v_report public.condition_reports%rowtype;
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
    raise exception 'FORBIDDEN: Only the requester can check in';
  end if;

  if v_booking.status <> 'APPROVED' then
    raise exception 'INVALID_TRANSITION: Booking is not approved';
  end if;

  if now() < v_booking.start_at or now() >= v_booking.end_at then
    raise exception 'VALIDATION_ERROR: Outside the booking time window';
  end if;

  if p_overall not in ('GOOD', 'MINOR_WEAR', 'DAMAGED', 'MISSING_PARTS')
     or jsonb_typeof(p_checklist) <> 'array' then
    raise exception 'VALIDATION_ERROR: Invalid condition report';
  end if;

  -- Save the initial condition report before changing the booking state.
  insert into public.condition_reports (
    booking_id, submitted_by, phase, overall, notes, checklist
  )
  values (
    p_booking_id, v_user_id, 'BEFORE', p_overall,
    nullif(trim(p_notes), ''), p_checklist
  )
  returning * into v_report;

  update public.bookings
  set status = 'CHECKED_IN', checked_in_at = now()
  where id = p_booking_id
  returning * into v_booking;

  insert into public.audit_events (
    booking_id, resource_id, actor_id, action
  )
  values (
    p_booking_id, v_booking.resource_id, v_user_id, 'RESOURCE_CHECKED_IN'
  );

  return v_booking;
end;
$$;


-- Record the return condition and close the active checkout.
create or replace function public.return_booking(
  p_booking_id uuid,
  p_overall text,
  p_notes text default null,
  p_checklist jsonb default '[]'::jsonb
)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_booking public.bookings%rowtype;
  v_report public.condition_reports%rowtype;
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

  -- The requester or resource owner can record the return.
  if not exists (
    select 1 from public.resources r
    where r.id = v_booking.resource_id
      and (r.owner_id = v_user_id or v_booking.user_id = v_user_id)
  ) then
    raise exception 'FORBIDDEN: Not a booking participant';
  end if;

  if v_booking.status <> 'CHECKED_IN' then
    raise exception 'INVALID_TRANSITION: Resource is not checked in';
  end if;

  if p_overall not in ('GOOD', 'MINOR_WEAR', 'DAMAGED', 'MISSING_PARTS')
     or jsonb_typeof(p_checklist) <> 'array' then
    raise exception 'VALIDATION_ERROR: Invalid condition report';
  end if;

  -- Save the return report before marking the resource as returned.
  insert into public.condition_reports (
    booking_id, submitted_by, phase, overall, notes, checklist
  )
  values (
    p_booking_id, v_user_id, 'AFTER', p_overall,
    nullif(trim(p_notes), ''), p_checklist
  )
  returning * into v_report;

  update public.bookings
  set status = 'RETURNED', returned_at = now()
  where id = p_booking_id
  returning * into v_booking;

  insert into public.audit_events (
    booking_id, resource_id, actor_id, action, metadata
  )
  values (
    p_booking_id, v_booking.resource_id, v_user_id,
    'RESOURCE_RETURNED',
    jsonb_build_object('condition', p_overall)
  );

  return v_booking;
end;
$$;


-- Prevent anonymous users from calling the new privileged functions.
revoke all on function public.submit_condition_report(uuid, text, text, text, jsonb)
  from public, anon;
revoke all on function public.check_in_booking(uuid, text, text, jsonb)
  from public, anon;
revoke all on function public.return_booking(uuid, text, text, jsonb)
  from public, anon;

grant execute on function public.submit_condition_report(uuid, text, text, text, jsonb)
  to authenticated;
grant execute on function public.check_in_booking(uuid, text, text, jsonb)
  to authenticated;
grant execute on function public.return_booking(uuid, text, text, jsonb)
  to authenticated;
