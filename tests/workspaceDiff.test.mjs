import test from 'node:test';
import assert from 'node:assert/strict';
import { diffWorkspace } from '../src/workspaceDiff.mjs';

const fixture = () => ({
  version: 3,
  settings: { schoolYearLabel: '2026–2027', schoolYearStart: '2026-08-01', schoolYearEnd: '2027-07-31' },
  lessonPeriods: [{ number: 1, startTime: '08:30', endTime: '09:15' }],
  classes: [{ id: 'class-a', name: 'Klas A', cluster: '1-2', students: [{ id: 'student-a', name: 'Leerling A' }] }],
  gymScheduleSlots: [],
  lessonSeries: [{ id: 'series-a', classId: 'class-a', rubricId: 'kanjam', includeTogether: true, occurrences: [{ key: 'occ-a', date: '2026-09-21', slotId: 'slot-a', startPeriod: 1, endPeriod: 1 }] }],
  lessonSessions: [],
  agendaExceptions: [],
  reportPeriods: [],
  assessments: [{ id: 'assessment-a', classId: 'class-a', studentId: 'student-a', seriesId: 'series-a', occurrenceKey: 'occ-a', rubricId: 'kanjam', submittedAt: '2026-09-21T09:00:00Z', self: { play: 'green' }, effective: { play: 'green' }, adjusted: { play: false } }],
});

test('een wijziging aan een leerlingscore verzendt alleen die score, niet de volledige klasadministratie', () => {
  const before = fixture();
  const after = structuredClone(before);
  after.assessments[0].self.play = 'blue';

  const changes = diffWorkspace(before, after);

  assert.deepEqual(changes.assessments.upsert, [after.assessments[0]]);
  assert.deepEqual(changes.assessments.delete, []);
  assert.deepEqual(changes.classes.upsert, []);
  assert.deepEqual(changes.students.upsert, []);
  assert.deepEqual(changes.lessonOccurrences.affectedSeries, []);
});

test('een verplaatste les stuurt alle momenten van alleen de gewijzigde lessenreeks', () => {
  const before = fixture();
  const after = structuredClone(before);
  after.lessonSeries[0].occurrences[0].date = '2026-09-22';

  const changes = diffWorkspace(before, after);

  assert.deepEqual(changes.lessonOccurrences.affectedSeries, ['series-a']);
  assert.deepEqual(changes.lessonOccurrences.upsert, [{
    seriesId: 'series-a', key: 'occ-a', date: '2026-09-22', slotId: 'slot-a', startPeriod: 1, endPeriod: 1, sequenceNumber: 1,
  }]);
});

test('het verwijderen van een klas bevat ook de gekoppelde leerlingen en beoordelingen', () => {
  const before = fixture();
  const after = structuredClone(before);
  after.classes = [];
  after.assessments = [];
  after.lessonSeries = [];

  const changes = diffWorkspace(before, after);

  assert.deepEqual(changes.classes.delete, ['class-a']);
  assert.deepEqual(changes.students.delete, [JSON.stringify(['class-a', 'student-a'])]);
  assert.deepEqual(changes.assessments.delete, ['assessment-a']);
  assert.deepEqual(changes.lessonSeries.delete, ['series-a']);
  assert.deepEqual(changes.lessonOccurrences.delete, [{ seriesId: 'series-a', key: 'occ-a' }]);
});
