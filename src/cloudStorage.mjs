export const LOAD_WORKSPACE_RPC = 'load_personal_workspace_snapshot';
export const SAVE_WORKSPACE_RPC = 'save_personal_workspace_snapshot';
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

export async function saveRemoteWorkspace(client, data) {
  const payload = workspacePayload(data);
  const { data: saved, error } = await client
    .rpc(SAVE_WORKSPACE_RPC, { payload })
    .single();

  if (error) throw error;
  return saved;
}
