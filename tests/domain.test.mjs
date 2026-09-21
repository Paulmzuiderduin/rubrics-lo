import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialData } from '../src/data.js';
import { appendLessonSession, dateRangeForFilter, deleteClassData, latestAssessmentInRange, nextAvailableOccurrences, occurrencesForWeek, parseDateKey, relocateSeriesOccurrence, removeSeriesOccurrence, upsertAssessment } from '../src/domain.mjs';

test('weekagenda bevat meerdere vaste gymmomenten met lesuren', () => {
  const data = createInitialData();
  const entries = occurrencesForWeek(data, parseDateKey('2026-09-14'));
  const classEntries = entries.filter((item) => item.classId === 'class-2a');
  assert.deepEqual(classEntries.map((item) => [item.date, item.startPeriod, item.endPeriod]), [['2026-09-15', 3, 4], ['2026-09-18', 5, 5]]);
});

test('lessenreeks kiest de volgende vrije momenten over een weekgrens', () => {
  const data = createInitialData();
  data.lessonSeries = [];
  const start = { key: '2026-09-18|slot-2a-fri', date: '2026-09-18', slotId: 'slot-2a-fri', classId: 'class-2a', startPeriod: 5, endPeriod: 5 };
  assert.deepEqual(nextAvailableOccurrences(data, start, 3).map((item) => item.date), ['2026-09-18', '2026-09-22', '2026-09-25']);
});

test('geannuleerd moment wordt bij een nieuwe lessenreeks overgeslagen', () => {
  const data = createInitialData();
  data.lessonSeries = [];
  data.agendaExceptions = [{ occurrenceKey: '2026-09-22|slot-2a-tue', status: 'cancelled' }];
  const start = { key: '2026-09-18|slot-2a-fri', date: '2026-09-18', slotId: 'slot-2a-fri', classId: 'class-2a', startPeriod: 5, endPeriod: 5 };
  assert.deepEqual(nextAvailableOccurrences(data, start, 3).map((item) => item.date), ['2026-09-18', '2026-09-25', '2026-09-29']);
});

test('rapport gebruikt de meest recente beoordeling binnen de gekozen periode', () => {
  const data = createInitialData();
  data.assessments.push({ ...data.assessments[0], id: 'new', submittedAt: '2026-10-02T10:00:00Z', effective: { movement: 'purple' } });
  assert.equal(latestAssessmentInRange(data.assessments, 'class-2a', 's-amine', 'kanjam', '2026-09-01', '2026-10-31').effective.movement, 'purple');
  assert.equal(latestAssessmentInRange(data.assessments, 'class-2a', 's-amine', 'kanjam', '2026-09-01', '2026-09-30').effective.movement, 'red');
});

test('een tweede inzending op hetzelfde beoordelingsmoment vervangt de eerste', () => {
  const data = createInitialData();
  const original = data.assessments[0];
  const replacement = {
    ...original,
    id: 'nieuwe-id',
    submittedAt: '2026-09-15T09:00:00.000Z',
    self: { movement: 'purple', together: 'red' },
    effective: { movement: 'purple', together: 'red' },
    adjusted: {},
  };
  const updated = upsertAssessment(data.assessments, replacement);
  assert.equal(updated.length, data.assessments.length);
  const stored = updated.find((item) => item.id === original.id);
  assert.deepEqual(stored.self, replacement.self);
  assert.deepEqual(stored.effective, replacement.self);
  assert.deepEqual(stored.adjusted, {});
  assert.equal(stored.submittedAt, replacement.submittedAt);
});

test('een beoordeling voor een ander lesmoment blijft apart bewaard', () => {
  const data = createInitialData();
  const original = data.assessments[0];
  const nextLesson = { ...original, id: 'volgende-les', occurrenceKey: '2026-09-22|slot-2a-tue' };
  const updated = upsertAssessment(data.assessments, nextLesson);
  assert.equal(updated.length, data.assessments.length + 1);
});

test('schoolperiode en aangepaste periode leveren hun eigen datumbereik', () => {
  const data = createInitialData();
  data.reportPeriods = [{ id: 'p1', label: 'Periode 1', startDate: '2026-08-20', endDate: '2026-10-20' }];
  assert.deepEqual(dateRangeForFilter(data, { type: 'period', periodId: 'p1' }), { start: '2026-08-20', end: '2026-10-20', label: 'Periode 1' });
  assert.deepEqual(dateRangeForFilter(data, { type: 'custom', start: '2026-09-01', end: '2026-09-30' }), { start: '2026-09-01', end: '2026-09-30', label: 'Aangepaste periode' });
});


test('een les binnen een reeks kan naar een andere datum en lesuren worden verplaatst', () => {
  const data = createInitialData();
  const oldKey = '2026-09-11|slot-2a-fri';
  const moved = relocateSeriesOccurrence(data, 'series-demo', oldKey, { date: '2026-09-14', startPeriod: 1, endPeriod: 2 });
  const series = moved.lessonSeries.find((item) => item.id === 'series-demo');
  const occurrence = series.occurrences.find((item) => item.date === '2026-09-14');
  assert.deepEqual([occurrence.startPeriod, occurrence.endPeriod], [1, 2]);
  assert.equal(series.occurrences.some((item) => item.key === oldKey), false);
  assert.equal(moved.lessonSessions.find((item) => item.id === 'session-demo-2').occurrenceKey, occurrence.key);
});

test('een oefenles kan uit een reeks worden verwijderd en verdwijnt uit de geschiedenis', () => {
  const data = createInitialData();
  const key = '2026-09-11|slot-2a-fri';
  const updated = removeSeriesOccurrence(data, 'series-demo', key);
  assert.deepEqual(updated.lessonSeries[0].occurrences.map((item) => item.date), ['2026-09-08', '2026-09-15']);
  assert.equal(updated.lessonSessions.some((item) => item.occurrenceKey === key), false);
});

test('een les met leerlingbeoordelingen wordt niet verwijderd', () => {
  const data = createInitialData();
  assert.throws(
    () => removeSeriesOccurrence(data, 'series-demo', '2026-09-15|slot-2a-tue'),
    /leerlingbeoordelingen/,
  );
});


test('een opnieuw gestarte les bewaart de bestaande lesgeschiedenis', () => {
  const data = createInitialData();
  const series = data.lessonSeries[0];
  const occurrence = series.occurrences[0];
  const result = appendLessonSession(data, series, occurrence, '2026-09-18T10:00:00Z', 'session-herstart');
  assert.equal(result.data.lessonSessions.length, data.lessonSessions.length + 1);
  assert.equal(result.data.lessonSessions.some((item) => item.id === 'session-demo-1'), true);
  assert.equal(result.session.id, 'session-herstart');
});

test('beoordelingsmoment en Samen bewegen kunnen vanuit de agenda worden gewijzigd', () => {
  const data = createInitialData();
  const key = '2026-09-11|slot-2a-fri';
  const updated = relocateSeriesOccurrence(data, 'series-demo', key, { date: '2026-09-11', startPeriod: 5, endPeriod: 5, lessonType: 'assessment', includeTogether: false });
  const series = updated.lessonSeries[0];
  assert.equal(series.assessmentOccurrenceKey, key);
  assert.equal(series.includeTogether, false);
});


test('een klas verwijderen ruimt gekoppelde persoonsgegevens en planning volledig op', () => {
  const data = createInitialData();
  data.agendaExceptions.push({ occurrenceKey: '2026-09-08|slot-2a-tue', status: 'cancelled' });
  const updated = deleteClassData(data, 'class-2a');
  assert.equal(updated.classes.some((item) => item.id === 'class-2a'), false);
  assert.equal(updated.gymScheduleSlots.some((item) => item.classId === 'class-2a'), false);
  assert.equal(updated.lessonSeries.some((item) => item.classId === 'class-2a'), false);
  assert.equal(updated.lessonSessions.length, 0);
  assert.equal(updated.assessments.some((item) => item.classId === 'class-2a'), false);
  assert.equal(updated.agendaExceptions.length, 0);
});
