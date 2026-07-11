import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  AlertCircle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Cloud,
  Copy,
  Download,
  FileText,
  Flame,
  LineChart,
  Loader2,
  Lock,
  LogIn,
  LogOut,
  Play,
  RotateCcw,
  Scale,
  Sparkles,
  Star,
  Target,
  Trophy,
  Utensils,
  User,
  XCircle,
  Zap,
} from 'lucide-react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db, firebaseConfigured, googleProvider } from './firebase';

const TOTAL_DAYS = 120;
const STORAGE_KEY = 'growth-120-account-state-v2';
const CALORIE_TOP = 1800;
const CALORIE_LIMIT = 2300;
const LEVEL_STEP = 650;
const WEEK_COUNT = Math.ceil(TOTAL_DAYS / 7);
const CHECKPOINT_DAYS = [7, 14, 30, 60, 90, 120];

const TIERS = {
  base: {
    id: 'base',
    title: 'Поддержание',
    short: 'База',
    xp: 50,
    color: '#7c9a78',
    bg: '#eef6e9',
    border: '#cfe2c8',
    text: '#365f36',
    description: 'День закрыт. Система не развалилась, путь живой.',
  },
  growth: {
    id: 'growth',
    title: 'Рост',
    short: 'Рост',
    xp: 110,
    color: '#4f8fb9',
    bg: '#eaf5fb',
    border: '#c8e1ef',
    text: '#255b7a',
    description: 'Есть заметный вклад в форму, 1С или рынок.',
  },
  breakthrough: {
    id: 'breakthrough',
    title: 'Прорыв',
    short: 'Топ',
    xp: 190,
    color: '#d18b47',
    bg: '#fff3df',
    border: '#f1d2a7',
    text: '#81501f',
    description: 'Топовый день: фокус, питание, вес и доказательства сошлись.',
  },
};

const PROOF_TYPES = [
  '1С обучение',
  'Практика 1С',
  'Конспект',
  'Сертификат',
  'Проект',
  'Задача',
  'Разбор вакансий',
  'Резюме',
  'Отклик',
  'Собеседование',
  'Тестовое',
  'Портфолио',
  'Другое',
];

const SIGNALS = [
  { minXp: 1200, text: 'Появился первый устойчивый контур. Движение уже видно.' },
  { minXp: 2800, text: 'Ритм начинает работать на тебя. Это уже не случайные дни.' },
  { minXp: 5200, text: '1С, форма и рынок становятся одной системой.' },
  { minXp: 9000, text: 'Рынок стал не страхом, а следствием твоей траектории.' },
];

const todayKey = () => toDateKey(new Date());

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateFromKey(key) {
  return new Date(`${key}T00:00:00`);
}

function addDays(dateKey, offset) {
  const date = dateFromKey(dateKey);
  date.setDate(date.getDate() + offset);
  return toDateKey(date);
}

function formatDate(dateKey) {
  return dateFromKey(dateKey).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
  }).replace('.', '');
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function num(value) {
  const parsed = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function userCacheKey(uid) {
  return `${STORAGE_KEY}:${uid || 'local'}`;
}

function createDay(day, startDate) {
  return {
    day,
    date: addDays(startDate, day - 1),
    workMinutes: '',
    actionText: '',
    proofs: [],
    calories: '',
    meals: '',
    weight: '',
    summary: '',
    result: null,
    xp: 0,
    closedAt: null,
  };
}

function createWeeklyReview(index) {
  return {
    week: index + 1,
    worked: '',
    blocked: '',
    nextLever: '',
  };
}

function createInitialState(startDate = todayKey()) {
  return {
    version: 2,
    startDate,
    createdAt: new Date().toISOString(),
    days: Array.from({ length: TOTAL_DAYS }, (_, index) => createDay(index + 1, startDate)),
    weeklyReviews: Array.from({ length: WEEK_COUNT }, (_, index) => createWeeklyReview(index)),
    finalReview: {
      offer: '',
      body: '',
      why: '',
      next: '',
    },
  };
}

function normalizeState(raw) {
  if (!raw?.startDate) return null;
  const startDate = raw.startDate;
  return {
    ...createInitialState(startDate),
    ...raw,
    days: Array.from({ length: TOTAL_DAYS }, (_, index) => {
      const previous = raw.days?.[index] || {};
      const legacyProof = previous.artifactType ? [previous.artifactType] : [];
      return {
        ...createDay(index + 1, startDate),
        ...previous,
        workMinutes: previous.workMinutes ?? previous.offerMinutes ?? '',
        actionText: previous.actionText ?? previous.offerAction ?? '',
        proofs: Array.isArray(previous.proofs) ? previous.proofs : legacyProof,
        day: index + 1,
        date: addDays(startDate, index),
      };
    }),
    weeklyReviews: Array.from({ length: WEEK_COUNT }, (_, index) => ({
      ...createWeeklyReview(index),
      ...(raw.weeklyReviews?.[index] || {}),
      week: index + 1,
    })),
    finalReview: {
      offer: '',
      body: '',
      why: '',
      next: '',
      ...(raw.finalReview || {}),
    },
  };
}

function loadCachedState(uid) {
  try {
    const scoped = localStorage.getItem(userCacheKey(uid));
    const legacy = localStorage.getItem('offer-growth-120-v1');
    const parsed = JSON.parse(scoped || legacy || 'null');
    return normalizeState(parsed);
  } catch {
    return null;
  }
}

function saveCachedState(uid, state) {
  try {
    localStorage.setItem(userCacheKey(uid), JSON.stringify(state));
  } catch {
    // Local cache is a convenience; cloud sync remains the source of truth.
  }
}

function clearCachedState(uid) {
  try {
    localStorage.removeItem(userCacheKey(uid));
  } catch {
    // A failed cache cleanup should not block the cloud reset.
  }
}

function getCurrentDayIndex(startDate) {
  const start = dateFromKey(startDate).getTime();
  const today = dateFromKey(todayKey()).getTime();
  return clamp(Math.floor((today - start) / 86400000), 0, TOTAL_DAYS - 1);
}

function evaluateDay(day) {
  const workMinutes = num(day.workMinutes);
  const calories = num(day.calories);
  const meals = num(day.meals);
  const weight = num(day.weight);
  const hasWork = workMinutes >= 25 && day.actionText.trim().length >= 5;
  const hasNutrition = calories > 0 && calories <= CALORIE_LIMIT && meals >= 1 && meals <= 3;
  const hasWeight = weight > 0;
  const hasProof = Array.isArray(day.proofs) && day.proofs.length > 0;
  const hasSummary = day.summary.trim().length >= 5;

  const score = [
    hasWork ? 30 : workMinutes > 0 || day.actionText.trim() ? 14 : 0,
    hasNutrition ? 25 : calories > 0 || meals > 0 ? 8 : 0,
    hasWeight ? 15 : 0,
    hasProof ? 15 : 0,
    hasSummary ? 15 : 0,
  ].reduce((sum, value) => sum + value, 0);

  const blockers = [];
  if (!hasWork) blockers.push('1С/рынок: минимум 25 минут и конкретное действие');
  if (!hasNutrition) blockers.push('Питание: до 2300 ккал и 1-3 приёма пищи');
  if (!hasWeight) blockers.push('Вес: внеси текущий вес');

  if (!(hasWork && hasNutrition && hasWeight)) {
    return {
      id: 'draft',
      title: 'Черновик',
      short: 'Черновик',
      xp: 0,
      color: '#94a3b8',
      bg: '#f1f5f9',
      border: '#dbe3eb',
      text: '#475569',
      score,
      blockers,
      description: 'День ещё не даёт чистого результата.',
    };
  }

  let tier = TIERS.base;
  if (workMinutes >= 60 && hasSummary && (hasProof || day.actionText.trim().length >= 24)) {
    tier = TIERS.growth;
  }
  if (workMinutes >= 120 && calories <= CALORIE_TOP && hasProof && hasSummary) {
    tier = TIERS.breakthrough;
  }

  return { ...tier, score, blockers: [], description: tier.description };
}

function calculateStats(days, currentDayIndex) {
  const elapsedDays = days.slice(0, currentDayIndex + 1);
  const closedDays = elapsedDays.filter((day) => day.result);
  const xp = days.reduce((sum, day) => sum + (day.xp || 0), 0);
  const level = Math.max(1, Math.floor(xp / LEVEL_STEP) + 1);
  const levelProgress = Math.round(((xp % LEVEL_STEP) / LEVEL_STEP) * 100);
  const tierCounts = closedDays.reduce((acc, day) => {
    acc[day.result] = (acc[day.result] || 0) + 1;
    return acc;
  }, {});

  const calories = closedDays.map((day) => num(day.calories)).filter(Boolean);
  const avgCalories = calories.length
    ? Math.round(calories.reduce((sum, value) => sum + value, 0) / calories.length)
    : 0;
  const topCalorieDays = closedDays.filter((day) => num(day.calories) > 0 && num(day.calories) <= CALORIE_TOP).length;
  const inLimitDays = closedDays.filter((day) => num(day.calories) > 0 && num(day.calories) <= CALORIE_LIMIT).length;

  const weights = closedDays.map((day) => ({ day: day.day, value: num(day.weight) })).filter((item) => item.value);
  const firstWeight = weights[0]?.value || 0;
  const lastWeight = weights.at(-1)?.value || 0;
  const weightDelta = firstWeight && lastWeight ? Number((lastWeight - firstWeight).toFixed(1)) : 0;

  const workMinutes = closedDays.reduce((sum, day) => sum + num(day.workMinutes), 0);
  const proofCount = closedDays.reduce((sum, day) => sum + (Array.isArray(day.proofs) ? day.proofs.length : 0), 0);
  const completionRate = elapsedDays.length ? Math.round((closedDays.length / elapsedDays.length) * 100) : 0;
  const emptyDays = elapsedDays.length - closedDays.length;
  const streak = [...elapsedDays].reverse().reduce((acc, day) => {
    if (acc.done) return acc;
    if (day.result) return { count: acc.count + 1, done: false };
    return { count: acc.count, done: true };
  }, { count: 0, done: false }).count;

  return {
    elapsedDays,
    closedDays,
    xp,
    level,
    levelProgress,
    tierCounts,
    avgCalories,
    topCalorieDays,
    inLimitDays,
    firstWeight,
    lastWeight,
    weightDelta,
    weights,
    workMinutes,
    proofCount,
    completionRate,
    emptyDays,
    streak,
  };
}

function getWeeks(days) {
  return Array.from({ length: WEEK_COUNT }, (_, index) => {
    const weekDays = days.slice(index * 7, index * 7 + 7);
    const closed = weekDays.filter((day) => day.result);
    const calories = closed.map((day) => num(day.calories)).filter(Boolean);
    const weights = closed.map((day) => num(day.weight)).filter(Boolean);
    return {
      number: index + 1,
      from: weekDays[0]?.day,
      to: weekDays.at(-1)?.day,
      closed,
      xp: closed.reduce((sum, day) => sum + (day.xp || 0), 0),
      work: closed.reduce((sum, day) => sum + num(day.workMinutes), 0),
      avgCalories: calories.length ? Math.round(calories.reduce((sum, value) => sum + value, 0) / calories.length) : 0,
      topCalories: closed.filter((day) => num(day.calories) > 0 && num(day.calories) <= CALORIE_TOP).length,
      inLimit: closed.filter((day) => num(day.calories) > 0 && num(day.calories) <= CALORIE_LIMIT).length,
      weightDelta: weights.length > 1 ? Number((weights.at(-1) - weights[0]).toFixed(1)) : 0,
      proofCount: closed.reduce((sum, day) => sum + (day.proofs?.length || 0), 0),
      breakthrough: closed.filter((day) => day.result === 'breakthrough').length,
      growth: closed.filter((day) => day.result === 'growth').length,
      base: closed.filter((day) => day.result === 'base').length,
    };
  });
}

function checkpointSummary(days, dayNumber) {
  const slice = days.slice(0, dayNumber);
  const closed = slice.filter((day) => day.result);
  const calories = closed.map((day) => num(day.calories)).filter(Boolean);
  const weights = closed.map((day) => num(day.weight)).filter(Boolean);
  return {
    day: dayNumber,
    elapsed: slice.length,
    closed: closed.length,
    xp: closed.reduce((sum, day) => sum + (day.xp || 0), 0),
    workMinutes: closed.reduce((sum, day) => sum + num(day.workMinutes), 0),
    avgCalories: calories.length ? Math.round(calories.reduce((sum, value) => sum + value, 0) / calories.length) : 0,
    weightDelta: weights.length > 1 ? Number((weights.at(-1) - weights[0]).toFixed(1)) : 0,
    proofCount: closed.reduce((sum, day) => sum + (day.proofs?.length || 0), 0),
  };
}

function buildExport(state, stats, weeks) {
  const closed = state.days.filter((day) => day.result);
  const checkpoints = CHECKPOINT_DAYS.map((dayNumber) => checkpointSummary(state.days, dayNumber));
  const markdown = [
    '# 120 дней: форма, 1С, рынок',
    '',
    `Старт: ${state.startDate}`,
    `Дней прошло: ${stats.elapsedDays.length}/${TOTAL_DAYS}`,
    `Закрыто дней: ${stats.closedDays.length}`,
    `XP: ${stats.xp}, уровень: ${stats.level}`,
    `1С/рынок часы: ${(stats.workMinutes / 60).toFixed(1)}`,
    `Дней <=1800 ккал: ${stats.topCalorieDays}`,
    `Дней <=2300 ккал: ${stats.inLimitDays}`,
    `Средние калории: ${stats.avgCalories || 'нет данных'}`,
    `Вес: ${stats.firstWeight || 'нет'} -> ${stats.lastWeight || 'нет'} кг, дельта ${stats.weightDelta} кг`,
    `Доказательств роста: ${stats.proofCount}`,
    '',
    '## Вопрос к нейросети',
    'Проанализируй мой 120-дневный путь. Найди, почему я приближаюсь или не приближаюсь к идеальной форме, сильному 1С-уровню и выходу на рынок. Объясни связь минут 1С/рынка, питания, веса и доказательств роста. Дай 3 главных рычага на следующую неделю.',
    '',
    '## Недельные рефлексии',
    ...state.weeklyReviews.map((review) => (
      `- Неделя ${review.week}: сработало: ${review.worked || '-'}; мешало: ${review.blocked || '-'}; рычаг: ${review.nextLever || '-'}`
    )),
    '',
    '## Недельные метрики',
    ...weeks.filter((week) => week.closed.length).map((week) => (
      `- Неделя ${week.number}: закрыто ${week.closed.length}/7, XP ${week.xp}, 1С/рынок ${(week.work / 60).toFixed(1)} ч, средние ккал ${week.avgCalories || '-'}, дней <=1800: ${week.topCalories}, вес ${week.weightDelta > 0 ? '+' : ''}${week.weightDelta} кг, доказательств ${week.proofCount}, топ-дней ${week.breakthrough}.`
    )),
    '',
    '## Чекпоинты',
    ...checkpoints.map((item) => (
      `- День ${item.day}: закрыто ${item.closed}/${item.elapsed}, XP ${item.xp}, 1С/рынок ${(item.workMinutes / 60).toFixed(1)} ч, средние ккал ${item.avgCalories || '-'}, вес ${item.weightDelta > 0 ? '+' : ''}${item.weightDelta} кг, доказательств ${item.proofCount}.`
    )),
    '',
    '## Дни',
    ...closed.map((day) => (
      `- День ${day.day} (${day.date}): ${TIERS[day.result]?.title || day.result}, XP ${day.xp}, 1С/рынок ${day.workMinutes} мин, ккал ${day.calories}, приёмов ${day.meals}, вес ${day.weight} кг, доказательства: ${(day.proofs || []).join(', ') || '-'}, действие: ${day.actionText}, итог: ${day.summary || '-'}`
    )),
    '',
    '## Финал 120',
    `Оффер/рынок: ${state.finalReview.offer || '-'}`,
    `Форма/тело: ${state.finalReview.body || '-'}`,
    `Почему результат такой: ${state.finalReview.why || '-'}`,
    `Следующий этап: ${state.finalReview.next || '-'}`,
  ].join('\n');

  const json = JSON.stringify({
    meta: {
      startDate: state.startDate,
      totalDays: TOTAL_DAYS,
      exportedAt: new Date().toISOString(),
    },
    stats,
    weeks,
    checkpoints,
    weeklyReviews: state.weeklyReviews,
    finalReview: state.finalReview,
    days: state.days,
  }, null, 2);

  return { markdown, json };
}

function getDiagnosis(stats, week) {
  if (!stats.closedDays.length) return ['Пока нет закрытых дней. Первый результат появится после фиксации дня.'];
  const items = [];
  const avgWork = stats.workMinutes / Math.max(1, stats.closedDays.length);
  if (avgWork >= 75) items.push('1С/рынок получают сильное время. Это главный двигатель оффера.');
  else items.push('1С/рынок пока недобирает фокус. Рычаг: поднять среднее время до 60-90 минут.');

  if (stats.avgCalories && stats.avgCalories <= CALORIE_TOP) items.push('Питание в топ-зоне: средние калории держат форму в режиме сушки.');
  else if (stats.avgCalories && stats.avgCalories <= CALORIE_LIMIT) items.push('Питание в рабочей зоне. Для ускорения формы чаще попадай в 1800.');
  else items.push('Питание выше рамки или данных мало. Это главный риск для формы.');

  if (stats.weightDelta < -0.4) items.push('Вес снижается. Дистанция подтверждает, что тело идёт в нужную сторону.');
  else if (stats.weightDelta > 0.4) items.push('Вес растёт. Смотри дни выше 2300 ккал и количество приёмов пищи.');
  else items.push('Вес пока держится. Это нормально для поддержки, но для сушки нужен более чистый дефицит.');

  if (week?.closed.length >= 5) items.push('Неделя достаточно плотная: уже можно анализировать систему, а не настроение.');
  else items.push('Неделе не хватает закрытых дней. Главный рычаг сейчас - регулярность отметок.');
  return items;
}

function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(Boolean(auth));
  const [authError, setAuthError] = useState('');
  const [state, setState] = useState(null);
  const [cloudReady, setCloudReady] = useState(false);
  const [syncState, setSyncState] = useState('idle');
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [showExport, setShowExport] = useState(false);
  const [exportMode, setExportMode] = useState('markdown');
  const [copied, setCopied] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const lastCloudJsonRef = useRef('');

  useEffect(() => {
    if (!auth) return undefined;
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthLoading(false);
      setCloudReady(false);
      setState(null);
      lastCloudJsonRef.current = '';
    });
  }, []);

  useEffect(() => {
    if (!user || !db) return undefined;
    const cached = loadCachedState(user.uid);
    const documentRef = doc(db, 'users', user.uid, 'trackers', 'growth120');
    return onSnapshot(documentRef, (snapshot) => {
      if (snapshot.exists()) {
        const cloudState = normalizeState(snapshot.data().state);
        lastCloudJsonRef.current = JSON.stringify(cloudState);
        setState(cloudState);
      } else {
        setState(cached);
      }
      setCloudReady(true);
      setSyncState('synced');
    }, (error) => {
      setAuthError(error.message);
      setState(cached);
      setCloudReady(true);
      setSyncState('offline');
    });
  }, [user]);

  useEffect(() => {
    if (!state || !user || !db || !cloudReady) return undefined;
    saveCachedState(user.uid, state);
    const serialized = JSON.stringify(state);
    if (serialized === lastCloudJsonRef.current) return undefined;
    const timeoutId = window.setTimeout(async () => {
      try {
        setSyncState('saving');
        lastCloudJsonRef.current = serialized;
        await setDoc(doc(db, 'users', user.uid, 'trackers', 'growth120'), {
          state,
          updatedAt: serverTimestamp(),
        }, { merge: true });
        setSyncState('synced');
      } catch (error) {
        setSyncState('offline');
        setAuthError(error instanceof Error ? error.message : 'Не удалось сохранить в Firebase.');
      }
    }, 450);
    return () => window.clearTimeout(timeoutId);
  }, [state, user, cloudReady]);

  const signIn = async () => {
    if (!auth || !firebaseConfigured) {
      setAuthError('Firebase не настроен.');
      return;
    }
    setAuthError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Не удалось войти через Google.');
    }
  };

  const logOut = async () => {
    if (auth) await signOut(auth);
  };

  if (authLoading) return <LoadingScreen text="Проверяю аккаунт..." />;
  if (!user) return <LoginScreen error={authError} onSignIn={signIn} configured={firebaseConfigured} />;
  if (!cloudReady) return <LoadingScreen text="Загружаю твою историю..." />;
  if (!state) return <StartScreen user={user} onStart={() => setState(createInitialState())} onLogOut={logOut} />;

  const currentDayIndex = getCurrentDayIndex(state.startDate);
  const safeActiveDayIndex = clamp(activeDayIndex, 0, currentDayIndex);
  const activeDay = state.days[safeActiveDayIndex];
  const activeEvaluation = evaluateDay(activeDay);
  const stats = calculateStats(state.days, currentDayIndex);
  const weeks = getWeeks(state.days);
  const currentWeekIndex = Math.floor(currentDayIndex / 7);
  const currentWeek = weeks[currentWeekIndex] || weeks[0];
  const currentReview = state.weeklyReviews[currentWeekIndex] || createWeeklyReview(currentWeekIndex);
  const finalDate = addDays(state.startDate, TOTAL_DAYS - 1);
  const latestSignal = [...SIGNALS].reverse().find((signal) => stats.xp >= signal.minXp);
  const exportData = buildExport(state, stats, weeks);
  const isFinalDay = currentDayIndex + 1 >= TOTAL_DAYS;

  const updateActiveDay = (nextDay) => {
    setState((previous) => ({
      ...previous,
      days: previous.days.map((day, index) => (
        index === safeActiveDayIndex
          ? { ...nextDay, result: null, xp: 0, closedAt: null }
          : day
      )),
    }));
  };

  const saveDay = () => {
    const evaluation = evaluateDay(activeDay);
    setState((previous) => ({
      ...previous,
      days: previous.days.map((day, index) => {
        if (index !== safeActiveDayIndex) return day;
        const result = evaluation.id === 'draft' ? null : evaluation.id;
        return {
          ...activeDay,
          result,
          xp: result ? evaluation.xp : 0,
          closedAt: result ? new Date().toISOString() : null,
        };
      }),
    }));
  };

  const updateWeeklyReview = (patch) => {
    setState((previous) => ({
      ...previous,
      weeklyReviews: previous.weeklyReviews.map((review, index) => (
        index === currentWeekIndex ? { ...review, ...patch } : review
      )),
    }));
  };

  const updateFinalReview = (patch) => {
    setState((previous) => ({
      ...previous,
      finalReview: { ...previous.finalReview, ...patch },
    }));
  };

  const resetJourney = async () => {
    setConfirmReset(false);
    setState(null);
    lastCloudJsonRef.current = 'null';
    if (user) clearCachedState(user.uid);
    if (!user || !db) return;
    try {
      setSyncState('saving');
      await setDoc(doc(db, 'users', user.uid, 'trackers', 'growth120'), {
        state: null,
        updatedAt: serverTimestamp(),
        resetAt: serverTimestamp(),
      }, { merge: true });
      setSyncState('synced');
    } catch (error) {
      setSyncState('offline');
      setAuthError(error instanceof Error ? error.message : 'Не удалось сбросить путь в Firebase.');
    }
  };

  const copyExport = async () => {
    const text = exportMode === 'markdown' ? exportData.markdown : exportData.json;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const downloadExport = () => {
    const isMarkdown = exportMode === 'markdown';
    const blob = new Blob([isMarkdown ? exportData.markdown : exportData.json], {
      type: isMarkdown ? 'text/markdown;charset=utf-8' : 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = isMarkdown ? 'growth-120-export.md' : 'growth-120-export.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#fbf7ef] text-slate-900">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(90deg,rgba(59,130,246,0.06)_1px,transparent_1px),linear-gradient(rgba(20,83,45,0.05)_1px,transparent_1px)] bg-[size:44px_44px]" />
      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <Header
          user={user}
          stats={stats}
          currentDayIndex={currentDayIndex}
          syncState={syncState}
          onExport={() => setShowExport(true)}
          onReset={() => setConfirmReset(true)}
          onLogOut={logOut}
        />

        <section className="grid gap-4 lg:grid-cols-[1.05fr_1.35fr]">
          <TodayPanel
            day={activeDay}
            evaluation={activeEvaluation}
            onChange={updateActiveDay}
            onSave={saveDay}
            activeDayIndex={safeActiveDayIndex}
            currentDayIndex={currentDayIndex}
          />
          <PathPanel
            days={state.days}
            activeDayIndex={safeActiveDayIndex}
            currentDayIndex={currentDayIndex}
            onSelect={setActiveDayIndex}
            stats={stats}
            signal={latestSignal}
            finalDate={finalDate}
          />
        </section>

        <Dashboard days={state.days} stats={stats} currentWeek={currentWeek} weeks={weeks} />
        <WeeklyReflection week={currentWeek} review={currentReview} onChange={updateWeeklyReview} />
        <Checkpoints days={state.days} currentDayIndex={currentDayIndex} />
        {isFinalDay && <FinalReview review={state.finalReview} onChange={updateFinalReview} />}
      </div>

      <AnimatePresence>
        {showExport && (
          <ExportModal
            exportMode={exportMode}
            setExportMode={setExportMode}
            data={exportMode === 'markdown' ? exportData.markdown : exportData.json}
            copied={copied}
            onCopy={copyExport}
            onDownload={downloadExport}
            onClose={() => setShowExport(false)}
          />
        )}
        {confirmReset && (
          <ConfirmReset onCancel={() => setConfirmReset(false)} onConfirm={resetJourney} />
        )}
      </AnimatePresence>
    </div>
  );
}

function LoadingScreen({ text }) {
  return (
    <div className="grid min-h-screen place-items-center bg-[#fbf7ef] text-slate-900">
      <div className="flex items-center gap-3 border border-[#eadfcd] bg-white/85 px-5 py-4 font-black shadow-sm rounded-lg">
        <Loader2 className="animate-spin text-[#4f8fb9]" size={22} />
        {text}
      </div>
    </div>
  );
}

function LoginScreen({ error, onSignIn, configured }) {
  return (
    <div className="min-h-screen bg-[#fbf7ef] text-slate-900">
      <div className="mx-auto grid min-h-screen max-w-5xl place-items-center px-4 py-10">
        <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="w-full border border-[#eadfcd] bg-[#fffaf1] p-6 shadow-sm sm:p-8 rounded-lg">
          <div className="mb-6 inline-flex items-center gap-2 border border-[#d6e5d2] bg-[#eef7eb] px-3 py-2 text-sm font-semibold text-[#436841] rounded-md">
            <Cloud size={18} />
            Google + Firebase
          </div>
          <h1 className="max-w-3xl text-4xl font-black leading-tight text-slate-950 sm:text-5xl">
            Вход, чтобы 120 дней жили на телефоне и компьютере
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
            Прогресс хранится по твоему Google-аккаунту. Открыл с другого устройства - видишь ту же историю, те же недели, тот же путь к 120 дню.
          </p>
          <button
            onClick={onSignIn}
            disabled={!configured}
            className="mt-8 inline-flex items-center gap-2 bg-slate-950 px-5 py-3 font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:bg-slate-300 rounded-md"
          >
            <LogIn size={18} />
            Войти через Google
          </button>
          {!configured && <div className="mt-4 text-sm font-bold text-rose-700">Firebase-конфиг не найден.</div>}
          {error && <div className="mt-4 border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700 rounded-md">{error}</div>}
        </motion.section>
      </div>
    </div>
  );
}

function StartScreen({ user, onStart, onLogOut }) {
  return (
    <div className="min-h-screen bg-[#fbf7ef] text-slate-900">
      <div className="mx-auto grid min-h-screen max-w-6xl place-items-center px-4 py-10">
        <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="grid w-full gap-6 lg:grid-cols-[1fr_0.82fr]">
          <div className="border border-[#eadfcd] bg-[#fffaf1] p-6 shadow-sm sm:p-8 rounded-lg">
            <div className="mb-8 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 border border-[#d6e5d2] bg-[#eef7eb] px-3 py-2 text-sm font-semibold text-[#436841] rounded-md">
                <Sparkles size={18} />
                120 дней роста
              </span>
              <span className="inline-flex items-center gap-2 border border-[#d9e6f2] bg-[#eef7ff] px-3 py-2 text-sm font-semibold text-[#255b7a] rounded-md">
                <User size={18} />
                {user.email}
              </span>
            </div>
            <h1 className="max-w-3xl text-4xl font-black leading-tight text-slate-950 sm:text-5xl">
              Форма, 1С и рынок в одной живой панели
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
              Старт фиксируется сегодняшней датой. Дальше приложение считает 120 дней, показывает рост по времени, весу, питанию, доказательствам и недельным рефлексиям.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button onClick={onStart} className="inline-flex items-center gap-2 bg-slate-950 px-5 py-3 font-bold text-white shadow-sm transition hover:bg-slate-800 rounded-md">
                <Play size={18} />
                Начать сегодня
              </button>
              <button onClick={onLogOut} className="inline-flex items-center gap-2 border border-[#e8dfce] bg-white px-5 py-3 font-bold text-slate-700 shadow-sm transition hover:bg-[#fffaf1] rounded-md">
                <LogOut size={18} />
                Выйти
              </button>
            </div>
          </div>

          <div className="grid gap-3">
            <StartMetric icon={<Target size={20} />} title="1С и рынок" text="Учёба, практика, проект, вакансии, резюме, отклики." />
            <StartMetric icon={<Utensils size={20} />} title="Питание" text="1800 как топ, 2300 как верхняя граница." />
            <StartMetric icon={<Scale size={20} />} title="Вес" text="График покажет, куда реально идёт тело." />
            <StartMetric icon={<Trophy size={20} />} title="День 120" text="Финальная форма появится как отдельный экран в конце пути." />
          </div>
        </motion.section>
      </div>
    </div>
  );
}

function StartMetric({ icon, title, text }) {
  return (
    <div className="border border-[#e7ddca] bg-white/75 p-5 shadow-sm rounded-lg">
      <div className="mb-3 flex items-center gap-3 text-slate-900">
        <span className="grid h-10 w-10 place-items-center bg-[#eff6ff] text-[#356d92] rounded-md">{icon}</span>
        <h2 className="text-lg font-black">{title}</h2>
      </div>
      <p className="leading-7 text-slate-600">{text}</p>
    </div>
  );
}

function Header({ user, stats, currentDayIndex, syncState, onExport, onReset, onLogOut }) {
  const syncText = syncState === 'saving' ? 'сохраняю' : syncState === 'offline' ? 'офлайн' : 'синхронно';
  return (
    <header className="border border-[#eadfcd] bg-white/85 p-4 shadow-sm backdrop-blur rounded-lg">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm font-semibold text-[#5c7955]">
            <CalendarDays size={16} />
            День {currentDayIndex + 1} из {TOTAL_DAYS}
            <span className="text-slate-300">/</span>
            Уровень {stats.level}
            <span className="text-slate-300">/</span>
            <Cloud size={16} />
            {syncText}
          </div>
          <h1 className="text-3xl font-black leading-tight text-slate-950 sm:text-4xl">
            120 дней: форма, 1С, рынок
          </h1>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
          <HeaderPill icon={<Flame size={16} />} label="XP" value={stats.xp} />
          <HeaderPill icon={<Target size={16} />} label="1С/рынок" value={`${(stats.workMinutes / 60).toFixed(1)} ч`} />
          <HeaderPill icon={<Scale size={16} />} label="Вес" value={stats.lastWeight ? `${stats.lastWeight} кг` : '--'} />
          <HeaderPill icon={<User size={16} />} label="Аккаунт" value={user.email?.split('@')[0] || 'user'} />
          <IconButton onClick={onExport} icon={<Download size={16} />} label="Экспорт" tone="blue" />
          <IconButton onClick={onReset} icon={<RotateCcw size={16} />} label="Старт" tone="orange" />
          <IconButton onClick={onLogOut} icon={<LogOut size={16} />} label="Выйти" tone="plain" />
        </div>
      </div>
      <div className="mt-4 h-3 overflow-hidden bg-[#edf1e8] rounded-md">
        <div className="h-full bg-[#7c9a78] transition-all duration-700" style={{ width: `${stats.levelProgress}%` }} />
      </div>
    </header>
  );
}

function HeaderPill({ icon, label, value }) {
  return (
    <div className="inline-flex min-h-[42px] items-center gap-2 border border-[#e5dccb] bg-[#fffaf1] px-3 py-2 rounded-md">
      <span className="text-[#7c9a78]">{icon}</span>
      <span className="text-xs font-semibold text-slate-500">{label}</span>
      <span className="font-black text-slate-950">{value}</span>
    </div>
  );
}

function IconButton({ onClick, icon, label, tone }) {
  const tones = {
    blue: 'border-[#c8d9e7] bg-[#edf7ff] text-[#255b7a] hover:bg-[#dff0fc]',
    orange: 'border-[#ecd3c6] bg-[#fff4ed] text-[#8a4b2d] hover:bg-[#ffe9dc]',
    plain: 'border-[#e8dfce] bg-white text-slate-700 hover:bg-[#fffaf1]',
  };
  return (
    <button onClick={onClick} className={`inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-bold transition rounded-md ${tones[tone]}`}>
      {icon}
      {label}
    </button>
  );
}

function TodayPanel({ day, evaluation, onChange, onSave, activeDayIndex, currentDayIndex }) {
  const editable = activeDayIndex <= currentDayIndex;
  const tier = evaluation.id === 'draft' ? evaluation : TIERS[evaluation.id];
  return (
    <section className="border border-[#eadfcd] bg-white/90 p-4 shadow-sm rounded-lg">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="mb-1 text-sm font-bold text-slate-500">{formatDate(day.date)}</div>
          <h2 className="text-2xl font-black text-slate-950">День {day.day}</h2>
        </div>
        <ResultBadge evaluation={evaluation} />
      </div>

      <div className="mb-5 grid gap-2 sm:grid-cols-3">
        <ScoreChip label="Калории" value={day.calories ? `${day.calories}` : '--'} tone={num(day.calories) <= CALORIE_TOP && num(day.calories) > 0 ? 'top' : num(day.calories) <= CALORIE_LIMIT && num(day.calories) > 0 ? 'ok' : 'draft'} />
        <ScoreChip label="1С/рынок" value={day.workMinutes ? `${day.workMinutes} мин` : '--'} tone={num(day.workMinutes) >= 120 ? 'top' : num(day.workMinutes) >= 60 ? 'ok' : 'draft'} />
        <ScoreChip label="Score" value={`${evaluation.score}%`} tone={evaluation.id === 'breakthrough' ? 'top' : evaluation.id !== 'draft' ? 'ok' : 'draft'} />
      </div>

      <div className="grid gap-4">
        <NumberField icon={<Target size={18} />} label="1С / рынок, минуты" value={day.workMinutes} disabled={!editable} min="0" onChange={(value) => onChange({ ...day, workMinutes: value })} />

        <ProofPicker value={day.proofs || []} disabled={!editable} onChange={(proofs) => onChange({ ...day, proofs })} />

        <TextField
          icon={<Zap size={18} />}
          label="Что сегодня приблизило к форме, 1С или рынку?"
          value={day.actionText}
          disabled={!editable}
          placeholder="Например: 1С Skillbox, практика, сертификат, проект, разбор вакансий, резюме"
          onChange={(value) => onChange({ ...day, actionText: value })}
        />

        <div className="grid gap-3 sm:grid-cols-3">
          <NumberField icon={<Utensils size={18} />} label="Калории" value={day.calories} disabled={!editable} min="0" onChange={(value) => onChange({ ...day, calories: value })} />
          <NumberField icon={<Activity size={18} />} label="Приёмы пищи" value={day.meals} disabled={!editable} min="0" onChange={(value) => onChange({ ...day, meals: value })} />
          <NumberField icon={<Scale size={18} />} label="Вес, кг" value={day.weight} disabled={!editable} min="0" step="0.1" onChange={(value) => onChange({ ...day, weight: value })} />
        </div>

        <TextField
          icon={<FileText size={18} />}
          label="Что стало сильнее во мне или системе?"
          value={day.summary}
          disabled={!editable}
          placeholder="Одна строка результата без лишней рефлексии"
          onChange={(value) => onChange({ ...day, summary: value })}
        />
      </div>

      <div className="mt-5 border border-[#e8dfce] bg-[#fffaf1] p-4 rounded-lg">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <div className="text-sm font-bold text-slate-500">Живой результат</div>
            <div className="text-xl font-black" style={{ color: tier.text }}>{evaluation.title}</div>
          </div>
          <div className="text-right">
            <div className="text-sm font-bold text-slate-500">XP</div>
            <div className="text-2xl font-black text-slate-950">+{evaluation.xp}</div>
          </div>
        </div>
        <div className="h-2 overflow-hidden bg-white rounded-md">
          <div className="h-full transition-all duration-500" style={{ width: `${evaluation.score}%`, backgroundColor: tier.color }} />
        </div>
        <p className="mt-3 text-sm font-semibold text-slate-600">{evaluation.description}</p>
        {evaluation.blockers.length > 0 && (
          <div className="mt-3 grid gap-2">
            {evaluation.blockers.map((blocker) => (
              <div key={blocker} className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                <AlertCircle size={15} className="text-[#d18b47]" />
                {blocker}
              </div>
            ))}
          </div>
        )}
      </div>

      <button onClick={onSave} disabled={!editable} className="mt-4 flex w-full items-center justify-center gap-2 bg-slate-950 px-4 py-3 font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 rounded-md">
        <CheckCircle2 size={18} />
        Зафиксировать день
      </button>
    </section>
  );
}

function ProofPicker({ value, onChange, disabled }) {
  const selected = Array.isArray(value) ? value : [];
  const toggleProof = (proof) => {
    if (selected.includes(proof)) onChange(selected.filter((item) => item !== proof));
    else onChange([...selected, proof]);
  };
  return (
    <div className="border border-[#e8dfce] bg-white p-3 rounded-lg">
      <span className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-600">
        <FileText size={18} />
        Доказательства дня
      </span>
      <div className="flex flex-wrap gap-2">
        {PROOF_TYPES.map((proof) => {
          const isSelected = selected.includes(proof);
          return (
            <button
              key={proof}
              type="button"
              disabled={disabled}
              onClick={() => toggleProof(proof)}
              className={`inline-flex items-center gap-2 border px-3 py-2 text-sm font-bold transition rounded-md ${isSelected ? 'border-[#cfe2c8] bg-[#eef6e9] text-[#365f36]' : 'border-[#e8dfce] bg-[#fffdf8] text-slate-600 hover:bg-[#fffaf1]'}`}
            >
              {isSelected ? <CheckCircle2 size={15} /> : <span className="h-[15px] w-[15px] border border-slate-300 rounded-sm" />}
              {proof}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function NumberField({ icon, label, value, onChange, disabled, min, step = '1' }) {
  return (
    <label className="block border border-[#e8dfce] bg-white p-3 rounded-lg">
      <span className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-600">{icon}{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        step={step}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="w-full border border-[#e6dcc8] bg-[#fffdf8] px-3 py-2 text-lg font-black text-slate-950 outline-none transition focus:border-[#8fb989] disabled:text-slate-400 rounded-md"
      />
    </label>
  );
}

function TextField({ icon, label, value, onChange, disabled, placeholder }) {
  return (
    <label className="block border border-[#e8dfce] bg-white p-3 rounded-lg">
      <span className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-600">{icon}{label}</span>
      <textarea
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-20 w-full resize-none border border-[#e6dcc8] bg-[#fffdf8] px-3 py-2 text-base font-semibold leading-6 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#8fb989] disabled:text-slate-400 rounded-md"
      />
    </label>
  );
}

function ResultBadge({ evaluation }) {
  const tier = evaluation.id === 'draft' ? evaluation : TIERS[evaluation.id];
  return (
    <div className="inline-flex items-center gap-2 border px-3 py-2 text-sm font-black rounded-md" style={{ backgroundColor: tier.bg, borderColor: tier.border, color: tier.text }}>
      {evaluation.id === 'breakthrough' ? <Trophy size={17} /> : evaluation.id === 'growth' ? <Sparkles size={17} /> : <CheckCircle2 size={17} />}
      {evaluation.short}
    </div>
  );
}

function ScoreChip({ label, value, tone }) {
  const styles = {
    top: 'border-[#f1d2a7] bg-[#fff3df] text-[#81501f]',
    ok: 'border-[#c8e1ef] bg-[#eaf5fb] text-[#255b7a]',
    draft: 'border-[#e8dfce] bg-[#fffaf1] text-slate-600',
  };
  return (
    <div className={`border p-3 rounded-lg ${styles[tone]}`}>
      <div className="text-xs font-bold">{label}</div>
      <div className="mt-1 text-xl font-black">{value}</div>
    </div>
  );
}

function PathPanel({ days, activeDayIndex, currentDayIndex, onSelect, stats, signal, finalDate }) {
  return (
    <section className="border border-[#eadfcd] bg-white/90 p-4 shadow-sm rounded-lg">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm font-bold text-slate-500">
            <Target size={16} />
            Путь 120 дней
          </div>
          <h2 className="text-2xl font-black text-slate-950">Рост видно на дистанции</h2>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <MiniStat label="База" value={stats.tierCounts.base || 0} />
          <MiniStat label="Рост" value={stats.tierCounts.growth || 0} />
          <MiniStat label="Топ" value={stats.tierCounts.breakthrough || 0} />
        </div>
      </div>

      <div className="mb-4 border border-[#f1d2a7] bg-[#fff3df] p-4 rounded-lg">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-black uppercase tracking-wide text-[#81501f]">Финальная точка</div>
            <div className="text-5xl font-black leading-none text-slate-950">120</div>
          </div>
          <div className="text-right">
            <div className="text-sm font-bold text-[#81501f]">{formatDate(finalDate)}</div>
            <div className="max-w-[220px] text-sm font-semibold leading-6 text-slate-700">
              День ответа: почему форма стала лучше, 1С выросла, а рынок стал ближе.
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-10 gap-1 sm:grid-cols-[repeat(15,minmax(0,1fr))] md:grid-cols-[repeat(20,minmax(0,1fr))]">
        {days.map((day, index) => {
          const locked = index > currentDayIndex;
          const tier = day.result ? TIERS[day.result] : null;
          const isActive = index === activeDayIndex;
          const isToday = index === currentDayIndex;
          return (
            <button
              key={day.day}
              type="button"
              disabled={locked}
              onClick={() => onSelect(index)}
              title={`День ${day.day}: ${day.result ? tier.title : locked ? 'будущий' : 'не отмечен'}`}
              className={`relative grid aspect-square min-h-[34px] place-items-center border text-xs font-black transition rounded-md ${locked ? 'cursor-not-allowed border-[#ede5d8] bg-[#f6f0e6] text-slate-300' : 'hover:scale-[1.03]'} ${isActive ? 'ring-2 ring-slate-950 ring-offset-2 ring-offset-white' : ''}`}
              style={{
                backgroundColor: tier ? tier.bg : isToday ? '#edf7ff' : '#fffdf8',
                borderColor: tier ? tier.border : isToday ? '#b9d9ed' : '#e8dfce',
                color: tier ? tier.text : isToday ? '#255b7a' : '#64748b',
              }}
            >
              {locked ? <Lock size={13} /> : day.day}
              {day.result === 'breakthrough' && <Star size={10} className="absolute right-1 top-1 fill-current" />}
            </button>
          );
        })}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <PathInsight icon={<Flame size={18} />} label="Серия" value={`${stats.streak} дн`} />
        <PathInsight icon={<FileText size={18} />} label="Доказательства" value={stats.proofCount} />
        <PathInsight icon={<CalendarDays size={18} />} label="Закрытие пути" value={`${stats.completionRate}%`} />
      </div>

      {signal && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 border border-[#d8e6d2] bg-[#f1f8ed] p-4 text-[#42653f] rounded-lg">
          <div className="flex items-center gap-2 font-black">
            <Sparkles size={18} />
            {signal.text}
          </div>
        </motion.div>
      )}
    </section>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="min-w-[72px] border border-[#e8dfce] bg-[#fffaf1] px-3 py-2 rounded-md">
      <div className="text-lg font-black text-slate-950">{value}</div>
      <div className="text-xs font-bold text-slate-500">{label}</div>
    </div>
  );
}

function PathInsight({ icon, label, value }) {
  return (
    <div className="border border-[#e8dfce] bg-[#fffaf1] p-3 rounded-lg">
      <div className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-500">{icon}{label}</div>
      <div className="text-2xl font-black text-slate-950">{value}</div>
    </div>
  );
}

function Dashboard({ days, stats, currentWeek, weeks }) {
  const diagnosis = getDiagnosis(stats, currentWeek);
  return (
    <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard icon={<LineChart size={18} />} title="Вес" subtitle={`${stats.firstWeight || '--'} -> ${stats.lastWeight || '--'} кг`} aside={<span className="text-sm font-black text-[#365f36]">{stats.weightDelta > 0 ? '+' : ''}{stats.weightDelta} кг</span>}>
          <LineChartSvg data={stats.weights} color="#7c9a78" fill="#e5f2de" unit="кг" targetValue={stats.firstWeight ? stats.firstWeight - 5 : null} />
        </ChartCard>
        <ChartCard icon={<Utensils size={18} />} title="Калории" subtitle={`среднее ${stats.avgCalories || '--'} ккал`} aside={<span className="text-sm font-black text-[#81501f]">1800 / 2300</span>}>
          <LineChartSvg data={days.map((day) => ({ day: day.day, value: num(day.calories) })).filter((item) => item.value)} color="#d18b47" fill="#fff1dc" unit="ккал" guideValues={[CALORIE_TOP, CALORIE_LIMIT]} />
        </ChartCard>
        <ChartCard icon={<BarChart3 size={18} />} title="Питание" subtitle={`${stats.topCalorieDays} дней до 1800`} aside={<span className="text-sm font-black text-[#255b7a]">{stats.inLimitDays} дней до 2300</span>}>
          <NutritionBars days={days} />
        </ChartCard>
        <ChartCard icon={<Target size={18} />} title="1С и рынок" subtitle={`${(stats.workMinutes / 60).toFixed(1)} ч`} aside={<span className="text-sm font-black text-[#365f36]">{stats.proofCount} доказательств</span>}>
          <OfferProgress days={days} />
        </ChartCard>
      </div>
      <div className="grid gap-4">
        <ResultCounters stats={stats} />
        <WeeklyPanel week={currentWeek} />
        <DiagnosisPanel items={diagnosis} />
        <WeeksStrip weeks={weeks} />
      </div>
    </section>
  );
}

function ResultCounters({ stats }) {
  return (
    <div className="border border-[#eadfcd] bg-white/90 p-4 shadow-sm rounded-lg">
      <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-500">
        <Trophy size={16} />
        Счётчики результата
      </div>
      <div className="grid grid-cols-2 gap-2">
        <WeekMetric label="Серия закрытых" value={`${stats.streak} дн`} />
        <WeekMetric label="Доказательства" value={stats.proofCount} />
        <WeekMetric label="Дни до 1800" value={stats.topCalorieDays} />
        <WeekMetric label="Дни до 2300" value={stats.inLimitDays} />
        <WeekMetric label="1С/рынок" value={`${(stats.workMinutes / 60).toFixed(1)} ч`} />
        <WeekMetric label="Пустые дни" value={stats.emptyDays} />
      </div>
    </div>
  );
}

function ChartCard({ icon, title, subtitle, aside, children }) {
  return (
    <div className="border border-[#eadfcd] bg-white/90 p-4 shadow-sm rounded-lg">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm font-bold text-slate-500">{icon}{title}</div>
          <div className="text-xl font-black text-slate-950">{subtitle}</div>
        </div>
        {aside}
      </div>
      {children}
    </div>
  );
}

function LineChartSvg({ data, color, fill, unit, guideValues = [], targetValue = null }) {
  if (!data.length) return <EmptyChart text="Нужна первая отметка" />;
  const values = data.map((item) => item.value);
  const guides = [...guideValues, targetValue].filter(Boolean);
  const minValue = Math.min(...values, ...guides);
  const maxValue = Math.max(...values, ...guides);
  const pad = Math.max(1, (maxValue - minValue) * 0.14);
  const yMin = minValue - pad;
  const yMax = maxValue + pad;
  const width = 420;
  const height = 180;
  const left = 34;
  const right = 12;
  const top = 12;
  const bottom = 28;
  const xFor = (day) => left + ((day - 1) / (TOTAL_DAYS - 1)) * (width - left - right);
  const yFor = (value) => top + ((yMax - value) / (yMax - yMin)) * (height - top - bottom);
  const line = data.map((item) => `${xFor(item.day)},${yFor(item.value)}`).join(' ');
  const area = data.length === 1
    ? `${xFor(data[0].day) - 3},${height - bottom} ${line} ${xFor(data[0].day) + 3},${height - bottom}`
    : `${left},${height - bottom} ${line} ${xFor(data.at(-1).day)},${height - bottom}`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-[220px] w-full overflow-visible">
      {[0, 1, 2, 3].map((index) => {
        const y = top + index * ((height - top - bottom) / 3);
        return <line key={index} x1={left} y1={y} x2={width - right} y2={y} stroke="#e7ddca" strokeWidth="1" />;
      })}
      {[1, 30, 60, 90, 120].map((day) => (
        <g key={day}>
          <line x1={xFor(day)} y1={top} x2={xFor(day)} y2={height - bottom} stroke="#efe7d8" strokeWidth="1" />
          <text x={xFor(day)} y={height - 8} textAnchor="middle" fontSize="10" fill="#64748b">{day}</text>
        </g>
      ))}
      {guideValues.map((guide) => (
        <g key={guide}>
          <line x1={left} y1={yFor(guide)} x2={width - right} y2={yFor(guide)} stroke="#d18b47" strokeDasharray="5 5" strokeWidth="1.4" />
          <text x={left + 4} y={yFor(guide) - 5} fontSize="10" fill="#81501f">{guide}</text>
        </g>
      ))}
      {targetValue && (
        <g>
          <line x1={left} y1={yFor(targetValue)} x2={width - right} y2={yFor(targetValue)} stroke="#7c9a78" strokeDasharray="5 5" strokeWidth="1.4" />
          <text x={left + 4} y={yFor(targetValue) - 5} fontSize="10" fill="#365f36">-5 кг</text>
        </g>
      )}
      <polygon points={area} fill={fill} opacity="0.9" />
      <polyline points={line} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      {data.map((item) => (
        <g key={`${item.day}-${item.value}`}>
          <circle cx={xFor(item.day)} cy={yFor(item.value)} r="4.5" fill="#fffdf8" stroke={color} strokeWidth="3" />
          <title>{`День ${item.day}: ${item.value} ${unit}`}</title>
        </g>
      ))}
    </svg>
  );
}

function EmptyChart({ text }) {
  return (
    <div className="grid h-[220px] place-items-center border border-dashed border-[#e1d6c3] bg-[#fffaf1] text-center text-sm font-bold text-slate-500 rounded-lg">
      {text}
    </div>
  );
}

function NutritionBars({ days }) {
  const filled = days.filter((day) => num(day.calories)).slice(-21);
  if (!filled.length) return <EmptyChart text="Питание появится после первых отметок" />;
  const maxValue = Math.max(...filled.map((day) => num(day.calories)), CALORIE_LIMIT);
  return (
    <div className="flex h-[220px] items-end gap-2 border border-[#e8dfce] bg-[#fffdf8] p-3 rounded-lg">
      {filled.map((day) => {
        const calories = num(day.calories);
        const tone = calories <= CALORIE_TOP ? '#7c9a78' : calories <= CALORIE_LIMIT ? '#d18b47' : '#c65d5d';
        return (
          <div key={day.day} className="flex h-full flex-1 flex-col justify-end gap-1">
            <div className="flex min-h-[148px] flex-col justify-end overflow-hidden rounded-md bg-[#f3ecdf]">
              <div className="transition-all" style={{ height: `${(calories / maxValue) * 100}%`, backgroundColor: tone }} title={`${calories} ккал`} />
            </div>
            <div className="text-center text-[10px] font-bold text-slate-500">{day.day}</div>
            <div className="text-center text-[10px] font-black text-slate-700">{calories}</div>
          </div>
        );
      })}
    </div>
  );
}

function OfferProgress({ days }) {
  const closed = days.filter((day) => day.result);
  if (!closed.length) return <EmptyChart text="Траектория заполнится после закрытия дня" />;
  const cumulative = [];
  closed.reduce((sum, day) => {
    const next = sum + num(day.workMinutes);
    cumulative.push({ day: day.day, value: Number((next / 60).toFixed(1)) });
    return next;
  }, 0);
  return <LineChartSvg data={cumulative} color="#4f8fb9" fill="#eaf5fb" unit="ч" />;
}

function WeeklyPanel({ week }) {
  return (
    <div className="border border-[#eadfcd] bg-white/90 p-4 shadow-sm rounded-lg">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm font-bold text-slate-500">
            <CalendarDays size={16} />
            Неделя {week.number}
          </div>
          <h3 className="text-2xl font-black text-slate-950">Итог дней {week.from}-{week.to}</h3>
        </div>
        <div className="text-right">
          <div className="text-sm font-bold text-slate-500">XP</div>
          <div className="text-3xl font-black text-slate-950">{week.xp}</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <WeekMetric label="Закрыто" value={`${week.closed.length}/7`} />
        <WeekMetric label="1С/рынок" value={`${(week.work / 60).toFixed(1)} ч`} />
        <WeekMetric label="Средние ккал" value={week.avgCalories || '--'} />
        <WeekMetric label="Доказательства" value={week.proofCount} />
      </div>
    </div>
  );
}

function WeeklyReflection({ week, review, onChange }) {
  return (
    <section className="border border-[#eadfcd] bg-white/90 p-4 shadow-sm rounded-lg">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm font-bold text-slate-500">
            <FileText size={16} />
            Рефлексия каждые 7 дней
          </div>
          <h2 className="text-2xl font-black text-slate-950">Неделя {week.number}: что реально произошло</h2>
        </div>
        <div className="text-sm font-bold text-slate-500">Дни {week.from}-{week.to}</div>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        <ReflectionField label="Что сработало?" value={review.worked} onChange={(value) => onChange({ worked: value })} placeholder="Что двигало форму, 1С или рынок?" />
        <ReflectionField label="Где просел?" value={review.blocked} onChange={(value) => onChange({ blocked: value })} placeholder="Калории, пустые дни, мало 1С, хаос?" />
        <ReflectionField label="Главный рычаг недели" value={review.nextLever} onChange={(value) => onChange({ nextLever: value })} placeholder="Один ход, который даст максимум." />
      </div>
    </section>
  );
}

function ReflectionField({ label, value, onChange, placeholder }) {
  return (
    <label className="block border border-[#e8dfce] bg-[#fffaf1] p-3 rounded-lg">
      <span className="mb-2 block text-sm font-black text-slate-600">{label}</span>
      <textarea
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-28 w-full resize-none border border-[#e6dcc8] bg-white px-3 py-2 text-sm font-semibold leading-6 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#8fb989] rounded-md"
      />
    </label>
  );
}

function WeekMetric({ label, value }) {
  return (
    <div className="border border-[#e8dfce] bg-[#fffaf1] p-3 rounded-lg">
      <div className="text-xs font-bold text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-black text-slate-950">{value}</div>
    </div>
  );
}

function DiagnosisPanel({ items }) {
  return (
    <div className="border border-[#eadfcd] bg-white/90 p-4 shadow-sm rounded-lg">
      <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-500">
        <BarChart3 size={16} />
        Почему результат такой
      </div>
      <div className="grid gap-2">
        {items.map((item) => (
          <div key={item} className="flex items-start gap-2 border border-[#e8dfce] bg-[#fffaf1] p-3 text-sm font-semibold leading-6 text-slate-700 rounded-lg">
            <ChevronRight size={16} className="mt-1 shrink-0 text-[#7c9a78]" />
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function WeeksStrip({ weeks }) {
  return (
    <div className="border border-[#eadfcd] bg-white/90 p-4 shadow-sm rounded-lg">
      <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-500">
        <CalendarDays size={16} />
        18 недель
      </div>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {weeks.map((week) => {
          const intensity = clamp(week.xp / 900, 0, 1);
          return (
            <div
              key={week.number}
              className="min-h-[58px] border p-2 rounded-md"
              style={{
                backgroundColor: `rgba(124, 154, 120, ${0.08 + intensity * 0.28})`,
                borderColor: week.closed.length ? '#cfe2c8' : '#eadfcd',
              }}
              title={`Неделя ${week.number}: ${week.xp} XP`}
            >
              <div className="text-xs font-bold text-slate-500">W{week.number}</div>
              <div className="text-lg font-black text-slate-950">{week.closed.length}/7</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Checkpoints({ days, currentDayIndex }) {
  return (
    <section className="border border-[#eadfcd] bg-white/90 p-4 shadow-sm rounded-lg">
      <div className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-500">
        <Trophy size={16} />
        Промежуточные итоги
      </div>
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {CHECKPOINT_DAYS.map((dayNumber) => {
          const summary = checkpointSummary(days, dayNumber);
          const reached = currentDayIndex + 1 >= dayNumber;
          return (
            <div key={dayNumber} className={`border p-4 rounded-lg ${reached ? 'border-[#cfe2c8] bg-[#f1f8ed]' : 'border-[#e8dfce] bg-[#fffaf1]'}`}>
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-bold text-slate-500">День {dayNumber}</div>
                {reached ? <CheckCircle2 size={17} className="text-[#5f8f5d]" /> : <Lock size={16} className="text-slate-400" />}
              </div>
              <div className="text-2xl font-black text-slate-950">{summary.xp} XP</div>
              <div className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                {summary.closed}/{summary.elapsed} дней · {(summary.workMinutes / 60).toFixed(1)} ч 1С
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function FinalReview({ review, onChange }) {
  return (
    <section className="border border-[#f1d2a7] bg-[#fff3df] p-5 shadow-sm rounded-lg">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-black uppercase tracking-wide text-[#81501f]">Финальная форма</div>
          <h2 className="text-5xl font-black leading-none text-slate-950">День 120</h2>
        </div>
        <Trophy size={54} className="text-[#d18b47]" />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <ReflectionField label="Что получилось по рынку/офферу?" value={review.offer} onChange={(value) => onChange({ offer: value })} placeholder="Оффер, собесы, уровень, рынок." />
        <ReflectionField label="Что получилось по форме?" value={review.body} onChange={(value) => onChange({ body: value })} placeholder="Вес, форма, питание, тело." />
        <ReflectionField label="Почему результат именно такой?" value={review.why} onChange={(value) => onChange({ why: value })} placeholder="Главные причины результата." />
        <ReflectionField label="Следующий этап" value={review.next} onChange={(value) => onChange({ next: value })} placeholder="Что начинается после 120 дней." />
      </div>
    </section>
  );
}

function ExportModal({ exportMode, setExportMode, data, copied, onCopy, onDownload, onClose }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 grid place-items-center bg-slate-900/35 p-4 backdrop-blur-sm">
      <motion.section initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }} className="w-full max-w-4xl border border-[#eadfcd] bg-[#fffdf8] p-4 shadow-2xl rounded-lg">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2 text-sm font-bold text-slate-500">
              <Download size={16} />
              Экспорт для анализа
            </div>
            <h2 className="text-2xl font-black text-slate-950">Данные 120-дневного пути</h2>
          </div>
          <button onClick={onClose} className="self-start text-slate-500 transition hover:text-slate-950">
            <XCircle size={26} />
          </button>
        </div>
        <div className="mb-3 flex flex-wrap gap-2">
          <button onClick={() => setExportMode('markdown')} className={`px-3 py-2 text-sm font-black rounded-md ${exportMode === 'markdown' ? 'bg-slate-950 text-white' : 'border border-[#e8dfce] bg-white text-slate-600'}`}>Markdown</button>
          <button onClick={() => setExportMode('json')} className={`px-3 py-2 text-sm font-black rounded-md ${exportMode === 'json' ? 'bg-slate-950 text-white' : 'border border-[#e8dfce] bg-white text-slate-600'}`}>JSON</button>
          <button onClick={onCopy} className="inline-flex items-center gap-2 border border-[#cfe2c8] bg-[#eef6e9] px-3 py-2 text-sm font-black text-[#365f36] rounded-md">
            <Copy size={16} />
            {copied ? 'Скопировано' : 'Скопировать'}
          </button>
          <button onClick={onDownload} className="inline-flex items-center gap-2 border border-[#c8e1ef] bg-[#eaf5fb] px-3 py-2 text-sm font-black text-[#255b7a] rounded-md">
            <Download size={16} />
            Скачать
          </button>
        </div>
        <textarea readOnly value={data} className="h-[58vh] w-full resize-none border border-[#e8dfce] bg-white p-4 font-mono text-sm leading-6 text-slate-800 outline-none rounded-md" />
      </motion.section>
    </motion.div>
  );
}

function ConfirmReset({ onCancel, onConfirm }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 grid place-items-center bg-slate-900/35 p-4 backdrop-blur-sm">
      <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} className="w-full max-w-md border border-[#eadfcd] bg-[#fffdf8] p-5 shadow-2xl rounded-lg">
        <h2 className="text-2xl font-black text-slate-950">Начать заново?</h2>
        <p className="mt-3 leading-7 text-slate-600">
          Прогресс этого аккаунта будет заменён новым стартом с сегодняшней датой.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button onClick={onCancel} className="border border-[#e8dfce] bg-white px-4 py-3 font-black text-slate-700 rounded-md">Оставить</button>
          <button onClick={onConfirm} className="bg-slate-950 px-4 py-3 font-black text-white rounded-md">Новый старт</button>
        </div>
      </motion.section>
    </motion.div>
  );
}

export default App;
