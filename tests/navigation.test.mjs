import test from 'node:test';
import assert from 'node:assert/strict';
import { readWorkspaceRoute, writeWorkspaceSearch } from '../src/navigation.mjs';

const data = { classes: [{ id: 'class-2a', students: [{ id: 'student-1' }] }] };

test('hoofdonderdeel en agendaweek worden na verversen hersteld', () => {
  const route = readWorkspaceRoute('?view=agenda&week=3', data);
  assert.equal(route.section, 'agenda');
  assert.equal(route.week, 3);
});

test('gekozen klas en klastab worden na verversen hersteld', () => {
  const route = readWorkspaceRoute('?view=classes&class=class-2a&tab=Lessen', data);
  assert.equal(route.selectedClassId, 'class-2a');
  assert.equal(route.classTab, 'Lessen');
});

test('een directe rubric-URL herstelt ook leerlijn en sport', () => {
  const route = readWorkspaceRoute('?view=rubrics&rubric=speerwerpen&from=agenda', data);
  assert.equal(route.rubricDetail, 'speerwerpen');
  assert.equal(route.rubricLearningLine, 'throwing');
  assert.equal(route.rubricActivity, 'speerwerpen');
  assert.equal(route.rubricBackTarget, 'agenda');
});

test('resultaatselecties blijven in de URL staan', () => {
  const search = writeWorkspaceSearch('', { section: 'results', resultsClassId: 'class-2a', resultsLearningLine: 'throwing' });
  assert.equal(search, '?view=results&resultsClass=class-2a&resultsLine=throwing');
  const route = readWorkspaceRoute(search, data);
  assert.equal(route.resultsClassId, 'class-2a');
  assert.equal(route.resultsLearningLine, 'throwing');
});

test('ongeldige routewaarden vallen veilig terug', () => {
  const route = readWorkspaceRoute('?view=onbekend&class=bestaat-niet&tab=Geheim', data);
  assert.equal(route.section, 'classes');
  assert.equal(route.selectedClassId, null);
  assert.equal(route.classTab, 'Overzicht');
});
