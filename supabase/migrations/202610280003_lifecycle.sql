-- CampusShare migration 3: check-in / return / condition reports / read helpers.
-- Additive + idempotent (create or replace). Safe to run once on top of 0001 + 0002.

-- Can the caller manage this resource? (its owner, or a manager/admin)
create or replace function public.can_manage_resource(p_resource_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.resources r where r.id = p_resource_id and r.owner_id = auth.uid())
      or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('manager','admin'));
$$;

-- Read helper: RLS hides other users' profiles, so names are joined here safely.
-- scope 'mine' = my bookings; 'owner_active' = approved/checked-in I can manage; 'owner_requests' = REQUESTED I can decide.
create or replace function public.list_bookings(p_scope text default 'mine')
returns table (id uuid, resource_id uuid, resource_name text, user_id uuid, requester_name text,
  start_at timestamptz, end_at timestamptz, purpose text, status text, decision_reason text,
  priority_score numeric, checked_in_at timestamptz, returned_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select b.id, b.resource_id, r.name, b.user_id, coalesce(nullif(p.full_name,''),'Student'),
         b.start_at, b.end_at, b.purpose, b.status, b.decision_reason, b.priority_score, b.checked_in_at, b.returned_at
  from public.bookings b
  join public.resources r on r.id = b.resource_id
  join public.profiles p on p.id = b.user_id
  where auth.uid() is not null and (
    (p_scope = 'mine' and b.user_id = auth.uid())
    or (p_scope = 'owner_active' and b.status in ('APPROVED','CHECKED_IN') and public.can_manage_resource(b.resource_id))
    or (p_scope = 'owner_requests' and b.status = 'REQUESTED' and public.can_manage_resource(b.resource_id)))
  order by b.start_at desc;
$$;

-- One call for the booking page: booking + condition reports + audit timeline.
create or replace function public.get_booking_detail(p_booking_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare b public.bookings;
begin
  select * into b from public.bookings where id = p_booking_id;
  if not found or not (b.user_id = auth.uid() or public.can_manage_resource(b.resource_id)) then return null; end if;
  return jsonb_build_object(
    'booking', to_jsonb(b),
    'resource_name', (select name from public.resources where id = b.resource_id),
    'requester_name', (select coalesce(nullif(full_name,''),'Student') from public.profiles where id = b.user_id),
    'reports', coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at) from public.condition_reports c where c.booking_id = b.id), '[]'),
    'timeline', coalesce((select jsonb_agg(jsonb_build_object('action', a.action, 'reason', a.reason,
        'actor', coalesce(nullif(pp.full_name,''),'System'), 'at', a.created_at) order by a.created_at)
      from public.audit_events a left join public.profiles pp on pp.id = a.actor_id where a.booking_id = b.id), '[]'));
end $$;

-- Check-in: APPROVED -> CHECKED_IN, with the BEFORE condition report, in one transaction.
create or replace function public.check_in_booking(p_booking_id uuid, p_overall text,
  p_notes text default null, p_checklist jsonb default '[]'::jsonb)
returns public.bookings language plpgsql security definer set search_path = '' as $$
declare b public.bookings;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  select * into b from public.bookings where id = p_booking_id for update;   -- lock row vs double check-in
  if not found then raise exception 'NOT_FOUND'; end if;
  if not public.can_manage_resource(b.resource_id) then raise exception 'FORBIDDEN'; end if;
  if b.status <> 'APPROVED' then raise exception 'INVALID_TRANSITION'; end if;
  -- DEMO TIP: widen this window (e.g. '2 hours') if you need to check in earlier while testing.
  if now() < b.start_at - interval '15 minutes' or now() >= b.end_at then
    raise exception 'VALIDATION_ERROR: Check-in opens 15 minutes before the booking starts.'; end if;
  insert into public.condition_reports (booking_id, submitted_by, phase, overall, notes, checklist)
    values (b.id, auth.uid(), 'BEFORE', p_overall, p_notes, coalesce(p_checklist,'[]'::jsonb));
  update public.bookings set status = 'CHECKED_IN', checked_in_at = now() where id = b.id returning * into b;
  insert into public.audit_events (booking_id, resource_id, actor_id, action, metadata)
    values (b.id, b.resource_id, auth.uid(), 'BOOKING_CHECKED_IN', jsonb_build_object('condition', p_overall));
  return b;
end $$;

-- Return: CHECKED_IN -> RETURNED, with the AFTER report. Damage is flagged in the audit log for review.
create or replace function public.return_booking(p_booking_id uuid, p_overall text,
  p_notes text default null, p_checklist jsonb default '[]'::jsonb)
returns public.bookings language plpgsql security definer set search_path = '' as $$
declare b public.bookings;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  select * into b from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if not public.can_manage_resource(b.resource_id) then raise exception 'FORBIDDEN'; end if;
  if b.status <> 'CHECKED_IN' then raise exception 'INVALID_TRANSITION'; end if;
  insert into public.condition_reports (booking_id, submitted_by, phase, overall, notes, checklist)
    values (b.id, auth.uid(), 'AFTER', p_overall, p_notes, coalesce(p_checklist,'[]'::jsonb));
  update public.bookings set status = 'RETURNED', returned_at = now() where id = b.id returning * into b;
  insert into public.audit_events (booking_id, resource_id, actor_id, action, metadata)
    values (b.id, b.resource_id, auth.uid(), 'BOOKING_RETURNED',
            jsonb_build_object('condition', p_overall, 'needs_review', p_overall in ('DAMAGED','MISSING_PARTS')));
  return b;
end $$;

-- Least privilege: only signed-in users may execute.
revoke all on function public.can_manage_resource(uuid), public.list_bookings(text), public.get_booking_detail(uuid),
  public.check_in_booking(uuid,text,text,jsonb), public.return_booking(uuid,text,text,jsonb) from public, anon;
grant execute on function public.can_manage_resource(uuid), public.list_bookings(text), public.get_booking_detail(uuid),
  public.check_in_booking(uuid,text,text,jsonb), public.return_booking(uuid,text,text,jsonb) to authenticated;
