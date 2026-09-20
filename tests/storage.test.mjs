import test from 'node:test';
import assert from 'node:assert/strict';
import { CLASS_CLUSTERS, criteriaForRubric, LEARNING_LINES, rubricActivities, rubricsForCluster, RUBRICS } from '../src/data.js';
import { migrateV1 } from '../src/storage.mjs';

test('klasclusters gebruiken de bouwbenamingen zonder opgeslagen sleutels te wijzigen', () => {
  assert.deepEqual(CLASS_CLUSTERS, [
    { key: '1-2', name: 'Onderbouw' },
    { key: '3-4', name: 'Middenbouw' },
    { key: '5-6', name: 'Bovenbouw' },
  ]);
});

test('rubricbibliotheek toont de HAN-leerlijnen en deelt rubrics per leerlijn in', () => {
  assert.deepEqual(LEARNING_LINES.map((item) => item.name), [
    'Lopen',
    'Springen (atletiek)',
    'Werpen',
    'Bewegen op Muziek',
    'Doelspelen',
    'Spelen met inblijven en uitmaken',
    'Terugslagspelen',
    'Balanceren',
    'Springen (turnen)',
    'Zwaaien (turnen)',
    'Stoeispelen',
    'Trefspelen (zelfverdediging)',
    'Zwemmen',
    'Golf',
    'Kanovaren',
    'Klimmen',
    'Mountainbiken',
    'Schaatsen',
    'Skaten/skeeleren',
  ]);
  assert.equal(RUBRICS.find((item) => item.id === 'kanjam')?.learningLine, 'target-games');
  assert.equal(RUBRICS.find((item) => item.id === 'speerwerpen')?.learningLine, 'throwing');
});

test('een rubric ondersteunt meerdere rijen binnen Beter bewegen', () => {
  const rubric = RUBRICS.find((item) => item.id === 'speerwerpen');
  assert.deepEqual(rubric.criteria.map((item) => item.key), ['approach-release', 'landing', 'together']);
  assert.deepEqual(rubric.criteria.map((item) => item.domain), ['movement', 'movement', 'together']);
  assert.deepEqual(criteriaForRubric(rubric, false).map((item) => item.key), ['approach-release', 'landing']);
});

test('sporten en spellen kunnen een aparte rubric per bouw krijgen', () => {
  const generic = { id: 'speerwerpen', activityId: 'speerwerpen', title: 'Speerwerpen', learningLine: 'throwing', cluster: null };
  const lower = { ...generic, id: 'speerwerpen-onderbouw', cluster: '1-2' };
  const middle = { ...generic, id: 'speerwerpen-middenbouw', cluster: '3-4' };
  const activities = rubricActivities([generic, lower, middle]);
  assert.equal(activities.length, 1);
  assert.deepEqual(activities[0].variants.map((item) => item.id), ['speerwerpen', 'speerwerpen-onderbouw', 'speerwerpen-middenbouw']);
  assert.deepEqual(rubricsForCluster('1-2', [generic, lower, middle]).map((item) => item.id), ['speerwerpen-onderbouw']);
  assert.deepEqual(rubricsForCluster('5-6', [generic, lower, middle]).map((item) => item.id), ['speerwerpen']);
});

test('v1-data migreert zonder klassen, leerlingen of beoordelingen te verliezen', () => {
  const old = { classes: [{ id: 'c1', name: 'Testklas', students: [{ id: 's1', name: 'Test Leerling' }], lessons: [{ id: 'l1', activity: 'KanJam', together: true, date: '2026-09-01T09:00:00Z' }] }], assessments: [{ id: 'a1', classId: 'c1', studentId: 's1', lessonId: 'l1', submittedAt: '2026-09-01T09:30:00Z', self: { movement: 'blue' }, effective: { movement: 'blue' }, adjusted: {} }] };
  const result = migrateV1(old);
  assert.equal(result.version, 3);
  assert.equal(result.classes[0].students[0].name, 'Test Leerling');
  assert.equal(result.assessments.length, 1);
  assert.equal(result.lessonSeries.length, 1);
  assert.equal(result.lessonSessions[0].mode, 'assessment');
});

test('lege clouddata vult alleen veilige standaarden aan en geen demo-klassen', async () => {
  const { hydrateData } = await import('../src/storage.mjs');
  const result = hydrateData({ version: 2, classes: [] });
  assert.equal(result.version, 3);
  assert.deepEqual(result.classes, []);
  assert.equal(result.lessonPeriods.length, 8);
  assert.deepEqual(result.assessments, []);
});

test('lokale pilotdata kan na cloudmigratie volledig worden gewist', async () => {
  const { clearLocalData, hasLocalData, OLD_STORAGE_KEY, STORAGE_KEY, V2_STORAGE_KEY } = await import('../src/storage.mjs');
  const values = new Map([[STORAGE_KEY, '{}'], [V2_STORAGE_KEY, '{}'], [OLD_STORAGE_KEY, '{}']]);
  const storage = { getItem: (key) => values.get(key) || null, removeItem: (key) => values.delete(key) };
  assert.equal(hasLocalData(storage), true);
  clearLocalData(storage);
  assert.equal(hasLocalData(storage), false);
});

test('bestaande klassen krijgen bij migratie een geldig klascluster', () => {
  const old = { classes: [{ id: 'c1', name: 'Testklas', students: [], lessons: [] }], assessments: [] };
  assert.equal(migrateV1(old).classes[0].cluster, '3-4');
});
