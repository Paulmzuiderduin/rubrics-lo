import test from 'node:test';
import assert from 'node:assert/strict';
import { LOAD_WORKSPACE_RPC, loadRemoteWorkspace, SAVE_WORKSPACE_RPC, saveRemoteWorkspace, workspacePayload } from '../src/cloudStorage.mjs';

test('workspacepayload forceert de ondersteunde schemaversie', () => {
  assert.deepEqual(workspacePayload({ version: 99, classes: [] }), { version: 3, classes: [] });
});

test('cloudopslag leest de werkomgeving via een servergebonden RPC', async () => {
  const calls = [];
  const chain = {
    async maybeSingle() { return { data: { data: { version: 3, classes: [] }, schema_version: 3, updated_at: '2026-09-18T10:00:00Z' }, error: null }; },
  };
  const client = { rpc(name, args) { calls.push([name, args]); return chain; } };
  const result = await loadRemoteWorkspace(client);
  assert.deepEqual(calls, [[LOAD_WORKSPACE_RPC, undefined]]);
  assert.equal(result.data.version, 3);
});

test('cloudopslag stuurt geen manipuleerbare eigenaar naar de server', async () => {
  let rpcCall;
  const chain = {
    async single() { return { data: { updated_at: '2026-09-18T10:00:00Z' }, error: null }; },
  };
  const client = { rpc(name, args) { rpcCall = { name, args }; return chain; } };
  await saveRemoteWorkspace(client, { version: 8, classes: [] });
  assert.equal(rpcCall.name, SAVE_WORKSPACE_RPC);
  assert.deepEqual(Object.keys(rpcCall.args), ['payload']);
  assert.equal(rpcCall.args.payload.version, 3);
});
