-- Run snapshot writes with the signed-in user's privileges. RLS remains the
-- security boundary, including when the private implementation function is
-- called directly from a database connection.

alter function private.replace_workspace_snapshot(uuid, jsonb, timestamptz)
  security invoker;
alter function public.save_personal_workspace_snapshot(jsonb)
  security invoker;

grant execute on function private.replace_workspace_snapshot(uuid, jsonb, timestamptz)
  to authenticated;

grant update on table public.workspaces to authenticated;

create policy workspaces_update_owner
on public.workspaces for update to authenticated
using (
  owner_user_id = (select auth.uid())
  and (select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)) = false
)
with check (
  owner_user_id = (select auth.uid())
  and workspace_type = 'personal'
  and (select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)) = false
);

drop policy workspaces_insert_personal on public.workspaces;
create policy workspaces_insert_personal
on public.workspaces for insert to authenticated
with check (
  owner_user_id = (select auth.uid())
  and workspace_type = 'personal'
  and (select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)) = false
);

drop policy workspace_members_select_self on public.workspace_members;
create policy workspace_members_select_self
on public.workspace_members for select to authenticated
using (
  user_id = (select auth.uid())
  and (select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)) = false
);

create index assessment_scores_rubric_domain_idx
  on public.assessment_scores (rubric_domain_id)
  where rubric_domain_id is not null;
create index assessments_rubric_id_idx
  on public.assessments (rubric_id);
create index assessments_rubric_version_idx
  on public.assessments (rubric_version_id)
  where rubric_version_id is not null;
create index assessments_series_idx
  on public.assessments (workspace_id, series_id)
  where series_id is not null;
create index lesson_series_rubric_id_idx
  on public.lesson_series (rubric_id);
create index lesson_series_rubric_version_idx
  on public.lesson_series (rubric_version_id)
  where rubric_version_id is not null;
