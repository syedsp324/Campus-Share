begin;

create extension if not exists pgtap with schema extensions;
select plan(7);

-- Isolated auth users exercise the same auth.uid() checks used by RPC calls.
insert into auth.users (id, email, raw_user_meta_data)
values
  ('a0000000-0000-4000-8000-000000000001', 'pgtap-overlap-owner@campusshare.test', '{"full_name":"Test Owner"}'),
  ('a0000000-0000-4000-8000-000000000002', 'pgtap-overlap-user@campusshare.test', '{"full_name":"Overlap User"}'),
  ('a0000000-0000-4000-8000-000000000003', 'pgtap-quota-owner@campusshare.test', '{"full_name":"Test Owner"}'),
  ('a0000000-0000-4000-8000-000000000004', 'pgtap-quota-user@campusshare.test', '{"full_name":"Quota User"}'),
  ('a0000000-0000-4000-8000-000000000005', 'pgtap-transition-owner@campusshare.test', '{"full_name":"Test Owner"}'),
  ('a0000000-0000-4000-8000-000000000006', 'pgtap-transition-user@campusshare.test', '{"full_name":"Transition User"}'),
  ('a0000000-0000-4000-8000-000000000007', 'pgtap-waitlist-owner@campusshare.test', '{"full_name":"Test Owner"}'),
  ('a0000000-0000-4000-8000-000000000008', 'pgtap-waitlist-user@campusshare.test', '{"full_name":"Waitlist User"}');

update public.profiles
set role = 'owner'
where id in (
  'a0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000003',
  'a0000000-0000-4000-8000-000000000005',
  'a0000000-0000-4000-8000-000000000007'
);

insert into public.resources (
  id, owner_id, name, category, max_active_bookings_per_user
)
values
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Overlap fixture', 'CAMERA', 4),
  ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000003', 'Quota fixture', 'CAMERA', 1),
  ('b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000005', 'Transition fixture', 'CAMERA', 4),
  ('b0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000007', 'Waitlist fixture', 'CAMERA', 4);

-- Two requests may share a requested interval, but only one can be approved.
insert into public.bookings (
  id, resource_id, user_id, start_at, end_at, purpose, status
)
values
  ('c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', now() + interval '10 days', now() + interval '11 days', 'COURSEWORK', 'REQUESTED'),
  ('c0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', now() + interval '10 days', now() + interval '11 days', 'RESEARCH', 'REQUESTED'),
  ('c0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000004', now() + interval '12 days', now() + interval '13 days', 'COURSEWORK', 'REQUESTED'),
  ('c0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000006', now() + interval '14 days', now() + interval '15 days', 'COURSEWORK', 'REQUESTED'),
  ('c0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000008', now() + interval '20 days', now() + interval '21 days', 'STUDENT_PROJECT', 'APPROVED'),
  ('c0000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000008', now() + interval '20 days', now() + interval '21 days', 'RESEARCH', 'WAITLISTED'),
  ('c0000000-0000-4000-8000-000000000007', 'b0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000008', now() + interval '20 days', now() + interval '21 days', 'COURSEWORK', 'WAITLISTED');

insert into public.bookings (
  id, resource_id, user_id, start_at, end_at, purpose, status
)
values (
  'c0000000-0000-4000-8000-000000000009',
  'b0000000-0000-4000-8000-000000000002',
  'a0000000-0000-4000-8000-000000000004',
  now() + interval '18 days', now() + interval '19 days', 'COURSEWORK', 'REQUESTED'
);

update public.bookings
set created_at = now() - interval '5 days', priority_score = 0
where id = 'c0000000-0000-4000-8000-000000000006';

update public.bookings
set created_at = now() - interval '1 day', priority_score = 0
where id = 'c0000000-0000-4000-8000-000000000007';

-- Recent use lowers score; this returned booking remains non-overlapping.
insert into public.bookings (
  id, resource_id, user_id, start_at, end_at, purpose, status, returned_at
)
values (
  'c0000000-0000-4000-8000-000000000008',
  'b0000000-0000-4000-8000-000000000004',
  'a0000000-0000-4000-8000-000000000008',
  now() - interval '2 days', now() - interval '1 day', 'OTHER', 'RETURNED', now() - interval '1 day'
);

-- A successful approval followed by an overlapping approval must be rejected
-- by PostgreSQL's exclusion constraint even when both requests already exist.
set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000001';
select lives_ok(
  $$select public.decide_booking('c0000000-0000-4000-8000-000000000001', 'APPROVE', 'Test approval')$$,
  'The first non-overlapping approval succeeds'
);
select throws_ok(
  $$select public.decide_booking('c0000000-0000-4000-8000-000000000002', 'APPROVE', 'Test overlap')$$,
  '23P01',
  'conflicting key value violates exclusion constraint "no_overlapping_active_bookings"',
  'An overlapping approval is rejected'
);

-- A request already at the configured active-booking limit cannot be followed
-- by another request for the same user.
set local request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000004';
select throws_ok(
  $$select public.request_booking(
    'b0000000-0000-4000-8000-000000000002',
    now() + interval '16 days',
    now() + interval '17 days',
    'COURSEWORK',
    'Quota test',
    null
  )$$,
  'P0001',
  'QUOTA_EXCEEDED: Too many active bookings',
  'The active-booking quota is enforced'
);

-- Returning a booking that has not been checked in is an invalid transition.
set local request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000006';
select throws_ok(
  $$select public.return_booking('c0000000-0000-4000-8000-000000000004', 'GOOD', null, '[]'::jsonb)$$,
  'P0001',
  'INVALID_TRANSITION: Resource is not checked in',
  'An invalid state transition is rejected'
);

-- Cancelling an approved booking promotes the eligible waitlist candidate with
-- the highest recomputed score (wait time minus recent use).
set local request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000008';
select lives_ok(
  $$select public.cancel_booking('c0000000-0000-4000-8000-000000000005', 'Reviewer test cancellation')$$,
  'Cancelling an approved booking completes successfully'
);
select is(
  (select status from public.bookings where id = 'c0000000-0000-4000-8000-000000000006'),
  'APPROVED',
  'The higher-scoring waitlist request is promoted'
);
select is(
  (select status from public.bookings where id = 'c0000000-0000-4000-8000-000000000007'),
  'WAITLISTED',
  'The other waitlist request remains queued'
);

select * from finish();
rollback;
