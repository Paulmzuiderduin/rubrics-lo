import { createEmptyData, createInitialData, DEFAULT_PERIODS } from './data.js';

export const STORAGE_KEY = 'rubrics-lo-pilot-v2';
export const OLD_STORAGE_KEY = 'rubrics-lo-pilot-v1';

export function migrateV1(oldData) {
  const base = createInitialData();
  if (!oldData?.classes) return base;
  const classes = oldData.classes.map(({ lessons, ...classItem }) => ({ ...classItem, cluster: classItem.cluster || '3-4' }));
  const lessonSeries = [];
  const lessonSessions = [];
  const lessonMap = new Map();
  oldData.classes.forEach((classItem) => (classItem.lessons || []).forEach((lesson, index) => {
    const date = String(lesson.date || new Date().toISOString()).slice(0, 10);
    const seriesId = `migrated-series-${lesson.id}`;
    const key = `${date}|migrated-${lesson.id}`;
    lessonSeries.push({ id: seriesId, classId: classItem.id, rubricId: 'kanjam', includeTogether: lesson.together !== false, occurrences: [{ key, date, slotId: `migrated-${lesson.id}`, startPeriod: 1, endPeriod: 1 }], assessmentOccurrenceKey: key, createdAt: lesson.date || new Date().toISOString() });
    lessonSessions.push({ id: `migrated-session-${index}-${lesson.id}`, seriesId, occurrenceKey: key, mode: 'assessment', startedAt: lesson.date || `${date}T09:00:00.000Z`, endedAt: lesson.date || `${date}T10:00:00.000Z` });
    lessonMap.set(lesson.id, { seriesId, key });
  }));
  const assessments = (oldData.assessments || []).map((item) => {
    const mapped = lessonMap.get(item.lessonId);
    return { ...item, rubricId: 'kanjam', seriesId: item.seriesId || mapped?.seriesId || null, occurrenceKey: item.occurrenceKey || mapped?.key || `${item.submittedAt.slice(0, 10)}|legacy` };
  });
  return { ...base, classes, lessonSeries: lessonSeries.length ? lessonSeries : base.lessonSeries, lessonSessions: lessonSessions.length ? lessonSessions : base.lessonSessions, assessments: assessments.length ? assessments : base.assessments };
}

export function hydrateData(value) {
  const base = createEmptyData();
  if (!value || typeof value !== 'object') return base;
  return {
    ...base,
    ...value,
    version: 2,
    settings: { ...base.settings, ...(value.settings || {}) },
    lessonPeriods: Array.isArray(value.lessonPeriods) && value.lessonPeriods.length ? value.lessonPeriods : DEFAULT_PERIODS,
    classes: Array.isArray(value.classes) ? value.classes.map((item) => ({ ...item, cluster: item.cluster || '3-4' })) : [],
    gymScheduleSlots: Array.isArray(value.gymScheduleSlots) ? value.gymScheduleSlots : [],
    lessonSeries: Array.isArray(value.lessonSeries) ? value.lessonSeries : [],
    lessonSessions: Array.isArray(value.lessonSessions) ? value.lessonSessions : [],
    agendaExceptions: Array.isArray(value.agendaExceptions) ? value.agendaExceptions : [],
    reportPeriods: Array.isArray(value.reportPeriods) ? value.reportPeriods : [],
    assessments: Array.isArray(value.assessments) ? value.assessments : [],
  };
}

export function loadData(storage) {
  try {
    const current = JSON.parse(storage.getItem(STORAGE_KEY));
    if (current?.version === 2) return hydrateData(current);
    const old = JSON.parse(storage.getItem(OLD_STORAGE_KEY));
    return old ? migrateV1(old) : createInitialData();
  } catch { return createInitialData(); }
}

export function saveData(storage, data) { storage.setItem(STORAGE_KEY, JSON.stringify({ ...data, version: 2 })); }
export function hasLocalData(storage) { return Boolean(storage.getItem(STORAGE_KEY) || storage.getItem(OLD_STORAGE_KEY)); }
export function clearLocalData(storage) { storage.removeItem(STORAGE_KEY); storage.removeItem(OLD_STORAGE_KEY); }
