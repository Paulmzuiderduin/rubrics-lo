import { createInitialData, DEFAULT_PERIODS } from './data.js';

export const STORAGE_KEY = 'rubrics-lo-pilot-v2';
export const OLD_STORAGE_KEY = 'rubrics-lo-pilot-v1';

export function migrateV1(oldData) {
  const base = createInitialData();
  if (!oldData?.classes) return base;
  const classes = oldData.classes.map(({ lessons, ...classItem }) => classItem);
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

export function loadData(storage) {
  try {
    const current = JSON.parse(storage.getItem(STORAGE_KEY));
    if (current?.version === 2) return { ...createInitialData(), ...current, lessonPeriods: current.lessonPeriods || DEFAULT_PERIODS };
    const old = JSON.parse(storage.getItem(OLD_STORAGE_KEY));
    return old ? migrateV1(old) : createInitialData();
  } catch { return createInitialData(); }
}

export function saveData(storage, data) { storage.setItem(STORAGE_KEY, JSON.stringify({ ...data, version: 2 })); }
