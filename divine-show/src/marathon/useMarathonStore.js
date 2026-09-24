import { useEffect, useRef, useState } from 'react';
import { doc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { historyErrorMessage } from '../auth/errors';
import { clearRequestedHistoryCache, resolveAccountStorage } from './accountStorage';
import { buildMarathonSummary, clearCachedState, createInitialState, finalizePastDays, loadCachedState, mergeStates, saveCachedState, todayKey } from './model';

export function useMarathonStore(user) {
  const [state, setState] = useState(null);
  const [ready, setReady] = useState(false);
  const [ownerUid, setOwnerUid] = useState(null);
  const [syncState, setSyncState] = useState('loading');
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const [history, setHistory] = useState([]);
  const [currentDate, setCurrentDate] = useState(todayKey);
  const sessionRef = useRef(null);
  const uid = user?.uid;
  const email = user?.email;

  useEffect(() => {
    if (!uid || !db) return undefined;
    const session = { alive: true, uid, state: null, storage: null, writable: false, saving: false, connecting: false, listening: false, resetChecked: false, retryAt: 0, localSaved: true, timer: null, remoteJson: '', unsubscribe: null, unsubscribeHistory: null };
    sessionRef.current = session;

    const publish = (next) => {
      if (!session.alive) return;
      session.state = next;
      if (!next) clearCachedState(uid, session.storage.cacheNamespace);
      session.localSaved = !next || saveCachedState(uid, next, session.storage.cacheNamespace);
      setOwnerUid(uid);
      setState(next);
      if (!session.localSaved) setError('Не удалось сохранить на устройстве. Дождись отметки «Сохранено в облаке».');
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
        const documentRef = doc(db, 'users', uid, 'trackers', session.storage.documentId);
        const payload = session.state;
        const written = await runTransaction(db, async (transaction) => {
          const snapshot = await transaction.get(documentRef);
          const next = finalizePastDays(mergeStates(snapshot.exists() ? snapshot.data().state : null, payload));
          let historyRef;
          let historySnapshot;
          if (next?.completedAt) {
            historyRef = doc(db, 'users', uid, 'trackers', 'marathon-history-v1');
            historySnapshot = await transaction.get(historyRef);
          }
          transaction.set(documentRef, { state: next, updatedAt: serverTimestamp() }, { merge: true });
          if (next?.completedAt) {
            const summary = next.completionSummary || buildMarathonSummary(next);
            const previousItems = historySnapshot.exists() && Array.isArray(historySnapshot.data().items) ? historySnapshot.data().items : [];
            const items = [summary, ...previousItems.filter((item) => item.journeyId !== next.journeyId)].sort((a, b) => String(b.completedAt).localeCompare(String(a.completedAt)));
            transaction.set(doc(db, 'users', uid, 'marathons', next.journeyId), { state: next, summary, updatedAt: serverTimestamp() });
            transaction.set(historyRef, { items, updatedAt: serverTimestamp() });
          }
          return next;
        });
        if (!session.alive) return;
        session.remoteJson = JSON.stringify(written);
        setError('');
        publish(finalizePastDays(mergeStates(written, session.state)));
        setSyncState('synced');
        succeeded = true;
      } catch (failure) {
        if (session.alive) {
          setSyncState('offline');
          setError(failure?.code === 'permission-denied' || failure?.code === 'unauthenticated' ? historyErrorMessage(failure) : session.localSaved ? 'На устройстве сохранено. Отправка в облако повторится при подключении.' : 'Не удалось сохранить изменения на устройстве и в облаке. Не закрывай вкладку и повтори синхронизацию.');
        }
      } finally {
        session.saving = false;
        if (succeeded && session.alive && JSON.stringify(session.state) !== session.remoteJson) schedule();
      }
    };

    session.commit = (recipe) => {
      if (!session.alive || !session.state) return;
      const now = new Date().toISOString();
      const next = finalizePastDays({ ...recipe(session.state, now), updatedAtClient: now });
      // Persist synchronously with the input event, before a mobile tab can be suspended.
      publish(next);
      setSyncState('saving');
      schedule();
    };

    session.start = async (commitments, durationDays) => {
      if (!session.alive || !session.writable || session.state?.contractAcceptedAt) return false;
      const next = createInitialState(todayKey(), commitments.acceptedAt, commitments, durationDays);
      const documentRef = doc(db, 'users', uid, 'trackers', session.storage.documentId);
      const saved = await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(documentRef);
        const existing = snapshot.exists() ? snapshot.data().state : null;
        if (existing?.contractAcceptedAt) return existing;
        transaction.set(documentRef, { state: next, updatedAt: serverTimestamp() }, { merge: true });
        return next;
      });
      if (!session.alive) return false;
      session.remoteJson = JSON.stringify(saved);
      setError('');
      publish(saved);
      setSyncState('synced');
      return true;
    };

    session.startNext = async () => {
      if (!session.alive || !session.writable || !session.state?.completedAt) return false;
      const documentRef = doc(db, 'users', uid, 'trackers', session.storage.documentId);
      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(documentRef);
        const existing = snapshot.exists() ? snapshot.data().state : null;
        if (!existing?.completedAt) throw new Error('journey-not-complete');
        const summary = existing.completionSummary || buildMarathonSummary(existing);
        const historyRef = doc(db, 'users', uid, 'trackers', 'marathon-history-v1');
        const historySnapshot = await transaction.get(historyRef);
        const previousItems = historySnapshot.exists() && Array.isArray(historySnapshot.data().items) ? historySnapshot.data().items : [];
        const items = [summary, ...previousItems.filter((item) => item.journeyId !== existing.journeyId)].sort((a, b) => String(b.completedAt).localeCompare(String(a.completedAt)));
        transaction.set(doc(db, 'users', uid, 'marathons', existing.journeyId), { state: existing, summary, updatedAt: serverTimestamp() });
        transaction.set(historyRef, { items, updatedAt: serverTimestamp() });
        transaction.set(documentRef, { state: null, resetGeneration: session.storage.generation, updatedAt: serverTimestamp() });
      });
      if (!session.alive) return false;
      session.remoteJson = 'null';
      publish(null);
      setSyncState('synced');
      return true;
    };

    const connectionFailed = (failure) => {
      if (!session.alive) return;
      session.writable = false;
      session.listening = false;
      session.unsubscribe?.();
      session.unsubscribe = null;
      session.retryAt = Date.now() + 30000;
      setReady(Boolean(session.state));
      setSyncState('offline');
      setError(historyErrorMessage(failure));
    };

    const connect = async (force = false) => {
      // Focus/visibility events often arrive together when returning from Google on a phone.
      if (!session.alive || session.connecting || (!force && (session.listening || Date.now() < session.retryAt))) return;
      session.connecting = true;
      session.unsubscribe?.();
      session.unsubscribe = null;
      session.listening = false;
      session.writable = false;
      setSyncState('loading');
      setError('');
      try {
        if (!session.storage) {
          session.storage = await resolveAccountStorage({ uid, email });
          if (!session.alive) return;
          publish(finalizePastDays(loadCachedState(uid, session.storage.cacheNamespace)));
          setReady(Boolean(session.state));
        }
        const documentRef = doc(db, 'users', uid, 'trackers', session.storage.documentId);
        if (session.storage.resetRequested && !session.resetChecked) {
          await runTransaction(db, async (transaction) => {
            const snapshot = await transaction.get(documentRef);
            if (snapshot.data()?.resetGeneration === session.storage.generation) return;
            session.storage.oldDocumentIds.forEach((id) => transaction.delete(doc(db, 'users', uid, 'trackers', id)));
            transaction.set(documentRef, { state: null, resetGeneration: session.storage.generation, updatedAt: serverTimestamp() });
          });
          if (!session.alive) return;
          session.resetChecked = true;
          clearRequestedHistoryCache(uid, session.storage);
        }
        session.unsubscribeHistory?.();
        session.unsubscribeHistory = onSnapshot(doc(db, 'users', uid, 'trackers', 'marathon-history-v1'), { includeMetadataChanges: true }, (snapshot) => {
          if (!session.alive) return;
          setHistory(snapshot.exists() && Array.isArray(snapshot.data().items) ? snapshot.data().items : []);
        }, connectionFailed);
        session.listening = true;
        session.unsubscribe = onSnapshot(documentRef, { includeMetadataChanges: true }, (snapshot) => {
          if (!session.alive) return;
          const remote = snapshot.exists() ? snapshot.data().state : null;
          if (!snapshot.metadata.hasPendingWrites) session.remoteJson = JSON.stringify(remote);
          session.writable = !snapshot.metadata.fromCache || session.writable;
          if (!snapshot.metadata.fromCache) setError('');
          publish(finalizePastDays(mergeStates(remote, session.state)));
          setReady(session.writable || Boolean(session.state));
          setSyncState(snapshot.metadata.fromCache ? 'offline' : snapshot.metadata.hasPendingWrites || JSON.stringify(session.state) !== session.remoteJson ? 'saving' : 'synced');
          if (session.writable) schedule();
        }, connectionFailed);
      } catch (failure) {
        connectionFailed(failure);
      } finally {
        session.connecting = false;
      }
    };
    session.retry = () => {
      if (session.writable) flush();
      else connect(true);
    };

    const refresh = () => {
      if (!session.alive) return;
      const date = todayKey();
      setCurrentDate(date);
      const next = finalizePastDays(session.state, date);
      if (next !== session.state) publish(next);
      if (session.writable) flush();
      else if (navigator.onLine) connect();
    };
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); else flush(); };
    const interval = window.setInterval(refresh, 30000);
    window.addEventListener('online', refresh);
    window.addEventListener('focus', refresh);
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisible);
    connect();
    return () => {
      session.alive = false;
      if (sessionRef.current === session) sessionRef.current = null;
      window.clearInterval(interval);
      window.clearTimeout(session.timer);
      session.unsubscribe?.();
      session.unsubscribeHistory?.();
      window.removeEventListener('online', refresh);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [uid, email]);

  const start = async (commitments, durationDays) => {
    if (starting || !commitments) return false;
    setStarting(true);
    try {
      const started = await sessionRef.current?.start(commitments, durationDays);
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
  return { state: belongsToUser ? state : null, history: belongsToUser ? history : [], ready: ready && belongsToUser, syncState, error, starting, currentDate, start, startNext: () => sessionRef.current?.startNext(), commit: (recipe) => sessionRef.current?.commit(recipe), retry: () => sessionRef.current?.retry() };
}
