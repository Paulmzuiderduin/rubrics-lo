import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialData } from '../src/data.js';
import { dateRangeForFilter, latestAssessmentInRange, nextAvailableOccurrences, occurrencesForWeek, parseDateKey } from '../src/domain.mjs';

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

test('schoolperiode en aangepaste periode leveren hun eigen datumbereik', () => {
  const data = createInitialData();
  data.reportPeriods = [{ id: 'p1', label: 'Periode 1', startDate: '2026-08-20', endDate: '2026-10-20' }];
  assert.deepEqual(dateRangeForFilter(data, { type: 'period', periodId: 'p1' }), { start: '2026-08-20', end: '2026-10-20', label: 'Periode 1' });
  assert.deepEqual(dateRangeForFilter(data, { type: 'custom', start: '2026-09-01', end: '2026-09-30' }), { start: '2026-09-01', end: '2026-09-30', label: 'Aangepaste periode' });
});
