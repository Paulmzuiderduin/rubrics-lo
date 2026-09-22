import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { RUBRICS } from '../src/data.js';

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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

test('authmails gebruiken de eigen Rubrics LO-afzender en Nederlandse templates', async () => {
  const config = await readFile(new URL('../supabase/config.toml', import.meta.url), 'utf8');
  const templateNames = ['invite', 'confirmation', 'recovery', 'magic-link', 'email-change', 'reauthentication'];

  assert.match(config, /enable_confirmations = true/);
  assert.doesNotMatch(config, /smtp[\s\S]{0,500}(password|pass)\s*=\s*"(?!env\()/i);

  for (const name of templateNames) {
    const html = await readFile(new URL(`../supabase/templates/${name}.html`, import.meta.url), 'utf8');
    assert.match(html, /Rubrics LO/);
    assert.match(html, /rubrics@paulzuiderduin\.com/);
    assert.match(html, /lang="nl"/);
    assert.doesNotMatch(html, /supabase/i);
  }
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

test('iedere selecteerbare rubric is gepubliceerd in de databasecatalogus', async () => {
  const directory = new URL('../supabase/migrations/', import.meta.url);
  const files = (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort();
  const migrations = await Promise.all(files.map((name) => readFile(new URL(name, directory), 'utf8')));
  for (const rubric of RUBRICS) {
    const rubricId = escapeRegExp(rubric.id);
    const publication = migrations.find((sql) => new RegExp(
      `insert into public\\.rubrics[\\s\\S]*?values\\s*\\(\\s*'${rubricId}'`,
      'i',
    ).test(sql));
    assert.ok(publication, `${rubric.title} ontbreekt in public.rubrics`);
    assert.match(
      publication,
      new RegExp(`insert into public\\.rubric_versions[\\s\\S]*?values\\s*\\(\\s*'${rubricId}'`, 'i'),
      `${rubric.title} heeft geen gepubliceerde databaseversie`,
    );

    for (const criterion of rubric.criteria) {
      assert.match(
        publication,
        new RegExp(`'${escapeRegExp(criterion.key)}'`, 'i'),
        `${rubric.title}: beoordelingsrij ${criterion.key} ontbreekt in de databasecatalogus`,
      );
      for (const level of Object.values(criterion.levels)) {
        for (const text of [level.summary, level.detail, level.next]) {
          assert.ok(
            publication.includes(text.replaceAll("'", "''")),
            `${rubric.title}: niveau-inhoud van ${criterion.key} ontbreekt in de databasecatalogus`,
          );
        }
      }
    }
  }
});

test('verschijningsvorm is geen eigenschap van een rubric in de database', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260922201202_remove_rubric_activity_form.sql', import.meta.url), 'utf8');
  assert.match(sql, /alter table public\.rubrics\s+drop column if exists activity_form/i);
});

test('snapshot-RPC bindt eigenaarschap server-side en is niet beschikbaar voor anon', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260919102617_migrate_workspace_snapshots.sql', import.meta.url), 'utf8');
  assert.match(sql, /caller_id uuid := \(select auth\.uid\(\)\)/i);
  assert.match(sql, /revoke all on function public\.save_personal_workspace_snapshot\(jsonb\)[\s\S]*from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.save_personal_workspace_snapshot\(jsonb\)[\s\S]*to authenticated/i);
  assert.doesNotMatch(sql, /save_personal_workspace_snapshot\([^)]*owner/i);
});

test('oude JSON-opslag wordt pas na de RPC-omschakeling verwijderd', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260919103101_remove_legacy_workspace_json.sql', import.meta.url), 'utf8');
  assert.match(sql, /drop trigger if exists teacher_workspaces_sync_normalized/i);
  assert.match(sql, /drop function if exists private\.sync_legacy_teacher_workspace\(\)/i);
  assert.match(sql, /drop table public\.teacher_workspaces/i);
});

test('publieke snapshot-API draait met gebruikersrechten en heeft gerichte indexen', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260919103240_harden_normalized_workspace_api.sql', import.meta.url), 'utf8');
  assert.match(sql, /alter function public\.save_personal_workspace_snapshot\(jsonb\)\s+security invoker/i);
  assert.match(sql, /create index assessment_scores_rubric_domain_idx/i);
  assert.match(sql, /create index lesson_series_rubric_version_idx/i);
});

test('private schrijfhelper accepteert geen eigenaar uit de browser', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260919103407_fix_workspace_snapshot_rls_boundary.sql', import.meta.url), 'utf8');
  assert.match(sql, /create function private\.replace_current_workspace_snapshot\(\s*payload jsonb/i);
  assert.match(sql, /caller_id uuid := \(select auth\.uid\(\)\)/i);
  assert.doesNotMatch(sql, /replace_current_workspace_snapshot\([^)]*owner/i);
  assert.match(sql, /create or replace function public\.save_personal_workspace_snapshot\(payload jsonb\)[\s\S]*security invoker/i);
});

test('gewijzigde werkruimte-opslag gebruikt compare-and-swap en behoudt de rollback-RPC tijdens de cutover', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260922202111_protect_workspace_snapshot_writes.sql', import.meta.url), 'utf8');
  assert.match(sql, /create function private\.apply_current_workspace_changes\([\s\S]*expected_updated_at timestamptz/i);
  assert.match(sql, /current_updated_at is distinct from expected_updated_at/i);
  assert.match(sql, /create function public\.apply_personal_workspace_changes\([\s\S]*security invoker/i);
  assert.match(sql, /grant execute on function public\.apply_personal_workspace_changes\(jsonb, timestamptz\)[\s\S]*to authenticated/i);
  assert.doesNotMatch(sql, /drop function public\.save_personal_workspace_snapshot/i);
});
