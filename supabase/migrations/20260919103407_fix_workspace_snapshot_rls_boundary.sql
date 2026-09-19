-- Keep the exposed RPC as SECURITY INVOKER while a private, identity-bound
-- helper performs the atomic replacement. The helper has no owner parameter:
-- even a direct authenticated call can only mutate auth.uid()'s workspace.

alter function private.replace_workspace_snapshot(uuid, jsonb, timestamptz)
  security definer;
revoke all on function private.replace_workspace_snapshot(uuid, jsonb, timestamptz)
  from public, anon, authenticated;

create function private.replace_current_workspace_snapshot(
  payload jsonb,
  target_updated_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
begin
  if caller_id is null
     or coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) then
    raise exception 'Authenticatie vereist.' using errcode = '42501';
  end if;

  return private.replace_workspace_snapshot(caller_id, payload, target_updated_at);
end;
$$;

revoke all on function private.replace_current_workspace_snapshot(jsonb, timestamptz)
  from public, anon, authenticated;
grant execute on function private.replace_current_workspace_snapshot(jsonb, timestamptz)
  to authenticated;

create or replace function public.save_personal_workspace_snapshot(payload jsonb)
returns table (updated_at timestamptz)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  saved_at timestamptz := now();
begin
  if caller_id is null
     or coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) then
    raise exception 'Authenticatie vereist.' using errcode = '42501';
  end if;

  if payload is null or jsonb_typeof(payload) <> 'object' then
    raise exception 'De werkomgeving moet een JSON-object zijn.' using errcode = '22023';
  end if;

  if octet_length(payload::text) > 10485760 then
    raise exception 'De werkomgeving is groter dan 10 MB.' using errcode = '22023';
  end if;

  perform private.replace_current_workspace_snapshot(payload, saved_at);
  return query select saved_at;
end;
$$;

revoke update on table public.workspaces from authenticated;
drop policy workspaces_update_owner on public.workspaces;
