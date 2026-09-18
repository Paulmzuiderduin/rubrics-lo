import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRemoteWorkspace, saveRemoteWorkspace, WORKSPACE_TABLE, workspacePayload } from '../src/cloudStorage.mjs';

test('workspacepayload forceert de ondersteunde schemaversie', () => {
  assert.deepEqual(workspacePayload({ version: 99, classes: [] }), { version: 2, classes: [] });
});

test('cloudopslag leest uitsluitend de werkomgeving van de opgegeven eigenaar', async () => {
  const calls = [];
  const chain = {
    select(value) { calls.push(['select', value]); return this; },
    eq(column, value) { calls.push(['eq', column, value]); return this; },
    async maybeSingle() { return { data: { data: { version: 2, classes: [] }, schema_version: 2, updated_at: '2026-09-18T10:00:00Z' }, error: null }; },
  };
  const client = { from(table) { calls.push(['from', table]); return chain; } };
  const result = await loadRemoteWorkspace(client, 'teacher-1');
  assert.equal(calls[0][1], WORKSPACE_TABLE);
  assert.deepEqual(calls.find((item) => item[0] === 'eq'), ['eq', 'owner_id', 'teacher-1']);
  assert.equal(result.data.version, 2);
});

test('cloudopslag zet owner_id altijd uit de ingelogde gebruiker', async () => {
  let upserted;
  const chain = {
    upsert(value, options) { upserted = value; assert.deepEqual(options, { onConflict: 'owner_id' }); return this; },
    select() { return this; },
    async single() { return { data: { updated_at: '2026-09-18T10:00:00Z' }, error: null }; },
  };
  const client = { from(table) { assert.equal(table, WORKSPACE_TABLE); return chain; } };
  await saveRemoteWorkspace(client, 'teacher-2', { version: 8, classes: [] });
  assert.equal(upserted.owner_id, 'teacher-2');
  assert.equal(upserted.schema_version, 2);
  assert.equal(upserted.data.version, 2);
});
