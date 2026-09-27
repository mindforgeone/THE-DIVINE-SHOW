import { useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

const CACHE_PREFIX = 'day-one-ai-reports-v1';
const MAX_REPORTS = 24;
const DEFAULT_AI_ENDPOINT = 'https://day-one-analyst.day-one-analyst-worker.workers.dev';

function normalizeReports(value) {
  return Array.isArray(value)
    ? value.filter((item) => item?.id && item?.analysis).sort((a, b) => String(b.generatedAt).localeCompare(String(a.generatedAt))).slice(0, MAX_REPORTS)
    : [];
}

function loadCache(uid) {
  try {
    return normalizeReports(JSON.parse(localStorage.getItem(`${CACHE_PREFIX}:${uid}`) || '[]'));
  } catch {
    return [];
  }
}

function saveCache(uid, reports) {
  try {
    localStorage.setItem(`${CACHE_PREFIX}:${uid}`, JSON.stringify(reports));
  } catch {
    // The cloud write below remains the source of truth when local storage is full.
  }
}

export function useAiReports(user) {
  const uid = user?.uid;
  const [reports, setReports] = useState(() => uid ? loadCache(uid) : []);
  const [syncState, setSyncState] = useState('loading');
  const documentRef = useMemo(() => uid && db ? doc(db, 'users', uid, 'private', 'ai-analyst-v1') : null, [uid]);

  useEffect(() => {
    if (!uid || !documentRef) return undefined;
    return onSnapshot(documentRef, { includeMetadataChanges: true }, (snapshot) => {
      const remote = normalizeReports(snapshot.data()?.reports);
      if (remote.length) {
        setReports(remote);
        saveCache(uid, remote);
      }
      setSyncState(snapshot.metadata.fromCache ? 'offline' : snapshot.metadata.hasPendingWrites ? 'saving' : 'synced');
    }, () => setSyncState('offline'));
  }, [documentRef, uid]);

  const saveReport = async (report) => {
    if (!uid || !documentRef) return { cloud: false, error: 'Нет подключения к профилю.' };
    const next = normalizeReports([report, ...reports.filter((item) => item.id !== report.id)]);
    setReports(next);
    saveCache(uid, next);
    setSyncState('saving');
    try {
      await setDoc(documentRef, { reports: next, updatedAt: serverTimestamp() }, { merge: true });
      setSyncState('synced');
      return { cloud: true, error: '' };
    } catch {
      setSyncState('offline');
      return { cloud: false, error: 'Разбор сохранён на этом устройстве, облако пока недоступно.' };
    }
  };

  return { reports, syncState, saveReport };
}

export async function requestAiAnalysis(user, snapshot) {
  const endpoint = String(globalThis.__DAY_ONE_AI_URL__ || import.meta.env.VITE_AI_API_URL || DEFAULT_AI_ENDPOINT).trim();
  if (!endpoint) throw new Error('Сервер аналитика ещё не подключён.');
  const token = await user.getIdToken();
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ snapshot }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Аналитик временно недоступен.');
  if (!payload.analysis) throw new Error('Модель вернула пустой разбор.');
  return payload;
}
