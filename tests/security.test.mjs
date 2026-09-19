import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('browserbeleid staat alleen eigen bron en het Rubrics Supabase-project toe', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const policy = html.match(/Content-Security-Policy" content="([^"]+)/)?.[1] || '';
  assert.match(policy, /default-src 'self'/);
  assert.match(policy, /https:\/\/qutrpxxtmztbiqkudkkx\.supabase\.co/);
  assert.match(policy, /object-src 'none'/);
  assert.doesNotMatch(policy, /default-src \*/);
});

test('RLS-migratie weigert anon en bindt alle mutaties aan auth.uid', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260918104432_secure_teacher_workspaces.sql', import.meta.url), 'utf8');
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /force row level security/i);
  assert.match(sql, /revoke all on table public\.teacher_workspaces from anon/i);
  assert.equal((sql.match(/owner_id = \(select auth\.uid\(\)\)/g) || []).length, 4);
  assert.doesNotMatch(sql, /grant .* to anon/i);
});

test('frontendconfiguratie accepteert alleen een publishable key', async () => {
  const client = await readFile(new URL('../src/supabase.js', import.meta.url), 'utf8');
  assert.match(client, /VITE_SUPABASE_PUBLISHABLE_KEY/);
  assert.doesNotMatch(client, /service_role|sb_secret_|VITE_SUPABASE_ANON_KEY/);
});

test('productdata is relationeel en voorbereid op latere workspaceleden', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260918161320_normalized_personal_workspaces.sql', import.meta.url), 'utf8');
  for (const table of ['workspaces', 'workspace_members', 'classes', 'students', 'lesson_series', 'lesson_occurrences', 'assessments', 'assessment_scores']) {
    assert.match(sql, new RegExp(`create table public\\.${table}`, 'i'));
  }
  assert.match(sql, /role text not null check \(role in \('owner', 'admin', 'teacher', 'viewer'\)\)/i);
  assert.match(sql, /create table public\.rubric_versions/i);
  assert.match(sql, /create table public\.rubric_domains/i);
  assert.match(sql, /create table public\.rubric_levels/i);
  assert.doesNotMatch(sql, /create table public\.schools/i);
});

test('snapshot-RPC bindt eigenaarschap server-side en is niet beschikbaar voor anon', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260919102617_migrate_workspace_snapshots.sql', import.meta.url), 'utf8');
  assert.match(sql, /caller_id uuid := \(select auth\.uid\(\)\)/i);
  assert.match(sql, /revoke all on function public\.save_personal_workspace_snapshot\(jsonb\)[\s\S]*from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.save_personal_workspace_snapshot\(jsonb\)[\s\S]*to authenticated/i);
  assert.doesNotMatch(sql, /save_personal_workspace_snapshot\([^)]*owner/i);
});
