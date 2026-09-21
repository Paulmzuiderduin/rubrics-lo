import test from 'node:test';
import assert from 'node:assert/strict';
import { guessMapping, normalizeSheet, parseCsv, sortStudentsByLastName, studentsFromRows } from '../src/utils.mjs';

test('CSV met puntkomma en aanhalingstekens wordt correct gelezen', () => {
  assert.deepEqual(parseCsv('Naam;Klas\n"De Wit, Bo";2A\nIsa Jansen;2A'), [['Naam', 'Klas'], ['De Wit, Bo', '2A'], ['Isa Jansen', '2A']]);
});

test('naamkolom wordt herkend en lege of dubbele namen verdwijnen', () => {
  const sheet = normalizeSheet([['Leerlingnaam', 'Klas'], ['Bo de Wit', '2A'], ['', '2A'], ['bo de wit', '2A']]);
  const mapping = guessMapping(sheet.headers);
  assert.equal(mapping.name, 0);
  assert.deepEqual(studentsFromRows(sheet.rows, mapping).map((student) => student.name), ['Bo de Wit']);
});

test('voor- en achternaam kunnen uit losse kolommen komen', () => {
  const sheet = normalizeSheet([['Voornaam', 'Achternaam'], ['Lina', 'Vermeer']]);
  const mapping = guessMapping(sheet.headers);
  assert.deepEqual(studentsFromRows(sheet.rows, mapping).map((student) => student.name), ['Lina Vermeer']);
});

test('leerlingen worden alfabetisch op achternaam gesorteerd', () => {
  const students = [
    { id: '1', name: 'Zara Vermeer' },
    { id: '2', name: 'Bo de Wit' },
    { id: '3', name: 'Amir Bakker' },
    { id: '4', name: 'Lina Bakker' },
  ];
  assert.deepEqual(sortStudentsByLastName(students).map((item) => item.name), ['Amir Bakker', 'Lina Bakker', 'Zara Vermeer', 'Bo de Wit']);
});
