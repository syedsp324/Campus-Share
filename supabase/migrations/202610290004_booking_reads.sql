-- Read helpers for booking screens. These expose only bookings the caller may see.
-- Keep writes in the existing request/decision/check-in/return functions.

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
    select b.id, b.resource_id, r.name,
      b.user_id, coalesce(nullif(p.full_name, ''), 'Student'),
      b.start_at, b.end_at, b.purpose, b.status,
      b.decision_reason, b.priority_score, b.checked_in_at, b.returned_at
    from public.bookings b
    join public.resources r on r.id = b.resource_id
    join public.profiles p on p.id = b.user_id
    where
      (p_scope = 'mine' and b.user_id = auth.uid())
      or (
        p_scope = 'owner_requests'
        and b.status in ('REQUESTED', 'VERIFYING', 'PENDING_REVIEW')
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
    order by b.created_at desc;
end;
$$;

create or replace function public.get_booking_detail(p_booking_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_role text;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  select b.* into v_booking
  from public.bookings b
  where b.id = p_booking_id;

  if not found then
    return null;
  end if;

  select p.role into v_role
  from public.profiles p
  where p.id = auth.uid();

  if v_booking.user_id <> auth.uid()
     and not exists (
       select 1 from public.resources r
       where r.id = v_booking.resource_id and r.owner_id = auth.uid()
     )
     and coalesce(v_role, '') not in ('manager', 'admin') then
    return null;
  end if;

  return jsonb_build_object(
    'booking', to_jsonb(v_booking),
    'resource_name', (
      select r.name from public.resources r where r.id = v_booking.resource_id
    ),
    'requester_name', (
      select coalesce(nullif(p.full_name, ''), 'Student')
      from public.profiles p where p.id = v_booking.user_id
    ),
    'reports', coalesce((
      select jsonb_agg(jsonb_build_object(
        'phase', c.phase, 'overall', c.overall, 'notes', c.notes,
        'checklist', c.checklist
      ) order by c.created_at)
      from public.condition_reports c where c.booking_id = v_booking.id
    ), '[]'::jsonb),
    'timeline', coalesce((
      select jsonb_agg(jsonb_build_object(
        'action', a.action, 'reason', a.reason,
        'actor', coalesce(nullif(p.full_name, ''), 'System'),
        'at', a.created_at
      ) order by a.created_at)
      from public.audit_events a
      left join public.profiles p on p.id = a.actor_id
      where a.booking_id = v_booking.id
    ), '[]'::jsonb)
  );
end;
$$;

-- Expose only slot availability, not the identity or details of another booking.
create or replace function public.is_booking_slot_available(
  p_resource_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and p_start_at is not null
    and p_end_at > p_start_at
    and exists (
      select 1 from public.resources r
      where r.id = p_resource_id
        and (
          r.is_active
          or r.owner_id = auth.uid()
          or exists (
            select 1 from public.profiles actor
            where actor.id = auth.uid()
              and actor.role in ('manager', 'admin')
          )
        )
    )
    and not exists (
      select 1 from public.bookings b
      where b.resource_id = p_resource_id
        and b.status in ('APPROVED', 'CHECKED_IN')
        and b.start_at < p_end_at
        and b.end_at > p_start_at
    );
$$;

revoke all on function public.list_booking_summaries(text) from public, anon;
revoke all on function public.get_booking_detail(uuid) from public, anon;
revoke all on function public.is_booking_slot_available(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.list_booking_summaries(text) to authenticated;
grant execute on function public.get_booking_detail(uuid) to authenticated;
grant execute on function public.is_booking_slot_available(uuid, timestamptz, timestamptz) to authenticated;
