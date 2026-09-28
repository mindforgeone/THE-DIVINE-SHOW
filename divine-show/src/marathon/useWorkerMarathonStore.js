import { useEffect, useRef, useState } from 'react';
import { clearCachedState, createInitialState, finalizePastDays, loadCachedState, mergeStates, saveCachedState, todayKey, buildMarathonSummary } from './model';
import { resolveAccountStorage } from './accountStorage';
import { loadCloudPayload, saveCloudPayload } from './cloudSync';

const POLL_INTERVAL = 3000;

function mergeHistory(remote = [], local = []) {
  const items = new Map();
  [...remote, ...local].forEach((item) => {
    if (!item?.journeyId) return;
    const previous = items.get(item.journeyId);
    if (!previous || String(item.completedAt || '') >= String(previous.completedAt || '')) items.set(item.journeyId, item);
  });
  return [...items.values()].sort((a, b) => String(b.completedAt || '').localeCompare(String(a.completedAt || '')));
}

function historyCacheKey(uid, namespace) {
  return `${namespace}:history:${uid}`;
}

function loadHistory(uid, namespace) {
  try {
    const value = JSON.parse(localStorage.getItem(historyCacheKey(uid, namespace)) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function saveHistory(uid, namespace, history) {
  try {
    localStorage.setItem(historyCacheKey(uid, namespace), JSON.stringify(history));
  } catch {
    // The worker copy remains authoritative when browser storage is full.
  }
}

export function useWorkerMarathonStore(user) {
  const [state, setState] = useState(null);
  const [history, setHistory] = useState([]);
  const [ready, setReady] = useState(false);
  const [ownerUid, setOwnerUid] = useState(null);
  const [syncState, setSyncState] = useState('loading');
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const [currentDate, setCurrentDate] = useState(todayKey);
  const sessionRef = useRef(null);
  const uid = user?.uid;
  const email = user?.email;

  useEffect(() => {
    if (!uid) return undefined;
    const session = {
      alive: true,
      state: null,
      history: [],
      storage: null,
      revision: 0,
      resetGeneration: '',
      remoteJson: '',
      writable: false,
      saving: false,
      connecting: false,
      pending: false,
      timer: null,
      pollTimer: null,
    };
    sessionRef.current = session;

    const publish = (next) => {
      if (!session.alive) return;
      session.state = next ? finalizePastDays(next) : null;
      if (session.state) saveCachedState(uid, session.state, session.storage.cacheNamespace);
      else clearCachedState(uid, session.storage.cacheNamespace);
      setOwnerUid(uid);
      setState(session.state);
    };

    const publishHistory = (next) => {
      if (!session.alive) return;
      session.history = mergeHistory(next);
      saveHistory(uid, session.storage.cacheNamespace, session.history);
      setHistory(session.history);
    };

    const currentPayload = () => ({
      version: 1,
      state: session.state,
      history: session.history,
      resetGeneration: session.resetGeneration || null,
    });

    const schedule = (delay = 300) => {
      window.clearTimeout(session.timer);
      session.timer = window.setTimeout(flush, delay);
    };

    const acceptRemote = (result) => {
      const payload = result?.payload;
      session.revision = Number(result?.revision || 0);
      if (!payload) {
        session.remoteJson = '';
        return;
      }
      const resetChanged = payload.resetGeneration && payload.resetGeneration !== session.resetGeneration;
      session.resetGeneration = payload.resetGeneration || session.resetGeneration;
      if (resetChanged && !payload.state) publish(null);
      else publish(mergeStates(payload.state, session.state));
      publishHistory(mergeHistory(payload.history, session.history));
      session.remoteJson = JSON.stringify(payload);
    };

    async function flush() {
      if (!session.alive || !session.writable) return false;
      if (session.saving) {
        session.pending = true;
        return false;
      }
      const outgoing = currentPayload();
      const outgoingJson = JSON.stringify(outgoing);
      if (outgoingJson === session.remoteJson) {
        setSyncState('synced');
        return true;
      }
      session.saving = true;
      session.pending = false;
      setSyncState('saving');
      try {
        const result = await saveCloudPayload(user, outgoing, session.revision);
        if (!session.alive) return false;
        session.revision = Number(result.revision || session.revision + 1);
        session.remoteJson = outgoingJson;
        setError('');
        setSyncState('synced');
        return true;
      } catch (failure) {
        if (!session.alive) return false;
        if (failure.status === 409 && failure.remote) {
          acceptRemote(failure.remote);
          session.writable = true;
          session.pending = true;
          setSyncState('saving');
          return false;
        }
        session.writable = false;
        setSyncState('offline');
        setError('Данные сохранены на устройстве. Не закрывай вкладку: облачная синхронизация повторится автоматически.');
        return false;
      } finally {
        session.saving = false;
        if (session.alive && (session.pending || JSON.stringify(currentPayload()) !== session.remoteJson)) schedule(250);
      }
    }

    const connect = async (force = false) => {
      if (!session.alive || session.connecting || (!force && session.writable)) return;
      session.connecting = true;
      if (!session.state) setSyncState('loading');
      try {
        if (!session.storage) {
          session.storage = await resolveAccountStorage({ uid, email });
          if (!session.alive) return;
          publish(loadCachedState(uid, session.storage.cacheNamespace));
          publishHistory(loadHistory(uid, session.storage.cacheNamespace));
        }
        const result = await loadCloudPayload(user);
        if (!session.alive) return;
        acceptRemote(result);
        session.writable = true;
        setReady(true);
        setError('');
        if (JSON.stringify(currentPayload()) !== session.remoteJson) {
          setSyncState('saving');
          schedule(0);
        } else {
          setSyncState('synced');
        }
      } catch {
        if (!session.alive) return;
        session.writable = false;
        setReady(Boolean(session.state));
        setSyncState('offline');
        setError(session.state ? 'История открыта с устройства. Подключение к облаку будет восстановлено автоматически.' : 'Не удалось загрузить облачную историю. Проверь интернет и повтори.');
      } finally {
        session.connecting = false;
      }
    };

    const poll = async () => {
      if (!session.alive || session.saving || document.visibilityState !== 'visible') return;
      try {
        const result = await loadCloudPayload(user);
        if (!session.alive) return;
        if (Number(result.revision || 0) !== session.revision) acceptRemote(result);
        session.writable = true;
        setReady(true);
        setError('');
        if (JSON.stringify(currentPayload()) !== session.remoteJson) {
          setSyncState('saving');
          schedule(0);
        } else {
          setSyncState('synced');
        }
      } catch {
        if (!session.alive) return;
        session.writable = false;
        setSyncState('offline');
      }
    };

    session.commit = (recipe) => {
      if (!session.alive || !session.state) return;
      const now = new Date().toISOString();
      publish(finalizePastDays({ ...recipe(session.state, now), updatedAtClient: now }));
      setSyncState('saving');
      schedule();
    };
    session.start = async (commitments, durationDays) => {
      if (!session.alive || session.state?.contractAcceptedAt) return false;
      publish(createInitialState(todayKey(), commitments.acceptedAt, commitments, durationDays));
      setSyncState('saving');
      if (session.writable) await flush();
      else connect(true);
      return true;
    };
    session.startNext = async () => {
      if (!session.alive || !session.state?.completedAt) return false;
      const summary = session.state.completionSummary || buildMarathonSummary(session.state);
      publishHistory([summary, ...session.history]);
      session.resetGeneration = `next-${uid}-${new Date().toISOString()}`;
      publish(null);
      setSyncState('saving');
      if (session.writable) await flush();
      else connect(true);
      return true;
    };
    session.resetJourney = async () => {
      if (!session.alive) return false;
      session.resetGeneration = `manual-${uid}-${new Date().toISOString()}`;
      publish(null);
      setSyncState('saving');
      if (session.writable) return flush();
      connect(true);
      return true;
    };
    session.retry = () => session.writable ? flush() : connect(true);

    resolveAccountStorage({ uid, email }).then((storage) => {
      if (!session.alive || session.storage) return;
      session.storage = storage;
      publish(loadCachedState(uid, storage.cacheNamespace));
      publishHistory(loadHistory(uid, storage.cacheNamespace));
      connect(true);
    }).catch(() => connect(true));

    const refresh = () => {
      if (!session.alive) return;
      setCurrentDate(todayKey());
      if (session.writable) poll();
      else if (navigator.onLine) connect(true);
    };
    session.pollTimer = window.setInterval(poll, POLL_INTERVAL);
    window.addEventListener('online', refresh);
    window.addEventListener('focus', refresh);
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      session.alive = false;
      if (sessionRef.current === session) sessionRef.current = null;
      window.clearTimeout(session.timer);
      window.clearInterval(session.pollTimer);
      window.removeEventListener('online', refresh);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [uid, email, user]);

  const start = async (commitments, durationDays) => {
    if (starting || !commitments) return false;
    setStarting(true);
    try {
      return Boolean(await sessionRef.current?.start(commitments, durationDays));
    } finally {
      setStarting(false);
    }
  };

  const belongsToUser = uid === ownerUid;
  return {
    state: belongsToUser ? state : null,
    history: belongsToUser ? history : [],
    ready: ready && belongsToUser,
    syncState,
    error,
    starting,
    currentDate,
    start,
    startNext: () => sessionRef.current?.startNext(),
    resetJourney: () => sessionRef.current?.resetJourney(),
    commit: (recipe) => sessionRef.current?.commit(recipe),
    retry: () => sessionRef.current?.retry(),
  };
}
