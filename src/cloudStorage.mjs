export const LOAD_WORKSPACE_RPC = 'load_personal_workspace_snapshot';
export const APPLY_WORKSPACE_CHANGES_RPC = 'apply_personal_workspace_changes';
export const WORKSPACE_SCHEMA_VERSION = 3;
export const WORKSPACE_SAVE_TIMEOUT_MS = 20_000;

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

export async function saveRemoteWorkspace(client, changes, expectedUpdatedAt, timeoutMs = WORKSPACE_SAVE_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const { data: saved, error } = await client
      .rpc(APPLY_WORKSPACE_CHANGES_RPC, { changes, expected_updated_at: expectedUpdatedAt ?? null })
      .abortSignal(controller.signal)
      .single();

    if (error) throw error;
    return saved;
  } catch (error) {
    if (controller.signal.aborted) {
      throw Object.assign(new Error('De opslag duurde te lang. De wijziging kan alsnog zijn verwerkt; laad eerst de opgeslagen versie opnieuw voordat u opnieuw probeert.'), { code: 'SAVE_TIMEOUT' });
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
