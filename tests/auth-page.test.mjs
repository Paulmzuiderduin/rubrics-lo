import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('publieke beginpagina legt doel, functies en contact uit', async () => {
  const authPage = await readFile(new URL('../src/AuthRoot.jsx', import.meta.url), 'utf8');

  assert.match(authPage, /digitale werkomgeving voor docenten lichamelijke opvoeding/i);
  assert.match(authPage, /Formatief handelen/);
  assert.match(authPage, /Rubrics specifiek voor het VO/);
  assert.match(authPage, /onderwijsvisie van de HAN/);
  assert.match(authPage, /mailto:info@paulzuiderduin\.com/);
  assert.match(authPage, /Beveiligde docentenomgeving/);
  assert.match(authPage, /Inloggen/);
});
