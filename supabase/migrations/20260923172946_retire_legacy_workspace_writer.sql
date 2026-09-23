-- The deployed client now writes targeted patches through the revision-checked RPC.
-- Disable the legacy whole-snapshot endpoint so stale clients cannot overwrite
-- concurrent changes by replacing an entire personal workspace.
revoke all on function public.save_personal_workspace_snapshot(jsonb)
  from public, anon, authenticated;

comment on function public.save_personal_workspace_snapshot(jsonb) is
  'Retired legacy writer. Kept for rollback analysis but not executable by API roles.';
