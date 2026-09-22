import { useCallback, useEffect, useRef, useState } from 'react';
import { createEmptyData } from './data.js';
import { clearLocalData, hasLocalData, hydrateData, loadData } from './storage.mjs';
import { loadRemoteWorkspace, saveRemoteWorkspace } from './cloudStorage.mjs';
import { diffWorkspace } from './workspaceDiff.mjs';
import { supabase } from './supabase.js';

export function useWorkspace(user) {
  const [state, setState] = useState({ data: null, phase: 'loading', sync: 'idle', error: '', conflict: false });
  const dataRef = useRef(null);
  const lastSavedData = useRef(null);
  const saveQueue = useRef(Promise.resolve());
  const saveVersion = useRef(0);
  const remoteUpdatedAt = useRef(null);
  const saveBlocked = useRef(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, data: null, phase: 'loading', error: '' }));
    loadRemoteWorkspace(supabase)
      .then((remote) => {
        if (!active) return;
        if (!remote) {
          setState({ data: null, phase: 'setup', sync: 'idle', error: '', conflict: false, hasLocal: hasLocalData(localStorage) });
          return;
        }
        const next = hydrateData(remote.data);
        dataRef.current = next;
        lastSavedData.current = next;
        remoteUpdatedAt.current = remote.updatedAt;
        saveBlocked.current = false;
        setState({ data: next, phase: 'ready', sync: 'saved', error: '', conflict: false, updatedAt: remote.updatedAt });
      })
      .catch((error) => {
        if (active) setState({ data: null, phase: 'error', sync: 'error', error: 'De gegevens konden niet worden geladen. Controleer de verbinding en probeer opnieuw.', conflict: false });
      });
    return () => { active = false; };
  }, [user.id, reloadKey]);

  const initialize = useCallback(async (source) => {
    setState((current) => ({ ...current, phase: 'loading', error: '' }));
    try {
      const next = source === 'local' && hasLocalData(localStorage) ? loadData(localStorage) : createEmptyData();
      const saved = await saveRemoteWorkspace(supabase, diffWorkspace({}, next), null);
      clearLocalData(localStorage);
      dataRef.current = next;
      lastSavedData.current = next;
      remoteUpdatedAt.current = saved.updated_at;
      saveBlocked.current = false;
      setState({ data: next, phase: 'ready', sync: 'saved', error: '', conflict: false, updatedAt: saved.updated_at });
    } catch (error) {
      setState((current) => ({ ...current, phase: 'setup', sync: 'error', error: error.code === '40001' ? 'Er bestaat al een opgeslagen werkomgeving. Laad de pagina opnieuw om die te openen.' : 'De werkomgeving kon niet worden aangemaakt. Controleer de verbinding en probeer opnieuw.', conflict: error.code === '40001' }));
    }
  }, [user.id]);

  const setData = useCallback((updater) => {
    const current = dataRef.current;
    if (!current) return;
    const next = typeof updater === 'function' ? updater(current) : updater;
    const changes = diffWorkspace(current, next);
    dataRef.current = next;
    const version = ++saveVersion.current;
    setState((previous) => ({ ...previous, data: next, sync: saveBlocked.current ? 'error' : 'saving', error: saveBlocked.current ? previous.error : '', conflict: saveBlocked.current ? previous.conflict : false }));
    if (saveBlocked.current) return;
    const task = saveQueue.current.then(async () => {
      if (saveBlocked.current) return null;
      const saved = await saveRemoteWorkspace(supabase, changes, remoteUpdatedAt.current);
      remoteUpdatedAt.current = saved.updated_at;
      lastSavedData.current = next;
      return saved;
    });
    saveQueue.current = task.catch(() => undefined);
    task.then((saved) => {
      if (saved && saveVersion.current === version) setState((previous) => ({ ...previous, sync: 'saved', updatedAt: saved.updated_at, error: '' }));
    }).catch((error) => {
      saveBlocked.current = true;
      setState((previous) => ({ ...previous, sync: 'error', error: error.code === '40001' ? 'Een andere sessie heeft ondertussen wijzigingen opgeslagen. Je wijzigingen zijn nog in dit venster beschikbaar; download ze voordat je de nieuwste versie opnieuw laadt.' : 'Opslaan is mislukt. Je wijzigingen zijn nog in dit venster beschikbaar. Controleer de verbinding en probeer opnieuw.', conflict: error.code === '40001' }));
    });
  }, [user.id]);

  const retrySave = useCallback(() => {
    if (!dataRef.current) return;
    const version = saveVersion.current;
    const pendingData = dataRef.current;
    saveBlocked.current = false;
    setState((previous) => ({ ...previous, sync: 'saving', error: '', conflict: false }));
    const changes = diffWorkspace(lastSavedData.current || {}, pendingData);
    const task = saveQueue.current.then(async () => {
      const saved = await saveRemoteWorkspace(supabase, changes, remoteUpdatedAt.current);
      remoteUpdatedAt.current = saved.updated_at;
      lastSavedData.current = pendingData;
      return saved;
    });
    saveQueue.current = task.catch(() => undefined);
    task.then((saved) => {
      if (saveVersion.current === version) setState((previous) => ({ ...previous, sync: 'saved', updatedAt: saved.updated_at, error: '', conflict: false }));
    }).catch((error) => {
      saveBlocked.current = true;
      setState((previous) => ({ ...previous, sync: 'error', error: error.code === '40001' ? 'De opgeslagen versie is nieuwer. Download de wijzigingen uit dit venster voordat je de nieuwste versie opnieuw laadt.' : 'Opslaan is opnieuw mislukt. Je wijzigingen zijn nog in dit venster beschikbaar.', conflict: error.code === '40001' }));
    });
  }, [user.id]);

  const downloadUnsaved = useCallback(() => {
    if (!dataRef.current) return;
    if (!window.confirm('Dit bestand kan leerlingnamen en beoordelingen bevatten. Bewaar het alleen op een beveiligde plek. Downloaden?')) return;
    const blob = new Blob([JSON.stringify(dataRef.current, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rubrics-lo-unsaved-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, []);

  const reloadSaved = useCallback(() => {
    if (!window.confirm('Niet-opgeslagen wijzigingen uit dit venster gaan verloren. Download eerst een backup als u deze wilt bewaren. Doorgaan?')) return;
    setReloadKey((value) => value + 1);
  }, []);

  useEffect(() => {
    if (state.sync !== 'saving' && state.sync !== 'error') return undefined;
    const warnBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [state.sync]);

  return {
    ...state,
    setData,
    initialize,
    retry: () => setReloadKey((value) => value + 1),
    retrySave,
    downloadUnsaved,
    reloadSaved,
  };
}
