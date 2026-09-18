export const ACTIVE_SESSION_KEY = 'rubrics-lo-active-session';

export function saveSessionLock(storage, userId, activeSession) {
  storage.setItem(ACTIVE_SESSION_KEY, JSON.stringify({ userId, activeSession }));
}

export function loadSessionLock(storage, userId, classIds) {
  try {
    const stored = JSON.parse(storage.getItem(ACTIVE_SESSION_KEY));
    if (stored?.userId !== userId) return null;
    const classId = stored.activeSession?.series?.classId;
    if (!classId || !classIds.includes(classId)) return null;
    if (!stored.activeSession?.sessionId || !stored.activeSession?.occurrence?.key) return null;
    return stored.activeSession;
  } catch { return null; }
}

export function clearSessionLock(storage) {
  storage.removeItem(ACTIVE_SESSION_KEY);
}
