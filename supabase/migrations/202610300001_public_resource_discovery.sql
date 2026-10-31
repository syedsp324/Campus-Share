-- Let signed-out visitors discover active resources without exposing owner
-- identities, deposits, or per-user booking limits through the public API.
revoke all on table public.resources from anon;

grant select (
  id,
  name,
  category,
  description,
  location,
  photo_url,
  usage_rules,
  requires_staff_present,
  is_high_demand,
  is_active,
  max_booking_length_hours
) on table public.resources to anon;

create policy "Public can discover active resources"
  on public.resources for select
  to anon
  using (is_active = true);
