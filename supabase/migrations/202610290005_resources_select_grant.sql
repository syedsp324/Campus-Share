-- Allow signed-in users to query resources; RLS still limits visible rows.
grant select on table public.resources to authenticated;
