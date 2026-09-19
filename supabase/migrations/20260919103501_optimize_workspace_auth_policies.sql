-- Cache auth.jwt() once per statement in these policies, matching the same
-- init-plan optimization already used for auth.uid().

drop policy workspaces_insert_personal on public.workspaces;
create policy workspaces_insert_personal
on public.workspaces for insert to authenticated
with check (
  owner_user_id = (select auth.uid())
  and workspace_type = 'personal'
  and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
);

drop policy workspace_members_select_self on public.workspace_members;
create policy workspace_members_select_self
on public.workspace_members for select to authenticated
using (
  user_id = (select auth.uid())
  and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
);
