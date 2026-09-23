const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
};

const same = (left, right) => JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
const asArray = (value) => Array.isArray(value) ? value : [];

function collectionChanges(before, after, keyFor, normalize = (item) => item) {
  const oldByKey = new Map(asArray(before).map((item) => [keyFor(item), normalize(item)]));
  const newByKey = new Map(asArray(after).map((item) => [keyFor(item), normalize(item)]));
  return {
    upsert: [...newByKey].filter(([key, value]) => !oldByKey.has(key) || !same(oldByKey.get(key), value)).map(([, value]) => value),
    delete: [...oldByKey.keys()].filter((key) => !newByKey.has(key)),
  };
}

const without = (item, key) => Object.fromEntries(Object.entries(item).filter(([name]) => name !== key));
const classStudents = (classes) => asArray(classes).flatMap((classItem) => asArray(classItem.students).map((student) => ({
  classId: classItem.id,
  id: student.id,
  name: student.name,
})));
const seriesOccurrences = (seriesList) => asArray(seriesList).flatMap((series) => asArray(series.occurrences).map((occurrence, index) => ({
  seriesId: series.id,
  key: occurrence.key,
  date: occurrence.date,
  slotId: occurrence.slotId,
  startPeriod: occurrence.startPeriod,
  endPeriod: occurrence.endPeriod,
  sequenceNumber: index + 1,
})));

export function diffWorkspace(before = {}, after = {}) {
  const classesBefore = asArray(before.classes);
  const classesAfter = asArray(after.classes);
  const seriesBefore = asArray(before.lessonSeries);
  const seriesAfter = asArray(after.lessonSeries);
  const occurrenceChanges = collectionChanges(
    seriesOccurrences(seriesBefore),
    seriesOccurrences(seriesAfter),
    (item) => JSON.stringify([item.seriesId, item.key]),
  );
  const affectedSeries = new Set([
    ...occurrenceChanges.upsert.map((item) => item.seriesId),
    ...occurrenceChanges.delete.map((key) => JSON.parse(key)[0]),
  ]);
  const currentOccurrenceUpserts = seriesOccurrences(seriesAfter)
    .filter((item) => affectedSeries.has(item.seriesId));
  const assessmentChanges = collectionChanges(before.assessments, after.assessments, (item) => item.id);
  const studentChanges = collectionChanges(
    classStudents(classesBefore),
    classStudents(classesAfter),
    (item) => JSON.stringify([item.classId, item.id]),
  );

  return {
    settings: same(before.settings, after.settings) ? null : after.settings,
    lessonPeriods: collectionChanges(before.lessonPeriods, after.lessonPeriods, (item) => item.number),
    classes: collectionChanges(classesBefore, classesAfter, (item) => item.id, (item) => without(item, 'students')),
    students: {
      ...studentChanges,
      delete: studentChanges.delete.map((key) => {
        const [classId, id] = JSON.parse(key);
        return { class_id: classId, id };
      }),
    },
    gymScheduleSlots: collectionChanges(before.gymScheduleSlots, after.gymScheduleSlots, (item) => item.id),
    lessonSeries: collectionChanges(seriesBefore, seriesAfter, (item) => item.id, (item) => without(item, 'occurrences')),
    lessonOccurrences: {
      upsert: currentOccurrenceUpserts,
      delete: occurrenceChanges.delete.map((key) => {
        const [seriesId, occurrenceKey] = JSON.parse(key);
        return { seriesId, key: occurrenceKey };
      }),
      affectedSeries: [...affectedSeries].filter((id) => seriesAfter.some((item) => item.id === id)),
    },
    lessonSessions: collectionChanges(before.lessonSessions, after.lessonSessions, (item) => item.id),
    agendaExceptions: collectionChanges(before.agendaExceptions, after.agendaExceptions, (item) => item.occurrenceKey),
    reportPeriods: collectionChanges(before.reportPeriods, after.reportPeriods, (item) => item.id),
    assessments: assessmentChanges,
  };
}
