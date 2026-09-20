import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const appSource = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');

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
  assert.match(appSource, /const \[selectedClassId, setSelectedClassId\] = useState\(''\)/);
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

test('resultaten kunnen per leerlijn worden bekeken', () => {
  assert.match(appSource, /const \[selectedLearningLine, setSelectedLearningLine\] = useState\(''\)/);
  assert.match(appSource, /item\.rubric\.learningLine === learningLine\.key/);
  assert.match(appSource, /className="results-learning-line-control"/);
  assert.doesNotMatch(appSource, /Oorspronkelijke leerlingbeoordeling/);
});

test('rubrics en resultaten ondersteunen een variabel aantal beoordelingsrijen', () => {
  assert.match(appSource, /rubric\.criteria\.filter\(\(criterion\) => assessment\.effective\[criterion\.key\]\)/);
  assert.doesNotMatch(appSource, /assessment\.effective\.movement/);
  assert.match(appSource, /Kies eerst een HAN-leerlijn, daarna een sport of spel en vervolgens de passende bouw/);
  assert.match(appSource, /className="learning-line-rubrics"/);
});

test('rubricbibliotheek ondersteunt bouwvarianten per sport of spel', () => {
  assert.match(appSource, /const \[selectedActivityId, setSelectedActivityId\] = useState\(null\)/);
  assert.match(appSource, /Onderbouw · Middenbouw · Bovenbouw/);
  assert.match(appSource, /CLASS_CLUSTERS\.map\(\(cluster\)/);
  assert.match(appSource, /rubricsForCluster\(classItem\?\.cluster\)/);
});
