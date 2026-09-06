import { useEffect, useRef, useState } from 'react';
import { doc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { clearRequestedHistoryCache, resolveAccountStorage } from './accountStorage';
import { createInitialState, finalizePastDays, loadCachedState, mergeStates, saveCachedState, todayKey } from './model';

export function useMarathonStore(user) {
  const [state, setState] = useState(null);
  const [ready, setReady] = useState(false);
  const [ownerUid, setOwnerUid] = useState(null);
  const [syncState, setSyncState] = useState('loading');
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const [currentDate, setCurrentDate] = useState(todayKey);
  const [attempt, setAttempt] = useState(0);
  const sessionRef = useRef(null);

  useEffect(() => {
    if (!user || !db) return undefined;
    const session = { alive: true, state: null, storage: null, writable: false, saving: false, timer: null, remoteJson: '', unsubscribe: null };
    sessionRef.current = session;

    const publish = (next) => {
      if (!session.alive) return;
      session.state = next;
      const localSaved = !next || saveCachedState(user.uid, next, session.storage.cacheNamespace);
      setOwnerUid(user.uid);
      setState(next);
      if (!localSaved) setError('Не удалось сохранить на устройстве. Дождись отметки «Сохранено в облаке».');
    };

    const schedule = () => {
      window.clearTimeout(session.timer);
      session.timer = window.setTimeout(flush, 450);
    };

    const flush = async () => {
      if (!session.alive || session.saving || !session.writable || !session.state) return;
      if (JSON.stringify(session.state) === session.remoteJson) return;
      session.saving = true;
      setSyncState('saving');
      let succeeded = false;
      try {
        const documentRef = doc(db, 'users', user.uid, 'trackers', session.storage.documentId);
        const payload = session.state;
        const written = await runTransaction(db, async (transaction) => {
          const snapshot = await transaction.get(documentRef);
          const next = finalizePastDays(mergeStates(snapshot.exists() ? snapshot.data().state : null, payload));
          transaction.set(documentRef, { state: next, updatedAt: serverTimestamp() }, { merge: true });
          return next;
        });
        if (!session.alive) return;
        session.remoteJson = JSON.stringify(written);
        publish(finalizePastDays(mergeStates(written, session.state)));
        setSyncState('synced');
        setError('');
        succeeded = true;
      } catch {
        if (session.alive) {
          setSyncState('offline');
          setError('На устройстве сохранено. Отправка в облако повторится при подключении.');
        }
      } finally {
        session.saving = false;
        if (succeeded && session.alive && JSON.stringify(session.state) !== session.remoteJson) schedule();
      }
    };

    session.commit = (recipe) => {
      if (!session.state) return;
      const now = new Date().toISOString();
      const next = finalizePastDays({ ...recipe(session.state, now), updatedAtClient: now });
      // Persist synchronously with the input event, before a mobile tab can be suspended.
      publish(next);
      setSyncState('saving');
      schedule();
    };

    session.start = async (commitments) => {
      if (!session.writable || session.state?.contractAcceptedAt) return false;
      const next = createInitialState(todayKey(), commitments.acceptedAt, commitments);
      const documentRef = doc(db, 'users', user.uid, 'trackers', session.storage.documentId);
      const saved = await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(documentRef);
        const existing = snapshot.exists() ? snapshot.data().state : null;
        if (existing?.contractAcceptedAt) return existing;
        transaction.set(documentRef, { state: next, updatedAt: serverTimestamp() }, { merge: true });
        return next;
      });
      if (!session.alive) return false;
      session.remoteJson = JSON.stringify(saved);
      publish(saved);
      setSyncState('synced');
      setError('');
      return true;
    };

    const initialize = async () => {
      setReady(false);
      setState(null);
      setOwnerUid(user.uid);
      setError('');
      try {
        session.storage = await resolveAccountStorage(user);
        if (!session.alive) return;
        const documentRef = doc(db, 'users', user.uid, 'trackers', session.storage.documentId);
        publish(finalizePastDays(loadCachedState(user.uid, session.storage.cacheNamespace)));
        if (session.state) setReady(true);
        if (session.storage.resetRequested) {
          await runTransaction(db, async (transaction) => {
            const snapshot = await transaction.get(documentRef);
            if (snapshot.data()?.resetGeneration === session.storage.generation) return;
            session.storage.oldDocumentIds.forEach((id) => transaction.delete(doc(db, 'users', user.uid, 'trackers', id)));
            transaction.set(documentRef, { state: null, resetGeneration: session.storage.generation, updatedAt: serverTimestamp() });
          });
          if (!session.alive) return;
          clearRequestedHistoryCache(user.uid, session.storage);
        }
        session.unsubscribe = onSnapshot(documentRef, { includeMetadataChanges: true }, (snapshot) => {
          if (!session.alive) return;
          const remote = snapshot.exists() ? snapshot.data().state : null;
          if (!snapshot.metadata.hasPendingWrites) session.remoteJson = JSON.stringify(remote);
          session.writable = !snapshot.metadata.fromCache || session.writable;
          publish(finalizePastDays(mergeStates(remote, session.state)));
          setReady(session.writable || Boolean(session.state));
          setSyncState(snapshot.metadata.fromCache ? 'offline' : snapshot.metadata.hasPendingWrites || JSON.stringify(session.state) !== session.remoteJson ? 'saving' : 'synced');
          if (session.writable) schedule();
        }, () => {
          if (!session.alive) return;
          setReady(true);
          setSyncState('offline');
          setError('Не удалось прочитать облачную историю. Проверь подключение и повтори синхронизацию.');
        });
      } catch {
        if (!session.alive) return;
        // A previously reset account may still open its new local history offline.
        if (session.storage && !session.state) publish(finalizePastDays(loadCachedState(user.uid, session.storage.cacheNamespace)));
        setReady(true);
        setSyncState('offline');
        setError('Для сброса истории и нового старта нужно подключение. Повтори синхронизацию.');
      }
    };

    const refresh = () => {
      if (!session.alive) return;
      const date = todayKey();
      setCurrentDate(date);
      const next = finalizePastDays(session.state, date);
      if (next !== session.state) publish(next);
      if (session.writable) flush();
      else if (session.storage && navigator.onLine) setAttempt((value) => value + 1);
    };
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); else flush(); };
    const interval = window.setInterval(refresh, 30000);
    window.addEventListener('online', refresh);
    window.addEventListener('focus', refresh);
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisible);
    initialize();
    return () => {
      session.alive = false;
      window.clearInterval(interval);
      window.clearTimeout(session.timer);
      session.unsubscribe?.();
      window.removeEventListener('online', refresh);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [user, attempt]);

  const start = async (commitments) => {
    if (starting || !commitments) return false;
    setStarting(true);
    try {
      const started = await sessionRef.current?.start(commitments);
      if (!started) setError('Перед стартом дождись подключения к облаку.');
      return started;
    } catch {
      setError('Старт не подтверждён облаком. Проверь интернет и попробуй ещё раз.');
      return false;
    } finally {
      setStarting(false);
    }
  };

  const belongsToUser = user?.uid === ownerUid;
  return { state: belongsToUser ? state : null, ready: ready && belongsToUser, syncState, error, starting, currentDate, start, commit: (recipe) => sessionRef.current?.commit(recipe), retry: () => setAttempt((value) => value + 1) };
}
