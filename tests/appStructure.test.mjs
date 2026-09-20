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
  assert.match(appSource, /Leren bewegen \+ Samen bewegen/);
  assert.match(appSource, /Alleen Leren bewegen/);
});

test('rapporten kunnen per leerling of voor de gehele klas worden afgedrukt', () => {
  assert.match(appSource, /const \[printScope, setPrintScope\] = useState\('student'\)/);
  assert.match(appSource, /<option value="class">Gehele klas<\/option>/);
  assert.match(appSource, /className="class-report-print"/);
});

test('resultaten vragen eerst om een klaskeuze', () => {
  assert.match(appSource, /const \[selectedClassId, setSelectedClassId\] = useState\(''\)/);
  assert.match(appSource, /Kies eerst een klas om de beoordelingen te bekijken/);
  assert.match(appSource, /setSelectedClassId\(classItem\.id\)/);
});

test('docent kan de zelfbeoordeling apart bekijken en de effectieve beoordeling aanpassen', () => {
  assert.match(appSource, /function ReviewModal\s*\(/);
  assert.match(appSource, /De leerlingbeoordeling is leidend/);
  assert.match(appSource, /Geldende beoordeling · alleen aanpassen indien nodig/);
  assert.match(appSource, /Aanpassing opslaan/);
  assert.match(appSource, /effective: \{ \.\.\.answers \}/);
});

test('resultaten kunnen wisselen tussen de geldende en oorspronkelijke leerlingbeoordeling', () => {
  assert.match(appSource, /const \[resultView, setResultView\] = useState\('effective'\)/);
  assert.match(appSource, /Geldende beoordeling/);
  assert.match(appSource, /Oorspronkelijke leerlingbeoordeling/);
  assert.match(appSource, /Docent aangepast/);
});
