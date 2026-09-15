export const WEEKDAYS = [
  { value: 1, name: 'Maandag', short: 'ma' }, { value: 2, name: 'Dinsdag', short: 'di' },
  { value: 3, name: 'Woensdag', short: 'wo' }, { value: 4, name: 'Donderdag', short: 'do' },
  { value: 5, name: 'Vrijdag', short: 'vr' },
];

export function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDateKey(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

export function addDays(date, amount) {
  const next = new Date(date); next.setDate(next.getDate() + amount); return next;
}

export function startOfWeek(date = new Date()) {
  const value = new Date(date); const day = value.getDay() || 7;
  value.setHours(12, 0, 0, 0); value.setDate(value.getDate() - day + 1); return value;
}

export function occurrenceKey(date, slotId) { return `${typeof date === 'string' ? date : localDateKey(date)}|${slotId}`; }

export function periodTimes(data, startPeriod, endPeriod) {
  const start = data.lessonPeriods.find((item) => item.number === Number(startPeriod));
  const end = data.lessonPeriods.find((item) => item.number === Number(endPeriod));
  return { startTime: start?.startTime || '—', endTime: end?.endTime || '—' };
}

export function periodLabel(start, end) { return Number(start) === Number(end) ? `Lesuur ${start}` : `Lesuur ${start}–${end}`; }

export function seriesForOccurrence(series, key) { return series.find((item) => item.occurrences.some((entry) => entry.key === key)); }

export function occurrencesForWeek(data, monday) {
  const startKey = localDateKey(monday); const endKey = localDateKey(addDays(monday, 6));
  const generated = [];
  for (let offset = 0; offset < 5; offset += 1) {
    const date = addDays(monday, offset); const dateKey = localDateKey(date); const weekday = offset + 1;
    data.gymScheduleSlots.filter((slot) => slot.weekday === weekday).forEach((slot) => generated.push({ key: occurrenceKey(dateKey, slot.id), date: dateKey, slotId: slot.id, classId: slot.classId, startPeriod: slot.startPeriod, endPeriod: slot.endPeriod }));
  }
  data.lessonSeries.flatMap((item) => item.occurrences.map((entry) => ({ ...entry, classId: item.classId }))).filter((entry) => entry.date >= startKey && entry.date <= endKey).forEach((entry) => { if (!generated.some((item) => item.key === entry.key)) generated.push(entry); });
  return generated.map((entry) => {
    const series = seriesForOccurrence(data.lessonSeries, entry.key);
    const exception = data.agendaExceptions.find((item) => item.occurrenceKey === entry.key);
    const session = data.lessonSessions.find((item) => item.occurrenceKey === entry.key);
    return { ...entry, series, exception, session };
  }).sort((a, b) => a.date.localeCompare(b.date) || a.startPeriod - b.startPeriod || a.classId.localeCompare(b.classId));
}

export function nextAvailableOccurrences(data, startOccurrence, count) {
  const results = [];
  const assigned = new Set(data.lessonSeries.flatMap((item) => item.occurrences.map((entry) => entry.key)));
  const cancelled = new Set(data.agendaExceptions.filter((item) => item.status === 'cancelled').map((item) => item.occurrenceKey));
  const startDate = parseDateKey(startOccurrence.date);
  for (let offset = 0; offset < 366 && results.length < count; offset += 1) {
    const date = addDays(startDate, offset); const weekday = date.getDay();
    data.gymScheduleSlots.filter((slot) => slot.classId === startOccurrence.classId && slot.weekday === weekday).sort((a, b) => a.startPeriod - b.startPeriod).forEach((slot) => {
      if (results.length >= count) return;
      const key = occurrenceKey(date, slot.id);
      const isBeforeStart = localDateKey(date) === startOccurrence.date && slot.startPeriod < startOccurrence.startPeriod;
      if (!isBeforeStart && !assigned.has(key) && !cancelled.has(key)) results.push({ key, date: localDateKey(date), slotId: slot.id, startPeriod: slot.startPeriod, endPeriod: slot.endPeriod });
    });
  }
  return results;
}

export function latestAssessmentInRange(assessments, classId, studentId, rubricId, startDate, endDate) {
  return assessments.filter((item) => item.classId === classId && item.studentId === studentId && (item.rubricId || 'kanjam') === rubricId && (!startDate || item.submittedAt.slice(0, 10) >= startDate) && (!endDate || item.submittedAt.slice(0, 10) <= endDate)).sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))[0] || null;
}

export function dateRangeForFilter(data, filter) {
  if (filter.type === 'custom') return { start: filter.start, end: filter.end, label: 'Aangepaste periode' };
  if (filter.type === 'period') {
    const period = data.reportPeriods.find((item) => item.id === filter.periodId);
    if (period) return { start: period.startDate, end: period.endDate, label: period.label };
  }
  return { start: data.settings.schoolYearStart, end: data.settings.schoolYearEnd, label: `Schooljaar ${data.settings.schoolYearLabel}` };
}
