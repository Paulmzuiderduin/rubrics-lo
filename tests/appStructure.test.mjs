import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const appSource = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');

test('rapportpagina bevat de periodefilter en periodebeheer-componenten', () => {
  assert.match(appSource, /function PeriodFilter\s*\(/);
  assert.match(appSource, /function ReportPeriodsModal\s*\(/);
  assert.match(appSource, /<PeriodFilter\b/);
  assert.match(appSource, /<ReportPeriodsModal\b/);
});
