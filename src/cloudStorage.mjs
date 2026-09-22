export const LOAD_WORKSPACE_RPC = 'load_personal_workspace_snapshot';
export const APPLY_WORKSPACE_CHANGES_RPC = 'apply_personal_workspace_changes';
export const WORKSPACE_SCHEMA_VERSION = 3;

export function workspacePayload(data) {
  return { ...data, version: WORKSPACE_SCHEMA_VERSION };
}

export async function loadRemoteWorkspace(client) {
  const { data, error } = await client
    .rpc(LOAD_WORKSPACE_RPC)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return {
    data: workspacePayload(data.data),
    schemaVersion: data.schema_version,
    updatedAt: data.updated_at,
  };
}

export async function saveRemoteWorkspace(client, changes, expectedUpdatedAt) {
  const { data: saved, error } = await client
    .rpc(APPLY_WORKSPACE_CHANGES_RPC, { changes, expected_updated_at: expectedUpdatedAt ?? null })
    .single();

  if (error) throw error;
  return saved;
}
