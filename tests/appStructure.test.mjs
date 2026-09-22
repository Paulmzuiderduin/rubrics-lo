import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const appSource = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
const rubricViewsSource = await readFile(new URL('../src/RubricViews.jsx', import.meta.url), 'utf8');
const stylesSource = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');

test('rapportpagina bevat de periodefilter en periodebeheer-componenten', () => {
  assert.match(appSource, /function PeriodFilter\s*\(/);
  assert.match(appSource, /function ReportPeriodsModal\s*\(/);
  assert.match(appSource, /<PeriodFilter\b/);
  assert.match(appSource, /<ReportPeriodsModal\b/);
});

test('rubricpresentatie kan Samen bewegen wel of niet meenemen', () => {
  assert.match(appSource, /const \[includeTogether, setIncludeTogether\] = useState\(true\)/);
  assert.match(appSource, /together=\$\{includeTogether \? '1' : '0'\}/);
  assert.match(appSource, /Beter bewegen \+ Samen bewegen/);
  assert.match(appSource, /Alleen Beter bewegen/);
});

test('rapporten kunnen per leerling of voor de gehele klas worden afgedrukt', () => {
  assert.match(appSource, /const \[printScope, setPrintScope\] = useState\('student'\)/);
  assert.match(appSource, /<option value="class">Gehele klas<\/option>/);
  assert.match(appSource, /className="class-report-print"/);
});

test('resultaten vragen eerst om een klaskeuze', () => {
  assert.match(appSource, /const \[resultsClassId, setResultsClassId\] = useState\(initialRoute\.resultsClassId\)/);
  assert.match(appSource, /Kies eerst een klas om de beoordelingen per leerlijn te bekijken/);
  assert.match(appSource, /setSelectedClassId\(classItem\.id\)/);
});

test('docent kan de zelfbeoordeling apart bekijken en de effectieve beoordeling aanpassen', () => {
  assert.match(appSource, /function ReviewModal\s*\(/);
  assert.match(appSource, /De leerlingbeoordeling is leidend/);
  assert.match(appSource, /Geldende beoordeling · alleen aanpassen indien nodig/);
  assert.match(appSource, /Aanpassing opslaan/);
  assert.match(appSource, /effective: \{ \.\.\.answers \}/);
});

test('leerling vult alle rubricrijen op één scherm in en dient eenmaal in', () => {
  assert.match(rubricViewsSource, /criteria\.map\(\(criterion\) => <LevelPicker/);
  assert.match(rubricViewsSource, /Beoordeling indienen/);
  assert.match(rubricViewsSource, /disabled=\{!complete\}/);
  assert.doesNotMatch(rubricViewsSource, /setStep\(/);
  assert.match(stylesSource, /\.assessment-all-criteria\s*\{[^}]*height:\s*calc\(100vh - 62px\)/s);
  assert.match(stylesSource, /\.assessment-all-criteria\s*\{[^}]*overflow:\s*hidden/s);
  assert.match(stylesSource, /\.assessment-rubric\s*\{[^}]*grid-template-columns:\s*190px minmax\(0, 1fr\)/s);
  assert.match(stylesSource, /\.level-option\s*\{[^}]*grid-template-rows:\s*auto 1fr[^}]*align-content:\s*start/s);
  assert.doesNotMatch(rubricViewsSource, /className="level-detail"/);
});

test('resultaten kunnen per leerlijn worden bekeken', () => {
  assert.match(appSource, /const \[resultsLearningLine, setResultsLearningLine\] = useState\(initialRoute\.resultsLearningLine\)/);
  assert.match(appSource, /item\.rubric\.learningLine === learningLine\.key/);
  assert.match(appSource, /className="results-learning-line-control"/);
  assert.doesNotMatch(appSource, /Oorspronkelijke leerlingbeoordeling/);
});

test('een testbeoordeling kan vanuit Resultaten worden verwijderd', () => {
  assert.match(appSource, /function DeleteAssessmentModal\s*\(/);
  assert.match(appSource, /Beoordeling verwijderen/);
  assert.match(appSource, /assessments\.filter\(\(item\) => item\.id !== modal\.assessment\.id\)/);
  assert.match(appSource, /type: 'deleteAssessment'/);
});

test('rubrics en resultaten ondersteunen een variabel aantal beoordelingsrijen', () => {
  assert.match(appSource, /rubric\.criteria\.filter\(\(criterion\) => assessment\.effective\[criterion\.key\]\)/);
  assert.doesNotMatch(appSource, /assessment\.effective\.movement/);
  assert.match(appSource, /Kies eerst een HAN-leerlijn, daarna een sport of spel en vervolgens de passende bouw/);
  assert.match(appSource, /className="learning-line-rubrics"/);
});

test('rubricbibliotheek ondersteunt bouwvarianten per sport of spel', () => {
  assert.match(appSource, /const \[rubricActivity, setRubricActivity\] = useState\(initialRoute\.rubricActivity\)/);
  assert.match(appSource, /Onderbouw · Middenbouw · Bovenbouw/);
  assert.match(appSource, /CLASS_CLUSTERS\.map\(\(cluster\)/);
  assert.match(appSource, /rubricsForCluster\(classItem\?\.cluster\)/);
});

test('rubrics tonen hun leerlijn en geen gekoppelde verschijningsvorm', () => {
  assert.match(appSource, /<span>Leerlijn<\/span>/);
  assert.match(appSource, /rubric\.learningLine/);
  assert.doesNotMatch(appSource, /Verschijningsvorm/);
  assert.doesNotMatch(appSource, /rubric\.form|activity\.form/);
  assert.doesNotMatch(rubricViewsSource, /rubric\.form/);
});

test('de huidige pagina wordt in de URL bewaard voor verversen', () => {
  assert.match(appSource, /readWorkspaceRoute\(window\.location\.search, data\)/);
  assert.match(appSource, /writeWorkspaceSearch\(url\.search/);
  assert.match(appSource, /window\.history\.replaceState/);
});
