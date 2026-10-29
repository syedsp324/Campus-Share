-- CampusShare: initial database schema
create extension if not exists btree_gist;

-- 1. User profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'user'
    check (role in ('user', 'manager', 'owner', 'admin')),
  created_at timestamptz not null default now()
);

-- Create a profile when a Supabase Auth user is created.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. Resources
create table public.resources (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id),
  name text not null,
  category text not null check (
    category in (
      'LAB', 'MAKERSPACE_TOOL', 'CAMERA',
      'COMPUTER', 'ROOM', 'TEST_DEVICE'
    )
  ),
  description text,
  location text,
  photo_url text,
  usage_rules text,
  requires_staff_present boolean not null default false,
  is_high_demand boolean not null default false,
  is_active boolean not null default true,
  deposit_amount numeric(10,2) not null default 0
    check (deposit_amount >= 0),
  max_hours_per_user_per_week integer not null default 5
    check (max_hours_per_user_per_week > 0),
  max_active_bookings_per_user integer not null default 2
    check (max_active_bookings_per_user > 0),
  max_booking_length_hours integer not null default 4
    check (max_booking_length_hours > 0),
  created_at timestamptz not null default now()
);

-- 3. Bookings
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.resources(id),
  user_id uuid not null references public.profiles(id),
  start_at timestamptz not null,
  end_at timestamptz not null,
  purpose text not null check (
    purpose in ('COURSEWORK', 'RESEARCH', 'STUDENT_PROJECT', 'OTHER')
  ),
  purpose_note text,
  team_name text,
  status text not null default 'REQUESTED' check (
    status in (
      'REQUESTED', 'VERIFYING', 'PENDING_REVIEW',
      'APPROVED', 'REJECTED', 'WAITLISTED',
      'CHECKED_IN', 'RETURNED', 'CLOSED',
      'CANCELLED', 'OVERDUE', 'DISPUTED'
    )
  ),
  decision_reason text,
  priority_score numeric,
  checked_in_at timestamptz,
  returned_at timestamptz,
  created_at timestamptz not null default now(),
  check (start_at < end_at)
);

-- Prevent overlapping approved or checked-in bookings
-- for the same resource, even under concurrent requests.
alter table public.bookings
  add constraint no_overlapping_active_bookings
  exclude using gist (
    resource_id with =,
    tstzrange(start_at, end_at, '[)') with &&
  )
  where (status in ('APPROVED', 'CHECKED_IN'));

-- 4. Before/after condition reports
create table public.condition_reports (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id),
  submitted_by uuid not null references public.profiles(id),
  phase text not null check (phase in ('BEFORE', 'AFTER')),
  overall text not null check (
    overall in ('GOOD', 'MINOR_WEAR', 'DAMAGED', 'MISSING_PARTS')
  ),
  notes text,
  checklist jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (booking_id, submitted_by, phase)
);

-- 5. Append-only audit history
create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings(id),
  resource_id uuid references public.resources(id),
  actor_id uuid references public.profiles(id),
  action text not null,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (booking_id is not null or resource_id is not null)
);

-- Enable Row Level Security on every application table.
alter table public.profiles enable row level security;
alter table public.resources enable row level security;
alter table public.bookings enable row level security;
alter table public.condition_reports enable row level security;
alter table public.audit_events enable row level security;

-- Profiles: users can read their own profile.
create policy "Users read own profile"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

-- Resources: active resources are discoverable;
-- owners can also see their own inactive resources.
create policy "Discover active resources"
  on public.resources for select
  to authenticated
  using (
    is_active
    or owner_id = (select auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('manager', 'admin')
    )
  );

-- Resource creation is limited to owners and admins.
create policy "Owners create resources"
  on public.resources for insert
  to authenticated
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('owner', 'admin')
    )
  );

create policy "Owners update own resources"
  on public.resources for update
  to authenticated
  using (
    owner_id = (select auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'admin'
    )
  )
  with check (
    owner_id = (select auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'admin'
    )
  );

-- Bookings: requesters and authorized resource managers can read.
create policy "Participants read bookings"
  on public.bookings for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.resources r
      where r.id = resource_id
        and r.owner_id = (select auth.uid())
    )
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('manager', 'admin')
    )
  );

-- Students can submit new requests, but cannot choose a
-- privileged initial status or create bookings for others.
create policy "Students request bookings"
  on public.bookings for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'REQUESTED'
    and start_at > now()
    and exists (
      select 1 from public.resources r
      where r.id = resource_id
        and r.is_active = true
    )
  );

-- Condition reports can be read by booking participants.
create policy "Participants read condition reports"
  on public.condition_reports for select
  to authenticated
  using (
    exists (
      select 1
      from public.bookings b
      join public.resources r on r.id = b.resource_id
      where b.id = booking_id
        and (
          b.user_id = (select auth.uid())
          or r.owner_id = (select auth.uid())
          or exists (
            select 1 from public.profiles p
            where p.id = (select auth.uid())
              and p.role in ('manager', 'admin')
          )
        )
    )
  );

-- Audit events are readable by relevant booking/resource parties.
create policy "Participants read audit events"
  on public.audit_events for select
  to authenticated
  using (
    exists (
      select 1
      from public.bookings b
      join public.resources r on r.id = b.resource_id
      where b.id = booking_id
        and (
          b.user_id = (select auth.uid())
          or r.owner_id = (select auth.uid())
          or exists (
            select 1 from public.profiles p
            where p.id = (select auth.uid())
              and p.role in ('manager', 'admin')
          )
        )
    )
    or exists (
      select 1 from public.resources r
      where r.id = resource_id
        and (
          r.owner_id = (select auth.uid())
          or exists (
            select 1 from public.profiles p
            where p.id = (select auth.uid())
              and p.role in ('manager', 'admin')
          )
        )
    )
  );

-- Indexes for common application queries.
create index resources_owner_id_idx
  on public.resources(owner_id);

create index resources_active_category_idx
  on public.resources(is_active, category);

create index bookings_user_status_idx
  on public.bookings(user_id, status);

create index bookings_resource_dates_idx
  on public.bookings(resource_id, start_at, end_at);

create index audit_events_booking_created_idx
  on public.audit_events(booking_id, created_at);