-- Cache both auth helpers once per statement so RLS remains fast at scale.
drop policy teacher_workspaces_select_own on public.teacher_workspaces;
drop policy teacher_workspaces_insert_own on public.teacher_workspaces;
drop policy teacher_workspaces_update_own on public.teacher_workspaces;

create policy teacher_workspaces_select_own
on public.teacher_workspaces
for select
to authenticated
using (
  owner_id = (select auth.uid())
  and coalesce((((select auth.jwt()) ->> 'is_anonymous')::boolean), false) = false
);

create policy teacher_workspaces_insert_own
on public.teacher_workspaces
for insert
to authenticated
with check (
  owner_id = (select auth.uid())
  and coalesce((((select auth.jwt()) ->> 'is_anonymous')::boolean), false) = false
);

create policy teacher_workspaces_update_own
on public.teacher_workspaces
for update
to authenticated
using (
  owner_id = (select auth.uid())
  and coalesce((((select auth.jwt()) ->> 'is_anonymous')::boolean), false) = false
)
with check (
  owner_id = (select auth.uid())
  and coalesce((((select auth.jwt()) ->> 'is_anonymous')::boolean), false) = false
);
