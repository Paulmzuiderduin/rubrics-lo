import { LEARNING_LINES, rubricActivities, RUBRICS } from './data.js';

export const WORKSPACE_SECTIONS = ['classes', 'rubrics', 'agenda', 'results', 'reports'];
export const CLASS_TABS = ['Overzicht', 'Leerlingen', 'Lessen', 'Rapport'];
const ROUTE_KEYS = ['view', 'class', 'tab', 'rubric', 'line', 'activity', 'from', 'week', 'resultsClass', 'resultsLine'];

export function readWorkspaceRoute(search, data) {
  const query = new URLSearchParams(search);
  const requestedSection = query.get('view');
  const section = WORKSPACE_SECTIONS.includes(requestedSection) ? requestedSection : 'classes';
  const requestedClass = query.get('class');
  const selectedClassId = data.classes.some((item) => item.id === requestedClass) ? requestedClass : null;
  const requestedTab = query.get('tab');
  const classTab = CLASS_TABS.includes(requestedTab) ? requestedTab : section === 'reports' && selectedClassId ? 'Rapport' : 'Overzicht';
  const selectedRubric = RUBRICS.find((item) => item.id === query.get('rubric'));
  const activities = rubricActivities(RUBRICS);
  const selectedActivity = activities.find((item) => item.id === query.get('activity')) || activities.find((item) => item.id === (selectedRubric?.activityId || selectedRubric?.id));
  const requestedLine = query.get('line');
  const requestedWeek = Number(query.get('week'));
  return {
    section,
    selectedClassId,
    classTab,
    rubricDetail: selectedRubric?.id || null,
    rubricLearningLine: LEARNING_LINES.some((item) => item.key === requestedLine) ? requestedLine : selectedRubric?.learningLine || selectedActivity?.learningLine || null,
    rubricActivity: selectedActivity?.id || null,
    rubricBackTarget: query.get('from') === 'agenda' ? 'agenda' : null,
    week: Number.isInteger(requestedWeek) ? requestedWeek : 0,
    resultsClassId: data.classes.some((item) => item.id === query.get('resultsClass')) ? query.get('resultsClass') : '',
    resultsLearningLine: LEARNING_LINES.some((item) => item.key === query.get('resultsLine')) ? query.get('resultsLine') : '',
  };
}

export function writeWorkspaceSearch(search, state) {
  const query = new URLSearchParams(search);
  ROUTE_KEYS.forEach((key) => query.delete(key));
  query.set('view', state.section);
  if (state.selectedClassId) { query.set('class', state.selectedClassId); query.set('tab', state.classTab); }
  if (state.section === 'rubrics') {
    if (state.rubricDetail) query.set('rubric', state.rubricDetail);
    if (state.rubricLearningLine) query.set('line', state.rubricLearningLine);
    if (state.rubricActivity) query.set('activity', state.rubricActivity);
    if (state.rubricBackTarget === 'agenda') query.set('from', 'agenda');
  }
  if (state.section === 'agenda' && state.week) query.set('week', String(state.week));
  if (state.section === 'results') {
    if (state.resultsClassId) query.set('resultsClass', state.resultsClassId);
    if (state.resultsLearningLine) query.set('resultsLine', state.resultsLearningLine);
  }
  const value = query.toString();
  return value ? `?${value}` : '';
}
