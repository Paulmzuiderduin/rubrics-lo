import test from 'node:test';
import assert from 'node:assert/strict';
import { APPLY_WORKSPACE_CHANGES_RPC, LOAD_WORKSPACE_RPC, loadRemoteWorkspace, saveRemoteWorkspace, workspacePayload } from '../src/cloudStorage.mjs';

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

test('cloudopslag verstuurt alleen wijzigingen en de verwachte revisie', async () => {
  let rpcCall;
  const chain = {
    abortSignal(signal) { assert.ok(signal instanceof AbortSignal); return this; },
    async single() { return { data: { updated_at: '2026-09-18T10:00:00Z' }, error: null }; },
  };
  const client = { rpc(name, args) { rpcCall = { name, args }; return chain; } };
  const changes = { classes: { upsert: [], delete: [] } };
  await saveRemoteWorkspace(client, changes, '2026-09-18T10:00:00Z');
  assert.equal(rpcCall.name, APPLY_WORKSPACE_CHANGES_RPC);
  assert.deepEqual(rpcCall.args, { changes, expected_updated_at: '2026-09-18T10:00:00Z' });
});

test('vastgelopen cloudopslag wordt afgebroken en als onzekere uitkomst gemeld', async () => {
  const chain = {
    abortSignal(signal) {
      return { single: () => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new Error('Aborted')), { once: true })) };
    },
  };
  const client = { rpc() { return chain; } };

  await assert.rejects(saveRemoteWorkspace(client, {}, null, 5), { code: 'SAVE_TIMEOUT' });
});
