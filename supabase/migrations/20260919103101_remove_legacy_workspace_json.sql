-- The RPC-based frontend is deployed and all legacy IDs and assessment values
-- have been verified against their normalized equivalents. Remove the
-- temporary compatibility bridge and the obsolete JSON document table.

drop trigger if exists teacher_workspaces_sync_normalized
  on public.teacher_workspaces;

drop function if exists private.sync_legacy_teacher_workspace();

drop table public.teacher_workspaces;
