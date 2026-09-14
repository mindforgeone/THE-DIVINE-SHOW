import { useEffect, useRef, useState } from 'react';
import { doc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { createStepsState, loadStepsCache, mergeStepsStates, normalizeStepsState, saveStepsCache, STEPS_DOCUMENT_ID } from './model';

export function useStepsStore(user) {
  const uid = user?.uid;
  const [state, setState] = useState(null);
  const [ownerUid, setOwnerUid] = useState(null);
  const [syncState, setSyncState] = useState('loading');
  const [error, setError] = useState('');
  const sessionRef = useRef(null);

  useEffect(() => {
    if (!uid || !db) return undefined;
    const session = { alive: true, uid, state: null, writable: false, saving: false, connecting: false, listening: false, timer: null, retryAt: 0, remoteJson: 'null', unsubscribe: null };
    sessionRef.current = session;
    const documentRef = doc(db, 'users', uid, 'trackers', STEPS_DOCUMENT_ID);

    const publish = (next) => {
      if (!session.alive) return;
      session.state = normalizeStepsState(next);
      setOwnerUid(uid);
      setState(session.state);
      if (!saveStepsCache(uid, session.state)) setError('Не удалось сохранить шаги на устройстве. Дождись синхронизации с облаком.');
    };
    const schedule = () => {
      clearTimeout(session.timer);
      session.timer = window.setTimeout(flush, 450);
    };
    const flush = async () => {
      if (!session.alive || session.saving || !session.writable || !session.state || JSON.stringify(session.state) === session.remoteJson) return;
      session.saving = true;
      setSyncState('saving');
      let succeeded = false;
      try {
        const payload = session.state;
        const saved = await runTransaction(db, async (transaction) => {
          const snapshot = await transaction.get(documentRef);
          const remote = snapshot.exists() ? snapshot.data().state : null;
          if (remote && remote.version !== 1) throw new Error('incompatible-steps-document');
          const merged = mergeStepsStates(remote, payload);
          transaction.set(documentRef, { state: merged, updatedAt: serverTimestamp() }, { merge: true });
          return merged;
        });
        if (!session.alive) return;
        session.remoteJson = JSON.stringify(saved);
        setError('');
        publish(mergeStepsStates(saved, session.state));
        setSyncState('synced');
        succeeded = true;
      } catch (failure) {
        if (session.alive) {
          setSyncState('offline');
          setError(failure?.code === 'permission-denied' ? 'Облако не разрешает сохранять шаги. Проверь доступ Firebase.' : 'Шаги сохранены на устройстве. Облако пока недоступно; повтори синхронизацию.');
        }
      } finally {
        session.saving = false;
        if (succeeded && session.alive && JSON.stringify(session.state) !== session.remoteJson) schedule();
      }
    };
    const failed = (failure) => {
      if (!session.alive) return;
      session.writable = false;
      session.listening = false;
      session.unsubscribe?.();
      session.unsubscribe = null;
      session.retryAt = Date.now() + 30000;
      setSyncState('offline');
      setError(failure?.code === 'permission-denied' ? 'История шагов недоступна в Firebase. Проверь правила доступа.' : 'История шагов пока доступна только на устройстве. Повтори загрузку.');
    };
    const connect = (force = false) => {
      if (!session.alive || session.connecting || (!force && (session.listening || Date.now() < session.retryAt))) return;
      session.connecting = true;
      session.unsubscribe?.();
      session.listening = true;
      session.writable = false;
      session.unsubscribe = onSnapshot(documentRef, { includeMetadataChanges: true }, (snapshot) => {
        if (!session.alive) return;
        const remote = snapshot.exists() ? snapshot.data().state : null;
        if (remote && remote.version !== 1) { failed({ code: 'incompatible-document' }); return; }
        if (!snapshot.metadata.hasPendingWrites) session.remoteJson = JSON.stringify(remote);
        session.writable = !snapshot.metadata.fromCache || session.writable;
        if (!snapshot.metadata.fromCache) setError('');
        publish(mergeStepsStates(remote, session.state));
        setSyncState(snapshot.metadata.fromCache ? 'offline' : snapshot.metadata.hasPendingWrites || JSON.stringify(session.state) !== session.remoteJson ? 'saving' : 'synced');
        if (session.writable) schedule();
      }, failed);
      session.connecting = false;
    };
    session.commit = (recipe) => {
      if (!session.alive || !session.state) return;
      const now = new Date().toISOString();
      const next = recipe(session.state, now);
      if (next === session.state) return;
      publish({ ...next, updatedAtClient: now });
      setSyncState('saving');
      schedule();
    };
    session.retry = () => session.writable ? flush() : connect(true);
    publish(loadStepsCache(uid) || createStepsState());
    connect();
    const refresh = () => {
      if (session.writable) flush();
      else if (navigator.onLine) connect();
    };
    window.addEventListener('online', refresh);
    window.addEventListener('focus', refresh);
    window.addEventListener('pagehide', flush);
    const interval = window.setInterval(refresh, 30000);
    return () => {
      session.alive = false;
      if (sessionRef.current === session) sessionRef.current = null;
      clearTimeout(session.timer);
      clearInterval(interval);
      session.unsubscribe?.();
      window.removeEventListener('online', refresh);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('pagehide', flush);
    };
  }, [uid]);

  return { state: uid === ownerUid ? state : null, syncState, error, commit: (recipe) => sessionRef.current?.commit(recipe), retry: () => sessionRef.current?.retry() };
}
