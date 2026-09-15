import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateV1 } from '../src/storage.mjs';

test('v1-data migreert zonder klassen, leerlingen of beoordelingen te verliezen', () => {
  const old = { classes: [{ id: 'c1', name: 'Testklas', students: [{ id: 's1', name: 'Test Leerling' }], lessons: [{ id: 'l1', activity: 'KanJam', together: true, date: '2026-09-01T09:00:00Z' }] }], assessments: [{ id: 'a1', classId: 'c1', studentId: 's1', lessonId: 'l1', submittedAt: '2026-09-01T09:30:00Z', self: { movement: 'blue' }, effective: { movement: 'blue' }, adjusted: {} }] };
  const result = migrateV1(old);
  assert.equal(result.version, 2);
  assert.equal(result.classes[0].students[0].name, 'Test Leerling');
  assert.equal(result.assessments.length, 1);
  assert.equal(result.lessonSeries.length, 1);
  assert.equal(result.lessonSessions[0].mode, 'assessment');
});
