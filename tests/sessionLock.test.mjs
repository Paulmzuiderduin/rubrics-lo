import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTIVE_SESSION_KEY, clearSessionLock, loadSessionLock, saveSessionLock } from '../src/sessionLock.mjs';

function memoryStorage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key), values };
}

const activeSession = { sessionId: 'session-1', occurrence: { key: '2026-09-18|slot-1' }, series: { classId: 'class-1' } };

test('leerlingmodus blijft voor dezelfde docent vergrendeld na verversen', () => {
  const storage = memoryStorage();
  saveSessionLock(storage, 'teacher-1', activeSession);
  assert.deepEqual(loadSessionLock(storage, 'teacher-1', ['class-1']), activeSession);
});

test('een sessieslot wordt nooit tussen accounts hergebruikt', () => {
  const storage = memoryStorage();
  saveSessionLock(storage, 'teacher-1', activeSession);
  assert.equal(loadSessionLock(storage, 'teacher-2', ['class-1']), null);
  assert.equal(loadSessionLock(storage, 'teacher-1', ['class-2']), null);
  clearSessionLock(storage);
  assert.equal(storage.getItem(ACTIVE_SESSION_KEY), null);
});
