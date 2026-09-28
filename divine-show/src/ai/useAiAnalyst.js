import { useEffect, useRef, useState } from 'react';
import { loadCloudResource, saveCloudResource } from '../marathon/cloudSync.js';

const CACHE_PREFIX = 'day-one-ai-reports-v1';
const MAX_REPORTS = 24;
const POLL_INTERVAL = 15000;
const DEFAULT_AI_ENDPOINT = 'https://day-one-analyst.day-one-analyst-worker.workers.dev';

function normalizeReports(value) {
  return Array.isArray(value)
    ? value.filter((item) => item?.id && item?.analysis).sort((a, b) => String(b.generatedAt).localeCompare(String(a.generatedAt))).slice(0, MAX_REPORTS)
    : [];
}

function mergeReports(...groups) {
  const items = new Map();
  groups.flat().forEach((item) => {
    if (!item?.id || !item?.analysis) return;
    const previous = items.get(item.id);
    if (!previous || String(item.generatedAt || '') >= String(previous.generatedAt || '')) items.set(item.id, item);
  });
  return normalizeReports([...items.values()]);
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
    // The worker copy remains authoritative when browser storage is full.
  }
}

export function useAiReports(user) {
  const uid = user?.uid;
  const [reports, setReports] = useState(() => uid ? loadCache(uid) : []);
  const [syncState, setSyncState] = useState('loading');
  const sessionRef = useRef(null);

  useEffect(() => {
    if (!uid || !user?.getIdToken) return undefined;
    const session = { alive: true, reports: loadCache(uid), revision: 0, saving: false, pending: false };
    sessionRef.current = session;

    const publish = (next) => {
      session.reports = normalizeReports(next);
      saveCache(uid, session.reports);
      if (session.alive) setReports(session.reports);
    };

    const persist = async () => {
      if (!session.alive) return;
      if (session.saving) { session.pending = true; return; }
      session.saving = true;
      session.pending = false;
      setSyncState('saving');
      try {
        const result = await saveCloudResource(user, 'ai-reports', { reports: session.reports }, session.revision);
        if (!session.alive) return;
        session.revision = Number(result.revision || session.revision + 1);
        setSyncState('synced');
      } catch (failure) {
        if (!session.alive) return;
        if (failure.status === 409 && failure.remote) {
          session.revision = Number(failure.remote.revision || 0);
          publish(mergeReports(failure.remote.payload?.reports, session.reports));
          session.pending = true;
        } else {
          setSyncState('offline');
        }
      } finally {
        session.saving = false;
        if (session.alive && session.pending) window.setTimeout(persist, 300);
      }
    };

    const refresh = async () => {
      if (!session.alive || session.saving || document.visibilityState !== 'visible') return;
      try {
        const result = await loadCloudResource(user, 'ai-reports');
        if (!session.alive) return;
        const remote = normalizeReports(result.payload?.reports);
        const merged = mergeReports(remote, session.reports);
        session.revision = Number(result.revision || 0);
        publish(merged);
        setSyncState('synced');
        if (JSON.stringify(merged) !== JSON.stringify(remote)) void persist();
      } catch {
        if (session.alive) setSyncState('offline');
      }
    };

    session.save = (report) => {
      publish(mergeReports([report], session.reports));
      void persist();
      return { cloud: null, error: '' };
    };

    const initialPublish = window.setTimeout(() => publish(session.reports), 0);
    void refresh();
    const timer = window.setInterval(refresh, POLL_INTERVAL);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      session.alive = false;
      if (sessionRef.current === session) sessionRef.current = null;
      window.clearTimeout(initialPublish);
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [uid, user]);

  const saveReport = (report) => sessionRef.current?.save(report) || { cloud: false, error: 'Нет подключения к профилю.' };
  return { reports, syncState, saveReport };
}

export async function requestAiAnalysis(user, snapshot) {
  const endpoint = String(globalThis.__DAY_ONE_AI_URL__ || import.meta.env.VITE_AI_API_URL || DEFAULT_AI_ENDPOINT).trim();
  if (!endpoint) throw new Error('Сервер аналитика ещё не подключён.');
  const token = await user.getIdToken();
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 90000);
  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ snapshot }),
    });
  } catch (failure) {
    if (failure.name === 'AbortError') throw new Error('Анализ занял слишком много времени. Попробуй ещё раз.', { cause: failure });
    throw failure;
  } finally {
    window.clearTimeout(timeout);
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Аналитик временно недоступен.');
  if (!payload.analysis) throw new Error('Модель вернула пустой разбор.');
  return payload;
}
