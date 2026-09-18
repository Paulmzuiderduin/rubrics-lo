export const WORKSPACE_TABLE = 'teacher_workspaces';
export const WORKSPACE_SCHEMA_VERSION = 2;

export function workspacePayload(data) {
  return { ...data, version: WORKSPACE_SCHEMA_VERSION };
}

export async function loadRemoteWorkspace(client, ownerId) {
  const { data, error } = await client
    .from(WORKSPACE_TABLE)
    .select('data, schema_version, updated_at')
    .eq('owner_id', ownerId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return {
    data: workspacePayload(data.data),
    schemaVersion: data.schema_version,
    updatedAt: data.updated_at,
  };
}

export async function saveRemoteWorkspace(client, ownerId, data) {
  const payload = workspacePayload(data);
  const { data: saved, error } = await client
    .from(WORKSPACE_TABLE)
    .upsert({
      owner_id: ownerId,
      schema_version: WORKSPACE_SCHEMA_VERSION,
      data: payload,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'owner_id' })
    .select('updated_at')
    .single();

  if (error) throw error;
  return saved;
}
