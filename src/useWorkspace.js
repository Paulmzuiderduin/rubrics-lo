import { useCallback, useEffect, useRef, useState } from 'react';
import { createEmptyData } from './data.js';
import { clearLocalData, hasLocalData, hydrateData, loadData } from './storage.mjs';
import { loadRemoteWorkspace, saveRemoteWorkspace } from './cloudStorage.mjs';
import { supabase } from './supabase.js';

export function useWorkspace(user) {
  const [state, setState] = useState({ data: null, phase: 'loading', sync: 'idle', error: '' });
  const dataRef = useRef(null);
  const saveQueue = useRef(Promise.resolve());
  const saveVersion = useRef(0);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, data: null, phase: 'loading', error: '' }));
    loadRemoteWorkspace(supabase, user.id)
      .then((remote) => {
        if (!active) return;
        if (!remote) {
          setState({ data: null, phase: 'setup', sync: 'idle', error: '', hasLocal: hasLocalData(localStorage) });
          return;
        }
        const next = hydrateData(remote.data);
        dataRef.current = next;
        setState({ data: next, phase: 'ready', sync: 'saved', error: '', updatedAt: remote.updatedAt });
      })
      .catch((error) => {
        if (active) setState({ data: null, phase: 'error', sync: 'error', error: error.message || 'De gegevens konden niet worden geladen.' });
      });
    return () => { active = false; };
  }, [user.id, reloadKey]);

  const initialize = useCallback(async (source) => {
    setState((current) => ({ ...current, phase: 'loading', error: '' }));
    try {
      const next = source === 'local' && hasLocalData(localStorage) ? loadData(localStorage) : createEmptyData();
      const saved = await saveRemoteWorkspace(supabase, user.id, next);
      clearLocalData(localStorage);
      dataRef.current = next;
      setState({ data: next, phase: 'ready', sync: 'saved', error: '', updatedAt: saved.updated_at });
    } catch (error) {
      setState((current) => ({ ...current, phase: 'setup', sync: 'error', error: error.message || 'De werkomgeving kon niet worden aangemaakt.' }));
    }
  }, [user.id]);

  const setData = useCallback((updater) => {
    const current = dataRef.current;
    if (!current) return;
    const next = typeof updater === 'function' ? updater(current) : updater;
    dataRef.current = next;
    const version = ++saveVersion.current;
    setState((previous) => ({ ...previous, data: next, sync: 'saving', error: '' }));
    const task = saveQueue.current
      .catch(() => undefined)
      .then(() => saveRemoteWorkspace(supabase, user.id, next));
    saveQueue.current = task;
    task.then((saved) => {
      if (saveVersion.current === version) setState((previous) => ({ ...previous, sync: 'saved', updatedAt: saved.updated_at, error: '' }));
    }).catch((error) => {
      if (saveVersion.current === version) setState((previous) => ({ ...previous, sync: 'error', error: error.message || 'Opslaan in Supabase is mislukt.' }));
    });
  }, [user.id]);

  return {
    ...state,
    setData,
    initialize,
    retry: () => setReloadKey((value) => value + 1),
  };
}
