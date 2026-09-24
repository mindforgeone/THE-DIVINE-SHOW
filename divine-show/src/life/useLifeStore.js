import { useEffect, useRef, useState } from 'react';
import { doc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { createLifeState, LIFE_DOCUMENT_ID, loadLifeCache, mergeLifeStates, normalizeLifeState, saveLifeCache } from './model';

export function useLifeStore(user) {
  const uid = user?.uid;
  const [state, setState] = useState(null);
  const [ownerUid, setOwnerUid] = useState(null);
  const [syncState, setSyncState] = useState('loading');
  const [error, setError] = useState('');
  const sessionRef = useRef(null);

  useEffect(() => {
    if (!uid || !db) return undefined;
    const session = { alive: true, state: null, writable: false, saving: false, connecting: false, listening: false, retryAt: 0, timer: null, remoteJson: 'null', unsubscribe: null };
    const documentRef = doc(db, 'users', uid, 'trackers', LIFE_DOCUMENT_ID);
    sessionRef.current = session;
    const publish = (next) => {
      if (!session.alive) return;
      session.state = normalizeLifeState(next);
      setOwnerUid(uid);
      setState(session.state);
      if (!saveLifeCache(uid, session.state)) setError('Данные Курса не удалось сохранить на устройстве. Дождись облака.');
    };
    const flush = async () => {
      if (!session.alive || session.saving || !session.writable || !session.state || JSON.stringify(session.state) === session.remoteJson) return;
      session.saving = true;
      setSyncState('saving');
      try {
        const payload = session.state;
        const saved = await runTransaction(db, async (transaction) => {
          const snapshot = await transaction.get(documentRef);
          const merged = mergeLifeStates(snapshot.exists() ? snapshot.data().state : null, payload);
          transaction.set(documentRef, { state: merged, updatedAt: serverTimestamp() }, { merge: true });
          return merged;
        });
        if (!session.alive) return;
        session.remoteJson = JSON.stringify(saved);
        setError('');
        publish(mergeLifeStates(saved, session.state));
        setSyncState('synced');
      } catch (failure) {
        if (session.alive) {
          setSyncState('offline');
          setError(failure?.code === 'permission-denied' ? 'Облако не разрешает сохранять Курс. Проверь правила Firebase.' : 'Курс сохранён на устройстве. Облако пока недоступно.');
        }
      } finally {
        session.saving = false;
      }
    };
    const schedule = () => {
      clearTimeout(session.timer);
      session.timer = window.setTimeout(flush, 450);
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
    publish(loadLifeCache(uid) || createLifeState());

    const connectionFailed = (failure) => {
      if (!session.alive) return;
      session.writable = false;
      session.listening = false;
      session.unsubscribe?.();
      session.unsubscribe = null;
      session.retryAt = Date.now() + 30000;
      setSyncState('offline');
      setError(failure?.code === 'permission-denied' ? 'История Курса недоступна в Firebase.' : 'Курс пока доступен только на этом устройстве.');
    };
    const connect = (force = false) => {
      if (!session.alive || session.connecting || (!force && (session.listening || Date.now() < session.retryAt))) return;
      session.connecting = true;
      session.unsubscribe?.();
      session.unsubscribe = null;
      session.listening = false;
      try {
        session.unsubscribe = onSnapshot(documentRef, { includeMetadataChanges: true }, (snapshot) => {
          if (!session.alive) return;
          const remote = snapshot.exists() ? snapshot.data().state : null;
          if (!snapshot.metadata.hasPendingWrites) session.remoteJson = JSON.stringify(remote);
          session.writable = !snapshot.metadata.fromCache || session.writable;
          session.listening = true;
          if (!snapshot.metadata.fromCache) setError('');
          publish(mergeLifeStates(remote, session.state));
          setSyncState(snapshot.metadata.fromCache ? 'offline' : snapshot.metadata.hasPendingWrites || JSON.stringify(session.state) !== session.remoteJson ? 'saving' : 'synced');
          if (session.writable) schedule();
        }, connectionFailed);
        session.listening = true;
      } catch (failure) {
        connectionFailed(failure);
      } finally {
        session.connecting = false;
      }
    };
    session.retry = () => session.writable ? flush() : connect(true);
    connect();
    const refresh = () => {
      if (session.writable) flush();
      else if (navigator.onLine) connect();
    };
    window.addEventListener('online', refresh);
    window.addEventListener('focus', refresh);
    window.addEventListener('pagehide', flush);
    return () => {
      session.alive = false;
      clearTimeout(session.timer);
      session.unsubscribe?.();
      window.removeEventListener('online', refresh);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('pagehide', flush);
    };
  }, [uid]);

  return { state: uid === ownerUid ? state : null, syncState, error, commit: (recipe) => sessionRef.current?.commit(recipe), retry: () => sessionRef.current?.retry() };
}
