-- Optional reviewer fixtures for the pre-provisioned CampusShare demo accounts.
-- Run only against the intended demo project, after all migrations.
-- Reruns replace only the rows with the fixture IDs below.
begin;

do $$
declare
  v_user_id uuid;
  v_owner_id uuid;
  v_resource_id uuid;
  v_base timestamptz := date_trunc('hour', now()) + interval '1 hour';
begin
  select id into v_user_id
  from auth.users
  where lower(email) = 'demo.student@campusshare.test'
  limit 1;

  select id into v_owner_id
  from auth.users
  where lower(email) = 'demo.owner@campusshare.test'
  limit 1;

  if v_user_id is null or v_owner_id is null then
    raise exception 'Reviewer fixtures require demo.student and demo.owner accounts to exist first.';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = v_owner_id and p.role in ('owner', 'admin', 'manager')
  ) then
    raise exception 'The demo.owner account must have an owner, manager, or admin role before loading reviewer fixtures.';
  end if;

  select r.id into v_resource_id
  from public.resources r
  where r.owner_id = v_owner_id and r.is_active
  order by r.created_at, r.id
  limit 1;

  if v_resource_id is null then
    raise exception 'Create at least one active resource owned by demo.owner before loading reviewer fixtures.';
  end if;

  -- Do not force a synthetic live checkout into an occupied resource slot.
  if exists (
    select 1 from public.bookings b
    where b.resource_id = v_resource_id
      and b.status in ('APPROVED', 'CHECKED_IN')
      and b.start_at < now() + interval '1 hour'
      and b.end_at > now()
      and b.id not between 'd0000000-0000-4000-8000-000000000001'::uuid
                        and 'd0000000-0000-4000-8000-000000000014'::uuid
  ) then
    raise exception 'The demo resource is occupied now; choose a free demo resource before loading fixtures.';
  end if;

  if exists (
    select 1 from public.bookings b
    where b.resource_id = v_resource_id
      and b.status in ('APPROVED', 'CHECKED_IN')
      and b.start_at < v_base + interval '16 days'
      and b.end_at > v_base + interval '15 days'
      and b.id not between 'd0000000-0000-4000-8000-000000000001'::uuid
                        and 'd0000000-0000-4000-8000-000000000014'::uuid
  ) then
    raise exception 'The demo resource has an existing booking in the reviewer fixture slot; choose another active demo resource.';
  end if;

  delete from public.audit_events where booking_id in (
    'd0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002',
    'd0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000004',
    'd0000000-0000-4000-8000-000000000005', 'd0000000-0000-4000-8000-000000000006',
    'd0000000-0000-4000-8000-000000000007', 'd0000000-0000-4000-8000-000000000008',
    'd0000000-0000-4000-8000-000000000009', 'd0000000-0000-4000-8000-000000000010',
    'd0000000-0000-4000-8000-000000000011', 'd0000000-0000-4000-8000-000000000012',
    'd0000000-0000-4000-8000-000000000013', 'd0000000-0000-4000-8000-000000000014'
  );
  delete from public.condition_reports where booking_id in (
    'd0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002',
    'd0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000004',
    'd0000000-0000-4000-8000-000000000005', 'd0000000-0000-4000-8000-000000000006',
    'd0000000-0000-4000-8000-000000000007', 'd0000000-0000-4000-8000-000000000008',
    'd0000000-0000-4000-8000-000000000009', 'd0000000-0000-4000-8000-000000000010',
    'd0000000-0000-4000-8000-000000000011', 'd0000000-0000-4000-8000-000000000012',
    'd0000000-0000-4000-8000-000000000013', 'd0000000-0000-4000-8000-000000000014'
  );
  delete from public.bookings where id in (
    'd0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002',
    'd0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000004',
    'd0000000-0000-4000-8000-000000000005', 'd0000000-0000-4000-8000-000000000006',
    'd0000000-0000-4000-8000-000000000007', 'd0000000-0000-4000-8000-000000000008',
    'd0000000-0000-4000-8000-000000000009', 'd0000000-0000-4000-8000-000000000010',
    'd0000000-0000-4000-8000-000000000011', 'd0000000-0000-4000-8000-000000000012',
    'd0000000-0000-4000-8000-000000000013', 'd0000000-0000-4000-8000-000000000014'
  );

  insert into public.bookings (
    id, resource_id, user_id, start_at, end_at, purpose, purpose_note, status,
    decision_reason, priority_score, checked_in_at, returned_at, created_at
  ) values
    ('d0000000-0000-4000-8000-000000000001', v_resource_id, v_user_id, v_base + interval '7 days', v_base + interval '8 days', 'COURSEWORK', 'Reviewer fixture: awaiting owner review.', 'REQUESTED', null, null, null, null, now() - interval '3 hours'),
    ('d0000000-0000-4000-8000-000000000002', v_resource_id, v_user_id, v_base + interval '9 days', v_base + interval '10 days', 'RESEARCH', 'Reviewer fixture: awaiting owner review.', 'REQUESTED', null, null, null, null, now() - interval '2 hours'),
    ('d0000000-0000-4000-8000-000000000003', v_resource_id, v_user_id, v_base + interval '15 days', v_base + interval '16 days', 'STUDENT_PROJECT', 'Reviewer fixture: approved upcoming booking.', 'APPROVED', 'Reviewer demo approval.', null, null, null, now() - interval '2 days'),
    ('d0000000-0000-4000-8000-000000000004', v_resource_id, v_user_id, now() - interval '15 minutes', now() + interval '45 minutes', 'COURSEWORK', 'Reviewer fixture: active checkout.', 'CHECKED_IN', 'Reviewer demo approval.', null, now() - interval '10 minutes', null, now() - interval '1 hour'),
    ('d0000000-0000-4000-8000-000000000005', v_resource_id, v_user_id, now() - interval '3 days', now() - interval '2 days', 'RESEARCH', 'Reviewer fixture: completed booking.', 'RETURNED', 'Reviewer demo approval.', null, now() - interval '3 days', now() - interval '2 days', now() - interval '4 days'),
    ('d0000000-0000-4000-8000-000000000006', v_resource_id, v_user_id, now() - interval '10 days', now() - interval '9 days', 'COURSEWORK', 'Reviewer fixture: closed booking.', 'CLOSED', 'Reviewer demo approval.', null, now() - interval '10 days', now() - interval '9 days', now() - interval '11 days'),
    ('d0000000-0000-4000-8000-000000000007', v_resource_id, v_user_id, v_base + interval '15 days', v_base + interval '16 days', 'OTHER', 'Reviewer fixture: waitlist position one.', 'WAITLISTED', 'Reviewer demo waitlist.', 10.00, null, null, now() - interval '10 days'),
    ('d0000000-0000-4000-8000-000000000008', v_resource_id, v_user_id, v_base + interval '15 days', v_base + interval '16 days', 'STUDENT_PROJECT', 'Reviewer fixture: waitlist position two.', 'WAITLISTED', 'Reviewer demo waitlist.', 2.00, null, null, now() - interval '2 days'),
    ('d0000000-0000-4000-8000-000000000009', v_resource_id, v_user_id, v_base + interval '20 days', v_base + interval '21 days', 'COURSEWORK', 'Reviewer fixture: declined request.', 'REJECTED', 'Reviewer demo decline.', null, null, null, now() - interval '5 days'),
    ('d0000000-0000-4000-8000-000000000010', v_resource_id, v_user_id, v_base + interval '22 days', v_base + interval '23 days', 'RESEARCH', 'Reviewer fixture: cancelled request.', 'CANCELLED', 'Reviewer demo cancellation.', null, null, null, now() - interval '6 days'),
    ('d0000000-0000-4000-8000-000000000011', v_resource_id, v_user_id, now() - interval '2 days', now() - interval '1 day', 'OTHER', 'Reviewer fixture: overdue state.', 'OVERDUE', 'Reviewer demo overdue fixture.', null, now() - interval '2 days', null, now() - interval '3 days'),
    ('d0000000-0000-4000-8000-000000000012', v_resource_id, v_user_id, v_base + interval '25 days', v_base + interval '26 days', 'RESEARCH', 'Reviewer fixture: disputed state.', 'DISPUTED', 'Reviewer demo dispute fixture.', null, null, null, now() - interval '7 days'),
    ('d0000000-0000-4000-8000-000000000013', v_resource_id, v_user_id, v_base + interval '27 days', v_base + interval '28 days', 'COURSEWORK', 'Reviewer fixture: legacy verification state.', 'VERIFYING', null, null, null, null, now() - interval '8 days'),
    ('d0000000-0000-4000-8000-000000000014', v_resource_id, v_user_id, v_base + interval '29 days', v_base + interval '30 days', 'STUDENT_PROJECT', 'Reviewer fixture: legacy pending review state.', 'PENDING_REVIEW', null, null, null, null, now() - interval '9 days');

  insert into public.condition_reports (booking_id, submitted_by, phase, overall, notes, checklist)
  values
    ('d0000000-0000-4000-8000-000000000004', v_user_id, 'BEFORE', 'GOOD', 'Fixture condition report for reviewer walkthrough.', '[]'::jsonb),
    ('d0000000-0000-4000-8000-000000000005', v_user_id, 'BEFORE', 'GOOD', 'Fixture condition report for reviewer walkthrough.', '[]'::jsonb),
    ('d0000000-0000-4000-8000-000000000005', v_user_id, 'AFTER', 'GOOD', 'Fixture condition report for reviewer walkthrough.', '[]'::jsonb);

  insert into public.audit_events (booking_id, resource_id, actor_id, action, reason, metadata)
  select b.id, b.resource_id, case when b.status in ('REQUESTED', 'CANCELLED') then v_user_id else v_owner_id end,
    'REVIEWER_FIXTURE_' || b.status, b.decision_reason, '{}'::jsonb
  from public.bookings b
  where b.id between 'd0000000-0000-4000-8000-000000000001'::uuid and 'd0000000-0000-4000-8000-000000000014'::uuid;
end;
$$;

commit;
