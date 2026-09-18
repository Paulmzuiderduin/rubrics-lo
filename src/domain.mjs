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
    const session = data.lessonSessions.filter((item) => item.occurrenceKey === entry.key).sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))[0];
    return { ...entry, series, exception, session };
  }).sort((a, b) => a.date.localeCompare(b.date) || a.startPeriod - b.startPeriod || a.classId.localeCompare(b.classId));
}

export function appendLessonSession(data, series, occurrence, startedAt = new Date().toISOString(), id = `session-${Date.now()}`) {
  const mode = series.assessmentOccurrenceKey === occurrence.key ? 'assessment' : 'display';
  const session = { id, seriesId: series.id, occurrenceKey: occurrence.key, mode, startedAt, endedAt: null };
  return { data: { ...data, lessonSessions: [...data.lessonSessions, session] }, session, mode };
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

function weekdayForDateKey(dateKey) { return parseDateKey(dateKey).getDay(); }

export function relocateSeriesOccurrence(data, seriesId, oldKey, changes) {
  const series = data.lessonSeries.find((item) => item.id === seriesId);
  const current = series?.occurrences.find((item) => item.key === oldKey);
  if (!series || !current) throw new Error('Deze les kon niet worden gevonden.');

  const startPeriod = Number(changes.startPeriod);
  const endPeriod = Number(changes.endPeriod);
  const matchingSlot = data.gymScheduleSlots.find((slot) => slot.classId === series.classId
    && slot.weekday === weekdayForDateKey(changes.date)
    && slot.startPeriod === startPeriod
    && slot.endPeriod === endPeriod);
  const moveId = current.moveId || `moved-${seriesId}-${oldKey.replace(/[^a-z0-9]/gi, '-')}`;
  const slotId = matchingSlot?.id || moveId;
  const nextKey = occurrenceKey(changes.date, slotId);
  const occupied = data.lessonSeries.some((item) => item.occurrences.some((entry) => entry.key === nextKey && entry.key !== oldKey));
  if (occupied) throw new Error('Op dit moment is al een andere rubricles gepland.');

  const replacement = { ...current, key: nextKey, date: changes.date, slotId, moveId, startPeriod, endPeriod };
  const lessonSeries = data.lessonSeries.map((item) => {
    if (item.id !== seriesId) return item;
    const occurrences = item.occurrences.map((entry) => entry.key === oldKey ? replacement : entry)
      .sort((a, b) => a.date.localeCompare(b.date) || a.startPeriod - b.startPeriod);
    let assessmentOccurrenceKey = item.assessmentOccurrenceKey === oldKey ? nextKey : item.assessmentOccurrenceKey;
    if (changes.lessonType === 'assessment') assessmentOccurrenceKey = nextKey;
    if (changes.lessonType === 'display' && assessmentOccurrenceKey === nextKey) {
      const fallback = occurrences.filter((entry) => entry.key !== nextKey).at(-1);
      if (!fallback) throw new Error('Een lessenreeks moet minimaal één beoordelingsmoment houden.');
      assessmentOccurrenceKey = fallback.key;
    }
    return { ...item, occurrences, assessmentOccurrenceKey, includeTogether: changes.includeTogether ?? item.includeTogether };
  });
  return {
    ...data,
    lessonSeries,
    lessonSessions: data.lessonSessions.map((item) => item.occurrenceKey === oldKey ? { ...item, occurrenceKey: nextKey } : item),
    assessments: data.assessments.map((item) => item.occurrenceKey === oldKey ? { ...item, occurrenceKey: nextKey } : item),
    agendaExceptions: data.agendaExceptions.map((item) => item.occurrenceKey === oldKey ? { ...item, occurrenceKey: nextKey } : item),
  };
}

export function removeSeriesOccurrence(data, seriesId, key) {
  const series = data.lessonSeries.find((item) => item.id === seriesId);
  if (!series?.occurrences.some((item) => item.key === key)) throw new Error('Deze les kon niet worden gevonden.');
  if (data.assessments.some((item) => item.occurrenceKey === key)) {
    throw new Error('Een les met leerlingbeoordelingen kan niet worden verwijderd.');
  }
  const remaining = series.occurrences.filter((item) => item.key !== key);
  const lessonSeries = remaining.length
    ? data.lessonSeries.map((item) => item.id === seriesId ? {
      ...item,
      occurrences: remaining,
      assessmentOccurrenceKey: item.assessmentOccurrenceKey === key ? remaining[remaining.length - 1].key : item.assessmentOccurrenceKey,
    } : item)
    : data.lessonSeries.filter((item) => item.id !== seriesId);
  return {
    ...data,
    lessonSeries,
    lessonSessions: data.lessonSessions.filter((item) => item.occurrenceKey !== key),
    agendaExceptions: data.agendaExceptions.filter((item) => item.occurrenceKey !== key),
  };
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

export function deleteClassData(data, classId) {
  const series = data.lessonSeries.filter((item) => item.classId === classId);
  const seriesIds = new Set(series.map((item) => item.id));
  const occurrenceKeys = new Set(series.flatMap((item) => item.occurrences.map((entry) => entry.key)));
  return {
    ...data,
    classes: data.classes.filter((item) => item.id !== classId),
    gymScheduleSlots: data.gymScheduleSlots.filter((item) => item.classId !== classId),
    lessonSeries: data.lessonSeries.filter((item) => item.classId !== classId),
    lessonSessions: data.lessonSessions.filter((item) => !seriesIds.has(item.seriesId)),
    agendaExceptions: data.agendaExceptions.filter((item) => !occurrenceKeys.has(item.occurrenceKey)),
    assessments: data.assessments.filter((item) => item.classId !== classId),
  };
}
