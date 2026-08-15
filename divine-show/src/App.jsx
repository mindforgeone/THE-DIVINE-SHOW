import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  AlertCircle,
  BarChart3,
  BatteryCharging,
  BadgeCheck,
  Brain,
  CalendarDays,
  Camera,
  CandyOff,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Cloud,
  Copy,
  Download,
  Drama,
  Filter,
  FileText,
  Flame,
  Footprints,
  Gauge,
  Heart,
  LineChart,
  Loader2,
  Lock,
  LogIn,
  LogOut,
  Medal,
  Play,
  Plus,
  Route,
  Save,
  Scale,
  Settings2,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Trophy,
  Trash2,
  Utensils,
  User,
  WineOff,
  XCircle,
  Zap,
} from 'lucide-react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { doc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore';
import { auth, db, firebaseConfigured, googleProvider } from './firebase';
import transformationBanner from './assets/transformation-banner.webp';

const TOTAL_DAYS = 120;
const STORAGE_KEY = 'growth-120-account-state-v2';
const CALORIE_TOP = 1800;
const CALORIE_LIMIT = 2300;
const LEVEL_STEP = 650;
const WEEK_COUNT = Math.ceil(TOTAL_DAYS / 7);
const CHECKPOINT_DAYS = [7, 14, 30, 60, 90, 120];
const DEFAULT_PROFILE = {
  age: 39,
  height: 167,
  sex: 'male',
  targetWeight: 65,
};
const DEFAULT_HABITS = [
  { id: 'alcohol', name: 'Алкоголь: 0', active: true, locked: true, createdAt: null },
  { id: 'sweet', name: 'Сладкое: 0', active: true, locked: true, createdAt: null },
];
const CORE_HABIT_IDS = ['alcohol', 'sweet'];
const ANXIETY_CATEGORIES = [
  { id: 'work', label: 'Работа' },
  { id: 'communication', label: 'Общение' },
  { id: 'expression', label: 'Самовыражение' },
  { id: 'new', label: 'Новое действие' },
  { id: 'body', label: 'Тело' },
  { id: 'other', label: 'Другое' },
];
const WIN_CATEGORIES = [
  { id: 'work', label: 'Ценность в Контуре' },
  { id: 'body', label: 'Тело и форма' },
  { id: 'acting', label: 'Актёрское мастерство' },
  { id: 'photo', label: 'Фотография' },
  { id: 'expression', label: 'Самовыражение' },
  { id: 'discipline', label: 'Доверие к себе' },
  { id: 'other', label: 'Другое' },
];
const GROWTH_CATEGORIES = [
  { id: 'kontur', label: 'Контур', color: '#0d7ea5' },
  { id: 'one-c', label: '1С и новый маршрут', color: '#6657c8' },
  { id: 'body', label: 'Тело', color: '#16a36a' },
  { id: 'acting', label: 'Актёрское мастерство', color: '#d75b7d' },
  { id: 'photo', label: 'Фотография', color: '#d58125' },
  { id: 'expression', label: 'Самовыражение', color: '#1b8f90' },
  { id: 'self', label: 'Забота о себе', color: '#b65aa1' },
  { id: 'other', label: 'Другое', color: '#64748b' },
];
const GROWTH_IMPACTS = [
  { id: 'step', label: 'Шаг', xp: 10 },
  { id: 'strong', label: 'Сильное', xp: 25 },
  { id: 'breakthrough', label: 'Прорыв', xp: 50 },
];
const CAREER_DECISIONS = {
  pending: {
    title: 'Испытательный срок идёт',
    description: 'Сейчас курс один: стать полезным специалистом в Контуре и собрать доказательства своей ценности.',
  },
  passed: {
    title: 'Испытательный срок пройден',
    description: 'Маршрут продолжается: закрепляться, брать больше ответственности и расти внутри Контура.',
  },
  not_passed: {
    title: 'Маршрут изменён, путь продолжается',
    description: 'Возвращение к 1С: системно усилить навыки, собрать мощный учёт результатов и выйти на новый уровень.',
  },
};

const SCENARIOS = {
  career: {
    id: 'career',
    title: 'Форма, 1С и рынок',
    shortTitle: '1С и рынок',
    header: '120 дней: форма, 1С, рынок',
    description: 'Учёба, практика и выход на рынок вместе с питанием и формой.',
    finish: 'Почему форма стала лучше, 1С выросла, а рынок стал ближе.',
  },
  life: {
    id: 'life',
    title: '120 дней выбора себя',
    shortTitle: 'Выбор себя',
    header: '120 дней: я действую и выбираю себя',
    description: 'Контур, 65 кг, актёрское мастерство, фотография и спокойное действие без самонаказания.',
    finish: 'Какие факты доказывают, что я научился доверять себе, действовать свободнее и построил новую норму.',
  },
};

const TIERS = {
  bad: {
    id: 'bad',
    title: 'День возвращения',
    short: 'Возврат',
    xp: 10,
    color: '#c65d5d',
    bg: '#fff1f1',
    border: '#efc6c6',
    text: '#8d3333',
    description: 'День зафиксирован честно. Главное — траектория продолжается, а завтра есть точка возврата.',
  },
  weak: {
    id: 'weak',
    title: 'Минимум удержан',
    short: 'Минимум',
    xp: 25,
    color: '#d18b47',
    bg: '#fff6e8',
    border: '#efd4aa',
    text: '#81501f',
    description: 'Минимум удержан. Это не вершина, но система не исчезла и может усилиться завтра.',
  },
  base: {
    id: 'base',
    title: 'День опоры',
    short: 'Опора',
    xp: 50,
    color: '#168b8f',
    bg: '#e6f9f8',
    border: '#9edddb',
    text: '#12676a',
    description: 'День закрыт нормально: система держится, форма и 1С не выпали.',
  },
  growth: {
    id: 'growth',
    title: 'День роста',
    short: 'Рост',
    xp: 110,
    color: '#20a969',
    bg: '#e8fbf1',
    border: '#8de0b5',
    text: '#116b42',
    description: 'Есть заметный вклад в форму, 1С или рынок. Такой день двигает траекторию.',
  },
  breakthrough: {
    id: 'breakthrough',
    title: 'День прорыва',
    short: 'Прорыв',
    xp: 190,
    color: '#18a957',
    bg: '#e9fbef',
    border: '#9ee8b7',
    text: '#0f7138',
    description: 'Идеальный день: 1С/рынок, питание, вес и доказательства сошлись в один вектор.',
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

const LIFE_SIGNALS = [
  { minXp: 1200, text: 'Новые решения уже повторяются. Ты не ждёшь уверенности, а создаёшь её действиями.' },
  { minXp: 2800, text: 'Чистое питание, проявленность и действия роста складываются в устойчивый ритм.' },
  { minXp: 5200, text: 'Старые привычки теряют власть: дистанция подтверждает, что ты умеешь выбирать себя.' },
  { minXp: 9000, text: 'Это уже не временный режим. Ты построил жизнь, в которой форма и ясность поддерживают друг друга.' },
];

const LIFE_TIER_DESCRIPTIONS = {
  bad: 'Правило нарушено, но ценность человека не нарушается. Фиксируем честно и возвращаемся к выбранному курсу следующим действием.',
  weak: 'Факты дня собраны. Курс не идеален, но честность уже возвращает управление тебе.',
  base: 'Нерушимые правила удержаны. Это не наказание, а спокойное подтверждение собственного выбора.',
  growth: 'Правила удержаны и появилось конкретное действие роста. Доверие к себе стало сильнее на один факт.',
  breakthrough: 'Ты не только удержал курс, но и расширил границы сильным действием. Именно так меняется способ жить.',
};

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

function average(values) {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
}

function getActiveHabits(habits = []) {
  return habits.filter((habit) => habit.active !== false);
}

function getHabitValue(day, habitId) {
  if (typeof day.habitValues?.[habitId] === 'boolean') return day.habitValues[habitId];
  if (habitId === 'alcohol' && typeof day.alcoholFree === 'boolean') return day.alcoholFree;
  if (habitId === 'sweet' && typeof day.sweetFree === 'boolean') return day.sweetFree;
  return null;
}

function calculateBmr(weight, profile = DEFAULT_PROFILE) {
  const currentWeight = num(weight);
  if (!currentWeight) return 0;
  const base = (10 * currentWeight) + (6.25 * num(profile.height)) - (5 * num(profile.age));
  return Math.round(base + (profile.sex === 'female' ? -161 : 5));
}

function calculateEnergyBalance(day, profile) {
  const calories = num(day.calories);
  const bmr = calculateBmr(day.weight, profile);
  if (!calories || !bmr) return null;
  const expenditure = bmr + num(day.activeCalories);
  return Math.round(calories - expenditure);
}

function formatEnergyBalance(balance) {
  if (balance === null || balance === undefined) return '--';
  if (balance < 0) return `Дефицит ${Math.abs(balance)} ккал`;
  if (balance > 0) return `Профицит ${balance} ккал`;
  return 'Баланс 0 ккал';
}

function createHabitId(name) {
  const slug = name.toLowerCase().replace(/[^a-zа-яё0-9]+/gi, '-').replace(/^-|-$/g, '');
  return `${slug || 'habit'}-${Date.now().toString(36)}`;
}

function createAnxietySituation() {
  return {
    id: `anxiety-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    category: 'work',
    situation: '',
    before: '',
    peak: '',
    after: '',
    action: '',
  };
}

function createGrowthAction() {
  return {
    id: `growth-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    category: 'kontur',
    impact: 'step',
    text: '',
    outcome: '',
  };
}

function isGrowthActionComplete(item) {
  return Boolean(item?.category && item?.impact && item?.text?.trim().length >= 3);
}

function isAnxietySituationComplete(item) {
  return Boolean(
    item?.situation?.trim().length >= 3
    && item?.before !== ''
    && item?.peak !== ''
    && item?.after !== ''
    && item?.action?.trim().length >= 3
  );
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
    alcoholFree: null,
    sweetFree: null,
    readingMinutes: '',
    activeCalories: '',
    steps: '',
    habitValues: {},
    choiceContext: '',
    anxietySituations: [],
    growthActions: [],
    dailyWinCategory: '',
    dailyWinText: '',
    artifactText: '',
    workWinType: '',
    workWinText: '',
    summary: '',
    draftSavedAt: null,
    draftUpdatedAt: null,
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
    updatedAt: null,
  };
}

function isWeeklyReviewComplete(review) {
  return Boolean(
    review?.worked?.trim()
    && review?.blocked?.trim()
    && review?.nextLever?.trim()
  );
}

function getDueReviewIndex(weeklyReviews, currentDayNumber) {
  const completedWeeks = Math.floor(currentDayNumber / 7);
  for (let index = 0; index < completedWeeks; index += 1) {
    if (!isWeeklyReviewComplete(weeklyReviews[index])) return index;
  }
  return -1;
}

function createInitialState(startDate = todayKey(), contractAcceptedAt = null) {
  const createdAt = new Date().toISOString();
  return {
    version: 6,
    scenario: 'life',
    journeyId: `journey-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    contractAcceptedAt,
    careerDecision: {
      status: 'pending',
      decidedAt: null,
    },
    profile: { ...DEFAULT_PROFILE },
    habits: DEFAULT_HABITS.map((habit) => ({ ...habit, createdAt: startDate })),
    startDate,
    createdAt,
    updatedAtClient: createdAt,
    days: Array.from({ length: TOTAL_DAYS }, (_, index) => createDay(index + 1, startDate)),
    weeklyReviews: Array.from({ length: WEEK_COUNT }, (_, index) => createWeeklyReview(index)),
    finalReview: {
      offer: '',
      body: '',
      why: '',
      next: '',
      updatedAt: null,
    },
  };
}

function normalizeHabits(rawHabits, startDate) {
  const source = Array.isArray(rawHabits) ? rawHabits : [];
  const core = DEFAULT_HABITS.map((defaultHabit) => ({
    ...defaultHabit,
    ...(source.find((habit) => habit.id === defaultHabit.id) || {}),
    name: defaultHabit.name,
    active: true,
    locked: true,
    createdAt: source.find((habit) => habit.id === defaultHabit.id)?.createdAt || startDate,
  }));
  const custom = source
    .filter((habit) => !CORE_HABIT_IDS.includes(habit.id))
    .map((habit) => ({ ...habit, active: habit.active !== false, locked: false }));
  return [...core, ...custom];
}

function normalizeState(raw) {
  if (!raw?.startDate) return null;
  const startDate = raw.startDate;
  const isCurrentContract = Number(raw.version || 0) >= 6 && Boolean(raw.contractAcceptedAt);
  return {
    ...createInitialState(startDate, null),
    ...raw,
    version: 6,
    scenario: isCurrentContract ? 'life' : (raw.scenario || 'life'),
    contractAcceptedAt: isCurrentContract ? raw.contractAcceptedAt : null,
    journeyId: raw.journeyId || `legacy-${raw.createdAt || startDate}`,
    careerDecision: {
      status: raw.careerDecision?.status || 'pending',
      decidedAt: raw.careerDecision?.decidedAt || null,
    },
    profile: {
      ...DEFAULT_PROFILE,
      ...(raw.profile || {}),
    },
    habits: normalizeHabits(raw.habits, startDate),
    days: Array.from({ length: TOTAL_DAYS }, (_, index) => {
      const previous = raw.days?.[index] || {};
      const legacyProof = previous.artifactType ? [previous.artifactType] : [];
      const habitValues = {
        ...(previous.habitValues || {}),
      };
      if (typeof previous.alcoholFree === 'boolean' && typeof habitValues.alcohol !== 'boolean') habitValues.alcohol = previous.alcoholFree;
      if (typeof previous.sweetFree === 'boolean' && typeof habitValues.sweet !== 'boolean') habitValues.sweet = previous.sweetFree;
      return {
        ...createDay(index + 1, startDate),
        ...previous,
        workMinutes: previous.workMinutes ?? previous.offerMinutes ?? '',
        actionText: previous.actionText ?? previous.offerAction ?? '',
        proofs: Array.isArray(previous.proofs) ? previous.proofs : legacyProof,
        habitValues,
        anxietySituations: Array.isArray(previous.anxietySituations)
          ? previous.anxietySituations.map((item, itemIndex) => ({
            id: item.id || `anxiety-${index + 1}-${itemIndex + 1}`,
            category: item.category || 'other',
            situation: item.situation || '',
            before: item.before ?? '',
            peak: item.peak ?? '',
            after: item.after ?? '',
            action: item.action || '',
          }))
          : [],
        growthActions: Array.isArray(previous.growthActions)
          ? previous.growthActions.map((item, itemIndex) => ({
            id: item.id || `growth-${index + 1}-${itemIndex + 1}`,
            category: item.category || 'other',
            impact: item.impact || 'step',
            text: item.text || '',
            outcome: item.outcome || '',
          }))
          : [],
        dailyWinCategory: previous.dailyWinCategory || (previous.workWinType ? 'work' : ''),
        dailyWinText: previous.dailyWinText || previous.workWinText || (raw.scenario === 'life' ? previous.actionText : previous.summary) || '',
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

function stateTimestamp(state) {
  return Date.parse(state?.updatedAtClient || state?.createdAt || '') || 0;
}

function itemTimestamp(item) {
  return Date.parse(item?.closedAt || item?.draftUpdatedAt || item?.draftSavedAt || item?.updatedAt || '') || 0;
}

function mergeTrackerStates(remoteRaw, localRaw) {
  if (!remoteRaw) return normalizeState(localRaw);
  if (!localRaw) return normalizeState(remoteRaw);
  const remote = normalizeState(remoteRaw);
  const local = normalizeState(localRaw);
  if (!remote) return local;
  if (!local) return remote;

  if (remote.journeyId !== local.journeyId) {
    const bothLegacy = (remoteRaw.version || 0) < 4 && (localRaw.version || 0) < 4;
    if (bothLegacy) {
      const remoteClosed = remote.days.filter((day) => day.result).length;
      const localClosed = local.days.filter((day) => day.result).length;
      return localClosed > remoteClosed ? local : remote;
    }
    return stateTimestamp(local) > stateTimestamp(remote) ? local : remote;
  }

  const localIsNewer = stateTimestamp(local) > stateTimestamp(remote);
  const newer = localIsNewer ? local : remote;
  const older = localIsNewer ? remote : local;
  return {
    ...older,
    ...newer,
    days: remote.days.map((remoteDay, index) => {
      const localDay = local.days[index];
      if (remoteDay.result && !localDay.result) return remoteDay;
      if (localDay.result && !remoteDay.result) return localDay;
      return itemTimestamp(localDay) > itemTimestamp(remoteDay) ? localDay : remoteDay;
    }),
    weeklyReviews: remote.weeklyReviews.map((remoteReview, index) => {
      const localReview = local.weeklyReviews[index];
      return itemTimestamp(localReview) > itemTimestamp(remoteReview) ? localReview : remoteReview;
    }),
    profile: { ...(localIsNewer ? remote.profile : local.profile), ...(localIsNewer ? local.profile : remote.profile) },
    habits: newer.habits,
    finalReview: itemTimestamp(local.finalReview) > itemTimestamp(remote.finalReview) ? local.finalReview : remote.finalReview,
    updatedAtClient: new Date(Math.max(stateTimestamp(remote), stateTimestamp(local))).toISOString(),
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

function getCurrentDayIndex(startDate) {
  const start = dateFromKey(startDate).getTime();
  const today = dateFromKey(todayKey()).getTime();
  return clamp(Math.floor((today - start) / 86400000), 0, TOTAL_DAYS - 1);
}

function getTierDescription(tierId, scenario) {
  return scenario === 'life' ? LIFE_TIER_DESCRIPTIONS[tierId] : TIERS[tierId]?.description;
}

function evaluateDay(day, scenario = 'career', habits = DEFAULT_HABITS) {
  if (scenario === 'life') return evaluateLifeDay(day, habits);
  const workMinutes = num(day.workMinutes);
  const calories = num(day.calories);
  const meals = num(day.meals);
  const weight = num(day.weight);
  const hasWorkFields = workMinutes > 0 && day.actionText.trim().length >= 5;
  const hasNutritionFields = calories > 0 && meals > 0;
  const hasWork = workMinutes >= 25 && day.actionText.trim().length >= 5;
  const hasNutrition = calories > 0 && calories <= CALORIE_LIMIT && meals >= 1 && meals <= 3;
  const hasWeight = weight > 0;
  const hasActivityFields = day.activeCalories !== '' && day.steps !== '';
  const hasProof = Array.isArray(day.proofs) && day.proofs.length > 0;
  const hasDailyWin = Boolean(day.dailyWinCategory && day.dailyWinText?.trim().length >= 5);
  const anxietyComplete = (day.anxietySituations || []).every(isAnxietySituationComplete);
  const canFix = hasWorkFields && hasNutritionFields && hasWeight && hasActivityFields && hasProof && hasDailyWin && anxietyComplete;

  const score = [
    hasWork ? 30 : hasWorkFields ? 14 : 0,
    hasNutrition ? 25 : hasNutritionFields ? 8 : 0,
    hasWeight ? 15 : 0,
    hasProof ? 15 : 0,
    hasDailyWin ? 15 : 0,
  ].reduce((sum, value) => sum + value, 0);

  const blockers = [];
  if (!hasWorkFields) blockers.push('1С/рынок: внеси минуты и конкретное действие');
  if (!hasProof) blockers.push('Доказательства дня: выбери хотя бы один пункт');
  if (!hasNutritionFields) blockers.push('Питание: внеси калории и количество приёмов пищи');
  if (!hasWeight) blockers.push('Вес: внеси текущий вес');
  if (!hasActivityFields) blockers.push('Активность: внеси активные калории и шаги, даже если значение равно 0');
  if (!hasDailyWin) blockers.push('Победа дня: зафиксируй одно доказательство роста');
  if (!anxietyComplete) blockers.push('Тревога: заверши или удали добавленную ситуацию');

  if (!canFix) {
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
      canFix,
      blockers,
      description: 'День ещё нельзя фиксировать: сначала заполни обязательные поля.',
    };
  }

  let tier = TIERS.bad;
  if (hasWork || hasNutrition) {
    tier = TIERS.weak;
  }
  if (hasWork && hasNutrition) {
    tier = TIERS.base;
  }
  if (workMinutes >= 75 && hasNutrition && day.actionText.trim().length >= 18) {
    tier = TIERS.growth;
  }
  if (workMinutes >= 120 && calories <= CALORIE_TOP && hasProof && hasDailyWin) {
    tier = TIERS.breakthrough;
  }

  return { ...tier, score, canFix, blockers: [], description: tier.description };
}

function evaluateLifeDay(day, habits) {
  const calories = num(day.calories);
  const meals = num(day.meals);
  const weight = num(day.weight);
  const hasNutritionFields = calories > 0 && meals > 0;
  const hasNutrition = calories > 0 && calories <= CALORIE_LIMIT && meals >= 1 && meals <= 3;
  const hasTopNutrition = hasNutrition && calories <= CALORIE_TOP;
  const hasWeight = weight > 0;
  const activeHabits = getActiveHabits(habits);
  const coreHabits = activeHabits.filter((habit) => CORE_HABIT_IDS.includes(habit.id));
  const coreAnswers = coreHabits.map((habit) => getHabitValue(day, habit.id));
  const hasCoreAnswers = coreAnswers.length === CORE_HABIT_IDS.length && coreAnswers.every((value) => typeof value === 'boolean');
  const keptCoreRules = hasCoreAnswers && coreAnswers.every((value) => value === true);
  const hasBrokenCoreRule = hasCoreAnswers && coreAnswers.some((value) => value === false);
  const hasChoiceContext = !hasBrokenCoreRule || day.choiceContext?.trim().length >= 3;
  const hasActivityFields = day.activeCalories !== '' && day.steps !== '';
  const hasDailyWin = Boolean(day.dailyWinCategory && day.dailyWinText?.trim().length >= 5);
  const anxietyComplete = (day.anxietySituations || []).every(isAnxietySituationComplete);
  const growthActions = day.growthActions || [];
  const growthActionsComplete = growthActions.every(isGrowthActionComplete);
  const completedGrowthActions = growthActions.filter(isGrowthActionComplete);
  const growthXp = completedGrowthActions.reduce((sum, item) => sum + (GROWTH_IMPACTS.find((impact) => impact.id === item.impact)?.xp || 0), 0);
  const canFix = hasNutritionFields
    && hasWeight
    && hasCoreAnswers
    && hasActivityFields
    && hasDailyWin
    && anxietyComplete
    && growthActionsComplete
    && hasChoiceContext;

  const score = [
    hasNutrition ? 20 : hasNutritionFields ? 8 : 0,
    hasWeight ? 5 : 0,
    hasActivityFields ? 10 : 0,
    keptCoreRules ? 40 : hasCoreAnswers ? 0 : 0,
    hasDailyWin ? 20 : 0,
    Math.min(5, completedGrowthActions.length * 3),
  ].reduce((sum, value) => sum + value, 0);

  const blockers = [];
  if (!hasCoreAnswers) blockers.push('Нерушимые правила: честно отметь алкоголь и сладкое');
  if (!hasNutritionFields) blockers.push('Питание: внеси калории и количество приёмов пищи');
  if (!hasWeight) blockers.push('Вес: внеси текущий вес');
  if (!hasActivityFields) blockers.push('Активность: внеси активные калории и шаги, даже если значение равно 0');
  if (!hasDailyWin) blockers.push('Доверие к себе: зафиксируй одно доказательство дня');
  if (!hasChoiceContext) blockers.push('Возврат к выбору: коротко зафиксируй, что происходило перед нарушением');
  if (!anxietyComplete) blockers.push('Тревога: заверши или удали добавленную ситуацию');
  if (!growthActionsComplete) blockers.push('Действия роста: заверши или удали добавленное действие');

  if (!canFix) {
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
      canFix,
      blockers,
      description: 'Заполни факты дня. Здесь не нужно быть идеальным, важно видеть реальную траекторию.',
    };
  }

  let tier = keptCoreRules ? (hasNutrition ? TIERS.base : TIERS.weak) : TIERS.bad;
  if (keptCoreRules && hasNutrition && (completedGrowthActions.length > 0 || (day.anxietySituations || []).length > 0)) tier = TIERS.growth;
  if (keptCoreRules && (hasTopNutrition || completedGrowthActions.length > 1) && completedGrowthActions.some((item) => item.impact === 'breakthrough')) tier = TIERS.breakthrough;

  return {
    ...tier,
    score: Math.min(100, score),
    xp: tier.xp + growthXp,
    canFix,
    blockers: [],
    description: getTierDescription(tier.id, 'life'),
  };
}

function calculateStats(days, currentDayIndex, habits = DEFAULT_HABITS, profile = DEFAULT_PROFILE) {
  const elapsedDays = days.slice(0, currentDayIndex + 1);
  const closedDays = elapsedDays.filter((day) => day.result);
  const recordedDays = elapsedDays.filter((day) => day.result || day.draftSavedAt);
  const activeHabits = getActiveHabits(habits);
  const xp = days.reduce((sum, day) => sum + (day.xp || 0), 0);
  const level = Math.max(1, Math.floor(xp / LEVEL_STEP) + 1);
  const levelProgress = Math.round(((xp % LEVEL_STEP) / LEVEL_STEP) * 100);
  const tierCounts = closedDays.reduce((acc, day) => {
    acc[day.result] = (acc[day.result] || 0) + 1;
    return acc;
  }, {});

  const calories = recordedDays.map((day) => num(day.calories)).filter(Boolean);
  const avgCalories = calories.length ? Math.round(calories.reduce((sum, value) => sum + value, 0) / calories.length) : 0;
  const topCalorieDays = recordedDays.filter((day) => num(day.calories) > 0 && num(day.calories) <= CALORIE_TOP).length;
  const inLimitDays = recordedDays.filter((day) => num(day.calories) > 0 && num(day.calories) <= CALORIE_LIMIT).length;
  const weights = recordedDays.map((day) => ({ day: day.day, value: num(day.weight) })).filter((item) => item.value);
  const firstWeight = weights[0]?.value || 0;
  const lastWeight = weights.at(-1)?.value || 0;
  const weightDelta = firstWeight && lastWeight ? Number((lastWeight - firstWeight).toFixed(1)) : 0;
  const activityCalories = recordedDays.map((day) => ({ day: day.day, value: num(day.activeCalories) })).filter((item) => item.value || item.value === 0 && dayHasSavedValue(recordedDays, item.day, 'activeCalories'));
  const steps = recordedDays.map((day) => ({ day: day.day, value: num(day.steps) })).filter((item) => item.value || item.value === 0 && dayHasSavedValue(recordedDays, item.day, 'steps'));
  const energyBalances = recordedDays.map((day) => ({ day: day.day, value: calculateEnergyBalance(day, profile) })).filter((item) => item.value !== null);
  const bmrValues = recordedDays.map((day) => ({ day: day.day, value: calculateBmr(day.weight, profile) })).filter((item) => item.value);
  const avgActiveCalories = activityCalories.length ? Math.round(activityCalories.reduce((sum, item) => sum + item.value, 0) / activityCalories.length) : 0;
  const avgSteps = steps.length ? Math.round(steps.reduce((sum, item) => sum + item.value, 0) / steps.length) : 0;
  const avgEnergyBalance = energyBalances.length ? Math.round(energyBalances.reduce((sum, item) => sum + item.value, 0) / energyBalances.length) : 0;
  const deficitDays = energyBalances.filter((item) => item.value < 0).length;
  const surplusDays = energyBalances.filter((item) => item.value > 0).length;
  const totalDeficit = Math.abs(energyBalances.filter((item) => item.value < 0).reduce((sum, item) => sum + item.value, 0));
  const totalEnergyBalance = energyBalances.reduce((sum, item) => sum + item.value, 0);

  const workMinutes = closedDays.reduce((sum, day) => sum + num(day.workMinutes), 0);
  const proofCount = closedDays.reduce((sum, day) => sum + (Array.isArray(day.proofs) ? day.proofs.length : 0), 0);
  const dailyWins = recordedDays.filter((day) => day.dailyWinText?.trim());
  const choiceContexts = closedDays.filter((day) => day.choiceContext?.trim());
  const growthActions = recordedDays.flatMap((day) => (day.growthActions || []).map((item) => ({
    ...item,
    day: day.day,
    date: day.date,
    complete: isGrowthActionComplete(item),
  }))).filter((item) => item.complete);
  const growthXp = growthActions.reduce((sum, item) => sum + (GROWTH_IMPACTS.find((impact) => impact.id === item.impact)?.xp || 0), 0);
  const actingSessions = growthActions.filter((item) => item.category === 'acting');
  const photoActions = growthActions.filter((item) => item.category === 'photo');
  const konturActions = growthActions.filter((item) => item.category === 'kontur');
  const oneCActions = growthActions.filter((item) => item.category === 'one-c');
  const anxietyEvents = recordedDays.flatMap((day) => (day.anxietySituations || []).map((item) => ({
    ...item,
    day: day.day,
    date: day.date,
    complete: isAnxietySituationComplete(item),
  }))).filter((item) => item.complete);
  const anxietyBefore = average(anxietyEvents.map((item) => num(item.before)));
  const anxietyPeak = average(anxietyEvents.map((item) => num(item.peak)));
  const anxietyAfter = average(anxietyEvents.map((item) => num(item.after)));
  const trendWindow = Math.min(5, Math.floor(anxietyEvents.length / 2));
  const anxietyTrend = trendWindow
    ? average(anxietyEvents.slice(-trendWindow).map((item) => num(item.peak))) - average(anxietyEvents.slice(0, trendWindow).map((item) => num(item.peak)))
    : null;
  const habitStats = habits.map((habit) => {
    const answered = closedDays.filter((day) => typeof getHabitValue(day, habit.id) === 'boolean');
    const kept = answered.filter((day) => getHabitValue(day, habit.id) === true).length;
    const streak = [...elapsedDays].reverse().reduce((acc, day) => {
      if (acc.done) return acc;
      if (day.result && getHabitValue(day, habit.id) === true) return { count: acc.count + 1, done: false };
      return { count: acc.count, done: true };
    }, { count: 0, done: false }).count;
    return {
      ...habit,
      answered: answered.length,
      kept,
      rate: answered.length ? Math.round((kept / answered.length) * 100) : 0,
      streak,
    };
  });
  const completionRate = elapsedDays.length ? Math.round((closedDays.length / elapsedDays.length) * 100) : 0;
  const emptyDays = elapsedDays.length - closedDays.length;
  const streak = [...elapsedDays].reverse().reduce((acc, day) => {
    if (acc.done) return acc;
    if (day.result) return { count: acc.count + 1, done: false };
    return { count: acc.count, done: true };
  }, { count: 0, done: false }).count;
  const cleanStreak = [...elapsedDays].reverse().reduce((acc, day) => {
    if (acc.done) return acc;
    const keptAll = activeHabits.length > 0 && activeHabits.every((habit) => getHabitValue(day, habit.id) === true);
    if (day.result && keptAll) return { count: acc.count + 1, done: false };
    return { count: acc.count, done: true };
  }, { count: 0, done: false }).count;
  const selfTrustScore = closedDays.length ? Math.round(closedDays.reduce((sum, day) => {
    const keptCore = CORE_HABIT_IDS.every((habitId) => getHabitValue(day, habitId) === true);
    const hasWin = Boolean(day.dailyWinText?.trim());
    const hasGrowth = (day.growthActions || []).some(isGrowthActionComplete);
    return sum + (keptCore ? 60 : 0) + (hasWin ? 20 : 0) + (hasGrowth ? 20 : 0);
  }, 0) / closedDays.length) : 0;

  return {
    elapsedDays,
    closedDays,
    recordedDays,
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
    activityCalories,
    steps,
    energyBalances,
    bmrValues,
    currentBmr: bmrValues.at(-1)?.value || 0,
    avgActiveCalories,
    avgSteps,
    avgEnergyBalance,
    deficitDays,
    surplusDays,
    totalDeficit,
    totalEnergyBalance,
    workMinutes,
    proofCount,
    dailyWins,
    choiceContexts,
    growthActions,
    growthXp,
    actingSessions,
    photoActions,
    konturActions,
    oneCActions,
    anxietyEvents,
    anxietyBefore,
    anxietyPeak,
    anxietyAfter,
    anxietyTrend,
    habitStats,
    completionRate,
    emptyDays,
    streak,
    cleanStreak,
    selfTrustScore,
  };
}

function dayHasSavedValue(days, dayNumber, key) {
  const day = days.find((item) => item.day === dayNumber);
  return day ? day[key] !== '' && day[key] !== null && day[key] !== undefined : false;
}

function getWeeks(days, habits = DEFAULT_HABITS, profile = DEFAULT_PROFILE) {
  return Array.from({ length: WEEK_COUNT }, (_, index) => {
    const weekDays = days.slice(index * 7, index * 7 + 7);
    const closed = weekDays.filter((day) => day.result);
    const calories = closed.map((day) => num(day.calories)).filter(Boolean);
    const weights = closed.map((day) => num(day.weight)).filter(Boolean);
    const energyBalances = closed.map((day) => calculateEnergyBalance(day, profile)).filter((value) => value !== null);
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
      alcoholFree: closed.filter((day) => getHabitValue(day, 'alcohol') === true).length,
      sweetFree: closed.filter((day) => getHabitValue(day, 'sweet') === true).length,
      habitStats: habits.map((habit) => ({
        id: habit.id,
        name: habit.name,
        kept: closed.filter((day) => getHabitValue(day, habit.id) === true).length,
        answered: closed.filter((day) => typeof getHabitValue(day, habit.id) === 'boolean').length,
      })),
      activeCalories: closed.reduce((sum, day) => sum + num(day.activeCalories), 0),
      steps: closed.reduce((sum, day) => sum + num(day.steps), 0),
      avgEnergyBalance: energyBalances.length ? Math.round(energyBalances.reduce((sum, value) => sum + value, 0) / energyBalances.length) : 0,
      dailyWins: closed.filter((day) => day.dailyWinText?.trim()).length,
      growthActions: closed.reduce((sum, day) => sum + (day.growthActions || []).filter(isGrowthActionComplete).length, 0),
      actingSessions: closed.reduce((sum, day) => sum + (day.growthActions || []).filter((item) => isGrowthActionComplete(item) && item.category === 'acting').length, 0),
      photoActions: closed.reduce((sum, day) => sum + (day.growthActions || []).filter((item) => isGrowthActionComplete(item) && item.category === 'photo').length, 0),
      anxietyEvents: closed.reduce((sum, day) => sum + (day.anxietySituations || []).filter(isAnxietySituationComplete).length, 0),
      breakthrough: closed.filter((day) => day.result === 'breakthrough').length,
      growth: closed.filter((day) => day.result === 'growth').length,
      base: closed.filter((day) => day.result === 'base').length,
      weak: closed.filter((day) => day.result === 'weak').length,
      bad: closed.filter((day) => day.result === 'bad').length,
    };
  });
}

function checkpointSummary(days, dayNumber, habits = DEFAULT_HABITS, profile = DEFAULT_PROFILE) {
  const slice = days.slice(0, dayNumber);
  const closed = slice.filter((day) => day.result);
  const calories = closed.map((day) => num(day.calories)).filter(Boolean);
  const weights = closed.map((day) => num(day.weight)).filter(Boolean);
  const energyBalances = closed.map((day) => calculateEnergyBalance(day, profile)).filter((value) => value !== null);
  return {
    day: dayNumber,
    elapsed: slice.length,
    closed: closed.length,
    xp: closed.reduce((sum, day) => sum + (day.xp || 0), 0),
    workMinutes: closed.reduce((sum, day) => sum + num(day.workMinutes), 0),
    avgCalories: calories.length ? Math.round(calories.reduce((sum, value) => sum + value, 0) / calories.length) : 0,
    weightDelta: weights.length > 1 ? Number((weights.at(-1) - weights[0]).toFixed(1)) : 0,
    proofCount: closed.reduce((sum, day) => sum + (day.proofs?.length || 0), 0),
    habitStats: habits.map((habit) => ({
      id: habit.id,
      name: habit.name,
      kept: closed.filter((day) => getHabitValue(day, habit.id) === true).length,
    })),
    alcoholFreeDays: closed.filter((day) => getHabitValue(day, 'alcohol') === true).length,
    sweetFreeDays: closed.filter((day) => getHabitValue(day, 'sweet') === true).length,
    steps: closed.reduce((sum, day) => sum + num(day.steps), 0),
    avgEnergyBalance: energyBalances.length ? Math.round(energyBalances.reduce((sum, value) => sum + value, 0) / energyBalances.length) : 0,
    dailyWins: closed.filter((day) => day.dailyWinText?.trim()).length,
    growthActions: closed.reduce((sum, day) => sum + (day.growthActions || []).filter(isGrowthActionComplete).length, 0),
    actingSessions: closed.reduce((sum, day) => sum + (day.growthActions || []).filter((item) => isGrowthActionComplete(item) && item.category === 'acting').length, 0),
    photoActions: closed.reduce((sum, day) => sum + (day.growthActions || []).filter((item) => isGrowthActionComplete(item) && item.category === 'photo').length, 0),
    anxietyEvents: closed.reduce((sum, day) => sum + (day.anxietySituations || []).filter(isAnxietySituationComplete).length, 0),
  };
}

function buildExport(state, stats, weeks) {
  const scenario = state.scenario || 'career';
  const isLife = scenario === 'life';
  const closed = state.days.filter((day) => day.result);
  const checkpoints = CHECKPOINT_DAYS.map((dayNumber) => checkpointSummary(state.days, dayNumber, state.habits, state.profile));
  const habitLines = stats.habitStats.map((habit) => `${habit.name}: ${habit.kept}/${habit.answered} (${habit.rate}%)`);
  const scenarioMetrics = isLife
    ? [
      ...habitLines,
      `Побед дня: ${stats.dailyWins.length}`,
      `Действий роста: ${stats.growthActions.length}`,
      `Актёрских занятий: ${stats.actingSessions.length}`,
      `Действий в фотографии: ${stats.photoActions.length}`,
      `Индекс доверия к себе: ${stats.selfTrustScore}%`,
      `Тревожных ситуаций: ${stats.anxietyEvents.length}`,
      `Карьерный маршрут: ${CAREER_DECISIONS[state.careerDecision?.status || 'pending'].title}`,
    ]
    : [`1С/рынок часы: ${(stats.workMinutes / 60).toFixed(1)}`];
  const aiQuestion = isLife
    ? 'Проанализируй мой 120-дневный путь без морализаторства и обесценивания. Найди, какие условия помогают соблюдать нулевой алкоголь и сладкое, управлять питанием, дефицитом и весом, расти в Контуре или по новому карьерному маршруту, заниматься актёрским мастерством, снимать и действовать несмотря на тревогу. Сопоставь действия роста, конкретные ситуации тревоги и доказательства доверия к себе. Дай 3 реалистичных рычага на следующую неделю.'
    : 'Проанализируй мой 120-дневный путь. Найди, почему я приближаюсь или не приближаюсь к идеальной форме, сильному 1С-уровню и выходу на рынок. Объясни связь минут 1С/рынка, питания, веса и доказательств роста. Дай 3 главных рычага на следующую неделю.';
  const markdown = [
    `# ${SCENARIOS[scenario].header}`,
    '',
    `Сценарий: ${SCENARIOS[scenario].title}`,
    `Старт: ${state.startDate}`,
    `Дней прошло: ${stats.elapsedDays.length}/${TOTAL_DAYS}`,
    `Закрыто дней: ${stats.closedDays.length}`,
    `Очки: ${stats.xp}, уровень: ${stats.level}`,
    ...scenarioMetrics,
    `Дней <=1800 ккал: ${stats.topCalorieDays}`,
    `Дней <=2300 ккал: ${stats.inLimitDays}`,
    `Средние калории: ${stats.avgCalories || 'нет данных'}`,
    `Базовый обмен сейчас: ${stats.currentBmr || 'нет данных'} ккал`,
    `Средние активные калории: ${stats.avgActiveCalories || 0} ккал`,
    `Средние шаги: ${stats.avgSteps || 0}`,
    `Средний энергобаланс: ${stats.avgEnergyBalance > 0 ? '+' : ''}${stats.avgEnergyBalance} ккал`,
    `Суммарный дефицит: ${stats.totalDeficit} ккал`,
    `Вес: ${stats.firstWeight || 'нет'} -> ${stats.lastWeight || 'нет'} кг, дельта ${stats.weightDelta} кг`,
    `Действий роста: ${isLife ? stats.growthActions.length : stats.proofCount}`,
    '',
    '## Вопрос к нейросети',
    aiQuestion,
    '',
    '## Недельные рефлексии',
    ...state.weeklyReviews.map((review) => (
      `- Неделя ${review.week}: сработало: ${review.worked || '-'}; мешало: ${review.blocked || '-'}; рычаг: ${review.nextLever || '-'}`
    )),
    '',
    '## Недельные метрики',
    ...weeks.filter((week) => week.closed.length).map((week) => (
      isLife
        ? `- Неделя ${week.number}: закрыто ${week.closed.length}/7, очки ${week.xp}, правила: ${week.habitStats.map((habit) => `${habit.name} ${habit.kept}/${habit.answered}`).join(', ') || '-'}, действия роста ${week.growthActions}, актёрских занятий ${week.actingSessions}, фотография ${week.photoActions}, шаги ${week.steps}, энергобаланс ${week.avgEnergyBalance > 0 ? '+' : ''}${week.avgEnergyBalance} ккал, побед дня ${week.dailyWins}, тревожных ситуаций ${week.anxietyEvents}, вес ${week.weightDelta > 0 ? '+' : ''}${week.weightDelta} кг.`
        : `- Неделя ${week.number}: закрыто ${week.closed.length}/7, очки ${week.xp}, 1С/рынок ${(week.work / 60).toFixed(1)} ч, средние ккал ${week.avgCalories || '-'}, дней <=1800: ${week.topCalories}, вес ${week.weightDelta > 0 ? '+' : ''}${week.weightDelta} кг, доказательств ${week.proofCount}.`
    )),
    '',
    '## Чекпоинты',
    ...checkpoints.map((item) => (
      isLife
        ? `- День ${item.day}: закрыто ${item.closed}/${item.elapsed}, очки ${item.xp}, правила: ${item.habitStats.map((habit) => `${habit.name} ${habit.kept}`).join(', ')}, действия роста ${item.growthActions}, актёрских занятий ${item.actingSessions}, фотография ${item.photoActions}, шаги ${item.steps}, энергобаланс ${item.avgEnergyBalance > 0 ? '+' : ''}${item.avgEnergyBalance} ккал, вес ${item.weightDelta > 0 ? '+' : ''}${item.weightDelta} кг.`
        : `- День ${item.day}: закрыто ${item.closed}/${item.elapsed}, очки ${item.xp}, 1С/рынок ${(item.workMinutes / 60).toFixed(1)} ч, средние ккал ${item.avgCalories || '-'}, вес ${item.weightDelta > 0 ? '+' : ''}${item.weightDelta} кг, доказательств ${item.proofCount}.`
    )),
    '',
    '## Дни',
    ...closed.map((day) => (
      isLife
        ? `- День ${day.day} (${day.date}): ${TIERS[day.result]?.title || day.result}, очки ${day.xp}, правила: ${state.habits.map((habit) => `${habit.name}: ${getHabitValue(day, habit.id) === true ? 'да' : getHabitValue(day, habit.id) === false ? 'нет' : '-'}`).join(', ')}, контекст возврата: ${day.choiceContext || '-'}, ккал ${day.calories}, активные ккал ${day.activeCalories || 0}, шаги ${day.steps || 0}, вес ${day.weight} кг, доверие к себе: ${day.dailyWinText || '-'}, действия роста: ${(day.growthActions || []).map((item) => `${GROWTH_CATEGORIES.find((category) => category.id === item.category)?.label || item.category}: ${item.text}`).join('; ') || '-'}, тревога: ${(day.anxietySituations || []).map((item) => `${item.situation} (${item.before}/${item.peak}/${item.after})`).join('; ') || 'ситуаций не было'}`
        : `- День ${day.day} (${day.date}): ${TIERS[day.result]?.title || day.result}, очки ${day.xp}, 1С/рынок ${day.workMinutes} мин, ккал ${day.calories}, активные ккал ${day.activeCalories || 0}, шаги ${day.steps || 0}, вес ${day.weight} кг, доказательства: ${(day.proofs || []).join(', ') || '-'}, действие: ${day.actionText}, победа дня: ${day.dailyWinText || '-'}`
    )),
    '',
    '## Финал 120',
    `${isLife ? 'Что стало новой нормой' : 'Оффер/рынок'}: ${state.finalReview.offer || '-'}`,
    `Форма/тело: ${state.finalReview.body || '-'}`,
    `Почему результат такой: ${state.finalReview.why || '-'}`,
    `Следующий этап: ${state.finalReview.next || '-'}`,
  ].join('\n');

  const json = JSON.stringify({
    meta: {
      scenario,
      startDate: state.startDate,
      contractAcceptedAt: state.contractAcceptedAt,
      careerDecision: state.careerDecision,
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

function getDiagnosis(stats, week, scenario = 'career') {
  if (!stats.closedDays.length) return ['Пока нет закрытых дней. Первый результат появится после фиксации дня.'];
  const items = [];
  if (scenario === 'life') {
    const activeHabitStats = stats.habitStats.filter((habit) => habit.active !== false);
    const weakestHabit = [...activeHabitStats].sort((a, b) => a.rate - b.rate)[0];
    const strongestHabit = [...activeHabitStats].sort((a, b) => b.rate - a.rate)[0];
    if (strongestHabit?.answered) items.push(`${strongestHabit.name}: ${strongestHabit.rate}% успешных отметок. Это самая устойчивая часть новой системы.`);
    if (weakestHabit?.answered && weakestHabit.id !== strongestHabit?.id) items.push(`${weakestHabit.name}: ${weakestHabit.rate}%. Здесь полезнее искать повторяющийся триггер, а не давить на себя.`);
    if (stats.growthActions.length) items.push(`Зафиксировано ${stats.growthActions.length} действий роста. Это факты движения, которые не зависят от текущей самооценки.`);
    else items.push('Действий роста пока нет. Начни с одного небольшого поступка, который раньше откладывался из-за тревоги или сравнения.');
    if (stats.avgEnergyBalance < 0) items.push(`Средний дефицит ${Math.abs(stats.avgEnergyBalance)} ккал. При таком темпе вес должен двигаться вниз, если отметки полные.`);
    else if (stats.energyBalances.length) items.push(`Средний профицит ${stats.avgEnergyBalance} ккал. Для цели 65 кг расход пока не перекрывает питание.`);
    if (stats.dailyWins.length) items.push(`Зафиксировано ${stats.dailyWins.length} побед дня. Это конкретные доказательства изменения, а не оценка настроения.`);
    else items.push('Побед дня пока нет в данных. Записывай один конкретный факт роста, даже небольшой.');
    if (stats.anxietyEvents.length) items.push(`Зафиксировано ${stats.anxietyEvents.length} тревожных ситуаций: средний пик ${stats.anxietyPeak}, после ${stats.anxietyAfter}.`);
  } else {
  const avgWork = stats.workMinutes / Math.max(1, stats.closedDays.length);
  if (avgWork >= 75) items.push('1С/рынок получают сильное время. Это главный двигатель оффера.');
  else items.push('1С/рынок пока недобирает фокус. Рычаг: поднять среднее время до 60-90 минут.');
  }

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
  const [cloudWritable, setCloudWritable] = useState(false);
  const [syncState, setSyncState] = useState('idle');
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [showExport, setShowExport] = useState(false);
  const [exportMode, setExportMode] = useState('markdown');
  const [copied, setCopied] = useState(false);
  const [careerDecisionChoice, setCareerDecisionChoice] = useState(null);
  const [confirmCloseDay, setConfirmCloseDay] = useState(false);
  const [activeView, setActiveView] = useState('main');
  const [statsRange, setStatsRange] = useState('30');
  const lastCloudJsonRef = useRef('');
  const trackerLoadedRef = useRef(false);

  useEffect(() => {
    if (!auth) return undefined;
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthLoading(false);
      setCloudReady(false);
      setCloudWritable(false);
      setState(null);
      lastCloudJsonRef.current = '';
      trackerLoadedRef.current = false;
    });
  }, []);

  useEffect(() => {
    if (!user || !db) return undefined;
    const cached = loadCachedState(user.uid);
    const documentRef = doc(db, 'users', user.uid, 'trackers', 'growth120');
    return onSnapshot(documentRef, (snapshot) => {
      const remoteState = snapshot.exists() ? snapshot.data().state : null;
      const snapshotState = remoteState ? mergeTrackerStates(remoteState, cached) : cached;
      if (snapshot.exists()) {
        lastCloudJsonRef.current = JSON.stringify(normalizeState(remoteState));
      }
      if (snapshotState?.startDate && !trackerLoadedRef.current) {
        setActiveDayIndex(getCurrentDayIndex(snapshotState.startDate));
        trackerLoadedRef.current = true;
      }
      setState((currentState) => mergeTrackerStates(snapshotState, currentState));
      setCloudReady(true);
      setCloudWritable(true);
      setSyncState(snapshot.metadata.hasPendingWrites ? 'saving' : 'synced');
    }, (error) => {
      setAuthError(error.message);
      if (cached?.startDate && !trackerLoadedRef.current) {
        setActiveDayIndex(getCurrentDayIndex(cached.startDate));
        trackerLoadedRef.current = true;
      }
      setState((currentState) => mergeTrackerStates(cached, currentState));
      setCloudReady(true);
      setCloudWritable(false);
      setSyncState('offline');
    });
  }, [user]);

  useEffect(() => {
    if (!state || !user) return undefined;
    saveCachedState(user.uid, state);
    if (!db || !cloudReady || !cloudWritable) return undefined;
    const serialized = JSON.stringify(state);
    if (serialized === lastCloudJsonRef.current) return undefined;
    const timeoutId = window.setTimeout(async () => {
      try {
        setSyncState('saving');
        const documentRef = doc(db, 'users', user.uid, 'trackers', 'growth120');
        const mergedState = await runTransaction(db, async (transaction) => {
          const snapshot = await transaction.get(documentRef);
          const remoteState = snapshot.exists() ? snapshot.data().state : null;
          const merged = mergeTrackerStates(remoteState, state);
          transaction.set(documentRef, {
            state: merged,
            updatedAt: serverTimestamp(),
          }, { merge: true });
          return merged;
        });
        lastCloudJsonRef.current = JSON.stringify(mergedState);
        saveCachedState(user.uid, mergedState);
        setState((current) => mergeTrackerStates(mergedState, current));
        setSyncState('synced');
      } catch (error) {
        setSyncState('offline');
        setAuthError(error instanceof Error ? error.message : 'Не удалось сохранить в Firebase.');
      }
    }, 450);
    return () => window.clearTimeout(timeoutId);
  }, [state, user, cloudReady, cloudWritable]);

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

  const startJourney = () => {
    const acceptedAt = new Date().toISOString();
    const nextState = createInitialState(todayKey(), acceptedAt);
    setState(nextState);
    setActiveDayIndex(getCurrentDayIndex(nextState.startDate));
    setActiveView('main');
  };

  if (authLoading) return <LoadingScreen text="Проверяю аккаунт..." />;
  if (!user) return <LoginScreen error={authError} onSignIn={signIn} configured={firebaseConfigured} />;
  if (!cloudReady) return <LoadingScreen text="Загружаю твою историю..." />;
  if (!state?.contractAcceptedAt) return <StartScreen user={user} onStart={startJourney} onLogOut={logOut} />;

  const scenario = state.scenario || 'career';
  const currentDayIndex = getCurrentDayIndex(state.startDate);
  const currentDayNumber = currentDayIndex + 1;
  const safeActiveDayIndex = clamp(activeDayIndex, 0, currentDayIndex);
  const activeDay = state.days[safeActiveDayIndex];
  const calculatedActiveEvaluation = evaluateDay(activeDay, scenario, state.habits);
  const activeEvaluation = activeDay.result && TIERS[activeDay.result]
    ? {
      ...TIERS[activeDay.result],
      xp: activeDay.xp || TIERS[activeDay.result].xp,
      score: calculatedActiveEvaluation.score,
      canFix: true,
      blockers: [],
      description: getTierDescription(activeDay.result, scenario),
    }
    : calculatedActiveEvaluation;
  const stats = calculateStats(state.days, currentDayIndex, state.habits, state.profile);
  const weeks = getWeeks(state.days, state.habits, state.profile);
  const currentWeekIndex = Math.floor(currentDayIndex / 7);
  const currentWeek = weeks[currentWeekIndex] || weeks[0];
  const dueReviewIndex = getDueReviewIndex(state.weeklyReviews, currentDayNumber);
  const isWeeklyReviewDay = currentDayNumber % 7 === 0;
  const visibleReviewIndex = dueReviewIndex >= 0 ? dueReviewIndex : isWeeklyReviewDay ? currentWeekIndex : -1;
  const visibleWeek = visibleReviewIndex >= 0 ? weeks[visibleReviewIndex] : null;
  const visibleReview = visibleReviewIndex >= 0 ? state.weeklyReviews[visibleReviewIndex] : null;
  const visibleReviewComplete = isWeeklyReviewComplete(visibleReview);
  const activeDayClosesVisibleWeek = visibleWeek && activeDay.day >= visibleWeek.to;
  const weeklyRequiredForActiveDay = Boolean(activeDayClosesVisibleWeek && !visibleReviewComplete);
  const finalDate = addDays(state.startDate, TOTAL_DAYS - 1);
  const journeyEnded = dateFromKey(todayKey()).getTime() > dateFromKey(finalDate).getTime();
  const scenarioSignals = scenario === 'life' ? LIFE_SIGNALS : SIGNALS;
  const latestSignal = [...scenarioSignals].reverse().find((signal) => stats.xp >= signal.minXp);
  const exportData = buildExport(state, stats, weeks);
  const isFinalDay = currentDayIndex + 1 >= TOTAL_DAYS;
  const updateActiveDay = (nextDay) => {
    if (journeyEnded || safeActiveDayIndex !== currentDayIndex || activeDay.result) return;
    const changedAt = new Date().toISOString();
    setState((previous) => ({
      ...previous,
      updatedAtClient: changedAt,
      days: previous.days.map((day, index) => (
        index === safeActiveDayIndex
          ? { ...nextDay, result: null, xp: 0, closedAt: null, draftUpdatedAt: changedAt }
          : day
      )),
    }));
  };

  const saveDraft = () => {
    if (journeyEnded || safeActiveDayIndex !== currentDayIndex || activeDay.result) return;
    const savedAt = new Date().toISOString();
    setState((previous) => ({
      ...previous,
      updatedAtClient: savedAt,
      days: previous.days.map((day, index) => (
        index === safeActiveDayIndex ? { ...day, draftSavedAt: savedAt, draftUpdatedAt: savedAt } : day
      )),
    }));
  };

  const closeDay = () => {
    const evaluation = evaluateDay(activeDay, scenario, state.habits);
    if (journeyEnded || safeActiveDayIndex !== currentDayIndex || !evaluation.canFix || weeklyRequiredForActiveDay) return;
    const closedAt = new Date().toISOString();
    setConfirmCloseDay(false);
    setState((previous) => ({
      ...previous,
      updatedAtClient: closedAt,
      days: previous.days.map((day, index) => {
        if (index !== safeActiveDayIndex) return day;
        return {
          ...activeDay,
          result: evaluation.id,
          xp: evaluation.xp,
          draftSavedAt: activeDay.draftSavedAt || closedAt,
          draftUpdatedAt: closedAt,
          closedAt,
        };
      }),
    }));
  };

  const addHabit = (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const changedAt = new Date().toISOString();
    setState((previous) => {
      const existing = previous.habits.find((habit) => habit.name.toLowerCase() === trimmed.toLowerCase());
      const habits = existing
        ? previous.habits.map((habit) => habit.id === existing.id ? { ...habit, active: true } : habit)
        : [...previous.habits, { id: createHabitId(trimmed), name: trimmed, active: true, createdAt: todayKey() }];
      return { ...previous, habits, updatedAtClient: changedAt };
    });
  };

  const removeHabit = (habitId) => {
    if (CORE_HABIT_IDS.includes(habitId)) return;
    const changedAt = new Date().toISOString();
    setState((previous) => ({
      ...previous,
      updatedAtClient: changedAt,
      habits: previous.habits.map((habit) => habit.id === habitId ? { ...habit, active: false } : habit),
    }));
  };

  const updateProfile = (patch) => {
    const changedAt = new Date().toISOString();
    setState((previous) => ({
      ...previous,
      profile: { ...previous.profile, ...patch },
      updatedAtClient: changedAt,
    }));
  };

  const updateWeeklyReview = (patch) => {
    if (visibleReviewIndex < 0) return;
    const changedAt = new Date().toISOString();
    setState((previous) => ({
      ...previous,
      updatedAtClient: changedAt,
      weeklyReviews: previous.weeklyReviews.map((review, index) => (
        index === visibleReviewIndex ? { ...review, ...patch, updatedAt: changedAt } : review
      )),
    }));
  };

  const updateFinalReview = (patch) => {
    const changedAt = new Date().toISOString();
    setState((previous) => ({
      ...previous,
      updatedAtClient: changedAt,
      finalReview: { ...previous.finalReview, ...patch, updatedAt: changedAt },
    }));
  };

  const confirmCareerDecision = () => {
    if (!careerDecisionChoice || state.careerDecision?.status !== 'pending') return;
    const decidedAt = new Date().toISOString();
    setState((previous) => ({
      ...previous,
      careerDecision: { status: careerDecisionChoice, decidedAt },
      updatedAtClient: decidedAt,
    }));
    setCareerDecisionChoice(null);
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
    <div className="min-h-screen overflow-x-hidden bg-[#f3f8fc] text-slate-900">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(90deg,rgba(13,126,165,0.045)_1px,transparent_1px),linear-gradient(rgba(239,106,76,0.035)_1px,transparent_1px)] bg-[size:48px_48px]" />
      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <Header
          user={user}
          stats={stats}
          scenario={scenario}
          currentDayNumber={currentDayNumber}
          syncState={syncState}
          activeView={activeView}
          onViewChange={setActiveView}
          onExport={() => setShowExport(true)}
          onLogOut={logOut}
        />

        <CareerRoutePanel
          decision={state.careerDecision}
          stats={stats}
          onChoose={setCareerDecisionChoice}
        />

        {activeView === 'main' ? (
          <>
            <section className="grid gap-4 lg:grid-cols-[1.05fr_1.35fr]">
              <TodayPanel
                day={activeDay}
                evaluation={activeEvaluation}
                scenario={scenario}
                habits={state.habits}
                profile={state.profile}
                onChange={updateActiveDay}
                onSaveDraft={saveDraft}
                onRequestClose={() => setConfirmCloseDay(true)}
                onAddHabit={addHabit}
                onRemoveHabit={removeHabit}
                activeDayIndex={safeActiveDayIndex}
                currentDayIndex={currentDayIndex}
                weeklyRequired={weeklyRequiredForActiveDay}
                journeyEnded={journeyEnded}
              />
              <PathPanel
                days={state.days}
                scenario={scenario}
                activeDayIndex={safeActiveDayIndex}
                currentDayIndex={currentDayIndex}
                onSelect={setActiveDayIndex}
                stats={stats}
                signal={latestSignal}
                finalDate={finalDate}
              />
            </section>
            {visibleWeek && (
              <WeeklyReflection
                week={visibleWeek}
                review={visibleReview}
                scenario={scenario}
                required={!visibleReviewComplete}
                onChange={updateWeeklyReview}
              />
            )}
            {isFinalDay && <FinalReview scenario={scenario} review={state.finalReview} onChange={updateFinalReview} />}
          </>
        ) : (
          <>
            <ModernDashboard scenario={scenario} days={state.days} stats={stats} currentWeek={currentWeek} weeks={weeks} habits={state.habits} profile={state.profile} careerDecision={state.careerDecision} range={statsRange} onRangeChange={setStatsRange} onProfileChange={updateProfile} />
          </>
        )}
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
        {careerDecisionChoice && (
          <ConfirmCareerDecision
            choice={careerDecisionChoice}
            onCancel={() => setCareerDecisionChoice(null)}
            onConfirm={confirmCareerDecision}
          />
        )}
        {confirmCloseDay && (
          <ConfirmCloseDay
            day={activeDay}
            evaluation={activeEvaluation}
            onCancel={() => setConfirmCloseDay(false)}
            onConfirm={closeDay}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function LoadingScreen({ text }) {
  return (
    <div className="grid min-h-screen place-items-center bg-[#eef7f9] text-slate-900">
      <div className="flex items-center gap-3 border border-[#cbdde1] bg-white/85 px-5 py-4 font-black shadow-sm rounded-lg">
        <Loader2 className="animate-spin text-[#4f8fb9]" size={22} />
        {text}
      </div>
    </div>
  );
}

function LoginScreen({ error, onSignIn, configured }) {
  return (
    <div className="min-h-screen bg-[#eef7f9] text-slate-900">
      <div className="mx-auto grid min-h-screen max-w-5xl place-items-center px-4 py-10">
        <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="w-full border border-[#cbdde1] bg-[#f4fafb] p-6 shadow-sm sm:p-8 rounded-lg">
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
  const [rulesAccepted, setRulesAccepted] = useState(false);
  const [noRestartAccepted, setNoRestartAccepted] = useState(false);
  const [confirmStart, setConfirmStart] = useState(false);
  const ready = rulesAccepted && noRestartAccepted;
  return (
    <div className="min-h-screen bg-[#eef7fb] text-slate-900">
      <section className="relative min-h-[66vh] overflow-hidden bg-[#dff4fb]" style={{ backgroundImage: `url(${transformationBanner})`, backgroundPosition: 'center', backgroundSize: 'cover' }}>
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(245,252,255,0.98)_0%,rgba(245,252,255,0.91)_48%,rgba(245,252,255,0.28)_100%)]" />
        <div className="relative mx-auto flex min-h-[66vh] max-w-7xl flex-col justify-center px-4 py-12 sm:px-6 lg:px-8">
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 border border-[#8ed8c1] bg-white/90 px-3 py-2 text-sm font-black text-[#126b55] rounded-md"><Heart size={18} />Жёсткость к правилам. Мягкость к себе.</span>
            <span className="inline-flex max-w-[250px] items-center gap-2 border border-[#b8d8ee] bg-white/90 px-3 py-2 text-sm font-bold text-[#124f73] rounded-md"><User size={18} /><span className="truncate">{user.email}</span></span>
          </div>
          <h1 className="max-w-3xl text-4xl font-black leading-tight text-[#102a43] sm:text-6xl">120 дней, после которых действия говорят за тебя</h1>
          <p className="mt-5 max-w-2xl text-lg font-semibold leading-8 text-slate-700">Не наказание и не попытка заслужить ценность. Ты уже ценность. Этот путь нужен, чтобы научиться доверять себе по фактам и спокойно делать то, что важно.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <button type="button" onClick={() => setConfirmStart(true)} disabled={!ready} className="inline-flex min-h-[52px] items-center gap-2 bg-[#ef5f42] px-5 py-3 font-black text-white shadow-lg transition hover:bg-[#d94c32] disabled:cursor-not-allowed disabled:bg-slate-300 rounded-md"><Play size={19} />Запустить единственный марафон</button>
            <button onClick={onLogOut} className="inline-flex min-h-[52px] items-center gap-2 border border-[#c9dce7] bg-white/90 px-5 py-3 font-bold text-slate-700 shadow-sm rounded-md"><LogOut size={18} />Выйти</button>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:px-8">
        <section>
          <div className="mb-4 text-sm font-black uppercase tracking-wide text-[#0d7ea5]">Личный контракт</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <StartMetric icon={<BadgeCheck size={20} />} title="Закрепиться в Контуре" text="Стать полезным специалистом. После решения испытательного срока маршрут зафиксирует следующий курс." />
            <StartMetric icon={<Scale size={20} />} title="65 кг и видимый пресс" text="Чистое питание, вес, активность и энергобаланс собираются в одну честную траекторию." />
            <StartMetric icon={<Drama size={20} />} title="Действовать свободнее" text="Два актёрских занятия в неделю и реальные действия несмотря на тревогу." />
            <StartMetric icon={<Camera size={20} />} title="Снова снимать" text="Минимум одна настоящая съёмка и дальнейшее развитие без ожидания чужого разрешения." />
          </div>
        </section>
        <section className="border border-[#b8d8ee] bg-white p-5 shadow-sm rounded-lg">
          <div className="flex items-center gap-2 text-lg font-black text-[#102a43]"><ShieldCheck size={21} className="text-[#ef5f42]" />Перед стартом</div>
          <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">Дата старта фиксируется сегодня. Следующие 120 календарных дней нельзя удалить, поставить на паузу или начать заново.</p>
          <label className="mt-5 flex cursor-pointer items-start gap-3 border border-[#dbe7ee] bg-[#f8fbfd] p-3 rounded-md"><input type="checkbox" checked={rulesAccepted} onChange={(event) => setRulesAccepted(event.target.checked)} className="mt-1 h-4 w-4 accent-[#ef5f42]" /><span className="text-sm font-bold leading-6 text-slate-700">Я выбираю 0 алкоголя и 0 сладкого на 120 дней. Нарушение фиксируется честно, без самоунижения.</span></label>
          <label className="mt-3 flex cursor-pointer items-start gap-3 border border-[#dbe7ee] bg-[#f8fbfd] p-3 rounded-md"><input type="checkbox" checked={noRestartAccepted} onChange={(event) => setNoRestartAccepted(event.target.checked)} className="mt-1 h-4 w-4 accent-[#ef5f42]" /><span className="text-sm font-bold leading-6 text-slate-700">Я понимаю: повторного старта не будет. Моя задача не быть идеальным, а пройти весь путь и увидеть правду.</span></label>
        </section>
      </div>

      <AnimatePresence>
        {confirmStart && <ConfirmStart onCancel={() => setConfirmStart(false)} onConfirm={onStart} />}
      </AnimatePresence>
    </div>
  );
}

function StartMetric({ icon, title, text }) {
  return (
    <div className="border border-[#cfe0e3] bg-white/75 p-5 shadow-sm rounded-lg">
      <div className="mb-3 flex items-center gap-3 text-slate-900">
        <span className="grid h-10 w-10 place-items-center bg-[#eff6ff] text-[#356d92] rounded-md">{icon}</span>
        <h2 className="text-lg font-black">{title}</h2>
      </div>
      <p className="leading-7 text-slate-600">{text}</p>
    </div>
  );
}

function Header({
  user,
  stats,
  scenario,
  currentDayNumber,
  syncState,
  activeView,
  onViewChange,
  onExport,
  onLogOut,
}) {
  const syncText = syncState === 'saving' ? 'сохраняю' : syncState === 'offline' ? 'офлайн' : 'синхронно';
  return (
    <header className="relative min-h-[230px] overflow-hidden border border-[#8ec9df] bg-[#eef9ff] shadow-md rounded-lg" style={{ backgroundImage: `url(${transformationBanner})`, backgroundPosition: 'calc(50% + 180px) center', backgroundSize: 'cover' }}>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(247,252,255,0.98)_0%,rgba(247,252,255,0.93)_42%,rgba(247,252,255,0.46)_72%,rgba(247,252,255,0.16)_100%)]" />
      <div className="relative p-5 sm:p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm font-semibold text-[#5c7955]">
            <CalendarDays size={16} />
            День {currentDayNumber} из {TOTAL_DAYS}
            <span className="text-slate-300">/</span>
            Уровень {stats.level}
            <span className="text-slate-300">/</span>
            <Cloud size={16} />
            {syncText}
          </div>
          <h1 className="text-3xl font-black leading-tight text-slate-950 sm:text-4xl">
            {SCENARIOS[scenario].header}
          </h1>
          {scenario === 'life' && (
            <div className="mt-3 flex max-w-3xl flex-wrap items-center gap-x-2 gap-y-1 text-sm font-black text-[#0c6685]">
              <span>Закрепиться в Контуре</span><span className="text-[#62acc4]">·</span>
              <span>65 кг и выраженный пресс</span><span className="text-[#62acc4]">·</span>
              <span>2 актёрских занятия в неделю</span><span className="text-[#62acc4]">·</span>
              <span>Снимать и спокойно проявляться</span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 xl:mt-20 xl:items-end">
          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            <HeaderPill icon={<User size={16} />} label="Аккаунт" value={user.email || 'user'} />
            <IconButton onClick={onExport} icon={<Download size={16} />} label="Экспорт" tone="plain" compact />
            <IconButton onClick={onLogOut} icon={<LogOut size={16} />} label="Выйти" tone="plain" compact />
          </div>
          <div className="flex flex-wrap gap-2 xl:justify-end">
            <ViewButton active={activeView === 'main'} onClick={() => onViewChange('main')} icon={<Target size={16} />} label="Основной" />
            <ViewButton active={activeView === 'stats'} onClick={() => onViewChange('stats')} icon={<BarChart3 size={16} />} label="Статистика" />
          </div>
        </div>
      </div>
      <div className="mt-5 h-3 overflow-hidden border border-white/70 bg-white/75 shadow-inner rounded-md">
        <div className="h-full bg-[#0d8fb9] transition-all duration-700" style={{ width: `${stats.levelProgress}%` }} />
      </div>
      </div>
    </header>
  );
}

function CareerRoutePanel({ decision, stats, onChoose }) {
  const status = decision?.status || 'pending';
  const content = CAREER_DECISIONS[status];
  const isPending = status === 'pending';
  return (
    <section className={`border p-4 shadow-sm rounded-lg ${status === 'passed' ? 'border-[#8bd5ac] bg-[#edfbf3]' : status === 'not_passed' ? 'border-[#b9b4ef] bg-[#f4f2ff]' : 'border-[#b8d8ee] bg-white'}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-md ${status === 'passed' ? 'bg-[#16a36a] text-white' : status === 'not_passed' ? 'bg-[#6657c8] text-white' : 'bg-[#e9f7fd] text-[#0d7ea5]'}`}>
            {status === 'passed' ? <BadgeCheck size={23} /> : <Route size={23} />}
          </span>
          <div>
            <div className="text-xs font-black uppercase tracking-wide text-slate-500">Карьерный маршрут</div>
            <h2 className="mt-1 text-xl font-black text-[#102a43]">{content.title}</h2>
            <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-slate-600">{content.description}</p>
          </div>
        </div>
        {isPending ? (
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
            <button type="button" onClick={() => onChoose('passed')} className="inline-flex min-h-[44px] items-center justify-center gap-2 bg-[#16a36a] px-4 py-2 text-sm font-black text-white rounded-md"><BadgeCheck size={17} />Испытательный пройден</button>
            <button type="button" onClick={() => onChoose('not_passed')} className="inline-flex min-h-[44px] items-center justify-center gap-2 border border-[#b9b4ef] bg-[#f4f2ff] px-4 py-2 text-sm font-black text-[#4e459f] rounded-md"><Route size={17} />Маршрут изменился</button>
          </div>
        ) : (
          <div className="grid shrink-0 grid-cols-2 gap-2 text-center">
            <div className="border border-white/80 bg-white/80 px-3 py-2 rounded-md"><div className="text-xs font-bold text-slate-500">Контур</div><div className="text-lg font-black text-[#0d7ea5]">{stats.konturActions.length}</div></div>
            <div className="border border-white/80 bg-white/80 px-3 py-2 rounded-md"><div className="text-xs font-bold text-slate-500">1С</div><div className="text-lg font-black text-[#6657c8]">{stats.oneCActions.length}</div></div>
          </div>
        )}
      </div>
    </section>
  );
}

function HeaderPill({ icon, label, value }) {
  return (
    <div className="grid min-h-[44px] max-w-[220px] grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 border border-[#cbdde2] bg-[#f4fafb] px-3 py-2 rounded-md">
      <span className="row-span-2 text-[#168b8f]">{icon}</span>
      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <span className="min-w-0 truncate text-sm font-black text-slate-950" title={value}>{value}</span>
    </div>
  );
}

function IconButton({ onClick, icon, label, tone, compact = false }) {
  const tones = {
    blue: 'border-[#c8d9e7] bg-[#edf7ff] text-[#255b7a] hover:bg-[#dff0fc]',
    green: 'border-[#86efac] bg-[#22c55e] text-white shadow-sm hover:bg-[#16a34a]',
    orange: 'border-[#ecd3c6] bg-[#fff4ed] text-[#8a4b2d] hover:bg-[#ffe9dc]',
    plain: 'border-[#d5e3e5] bg-white text-slate-700 hover:bg-[#f4fafb]',
  };
  return (
    <button onClick={onClick} className={`inline-flex items-center justify-center gap-2 border text-sm font-bold transition rounded-md ${compact ? 'px-3 py-2' : 'px-4 py-3'} ${tones[tone]}`}>
      {icon}
      {label}
    </button>
  );
}

function ViewButton({ active, onClick, icon, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 border px-4 py-3 text-sm font-black transition rounded-md ${active ? 'border-slate-950 bg-slate-950 text-white' : 'border-[#d5e3e5] bg-[#ffffff] text-slate-700 hover:bg-[#f4fafb]'}`}
    >
      {icon}
      {label}
    </button>
  );
}

function TodayPanel({
  day,
  evaluation,
  scenario,
  habits,
  profile,
  onChange,
  onSaveDraft,
  onRequestClose,
  onAddHabit,
  onRemoveHabit,
  activeDayIndex,
  currentDayIndex,
  weeklyRequired,
  journeyEnded,
}) {
  const isFixed = Boolean(day.result);
  const isToday = activeDayIndex === currentDayIndex;
  const isPast = activeDayIndex < currentDayIndex;
  const editable = isToday && !isFixed && !journeyEnded;
  const isLife = scenario === 'life';
  const activeHabits = getActiveHabits(habits);
  const coreRuleBroken = CORE_HABIT_IDS.some((habitId) => getHabitValue(day, habitId) === false);
  const energyBalance = calculateEnergyBalance(day, profile);
  const bmr = calculateBmr(day.weight, profile);
  const totalExpenditure = bmr ? bmr + num(day.activeCalories) : 0;
  const savedTimestamp = Date.parse(day.draftSavedAt || '') || 0;
  const updatedTimestamp = Date.parse(day.draftUpdatedAt || '') || 0;
  const draftIsSaved = savedTimestamp > 0 && savedTimestamp >= updatedTimestamp;
  const canClose = editable && evaluation.canFix && !weeklyRequired;
  return (
    <section className="border border-[#cfe0e3] bg-white/95 p-4 shadow-sm rounded-lg">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="mb-1 text-sm font-bold text-slate-500">{formatDate(day.date)}</div>
          <h2 className="text-2xl font-black text-slate-950">День {day.day}</h2>
        </div>
        {isFixed ? (
          <ResultBadge evaluation={evaluation} />
        ) : (
          <div className={`inline-flex min-h-[40px] items-center gap-2 border px-3 py-2 text-sm font-black rounded-md ${draftIsSaved ? 'border-[#9ee8b7] bg-[#e9fbef] text-[#0f7138]' : 'border-[#cbdde2] bg-[#eef7fa] text-[#315f6a]'}`}>
            {draftIsSaved ? <CheckCircle2 size={16} /> : <Cloud size={16} />}
            {draftIsSaved ? `Сохранено ${new Date(day.draftSavedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}` : 'Есть изменения'}
          </div>
        )}
      </div>

      <div className="mb-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <ScoreChip label="Калории" value={day.calories ? `${day.calories}` : '--'} tone={num(day.calories) <= CALORIE_TOP && num(day.calories) > 0 ? 'top' : num(day.calories) <= CALORIE_LIMIT && num(day.calories) > 0 ? 'ok' : 'draft'} />
        <ScoreChip label="Активные калории" value={day.activeCalories !== '' ? `${day.activeCalories}` : '--'} tone={num(day.activeCalories) > 0 ? 'ok' : 'draft'} />
        <ScoreChip label="Шаги" value={day.steps !== '' ? Number(day.steps).toLocaleString('ru-RU') : '--'} tone={num(day.steps) >= 8000 ? 'top' : num(day.steps) >= 4000 ? 'ok' : 'draft'} />
        <ScoreChip
          label="Энергетический итог"
          value={formatEnergyBalance(energyBalance)}
          tone={energyBalance === null ? 'draft' : energyBalance < 0 ? 'top' : energyBalance <= 200 ? 'ok' : 'bad'}
        />
      </div>

      {(bmr > 0 || num(day.activeCalories) > 0) && (
        <div className="mb-4 grid gap-2 border border-[#cfe3e7] bg-[#f0f9fa] p-3 text-sm font-bold text-slate-600 rounded-lg sm:grid-cols-3">
          <span>Базовый обмен: <strong className="text-slate-950">{bmr || '--'} ккал</strong></span>
          <span>Активность: <strong className="text-slate-950">{day.activeCalories || 0} ккал</strong></span>
          <span>Общий расход: <strong className="text-slate-950">{totalExpenditure || '--'} ккал</strong></span>
        </div>
      )}

      {isPast && !isFixed && (
        <div className="mb-4 flex items-center gap-2 border border-[#f0c8c8] bg-[#fff2f2] p-3 text-sm font-black text-[#8d3333] rounded-lg">
          <Lock size={16} />
          День пропущен. Заполнение задним числом закрыто.
        </div>
      )}

      {journeyEnded && !isFixed && (
        <div className="mb-4 flex items-center gap-2 border border-[#cbd5e1] bg-[#f1f5f9] p-3 text-sm font-black text-slate-600 rounded-lg"><Lock size={16} />120 дней завершены. Незакрытые записи больше не редактируются.</div>
      )}

      <div className="grid gap-4">
        {isLife ? (
          <HabitTracker
            habits={activeHabits}
            values={day.habitValues || {}}
            disabled={!editable}
            onChange={(habitId, value) => onChange({ ...day, habitValues: { ...(day.habitValues || {}), [habitId]: value } })}
            onAdd={onAddHabit}
            onRemove={onRemoveHabit}
          />
        ) : (
          <>
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
          </>
        )}

        {isLife && coreRuleBroken && (
          <TextField
            icon={<Heart size={18} />}
            label="Что происходило перед этим?"
            value={day.choiceContext || ''}
            disabled={!editable}
            placeholder="Без обвинений. Только ситуация, триггер и что поможет вернуться к своему выбору."
            onChange={(choiceContext) => onChange({ ...day, choiceContext })}
          />
        )}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <NumberField icon={<Utensils size={18} />} label="Калории" value={day.calories} disabled={!editable} min="0" onChange={(value) => onChange({ ...day, calories: value })} />
          <NumberField icon={<BatteryCharging size={18} />} label="Активные калории" value={day.activeCalories} disabled={!editable} min="0" onChange={(value) => onChange({ ...day, activeCalories: value })} />
          <NumberField icon={<Footprints size={18} />} label="Шаги" value={day.steps} disabled={!editable} min="0" onChange={(value) => onChange({ ...day, steps: value })} />
          <NumberField icon={<Activity size={18} />} label="Приёмы пищи" value={day.meals} disabled={!editable} min="0" onChange={(value) => onChange({ ...day, meals: value })} />
          <NumberField icon={<Scale size={18} />} label="Вес, кг" value={day.weight} disabled={!editable} min="0" step="0.1" onChange={(value) => onChange({ ...day, weight: value })} />
        </div>

        {isLife && (
          <GrowthActionTracker
            actions={day.growthActions || []}
            disabled={!editable}
            onChange={(growthActions) => onChange({ ...day, growthActions })}
          />
        )}

        <AnxietyTracker
          situations={day.anxietySituations || []}
          disabled={!editable}
          onChange={(anxietySituations) => onChange({ ...day, anxietySituations })}
        />

        <DailyWinField
          category={day.dailyWinCategory || ''}
          value={day.dailyWinText || ''}
          disabled={!editable}
          onCategoryChange={(dailyWinCategory) => onChange({ ...day, dailyWinCategory })}
          onChange={(dailyWinText) => onChange({ ...day, dailyWinText })}
        />
      </div>

      {isFixed && (
        <div className="mt-5 flex items-center justify-between gap-3 border border-[#86d9a3] bg-[#e9fbef] p-4 text-[#0f7138] rounded-lg">
          <div className="flex items-center gap-3">
            <Trophy size={22} />
            <div>
              <div className="text-sm font-bold">День закрыт навсегда</div>
              <div className="text-xl font-black">{evaluation.title}</div>
            </div>
          </div>
          <div className="text-right text-sm font-black">+{evaluation.xp} очков</div>
        </div>
      )}

      {weeklyRequired && editable && (
        <div className="mt-4 flex items-center gap-2 border border-[#f1d2a7] bg-[#fff3df] p-3 text-sm font-black text-[#81501f] rounded-lg">
          <AlertCircle size={16} />
          Сначала закрой обязательную недельную рефлексию ниже.
        </div>
      )}

      {editable && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button onClick={onSaveDraft} type="button" className="flex min-h-[50px] items-center justify-center gap-2 border border-[#8fcbd5] bg-[#e8f8fb] px-4 py-3 font-black text-[#245d68] transition hover:bg-[#d7f2f6] rounded-md">
            <Save size={18} />
            Сохранить
          </button>
          <button
            onClick={onRequestClose}
            type="button"
            disabled={!canClose}
            className="flex min-h-[50px] items-center justify-center gap-2 border border-[#69d28e] bg-[#18a957] px-4 py-3 font-black text-white transition hover:bg-[#138747] disabled:cursor-not-allowed disabled:border-[#d5e1e3] disabled:bg-[#edf3f4] disabled:text-slate-400 rounded-md"
          >
            <CheckCircle2 size={18} />
            {weeklyRequired ? 'Сначала закрой неделю' : evaluation.canFix ? 'Закрыть день' : 'Заполнить день полностью'}
          </button>
        </div>
      )}
    </section>
  );
}

function GrowthActionTracker({ actions, disabled, onChange }) {
  const updateAction = (id, patch) => onChange(actions.map((item) => item.id === id ? { ...item, ...patch } : item));
  const removeAction = (id) => onChange(actions.filter((item) => item.id !== id));
  return (
    <section className="border border-[#c9bff0] bg-[#f7f5ff] p-4 rounded-lg">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 font-black text-[#51459f]"><Zap size={19} />Действия роста</div>
          <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">Добавляй только реальные действия. Они необязательны каждый день, но именно из них соберётся путь за 120 дней.</p>
        </div>
        {!disabled && (
          <button type="button" onClick={() => onChange([...actions, createGrowthAction()])} className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 bg-[#6657c8] px-4 py-2 font-black text-white shadow-sm transition hover:bg-[#5548aa] rounded-md"><Plus size={18} />Добавить действие</button>
        )}
      </div>
      {actions.length === 0 ? (
        <div className="mt-4 border border-dashed border-[#c9bff0] bg-white/70 p-4 text-sm font-bold text-[#685f8f] rounded-md">Сегодня действия роста пока не добавлены.</div>
      ) : (
        <div className="mt-4 grid gap-3">
          <AnimatePresence initial={false}>
            {actions.map((item, index) => (
              <motion.article key={item.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} className="border border-[#d9d3f3] bg-white p-4 shadow-sm rounded-lg">
                <div className="mb-3 flex items-center justify-between gap-3"><div className="text-sm font-black text-[#51459f]">Действие {index + 1}</div>{!disabled && <button type="button" onClick={() => removeAction(item.id)} title="Удалить действие" className="grid h-9 w-9 place-items-center border border-rose-200 bg-rose-50 text-rose-600 rounded-md"><Trash2 size={17} /></button>}</div>
                <div className="grid gap-3 lg:grid-cols-[0.75fr_1.25fr]">
                  <label className="border border-[#e1dcf4] bg-[#faf9ff] p-3 rounded-md"><span className="mb-2 block text-xs font-bold text-slate-500">Направление</span><select value={item.category} disabled={disabled} onChange={(event) => updateAction(item.id, { category: event.target.value })} className="w-full bg-transparent text-sm font-black text-slate-900 outline-none disabled:text-slate-500">{GROWTH_CATEGORIES.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}</select></label>
                  <label className="border border-[#e1dcf4] bg-[#faf9ff] p-3 rounded-md"><span className="mb-2 block text-xs font-bold text-slate-500">Что конкретно сделал?</span><input value={item.text} disabled={disabled} onChange={(event) => updateAction(item.id, { text: event.target.value })} placeholder="Например: провёл съёмку, выступил на занятии, разобрал рабочую задачу" className="w-full bg-transparent text-sm font-bold text-slate-950 outline-none placeholder:text-slate-400 disabled:text-slate-500" /></label>
                </div>
                <div className="mt-3 grid gap-3 lg:grid-cols-[0.75fr_1.25fr]">
                  <div className="border border-[#e1dcf4] bg-[#faf9ff] p-3 rounded-md"><span className="mb-2 block text-xs font-bold text-slate-500">Масштаб действия</span><div className="grid grid-cols-3 gap-1">{GROWTH_IMPACTS.map((impact) => <button key={impact.id} type="button" disabled={disabled} onClick={() => updateAction(item.id, { impact: impact.id })} className={`min-h-[38px] border px-2 text-xs font-black rounded-md ${item.impact === impact.id ? 'border-[#6657c8] bg-[#6657c8] text-white' : 'border-[#ddd8ef] bg-white text-slate-600'}`}>{impact.label}</button>)}</div></div>
                  <label className="border border-[#e1dcf4] bg-[#faf9ff] p-3 rounded-md"><span className="mb-2 block text-xs font-bold text-slate-500">Результат или следующий шаг <span className="font-semibold">(необязательно)</span></span><input value={item.outcome} disabled={disabled} onChange={(event) => updateAction(item.id, { outcome: event.target.value })} placeholder="Что получилось или что продолжить" className="w-full bg-transparent text-sm font-semibold text-slate-950 outline-none placeholder:text-slate-400 disabled:text-slate-500" /></label>
                </div>
              </motion.article>
            ))}
          </AnimatePresence>
        </div>
      )}
    </section>
  );
}

function AnxietyTracker({ situations, disabled, onChange }) {
  const updateSituation = (id, patch) => {
    onChange(situations.map((item) => item.id === id ? { ...item, ...patch } : item));
  };
  const removeSituation = (id) => onChange(situations.filter((item) => item.id !== id));
  return (
    <section className="border border-[#b8d8ee] bg-[#f4faff] p-4 rounded-lg">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 font-black text-[#124f73]"><Brain size={19} />Тревожные ситуации</div>
          <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">
            Ситуаций не было — ничего не добавляй. Появилась — зафиксируй конкретный момент.
          </p>
        </div>
        {!disabled && (
          <button
            type="button"
            onClick={() => onChange([...situations, createAnxietySituation()])}
            className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 bg-[#0d7ea5] px-4 py-2 font-black text-white shadow-sm transition hover:bg-[#096b8e] rounded-md"
          >
            <Plus size={18} />Добавить ситуацию
          </button>
        )}
      </div>

      {situations.length === 0 ? (
        <div className="mt-4 border border-dashed border-[#b8d8ee] bg-white/70 p-4 text-sm font-bold text-[#4b6b7e] rounded-md">
          Сегодня пока нет зафиксированных ситуаций.
        </div>
      ) : (
        <div className="mt-4 grid gap-3">
          <AnimatePresence initial={false}>
            {situations.map((item, index) => (
              <motion.article
                key={item.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                className="border border-[#b8d8ee] bg-white p-4 shadow-sm rounded-lg"
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="text-sm font-black text-[#0d6f91]">Ситуация {index + 1}</div>
                  {!disabled && (
                    <button type="button" onClick={() => removeSituation(item.id)} title="Удалить ситуацию" className="grid h-9 w-9 place-items-center border border-rose-200 bg-rose-50 text-rose-600 transition hover:bg-rose-100 rounded-md">
                      <Trash2 size={17} />
                    </button>
                  )}
                </div>
                <div className="grid gap-3 lg:grid-cols-[0.72fr_1.28fr]">
                  <label className="border border-[#d3e3ee] bg-[#f8fbff] p-3 rounded-md">
                    <span className="mb-2 block text-xs font-bold text-slate-500">Контекст</span>
                    <select value={item.category} disabled={disabled} onChange={(event) => updateSituation(item.id, { category: event.target.value })} className="w-full bg-transparent text-sm font-black text-slate-900 outline-none disabled:text-slate-500">
                      {ANXIETY_CATEGORIES.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                    </select>
                  </label>
                  <label className="border border-[#d3e3ee] bg-[#f8fbff] p-3 rounded-md">
                    <span className="mb-2 block text-xs font-bold text-slate-500">Что произошло?</span>
                    <input value={item.situation} disabled={disabled} onChange={(event) => updateSituation(item.id, { situation: event.target.value })} placeholder="Например: высказал своё мнение на созвоне" className="w-full bg-transparent text-sm font-bold text-slate-950 outline-none placeholder:text-slate-400 disabled:text-slate-500" />
                  </label>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <AnxietyScale label="Перед действием" value={item.before} disabled={disabled} color="#0d7ea5" onChange={(before) => updateSituation(item.id, { before })} />
                  <AnxietyScale label="Пик во время" value={item.peak} disabled={disabled} color="#ef6a4c" onChange={(peak) => updateSituation(item.id, { peak })} />
                  <AnxietyScale label="После ситуации" value={item.after} disabled={disabled} color="#16a36a" onChange={(after) => updateSituation(item.id, { after })} />
                </div>
                <label className="mt-3 block border border-[#d3e3ee] bg-[#f8fbff] p-3 rounded-md">
                  <span className="mb-2 block text-xs font-bold text-slate-500">Что ты сделал, несмотря на тревогу?</span>
                  <textarea value={item.action} disabled={disabled} onChange={(event) => updateSituation(item.id, { action: event.target.value })} placeholder="Конкретное действие и чем закончилась ситуация" className="h-20 w-full resize-none bg-transparent text-sm font-semibold leading-6 text-slate-950 outline-none placeholder:text-slate-400 disabled:text-slate-500" />
                </label>
              </motion.article>
            ))}
          </AnimatePresence>
        </div>
      )}
    </section>
  );
}

function AnxietyScale({ label, value, disabled, color, onChange }) {
  const displayValue = value === '' ? '—' : value;
  return (
    <label className="border border-[#d3e3ee] bg-[#f8fbff] p-3 rounded-md">
      <span className="flex items-center justify-between gap-2 text-xs font-bold text-slate-500">
        {label}
        <strong className="text-xl text-slate-950">{displayValue}</strong>
      </span>
      <input
        type="range"
        min="0"
        max="100"
        step="5"
        value={value === '' ? 50 : value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="mt-3 h-2 w-full cursor-pointer disabled:cursor-not-allowed"
        style={{ accentColor: color }}
      />
      <span className="mt-2 flex justify-between text-[10px] font-bold text-slate-400"><span>0 · спокойно</span><span>100 · максимум</span></span>
    </label>
  );
}

function DailyWinField({ category, value, disabled, onCategoryChange, onChange }) {
  return (
    <section className="border border-[#f4c76e] bg-[#fff8e8] p-4 shadow-sm rounded-lg">
      <div className="mb-1 flex items-center gap-2 font-black text-[#8b5416]"><Medal size={20} />Доказательство доверия к себе</div>
      <p className="mb-3 text-sm font-semibold leading-6 text-slate-600">Самооценка растёт не от уговоров, а от фактов, которые ты сам видишь.</p>
      <div className="grid gap-3 lg:grid-cols-[0.72fr_1.28fr]">
        <label className="border border-[#efd59e] bg-white/80 p-3 rounded-md">
          <span className="mb-2 block text-xs font-bold text-slate-500">Направление роста</span>
          <select value={category} disabled={disabled} onChange={(event) => onCategoryChange(event.target.value)} className="w-full bg-transparent text-sm font-black text-slate-900 outline-none disabled:text-slate-500">
            <option value="">Выбери направление</option>
            {WIN_CATEGORIES.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
        </label>
        <label className="border border-[#efd59e] bg-white/80 p-3 rounded-md">
          <span className="mb-2 block text-xs font-bold text-slate-500">Что сегодня доказало, что я могу себе доверять?</span>
          <textarea value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} placeholder="Один конкретный факт, маленький или большой" className="h-20 w-full resize-none bg-transparent text-sm font-semibold leading-6 text-slate-950 outline-none placeholder:text-slate-400 disabled:text-slate-500" />
        </label>
      </div>
    </section>
  );
}

function HabitTracker({ habits, values, disabled, onChange, onAdd, onRemove }) {
  const [showSettings, setShowSettings] = useState(false);
  const [newHabit, setNewHabit] = useState('');
  const addHabit = () => {
    if (!newHabit.trim()) return;
    onAdd(newHabit);
    setNewHabit('');
  };
  return (
    <div className="border border-[#cfe0e3] bg-[#f8fcfc] p-3 rounded-lg">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-sm font-black text-slate-700">
            <ShieldCheck size={18} />
            Нерушимые правила
          </div>
          <div className="mt-1 text-xs font-bold text-slate-500">Алкоголь и сладкое нельзя удалить. Дополнительные правила остаются гибкими.</div>
        </div>
        <button type="button" disabled={disabled} onClick={() => setShowSettings((value) => !value)} className="inline-flex items-center gap-2 border border-[#cbdde2] bg-white px-3 py-2 text-sm font-black text-[#315f6a] disabled:opacity-50 rounded-md">
          <Settings2 size={15} />
          Настроить
        </button>
      </div>
      {showSettings && !disabled && (
        <div className="mb-3 flex gap-2 border border-[#bcd9df] bg-[#eef9fb] p-3 rounded-lg">
          <input
            value={newHabit}
            onChange={(event) => setNewHabit(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addHabit();
              }
            }}
            placeholder="Дополнительное правило"
            className="min-w-0 flex-1 border border-[#bcd3d8] bg-white px-3 py-2 font-semibold text-slate-950 outline-none focus:border-[#40a7b8] rounded-md"
          />
          <button type="button" onClick={addHabit} disabled={!newHabit.trim()} title="Добавить привычку" className="grid h-11 w-11 shrink-0 place-items-center bg-[#126879] text-white disabled:bg-slate-300 rounded-md">
            <Plus size={19} />
          </button>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {habits.map((habit) => (
          <BinaryChoice
            key={habit.id}
            icon={habit.id === 'alcohol' ? <WineOff size={18} /> : habit.id === 'sweet' ? <CandyOff size={18} /> : <CheckCircle2 size={18} />}
            label={`Сегодня: ${habit.name}?`}
            value={typeof values[habit.id] === 'boolean' ? values[habit.id] : null}
            disabled={disabled}
            positiveLabel="Да"
            onChange={(value) => onChange(habit.id, value)}
            onRemove={showSettings && !CORE_HABIT_IDS.includes(habit.id) ? () => onRemove(habit.id) : null}
          />
        ))}
      </div>
    </div>
  );
}

function BinaryChoice({ icon, label, value, onChange, disabled, positiveLabel, onRemove = null }) {
  return (
    <div className={`border border-[#d5e3e5] p-3 rounded-lg ${disabled ? 'bg-[#f4f7f8]' : 'bg-white'}`}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-bold text-slate-600">{icon}{label}</span>
        {onRemove && (
          <button type="button" onClick={onRemove} title="Убрать привычку" className="grid h-7 w-7 shrink-0 place-items-center text-slate-400 transition hover:bg-[#fff1f1] hover:text-[#8d3333] rounded-md">
            <Trash2 size={15} />
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(true)}
          className={`border px-3 py-2 text-sm font-black transition disabled:cursor-not-allowed rounded-md ${value === true ? 'border-[#86d9a3] bg-[#e9fbef] text-[#0f7138]' : 'border-[#d5e3e5] bg-[#ffffff] text-slate-600'}`}
        >
          {positiveLabel}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(false)}
          className={`border px-3 py-2 text-sm font-black transition disabled:cursor-not-allowed rounded-md ${value === false ? 'border-[#efc6c6] bg-[#fff1f1] text-[#8d3333]' : 'border-[#d5e3e5] bg-[#ffffff] text-slate-600'}`}
        >
          Нет
        </button>
      </div>
    </div>
  );
}

function ProofPicker({ value, onChange, disabled, label = 'Доказательства дня', proofTypes = PROOF_TYPES }) {
  const selected = Array.isArray(value) ? value : [];
  const toggleProof = (proof) => {
    if (selected.includes(proof)) onChange(selected.filter((item) => item !== proof));
    else onChange([...selected, proof]);
  };
  return (
    <div className={`border border-[#d5e3e5] p-3 rounded-lg ${disabled ? 'bg-[#f8fafc]' : 'bg-white'}`}>
      <span className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-600">
        <FileText size={18} />
        {label}
      </span>
      <div className="flex flex-wrap gap-2">
        {proofTypes.map((proof) => {
          const isSelected = selected.includes(proof);
          return (
            <button
              key={proof}
              type="button"
              disabled={disabled}
              onClick={() => toggleProof(proof)}
              className={`inline-flex items-center gap-2 border px-3 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-75 rounded-md ${isSelected ? 'border-[#9edddb] bg-[#e6f9f8] text-[#12676a]' : 'border-[#d5e3e5] bg-[#ffffff] text-slate-600 hover:bg-[#f4fafb]'}`}
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
    <label className={`block border border-[#d5e3e5] p-3 rounded-lg ${disabled ? 'bg-[#f8fafc]' : 'bg-white'}`}>
      <span className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-600">{icon}{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        step={step}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="w-full border border-[#cbdde2] bg-[#ffffff] px-3 py-2 text-lg font-black text-slate-950 outline-none transition focus:border-[#8fb989] disabled:bg-[#eef2f7] disabled:text-slate-500 rounded-md"
      />
    </label>
  );
}

function TextField({ icon, label, value, onChange, disabled, placeholder }) {
  return (
    <label className={`block border border-[#d5e3e5] p-3 rounded-lg ${disabled ? 'bg-[#f8fafc]' : 'bg-white'}`}>
      <span className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-600">{icon}{label}</span>
      <textarea
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-20 w-full resize-none border border-[#cbdde2] bg-[#ffffff] px-3 py-2 text-base font-semibold leading-6 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#8fb989] disabled:bg-[#eef2f7] disabled:text-slate-500 rounded-md"
      />
    </label>
  );
}

function ResultBadge({ evaluation }) {
  const tier = evaluation.id === 'draft' ? evaluation : TIERS[evaluation.id];
  const icon = evaluation.id === 'breakthrough'
    ? <Trophy size={17} />
    : evaluation.id === 'growth'
      ? <Sparkles size={17} />
      : evaluation.id === 'bad'
        ? <XCircle size={17} />
        : evaluation.id === 'weak'
          ? <AlertCircle size={17} />
          : <CheckCircle2 size={17} />;
  return (
    <div className="inline-flex items-center gap-2 border px-3 py-2 text-sm font-black rounded-md" style={{ backgroundColor: tier.bg, borderColor: tier.border, color: tier.text }}>
      {icon}
      {evaluation.short}
    </div>
  );
}

function ScoreChip({ label, value, tone }) {
  const styles = {
    top: 'border-[#9ee8b7] bg-[#e9fbef] text-[#0f7138]',
    ok: 'border-[#c8e1ef] bg-[#eaf5fb] text-[#255b7a]',
    weak: 'border-[#efd4aa] bg-[#fff6e8] text-[#81501f]',
    bad: 'border-[#efc6c6] bg-[#fff1f1] text-[#8d3333]',
    draft: 'border-[#d5e3e5] bg-[#f4fafb] text-slate-600',
  };
  return (
    <div className={`border p-3 rounded-lg ${styles[tone]}`}>
      <div className="text-xs font-bold">{label}</div>
      <div className="mt-1 text-xl font-black">{value}</div>
    </div>
  );
}

function PathPanel({ days, scenario, activeDayIndex, currentDayIndex, onSelect, stats, signal, finalDate }) {
  const isLife = scenario === 'life';
  return (
    <section className="border border-[#cbdde1] bg-white/90 p-4 shadow-sm rounded-lg">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm font-bold text-slate-500">
            <Target size={16} />
            Путь 120 дней
          </div>
          <h2 className="text-2xl font-black text-slate-950">{isLife ? 'Новая норма видна на дистанции' : 'Рост видно на дистанции'}</h2>
        </div>
        <div className="grid grid-cols-5 gap-1 text-center">
          <MiniStat label="Возврат" value={stats.tierCounts.bad || 0} />
          <MiniStat label="Минимум" value={stats.tierCounts.weak || 0} />
          <MiniStat label="Опора" value={stats.tierCounts.base || 0} />
          <MiniStat label="Рост" value={stats.tierCounts.growth || 0} />
          <MiniStat label="Прорыв" value={stats.tierCounts.breakthrough || 0} />
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
              День ответа: {SCENARIOS[scenario].finish}
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
          const isMissed = index < currentDayIndex && !day.result;
          return (
            <button
              key={day.day}
              type="button"
              disabled={locked}
              onClick={() => onSelect(index)}
              title={`День ${day.day}: ${day.result ? tier.title : locked ? 'будущий' : isMissed ? 'пропущен' : 'сегодня'}`}
              className={`relative grid aspect-square min-h-[34px] place-items-center border text-xs font-black transition rounded-md ${locked ? 'cursor-not-allowed border-[#dbe7e9] bg-[#edf3f4] text-slate-300' : 'hover:scale-[1.03]'} ${isActive ? 'ring-2 ring-slate-950 ring-offset-2 ring-offset-white' : ''}`}
              style={{
                backgroundColor: tier ? tier.bg : isToday ? '#e3f8fc' : isMissed ? '#fff0f2' : '#f0f5f6',
                borderColor: tier ? tier.border : isToday ? '#73c9d8' : isMissed ? '#f0bcc4' : '#d7e3e5',
                color: tier ? tier.text : isToday ? '#126879' : isMissed ? '#a43f50' : '#64748b',
              }}
            >
              {locked ? <Lock size={13} /> : day.day}
              {day.result === 'growth' && <Sparkles size={10} className="absolute right-1 top-1" />}
              {day.result === 'breakthrough' && <Star size={10} className="absolute right-1 top-1 fill-current" />}
            </button>
          );
        })}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <PathInsight icon={<Flame size={18} />} label={isLife ? 'Чистая серия' : 'Серия'} value={`${isLife ? stats.cleanStreak : stats.streak} дн`} />
        <PathInsight icon={<Zap size={18} />} label={isLife ? 'Действия роста' : 'Доказательства'} value={isLife ? stats.growthActions.length : stats.proofCount} />
        <PathInsight icon={<CalendarDays size={18} />} label="Закрытие пути" value={`${stats.completionRate}%`} />
      </div>

      {signal && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 border border-[#b8ddd5] bg-[#eaf9f6] p-4 text-[#17675d] rounded-lg">
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
    <div className="min-w-[72px] border border-[#d5e3e5] bg-[#f4fafb] px-3 py-2 rounded-md">
      <div className="text-lg font-black text-slate-950">{value}</div>
      <div className="text-xs font-bold text-slate-500">{label}</div>
    </div>
  );
}

function PathInsight({ icon, label, value }) {
  return (
    <div className="border border-[#d5e3e5] bg-[#f4fafb] p-3 rounded-lg">
      <div className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-500">{icon}{label}</div>
      <div className="text-2xl font-black text-slate-950">{value}</div>
    </div>
  );
}

const STAT_METRICS = [
  { id: 'energy', label: 'Энергия', icon: Gauge },
  { id: 'weight', label: 'Вес и прогноз', icon: Scale },
  { id: 'anxiety', label: 'Тревожные ситуации', icon: Brain },
  { id: 'activity', label: 'Шаги и активность', icon: Footprints },
  { id: 'habits', label: 'Привычки', icon: CheckCircle2 },
  { id: 'growth', label: 'Действия роста', icon: Zap },
  { id: 'wins', label: 'Доверие к себе', icon: Medal },
  { id: 'journey', label: 'Весь путь', icon: Target },
];

function ModernDashboard(props) {
  const { days, stats, currentWeek, weeks, scenario, habits, profile, careerDecision, range, onRangeChange, onProfileChange } = props;
  const [showFilters, setShowFilters] = useState(false);
  const [visibleMetrics, setVisibleMetrics] = useState(['energy']);
  if (scenario !== 'life') return <LegacyDashboard {...props} />;
  const rangeSize = range === 'all' ? TOTAL_DAYS : Number(range);
  const lastElapsedDay = stats.elapsedDays.length;
  const firstVisibleDay = Math.max(1, lastElapsedDay - rangeSize + 1);
  const visibleDays = days.filter((day) => day.day >= firstVisibleDay && day.day <= lastElapsedDay);
  const periodStats = calculateStats(visibleDays, Math.max(0, visibleDays.length - 1), habits, profile);
  const visibleRecordedDays = visibleDays.filter((day) => day.result || day.draftSavedAt);
  const hasMetric = (id) => visibleMetrics.includes(id);
  const toggleMetric = (id) => setVisibleMetrics((current) => (
    current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
  ));
  const diagnosis = getDiagnosis(stats, currentWeek, scenario);
  return (
    <section className="grid gap-4">
      <div className="border border-[#b8d8ee] bg-white p-4 shadow-sm rounded-lg">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-black text-[#0d7ea5]"><BarChart3 size={18} />Центр прогресса</div>
            <h2 className="mt-1 text-2xl font-black text-[#102a43]">Вся траектория — без информационного шума</h2>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <StatsRangeControl value={range} onChange={onRangeChange} />
            <button type="button" onClick={() => setShowFilters((value) => !value)} className={`inline-flex min-h-[46px] items-center justify-center gap-2 border px-4 font-black transition rounded-md ${showFilters ? 'border-[#0d7ea5] bg-[#0d7ea5] text-white' : 'border-[#b8d8ee] bg-[#f4faff] text-[#124f73] hover:bg-[#e9f6ff]'}`}>
              <Filter size={18} />Показатели {showFilters ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>
        <AnimatePresence initial={false}>
          {showFilters && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="mt-4 grid gap-2 border-t border-[#dce9f2] pt-4 sm:grid-cols-2 lg:grid-cols-4">
                {STAT_METRICS.map((metric) => {
                  const Icon = metric.icon;
                  const active = hasMetric(metric.id);
                  return (
                    <label key={metric.id} className={`flex cursor-pointer items-center gap-3 border p-3 transition rounded-md ${active ? 'border-[#57b8d6] bg-[#e9f8ff] text-[#0c6685]' : 'border-[#dce6ed] bg-white text-slate-600 hover:bg-[#f7fbff]'}`}>
                      <input type="checkbox" checked={active} onChange={() => toggleMetric(metric.id)} className="sr-only" />
                      <span className={`grid h-9 w-9 place-items-center rounded-md ${active ? 'bg-[#0d7ea5] text-white' : 'bg-[#edf3f7] text-slate-500'}`}><Icon size={18} /></span>
                      <span className="text-sm font-black">{metric.label}</span>
                    </label>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <GoalPulse stats={stats} profile={profile} currentDayNumber={lastElapsedDay} />
      <IdentityProgress stats={stats} currentWeek={currentWeek} careerDecision={careerDecision} />

      {hasMetric('energy') && <EnergyOverview stats={periodStats} days={visibleRecordedDays} profile={profile} />}
      {hasMetric('weight') && (
        <div className="grid gap-4">
          <WeightForecast stats={stats} profile={profile} currentDayNumber={lastElapsedDay} />
          <ChartCard icon={<LineChart size={18} />} title="Вес по дням" subtitle={`${periodStats.firstWeight || '--'} → ${periodStats.lastWeight || '--'} кг`} aside={<span className="text-sm font-black text-[#0d7ea5]">цель {profile.targetWeight} кг</span>}>
            <LineChartSvg data={stats.weights.filter((item) => item.day >= firstVisibleDay)} color="#0d7ea5" fill="#dff4ff" unit="кг" targetValue={num(profile.targetWeight)} targetLabel={`${profile.targetWeight} кг`} />
          </ChartCard>
        </div>
      )}
      {hasMetric('anxiety') && <AnxietyStatsPanel stats={periodStats} />}
      {hasMetric('activity') && (
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard icon={<BatteryCharging size={18} />} title="Активные калории" subtitle={`среднее ${periodStats.avgActiveCalories} ккал`} aside={<span className="text-sm font-black text-[#0d7ea5]">за выбранный период</span>}>
            <LineChartSvg data={periodStats.activityCalories} color="#0d7ea5" fill="#dff4ff" unit="ккал" />
          </ChartCard>
          <ChartCard icon={<Footprints size={18} />} title="Шаги" subtitle={`среднее ${periodStats.avgSteps.toLocaleString('ru-RU')}`} aside={<span className="text-sm font-black text-[#16865f]">цель 8 000+</span>}>
            <LineChartSvg data={periodStats.steps} color="#16a36a" fill="#e1f8ee" unit="шагов" guideValues={[8000]} />
          </ChartCard>
        </div>
      )}
      {hasMetric('habits') && (
        <ChartCard icon={<CheckCircle2 size={18} />} title="Привычки" subtitle={`${periodStats.cleanStreak} дней текущей серии`} aside={<span className="text-sm font-black text-[#0d7ea5]">{habits.filter((habit) => habit.active !== false).length} активных</span>}>
          <HabitMatrix days={visibleDays} habits={habits} />
          <CommitmentContextList days={periodStats.choiceContexts} />
        </ChartCard>
      )}
      {hasMetric('growth') && <GrowthStatsPanel actions={periodStats.growthActions} />}
      {hasMetric('wins') && <VictoryStatsPanel wins={periodStats.dailyWins} />}
      {hasMetric('journey') && (
        <div className="grid gap-4 xl:grid-cols-2">
          <ResultCounters stats={stats} scenario={scenario} />
          <WeeklyPanel week={currentWeek} scenario={scenario} />
          <ProfileSettings profile={profile} onChange={onProfileChange} />
          <DiagnosisPanel items={diagnosis} />
          <div className="xl:col-span-2"><WeeksStrip weeks={weeks} /></div>
          <div className="xl:col-span-2"><Checkpoints scenario={scenario} days={days} currentDayIndex={lastElapsedDay - 1} habits={habits} profile={profile} /></div>
        </div>
      )}
      {visibleMetrics.length === 0 && (
        <div className="border border-dashed border-[#a9cfe3] bg-white p-8 text-center rounded-lg">
          <div className="font-black text-[#124f73]">Выбери показатели</div>
          <p className="mt-2 text-sm font-semibold text-slate-500">Кнопка «Показатели» возвращает любой график в один клик.</p>
        </div>
      )}
    </section>
  );
}

function GoalPulse({ stats, profile, currentDayNumber }) {
  const currentWeight = stats.lastWeight;
  const remaining = currentWeight ? Math.max(0, currentWeight - num(profile.targetWeight)) : null;
  return (
    <section className="grid gap-2 border border-[#155f83] bg-[#102f4a] p-4 text-white shadow-md rounded-lg sm:grid-cols-2 xl:grid-cols-4">
      <PulseMetric label="До финала" value={`${Math.max(0, TOTAL_DAYS - currentDayNumber)} дней`} accent="#64d8ff" />
      <PulseMetric label="Вес сейчас" value={currentWeight ? `${currentWeight} кг` : 'Нет отметки'} accent="#7cf0bf" />
      <PulseMetric label="До 65 кг" value={remaining === null ? 'Нужен вес' : `${remaining.toFixed(1)} кг`} accent="#ffcb6b" />
      <PulseMetric label="Доверие к себе" value={`${stats.selfTrustScore}%`} accent="#ff8b7b" />
    </section>
  );
}

function PulseMetric({ label, value, accent }) {
  return (
    <div className="border-l-4 px-3 py-2" style={{ borderColor: accent }}>
      <div className="text-xs font-bold text-sky-100">{label}</div>
      <div className="mt-1 text-xl font-black">{value}</div>
    </div>
  );
}

function IdentityProgress({ stats, currentWeek, careerDecision }) {
  const careerStatus = careerDecision?.status || 'pending';
  const alcohol = stats.habitStats.find((habit) => habit.id === 'alcohol');
  const sweet = stats.habitStats.find((habit) => habit.id === 'sweet');
  const actorDone = currentWeek?.actingSessions || 0;
  return (
    <section className="border border-[#c9dce8] bg-white p-4 shadow-sm rounded-lg">
      <div className="mb-4 flex items-center gap-2 text-lg font-black text-[#102a43]"><Target size={20} className="text-[#ef5f42]" />Четыре результата, которые должны стать видны</div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MissionMetric icon={<BadgeCheck size={19} />} label="Карьерный курс" value={CAREER_DECISIONS[careerStatus].title} detail={`${stats.konturActions.length} действий в Контуре · ${stats.oneCActions.length} по 1С`} tone="blue" />
        <MissionMetric icon={<Scale size={19} />} label="Тело" value={stats.lastWeight ? `${stats.lastWeight} кг → 65 кг` : 'Нужна первая отметка'} detail={`Алкоголь ${alcohol?.kept || 0}/${alcohol?.answered || 0} · сладкое ${sweet?.kept || 0}/${sweet?.answered || 0}`} tone="green" />
        <MissionMetric icon={<Drama size={19} />} label="Актёрское мастерство" value={`${actorDone}/2 на этой неделе`} detail={`${stats.actingSessions.length} занятий за весь путь`} tone="pink" />
        <MissionMetric icon={<Camera size={19} />} label="Фотография" value={stats.photoActions.length ? `${stats.photoActions.length} действий` : 'Первая съёмка впереди'} detail="Цель: минимум одна настоящая съёмка" tone="amber" />
      </div>
    </section>
  );
}

function MissionMetric({ icon, label, value, detail, tone }) {
  const tones = {
    blue: 'border-[#b8d8ee] bg-[#f4faff] text-[#0d7ea5]',
    green: 'border-[#b8e0cb] bg-[#f1fbf5] text-[#16865f]',
    pink: 'border-[#edbfd0] bg-[#fff4f8] text-[#bf4c73]',
    amber: 'border-[#efd2a8] bg-[#fff8ed] text-[#b56b1f]',
  };
  return (
    <div className={`border p-3 rounded-md ${tones[tone]}`}>
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide">{icon}{label}</div>
      <div className="mt-2 text-lg font-black leading-6 text-slate-950">{value}</div>
      <div className="mt-1 text-xs font-bold leading-5 text-slate-500">{detail}</div>
    </div>
  );
}

function GrowthStatsPanel({ actions }) {
  const counts = GROWTH_CATEGORIES.map((category) => ({
    ...category,
    count: actions.filter((item) => item.category === category.id).length,
  })).filter((category) => category.count > 0);
  return (
    <section className="border border-[#c9bff0] bg-[#f7f5ff] p-4 shadow-sm rounded-lg">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div><div className="flex items-center gap-2 font-black text-[#51459f]"><Zap size={19} />Действия роста</div><div className="mt-1 text-2xl font-black text-slate-950">{actions.length} фактов движения</div></div>
        <div className="flex flex-wrap gap-2">{counts.map((category) => <span key={category.id} className="border bg-white px-3 py-2 text-xs font-black rounded-md" style={{ borderColor: `${category.color}55`, color: category.color }}>{category.label}: {category.count}</span>)}</div>
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {[...actions].reverse().map((item) => {
          const category = GROWTH_CATEGORIES.find((option) => option.id === item.category);
          const impact = GROWTH_IMPACTS.find((option) => option.id === item.impact);
          return <div key={`${item.day}-${item.id}`} className="border border-[#ded8f4] bg-white p-3 rounded-md"><div className="text-xs font-black" style={{ color: category?.color || '#51459f' }}>День {item.day} · {category?.label || 'Другое'} · {impact?.label || 'Шаг'}</div><div className="mt-1 text-sm font-bold leading-6 text-slate-800">{item.text}</div>{item.outcome && <div className="mt-1 text-xs font-semibold leading-5 text-slate-500">{item.outcome}</div>}</div>;
        })}
        {!actions.length && <div className="border border-dashed border-[#c9bff0] bg-white/70 p-4 text-sm font-bold text-slate-500 rounded-md">Добавленные действия появятся здесь и попадут в итоговый экспорт.</div>}
      </div>
    </section>
  );
}

function EnergyOverview({ stats, days, profile }) {
  const calorieData = days.map((day) => ({ day: day.day, value: num(day.calories) })).filter((item) => item.value);
  const activeData = days.map((day) => ({ day: day.day, value: num(day.activeCalories) })).filter((item) => item.value || item.value === 0);
  return (
    <section className="grid gap-4">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryMetric label="Суммарный дефицит" value={`${stats.totalDeficit.toLocaleString('ru-RU')} ккал`} tone="green" />
        <SummaryMetric label="Итог периода" value={`${stats.totalEnergyBalance > 0 ? '+' : ''}${stats.totalEnergyBalance.toLocaleString('ru-RU')} ккал`} tone={stats.totalEnergyBalance <= 0 ? 'blue' : 'coral'} />
        <SummaryMetric label="Средний итог дня" value={`${stats.avgEnergyBalance > 0 ? '+' : ''}${stats.avgEnergyBalance} ккал`} tone="blue" />
        <SummaryMetric label="Дней в дефиците" value={`${stats.deficitDays} из ${stats.energyBalances.length}`} tone="amber" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard icon={<Utensils size={18} />} title="Съеденные калории" subtitle={`среднее ${stats.avgCalories || '--'} ккал`} aside={<span className="text-sm font-black text-[#a55817]">1800 / 2300</span>}>
          <LineChartSvg data={calorieData} color="#f0783c" fill="#fff0e7" unit="ккал" guideValues={[CALORIE_TOP, CALORIE_LIMIT]} />
        </ChartCard>
        <ChartCard icon={<BatteryCharging size={18} />} title="Активные калории" subtitle={`среднее ${stats.avgActiveCalories} ккал`} aside={<span className="text-sm font-black text-[#0d7ea5]">без базового обмена</span>}>
          <LineChartSvg data={activeData} color="#0d7ea5" fill="#dff4ff" unit="ккал" />
        </ChartCard>
        <div className="lg:col-span-2">
          <ChartCard icon={<Gauge size={18} />} title="Энергетический итог по дням" subtitle={formatEnergyBalance(stats.avgEnergyBalance)} aside={<span className="text-sm font-black text-[#0d7ea5]">базовый обмен {stats.currentBmr || '--'}</span>}>
            <BalanceBars data={stats.energyBalances} />
          </ChartCard>
        </div>
      </div>
      <details className="border border-[#cbdde8] bg-white shadow-sm rounded-lg">
        <summary className="flex cursor-pointer items-center justify-between gap-3 p-4 font-black text-[#163b54]">Данные по дням <ChevronDown size={18} /></summary>
        <DailyEnergyTable days={days} profile={profile} />
      </details>
    </section>
  );
}

function SummaryMetric({ label, value, tone }) {
  const tones = {
    green: 'border-[#8de0b5] bg-[#e9fbf2] text-[#106a44]',
    blue: 'border-[#9ed9ef] bg-[#e9f8ff] text-[#0c6685]',
    coral: 'border-[#f3b2a5] bg-[#fff0ed] text-[#a84435]',
    amber: 'border-[#f3d18e] bg-[#fff8e8] text-[#8b5416]',
  };
  return <div className={`border p-4 rounded-lg ${tones[tone]}`}><div className="text-xs font-bold">{label}</div><div className="mt-1 text-2xl font-black">{value}</div></div>;
}

function DailyEnergyTable({ days, profile }) {
  const rows = [...days].reverse();
  return (
    <div className="overflow-x-auto border-t border-[#dce6ed]">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="bg-[#f4f8fb] text-xs uppercase text-slate-500"><tr><th className="p-3">День</th><th className="p-3">Съедено</th><th className="p-3">Активные</th><th className="p-3">Базовый обмен</th><th className="p-3">Общий расход</th><th className="p-3">Итог</th></tr></thead>
        <tbody>
          {rows.map((day) => {
            const bmr = calculateBmr(day.weight, profile);
            const balance = calculateEnergyBalance(day, profile);
            return (
              <tr key={day.day} className="border-t border-[#e7eef3] font-semibold text-slate-700">
                <td className="p-3 font-black text-slate-950">{day.day} · {formatDate(day.date)}</td><td className="p-3">{day.calories || '—'}</td><td className="p-3">{day.activeCalories === '' ? '—' : day.activeCalories}</td><td className="p-3">{bmr || '—'}</td><td className="p-3">{bmr ? bmr + num(day.activeCalories) : '—'}</td><td className={`p-3 font-black ${balance !== null && balance < 0 ? 'text-emerald-700' : 'text-rose-600'}`}>{formatEnergyBalance(balance)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AnxietyStatsPanel({ stats }) {
  const trend = stats.anxietyTrend;
  const trendText = trend === null ? 'Нужно минимум 2 ситуации' : trend > 5 ? `Пик выше на ${trend}` : trend < -5 ? `Пик ниже на ${Math.abs(trend)}` : 'Пик примерно стабилен';
  return (
    <section className="grid gap-4">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryMetric label="Ситуаций" value={stats.anxietyEvents.length} tone="blue" />
        <SummaryMetric label="Среднее до" value={stats.anxietyEvents.length ? stats.anxietyBefore : '—'} tone="amber" />
        <SummaryMetric label="Средний пик" value={stats.anxietyEvents.length ? stats.anxietyPeak : '—'} tone="coral" />
        <SummaryMetric label="Среднее после" value={stats.anxietyEvents.length ? stats.anxietyAfter : '—'} tone="green" />
      </div>
      <ChartCard icon={<Brain size={18} />} title="Тревога в конкретных ситуациях" subtitle={trendText} aside={<span className="text-sm font-black text-[#0d7ea5]">до · пик · после</span>}>
        <AnxietyChart data={stats.anxietyEvents} />
      </ChartCard>
      <details className="border border-[#cbdde8] bg-white shadow-sm rounded-lg">
        <summary className="flex cursor-pointer items-center justify-between gap-3 p-4 font-black text-[#163b54]">Все ситуации за период <ChevronDown size={18} /></summary>
        <div className="grid gap-2 border-t border-[#dce6ed] p-4">
          {[...stats.anxietyEvents].reverse().map((item) => (
            <div key={`${item.day}-${item.id}`} className="border border-[#dce6ed] bg-[#f8fbfd] p-3 rounded-md">
              <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-black text-[#0d7ea5]">День {item.day} · {ANXIETY_CATEGORIES.find((option) => option.id === item.category)?.label || 'Другое'}</span><span className="text-xs font-black text-slate-500">{item.before} → {item.peak} → {item.after}</span></div>
              <div className="mt-1 font-bold text-slate-900">{item.situation}</div><div className="mt-1 text-sm font-semibold text-slate-600">{item.action}</div>
            </div>
          ))}
          {!stats.anxietyEvents.length && <div className="p-4 text-center text-sm font-bold text-slate-500">Пока нет зафиксированных ситуаций.</div>}
        </div>
      </details>
    </section>
  );
}

function AnxietyChart({ data }) {
  if (!data.length) return <EmptyChart text="Добавь первую конкретную ситуацию" />;
  const visible = data.slice(-30);
  const width = 720;
  const height = 230;
  const left = 38;
  const right = 14;
  const top = 18;
  const bottom = 34;
  const xFor = (index) => left + (index / Math.max(1, visible.length - 1)) * (width - left - right);
  const yFor = (value) => top + ((100 - num(value)) / 100) * (height - top - bottom);
  const points = (key) => visible.map((item, index) => `${xFor(index)},${yFor(item[key])}`).join(' ');
  const lines = [
    { key: 'before', label: 'До', color: '#0d7ea5' },
    { key: 'peak', label: 'Пик', color: '#ef6a4c' },
    { key: 'after', label: 'После', color: '#16a36a' },
  ];
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[250px] min-w-[620px] w-full">
        {[0, 25, 50, 75, 100].map((value) => <g key={value}><line x1={left} y1={yFor(value)} x2={width - right} y2={yFor(value)} stroke="#dce6ed" /><text x="4" y={yFor(value) + 4} fontSize="11" fill="#64748b">{value}</text></g>)}
        {lines.map((line) => <polyline key={line.key} points={points(line.key)} fill="none" stroke={line.color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />)}
        {visible.map((item, index) => lines.map((line) => <circle key={`${item.id}-${line.key}`} cx={xFor(index)} cy={yFor(item[line.key])} r="4" fill="white" stroke={line.color} strokeWidth="3"><title>{`День ${item.day}: ${line.label} ${item[line.key]}`}</title></circle>))}
        {visible.map((item, index) => <text key={`day-${item.id}`} x={xFor(index)} y={height - 10} textAnchor="middle" fontSize="10" fill="#64748b">{item.day}</text>)}
      </svg>
      <div className="flex justify-center gap-5 text-xs font-black text-slate-600">{lines.map((line) => <span key={line.key} className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: line.color }} />{line.label}</span>)}</div>
    </div>
  );
}

function VictoryStatsPanel({ wins }) {
  const counts = WIN_CATEGORIES.map((category) => ({ ...category, count: wins.filter((day) => day.dailyWinCategory === category.id).length })).filter((item) => item.count);
  return (
    <section className="border border-[#f0cf8c] bg-[#fffaf0] p-4 shadow-sm rounded-lg">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2 font-black text-[#8b5416]"><Medal size={19} />Доверие к себе</div><div className="mt-1 text-2xl font-black text-slate-950">{wins.length} доказательств</div></div><div className="flex flex-wrap gap-2">{counts.map((item) => <span key={item.id} className="border border-[#efd59e] bg-white px-3 py-2 text-xs font-black text-[#8b5416] rounded-md">{item.label}: {item.count}</span>)}</div></div>
      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {[...wins].reverse().map((day) => <div key={day.day} className="border border-[#efd9ad] bg-white p-3 rounded-md"><div className="text-xs font-black text-[#a6631a]">День {day.day} · {WIN_CATEGORIES.find((item) => item.id === day.dailyWinCategory)?.label || 'Победа'}</div><div className="mt-1 text-sm font-semibold leading-6 text-slate-700">{day.dailyWinText}</div></div>)}
        {!wins.length && <div className="border border-dashed border-[#efd59e] bg-white/70 p-4 text-sm font-bold text-slate-500 rounded-md">Первая победа появится после закрытия дня.</div>}
      </div>
    </section>
  );
}

function LegacyDashboard({ days, stats, currentWeek, weeks, scenario, habits, profile, range, onRangeChange, onProfileChange }) {
  const isLife = scenario === 'life';
  const diagnosis = getDiagnosis(stats, currentWeek, scenario);
  const rangeSize = range === 'all' ? TOTAL_DAYS : Number(range);
  const lastElapsedDay = stats.elapsedDays.length;
  const firstVisibleDay = Math.max(1, lastElapsedDay - rangeSize + 1);
  const visibleDays = days.filter((day) => day.day >= firstVisibleDay && day.day <= lastElapsedDay);
  const visibleRecordedDays = visibleDays.filter((day) => day.result || day.draftSavedAt);
  return (
    <section className="grid gap-4">
      <div className="flex flex-col gap-3 border border-[#b9d7dd] bg-white/95 p-4 shadow-sm rounded-lg lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-black text-[#247184]"><BarChart3 size={17} />Статистика пути</div>
          <h2 className="mt-1 text-2xl font-black text-slate-950">Что реально меняется</h2>
        </div>
        <StatsRangeControl value={range} onChange={onRangeChange} />
      </div>

      {isLife && <WeightForecast stats={stats} profile={profile} currentDayNumber={lastElapsedDay} />}

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
      <div className="grid content-start gap-4 lg:grid-cols-2">
        <ChartCard icon={<LineChart size={18} />} title="Вес" subtitle={`${stats.firstWeight || '--'} -> ${stats.lastWeight || '--'} кг`} aside={<span className="text-sm font-black text-[#12676a]">{stats.weightDelta > 0 ? '+' : ''}{stats.weightDelta} кг</span>}>
          <LineChartSvg data={stats.weights.filter((item) => item.day >= firstVisibleDay)} color="#168b8f" fill="#dff5f3" unit="кг" targetValue={isLife ? num(profile.targetWeight) : stats.firstWeight ? stats.firstWeight - 5 : null} targetLabel={isLife ? `${profile.targetWeight} кг` : '-5 кг'} />
        </ChartCard>
        <ChartCard icon={<Gauge size={18} />} title="Дефицит и профицит" subtitle={formatEnergyBalance(stats.avgEnergyBalance)} aside={<span className="text-sm font-black text-[#247184]">Базовый обмен {stats.currentBmr || '--'}</span>}>
          <BalanceBars data={stats.energyBalances.filter((item) => item.day >= firstVisibleDay)} />
        </ChartCard>
        <ChartCard icon={<Utensils size={18} />} title="Съеденные калории" subtitle={`среднее ${stats.avgCalories || '--'} ккал`} aside={<span className="text-sm font-black text-[#805216]">1800 / 2300</span>}>
          <LineChartSvg data={visibleRecordedDays.map((day) => ({ day: day.day, value: num(day.calories) })).filter((item) => item.value)} color="#e28a2f" fill="#fff0d8" unit="ккал" guideValues={[CALORIE_TOP, CALORIE_LIMIT]} />
        </ChartCard>
        <ChartCard icon={<BatteryCharging size={18} />} title="Энергия активности" subtitle={`среднее ${stats.avgActiveCalories || 0} ккал`} aside={<span className="text-sm font-black text-[#247184]">без базового обмена</span>}>
          <LineChartSvg data={visibleRecordedDays.map((day) => ({ day: day.day, value: num(day.activeCalories) })).filter((item) => item.value)} color="#1b9db2" fill="#dff5f8" unit="ккал" />
        </ChartCard>
        <ChartCard icon={<Footprints size={18} />} title="Шаги" subtitle={`среднее ${stats.avgSteps.toLocaleString('ru-RU')}`} aside={<span className="text-sm font-black text-[#12676a]">цель 8 000+</span>}>
          <LineChartSvg data={visibleRecordedDays.map((day) => ({ day: day.day, value: num(day.steps) })).filter((item) => item.value)} color="#20a969" fill="#def7e9" unit="шагов" guideValues={[8000]} />
        </ChartCard>
        {isLife ? (
          <>
            <ChartCard icon={<CheckCircle2 size={18} />} title="Привычки" subtitle={`${stats.cleanStreak} дней чистой серии`} aside={<span className="text-sm font-black text-[#247184]">{habits.length} всего</span>}>
              <HabitMatrix days={visibleDays} habits={habits} />
            </ChartCard>
            <GrowthStatsPanel actions={stats.growthActions} />
          </>
        ) : (
          <>
            <ChartCard icon={<BarChart3 size={18} />} title="Питание" subtitle={`${stats.topCalorieDays} дней до 1800`} aside={<span className="text-sm font-black text-[#255b7a]">{stats.inLimitDays} дней до 2300</span>}>
              <NutritionBars days={days} />
            </ChartCard>
            <ChartCard icon={<Target size={18} />} title="1С и рынок" subtitle={`${(stats.workMinutes / 60).toFixed(1)} ч`} aside={<span className="text-sm font-black text-[#12676a]">{stats.proofCount} доказательств</span>}>
              <OfferProgress days={days} />
            </ChartCard>
          </>
        )}
      </div>
      <div className="grid gap-4">
        <ResultCounters stats={stats} scenario={scenario} />
        <WeeklyPanel week={currentWeek} scenario={scenario} />
        <ProfileSettings profile={profile} onChange={onProfileChange} />
        <DiagnosisPanel items={diagnosis} />
        <WeeksStrip weeks={weeks} />
      </div>
      </div>
    </section>
  );
}

function StatsRangeControl({ value, onChange }) {
  const options = [
    { id: '7', label: '7 дней' },
    { id: '30', label: '30 дней' },
    { id: '180', label: '6 месяцев' },
    { id: '365', label: '1 год' },
    { id: 'all', label: 'Весь путь' },
  ];
  return (
    <div className="grid grid-cols-2 gap-1 border border-[#c6dce0] bg-[#eef6f8] p-1 rounded-md sm:grid-cols-5">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={`min-h-[38px] px-3 text-sm font-black transition rounded-md ${value === option.id ? 'bg-[#126879] text-white shadow-sm' : 'text-slate-600 hover:bg-white'}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function WeightForecast({ stats, profile, currentDayNumber }) {
  const currentWeight = stats.lastWeight;
  const targetWeight = num(profile.targetWeight);
  if (!currentWeight) {
    return (
      <section className="border border-[#9dd8e1] bg-[#eaf9fc] p-5 rounded-lg">
        <div className="flex items-center gap-2 font-black text-[#126879]"><Scale size={19} />Прогноз до {targetWeight} кг</div>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">Сохрани первый вес, и здесь появятся три расчётных сценария и проверка фактического темпа.</p>
      </section>
    );
  }
  const remainingKg = Math.max(0, currentWeight - targetWeight);
  const daysLeftInMarathon = Math.max(0, TOTAL_DAYS - currentDayNumber);
  const energyWeightEquivalent = stats.energyBalances.length ? Number((Math.abs(stats.totalEnergyBalance) / 7700).toFixed(2)) : null;
  const plans = [
    { id: 'light', title: 'Лёгкий', deficit: 250, color: '#168b8f', bg: '#e6f9f8', border: '#9edddb' },
    { id: 'steady', title: 'Средний', deficit: 450, color: '#2474a6', bg: '#eaf5ff', border: '#add5ef' },
    { id: 'fast', title: 'Быстрый', deficit: 650, color: '#b45b24', bg: '#fff1e7', border: '#efc59f' },
  ].map((plan) => {
    const days = remainingKg > 0 ? Math.ceil((remainingKg * 7700) / plan.deficit) : 0;
    return { ...plan, days, finishDate: addDays(todayKey(), days), fits: days <= daysLeftInMarathon };
  });
  const firstPoint = stats.weights[0];
  const lastPoint = stats.weights.at(-1);
  const measuredDays = firstPoint && lastPoint ? Math.max(0, lastPoint.day - firstPoint.day) : 0;
  const dailyLoss = measuredDays > 0 ? (firstPoint.value - lastPoint.value) / measuredDays : 0;
  const projectedDays = dailyLoss > 0 && remainingKg > 0 ? Math.ceil(remainingKg / dailyLoss) : null;
  const paceStatus = remainingKg <= 0
    ? { text: 'Цель достигнута', tone: 'border-[#7fdaa1] bg-[#e8fbf0] text-[#116b42]' }
    : projectedDays === null
      ? { text: 'Нужно больше отметок веса', tone: 'border-[#b9d7dd] bg-[#eef7f9] text-[#315f6a]' }
      : projectedDays <= daysLeftInMarathon
        ? { text: `Успеваешь: прогноз через ${projectedDays} дн.`, tone: 'border-[#7fdaa1] bg-[#e8fbf0] text-[#116b42]' }
        : { text: `Текущий темп не успевает: прогноз через ${projectedDays} дн.`, tone: 'border-[#efc59f] bg-[#fff1e7] text-[#8b4a20]' };
  return (
    <section className="border border-[#9dd8e1] bg-white/95 p-5 shadow-sm rounded-lg">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-black text-[#247184]"><Target size={18} />Автоматический прогноз формы</div>
          <h2 className="mt-1 text-3xl font-black text-slate-950">{currentWeight} → {targetWeight} кг</h2>
          <p className="mt-1 text-sm font-semibold text-slate-600">Осталось {remainingKg.toFixed(1)} кг · до конца марафона {daysLeftInMarathon} дней</p>
          {energyWeightEquivalent !== null && <p className="mt-1 text-xs font-black text-[#0d7ea5]">Накопленный энергобаланс: {stats.totalEnergyBalance <= 0 ? 'расчётное снижение' : 'расчётный набор'} ≈ {energyWeightEquivalent} кг</p>}
        </div>
        <div className={`border px-4 py-3 text-sm font-black rounded-lg ${paceStatus.tone}`}>{paceStatus.text}</div>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {plans.map((plan) => (
          <div key={plan.id} className="border p-4 rounded-lg" style={{ backgroundColor: plan.bg, borderColor: plan.border }}>
            <div className="text-sm font-black" style={{ color: plan.color }}>{plan.title}</div>
            <div className="mt-1 text-2xl font-black text-slate-950">−{plan.deficit} ккал/день</div>
            <div className="mt-2 text-sm font-bold text-slate-600">≈ {plan.days} дней · {formatDate(plan.finishDate)}</div>
            <div className={`mt-3 text-xs font-black ${plan.fits ? 'text-[#116b42]' : 'text-[#9a4928]'}`}>{plan.fits ? 'В пределах 120 дней' : 'Выходит за марафон'}</div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">Расчёт ориентировочный: 7 700 ккал на килограмм. Реальный темп уточняется по твоим отметкам веса и может меняться из-за воды и адаптации обмена.</p>
    </section>
  );
}

function ProfileSettings({ profile, onChange }) {
  return (
    <section className="border border-[#cbdde1] bg-white/95 p-4 shadow-sm rounded-lg">
      <div className="mb-3 flex items-center gap-2 text-sm font-black text-slate-600"><Settings2 size={17} />Данные для расчёта</div>
      <div className="grid grid-cols-2 gap-2">
        <CompactInput label="Возраст" value={profile.age} onChange={(value) => onChange({ age: value })} />
        <CompactInput label="Рост, см" value={profile.height} onChange={(value) => onChange({ height: value })} />
        <CompactInput label="Цель, кг" value={profile.targetWeight} onChange={(value) => onChange({ targetWeight: value })} step="0.1" />
        <label className="border border-[#d5e3e5] bg-[#f4fafb] p-3 rounded-md">
          <span className="mb-2 block text-xs font-bold text-slate-500">Пол</span>
          <select value={profile.sex} onChange={(event) => onChange({ sex: event.target.value })} className="w-full bg-transparent text-base font-black text-slate-950 outline-none">
            <option value="male">Мужчина</option>
            <option value="female">Женщина</option>
          </select>
        </label>
      </div>
    </section>
  );
}

function CompactInput({ label, value, onChange, step = '1' }) {
  return (
    <label className="border border-[#d5e3e5] bg-[#f4fafb] p-3 rounded-md">
      <span className="mb-2 block text-xs font-bold text-slate-500">{label}</span>
      <input type="number" min="0" step={step} value={value} onChange={(event) => onChange(event.target.value)} className="w-full bg-transparent text-base font-black text-slate-950 outline-none" />
    </label>
  );
}

function ResultCounters({ stats, scenario }) {
  const isLife = scenario === 'life';
  return (
    <div className="border border-[#cbdde1] bg-white/90 p-4 shadow-sm rounded-lg">
      <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-500">
        <Trophy size={16} />
        Счётчики результата
      </div>
      <div className="grid grid-cols-2 gap-2">
        {isLife ? (
          <>
            <WeekMetric label="Чистая серия" value={`${stats.cleanStreak} дн`} />
            <WeekMetric label="Дни в дефиците" value={stats.deficitDays} />
            <WeekMetric label="Средние шаги" value={stats.avgSteps.toLocaleString('ru-RU')} />
            <WeekMetric label="Доверие к себе" value={`${stats.selfTrustScore}%`} />
            <WeekMetric label="Действия роста" value={stats.growthActions.length} />
            <WeekMetric label="Ситуации тревоги" value={stats.anxietyEvents.length} />
            <WeekMetric label="Пустые дни" value={stats.emptyDays} />
          </>
        ) : (
          <>
            <WeekMetric label="Серия закрытых" value={`${stats.streak} дн`} />
            <WeekMetric label="Доказательства" value={stats.proofCount} />
            <WeekMetric label="Дни до 1800" value={stats.topCalorieDays} />
            <WeekMetric label="Дни до 2300" value={stats.inLimitDays} />
            <WeekMetric label="1С/рынок" value={`${(stats.workMinutes / 60).toFixed(1)} ч`} />
            <WeekMetric label="Пустые дни" value={stats.emptyDays} />
          </>
        )}
      </div>
    </div>
  );
}

function ChartCard({ icon, title, subtitle, aside, children }) {
  return (
    <div className="border border-[#cbdde1] bg-white/90 p-4 shadow-sm rounded-lg">
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

function LineChartSvg({ data, color, fill, unit, guideValues = [], targetValue = null, targetLabel = 'цель' }) {
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
  const domainMin = Math.min(...data.map((item) => item.day));
  const domainMax = Math.max(...data.map((item) => item.day));
  const domainSpan = Math.max(1, domainMax - domainMin);
  const xFor = (day) => left + ((day - domainMin) / domainSpan) * (width - left - right);
  const tickDays = [...new Set(Array.from({ length: 5 }, (_, index) => Math.round(domainMin + (domainSpan * index) / 4)))];
  const yFor = (value) => top + ((yMax - value) / (yMax - yMin)) * (height - top - bottom);
  const line = data.map((item) => `${xFor(item.day)},${yFor(item.value)}`).join(' ');
  const area = data.length === 1
    ? `${xFor(data[0].day) - 3},${height - bottom} ${line} ${xFor(data[0].day) + 3},${height - bottom}`
    : `${left},${height - bottom} ${line} ${xFor(data.at(-1).day)},${height - bottom}`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-[220px] w-full overflow-visible">
      {[0, 1, 2, 3].map((index) => {
        const y = top + index * ((height - top - bottom) / 3);
        return <line key={index} x1={left} y1={y} x2={width - right} y2={y} stroke="#cfe0e3" strokeWidth="1" />;
      })}
      {tickDays.map((day) => (
        <g key={day}>
          <line x1={xFor(day)} y1={top} x2={xFor(day)} y2={height - bottom} stroke="#e2ecee" strokeWidth="1" />
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
          <line x1={left} y1={yFor(targetValue)} x2={width - right} y2={yFor(targetValue)} stroke="#168b8f" strokeDasharray="5 5" strokeWidth="1.4" />
          <text x={left + 4} y={yFor(targetValue) - 5} fontSize="10" fill="#12676a">{targetLabel}</text>
        </g>
      )}
      <polygon points={area} fill={fill} opacity="0.9" />
      <polyline points={line} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      {data.map((item) => (
        <g key={`${item.day}-${item.value}`}>
          <circle cx={xFor(item.day)} cy={yFor(item.value)} r="4.5" fill="#ffffff" stroke={color} strokeWidth="3" />
          <title>{`День ${item.day}: ${item.value} ${unit}`}</title>
        </g>
      ))}
    </svg>
  );
}

function EmptyChart({ text }) {
  return (
    <div className="grid h-[220px] place-items-center border border-dashed border-[#c7dade] bg-[#f4fafb] text-center text-sm font-bold text-slate-500 rounded-lg">
      {text}
    </div>
  );
}

function BalanceBars({ data }) {
  if (!data.length) return <EmptyChart text="Энергобаланс появится после калорий, веса и активности" />;
  const visible = data.slice(-30);
  const maxAbs = Math.max(1, ...visible.map((item) => Math.abs(item.value)));
  return (
    <div className="h-[220px] border border-[#d5e3e5] bg-white p-3 rounded-lg">
      <div className="relative flex h-[176px] items-stretch gap-1 border-y border-[#dbe8ea] bg-[#f7fbfc]">
        <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-[#8aaeb5]" />
        {visible.map((item) => {
          const height = Math.max(3, (Math.abs(item.value) / maxAbs) * 46);
          const isDeficit = item.value < 0;
          return (
            <div key={item.day} className="relative flex-1" title={`День ${item.day}: ${formatEnergyBalance(item.value)}`}>
              <div
                className={`absolute inset-x-[10%] rounded-sm ${isDeficit ? 'top-1/2 bg-[#23ad6d]' : 'bottom-1/2 bg-[#e06a68]'}`}
                style={{ height: `${height}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-between text-xs font-black text-slate-500">
        <span>день {visible[0].day}</span>
        <span className="text-[#168b8f]">дефицит</span>
        <span className="text-[#b24e4e]">профицит</span>
        <span>день {visible.at(-1).day}</span>
      </div>
    </div>
  );
}

function NutritionBars({ days }) {
  const filled = days.filter((day) => num(day.calories)).slice(-21);
  if (!filled.length) return <EmptyChart text="Питание появится после первых отметок" />;
  const maxValue = Math.max(...filled.map((day) => num(day.calories)), CALORIE_LIMIT);
  return (
    <div className="flex h-[220px] items-end gap-2 border border-[#d5e3e5] bg-[#ffffff] p-3 rounded-lg">
      {filled.map((day) => {
        const calories = num(day.calories);
        const tone = calories <= CALORIE_TOP ? '#168b8f' : calories <= CALORIE_LIMIT ? '#d18b47' : '#c65d5d';
        return (
          <div key={day.day} className="flex h-full flex-1 flex-col justify-end gap-1">
            <div className="flex min-h-[148px] flex-col justify-end overflow-hidden rounded-md bg-[#e8f1f2]">
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

function HabitMatrix({ days, habits }) {
  const filled = days.filter((day) => day.result).slice(-30);
  if (!filled.length) return <EmptyChart text="Чистый курс появится после первого закрытого дня" />;
  const rows = habits.filter((habit) => habit.active !== false || filled.some((day) => typeof getHabitValue(day, habit.id) === 'boolean'));
  return (
    <div className="flex min-h-[220px] max-h-[300px] flex-col gap-4 overflow-y-auto border border-[#d5e3e5] bg-[#ffffff] p-4 rounded-lg">
      {rows.map((row) => (
        <div key={row.id}>
          <div className="mb-2 flex items-center justify-between gap-3 text-xs font-black text-slate-500">
            <span>{row.name}</span>
            <span>последние {filled.length} дн.</span>
          </div>
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${filled.length}, minmax(8px, 1fr))` }}>
            {filled.map((day) => {
              const value = getHabitValue(day, row.id);
              return (
                <div
                  key={`${row.id}-${day.day}`}
                  className={`h-7 border rounded-sm ${value === true ? 'border-[#80d7a0] bg-[#23ad6d]' : value === false ? 'border-[#efb6bd] bg-[#ef8e99]' : 'border-[#d5e3e5] bg-[#edf3f4]'}`}
                  title={`День ${day.day}: ${value === true ? 'да' : value === false ? 'нет' : 'нет отметки'}`}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function CommitmentContextList({ days }) {
  if (!days.length) return <div className="mt-3 border border-[#b8e0cb] bg-[#f1fbf5] p-3 text-sm font-bold text-[#126b55] rounded-md">За выбранный период возвраты к старому выбору не зафиксированы.</div>;
  return (
    <details className="mt-3 border border-[#f0c8c8] bg-[#fff7f7] rounded-md">
      <summary className="cursor-pointer px-3 py-3 text-sm font-black text-[#8d3333]">Контексты возврата: {days.length}</summary>
      <div className="grid gap-2 border-t border-[#f0d5d5] p-3">
        {[...days].reverse().map((day) => <div key={day.day} className="text-sm font-semibold leading-6 text-slate-700"><strong className="text-[#8d3333]">День {day.day}:</strong> {day.choiceContext}</div>)}
      </div>
    </details>
  );
}

function WeeklyPanel({ week, scenario }) {
  const isLife = scenario === 'life';
  return (
    <div className="border border-[#cbdde1] bg-white/90 p-4 shadow-sm rounded-lg">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm font-bold text-slate-500">
            <CalendarDays size={16} />
            Неделя {week.number}
          </div>
          <h3 className="text-2xl font-black text-slate-950">Итог дней {week.from}-{week.to}</h3>
        </div>
        <div className="text-right">
          <div className="text-sm font-bold text-slate-500">Очки</div>
          <div className="text-3xl font-black text-slate-950">{week.xp}</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <WeekMetric label="Закрыто" value={`${week.closed.length}/7`} />
        {isLife ? (
          <>
            <WeekMetric label="Средний энергобаланс" value={`${week.avgEnergyBalance > 0 ? '+' : ''}${week.avgEnergyBalance} ккал`} />
            <WeekMetric label="Шаги" value={week.steps.toLocaleString('ru-RU')} />
            <WeekMetric label="Актёрские занятия" value={`${week.actingSessions}/2`} />
            <WeekMetric label="Действия роста" value={week.growthActions} />
          </>
        ) : (
          <>
            <WeekMetric label="1С/рынок" value={`${(week.work / 60).toFixed(1)} ч`} />
            <WeekMetric label="Средние ккал" value={week.avgCalories || '--'} />
            <WeekMetric label="Доказательства" value={week.proofCount} />
          </>
        )}
      </div>
    </div>
  );
}

function WeeklyReflection({ week, review, scenario, required, onChange }) {
  const isLife = scenario === 'life';
  return (
    <section className={`border p-4 shadow-sm rounded-lg ${required ? 'border-[#f1d2a7] bg-[#fff8eb]' : 'border-[#9edddb] bg-[#eaf9f6]'}`}>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className={`mb-1 flex items-center gap-2 text-sm font-bold ${required ? 'text-[#81501f]' : 'text-[#12676a]'}`}>
            <FileText size={16} />
            {required ? 'Обязательная фиксация недели' : 'Неделя закрыта'}
          </div>
          <h2 className="text-2xl font-black text-slate-950">Неделя {week.number}: доказательства перемен</h2>
        </div>
        <div className="text-sm font-bold text-slate-500">Дни {week.from}-{week.to}</div>
      </div>
      {required && (
        <div className="mb-3 border border-[#f1d2a7] bg-[#fff3df] p-3 text-sm font-black leading-6 text-[#81501f] rounded-lg">
          Заполни эти 3 поля, чтобы зафиксировать день {week.to}. После закрытия он больше не будет висеть каждый день.
        </div>
      )}
      <div className="grid gap-3 lg:grid-cols-3">
        <ReflectionField label="Что стало сильнее?" value={review.worked} onChange={(value) => onChange({ worked: value })} placeholder={isLife ? 'Какие решения уже начинают становиться твоей нормой?' : 'Что двигало форму, 1С или рынок?'} required={required} />
        <ReflectionField label="Где нужна опора?" value={review.blocked} onChange={(value) => onChange({ blocked: value })} placeholder={isLife ? 'В каких ситуациях следующий шаг пока требует больше внимания?' : 'Что стоит упростить или поддержать?'} required={required} />
        <ReflectionField label="Что повторю на следующей неделе?" value={review.nextLever} onChange={(value) => onChange({ nextLever: value })} placeholder={isLife ? 'Одно действие, которое уже работает и должно повториться.' : 'Один ход, который даст максимум.'} required={required} />
      </div>
    </section>
  );
}

function ReflectionField({ label, value, onChange, placeholder, required = false }) {
  return (
    <label className="block border border-[#d5e3e5] bg-[#f4fafb] p-3 rounded-lg">
      <span className="mb-2 block text-sm font-black text-slate-600">{label}{required && <span className="text-[#c65d5d]"> *</span>}</span>
      <textarea
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-28 w-full resize-none border border-[#cbdde2] bg-white px-3 py-2 text-sm font-semibold leading-6 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#8fb989] rounded-md"
      />
    </label>
  );
}

function WeekMetric({ label, value }) {
  return (
    <div className="border border-[#d5e3e5] bg-[#f4fafb] p-3 rounded-lg">
      <div className="text-xs font-bold text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-black text-slate-950">{value}</div>
    </div>
  );
}

function DiagnosisPanel({ items }) {
  return (
    <div className="border border-[#cbdde1] bg-white/90 p-4 shadow-sm rounded-lg">
      <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-500">
        <BarChart3 size={16} />
        Почему результат такой
      </div>
      <div className="grid gap-2">
        {items.map((item) => (
          <div key={item} className="flex items-start gap-2 border border-[#d5e3e5] bg-[#f4fafb] p-3 text-sm font-semibold leading-6 text-slate-700 rounded-lg">
            <ChevronRight size={16} className="mt-1 shrink-0 text-[#168b8f]" />
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function WeeksStrip({ weeks }) {
  return (
    <div className="border border-[#cbdde1] bg-white/90 p-4 shadow-sm rounded-lg">
      <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-500">
        <CalendarDays size={16} />
        18 недель
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {weeks.map((week) => {
          const intensity = clamp(week.xp / 900, 0, 1);
          return (
            <div
              key={week.number}
              className="min-h-[58px] border p-2 rounded-md"
              style={{
                backgroundColor: `rgba(124, 154, 120, ${0.08 + intensity * 0.28})`,
                borderColor: week.closed.length ? '#9edddb' : '#cbdde1',
              }}
              title={`${week.number}-я неделя: ${week.xp} очков`}
            >
              <div className="text-xs font-bold text-slate-500">{week.number}-я неделя</div>
              <div className="text-lg font-black text-slate-950">{week.closed.length}/7</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Checkpoints({ days, currentDayIndex, scenario, habits, profile }) {
  const isLife = scenario === 'life';
  return (
    <section className="border border-[#cbdde1] bg-white/90 p-4 shadow-sm rounded-lg">
      <div className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-500">
        <Trophy size={16} />
        Промежуточные итоги
      </div>
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {CHECKPOINT_DAYS.map((dayNumber) => {
          const summary = checkpointSummary(days, dayNumber, habits, profile);
          const reached = currentDayIndex + 1 >= dayNumber;
          return (
            <div key={dayNumber} className={`border p-4 rounded-lg ${reached ? 'border-[#9edddb] bg-[#eaf9f6]' : 'border-[#d5e3e5] bg-[#f4fafb]'}`}>
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-bold text-slate-500">{dayNumber === 90 && isLife ? 'Испытательный срок · день 90' : `День ${dayNumber}`}</div>
                {reached ? <CheckCircle2 size={17} className="text-[#5f8f5d]" /> : <Lock size={16} className="text-slate-400" />}
              </div>
              <div className="text-2xl font-black text-slate-950">{summary.xp} очков</div>
              <div className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                {isLife
                  ? `${summary.closed}/${summary.elapsed} дней · ${summary.dailyWins} побед · ${summary.anxietyEvents} тревожных ситуаций`
                  : `${summary.closed}/${summary.elapsed} дней · ${(summary.workMinutes / 60).toFixed(1)} ч 1С`}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function FinalReview({ review, onChange, scenario }) {
  const isLife = scenario === 'life';
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
        <ReflectionField label={isLife ? 'Что стало моей новой нормой?' : 'Что получилось по рынку/офферу?'} value={review.offer} onChange={(value) => onChange({ offer: value })} placeholder={isLife ? 'Чистое питание, действия роста, проявленность и доверие к себе.' : 'Оффер, собесы, уровень, рынок.'} />
        <ReflectionField label="Что получилось по форме?" value={review.body} onChange={(value) => onChange({ body: value })} placeholder="Вес, форма, питание, тело." />
        <ReflectionField label="Почему результат именно такой?" value={review.why} onChange={(value) => onChange({ why: value })} placeholder={isLife ? 'Какие условия помогли измениться и где остались риски.' : 'Главные причины результата.'} />
        <ReflectionField label="Следующий этап" value={review.next} onChange={(value) => onChange({ next: value })} placeholder="Что начинается после 120 дней." />
      </div>
    </section>
  );
}

function ExportModal({ exportMode, setExportMode, data, copied, onCopy, onDownload, onClose }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 grid place-items-center bg-slate-900/35 p-4 backdrop-blur-sm">
      <motion.section initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }} className="w-full max-w-4xl border border-[#cbdde1] bg-[#ffffff] p-4 shadow-2xl rounded-lg">
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
          <button onClick={() => setExportMode('markdown')} className={`px-3 py-2 text-sm font-black rounded-md ${exportMode === 'markdown' ? 'bg-slate-950 text-white' : 'border border-[#d5e3e5] bg-white text-slate-600'}`}>Текст</button>
          <button onClick={() => setExportMode('json')} className={`px-3 py-2 text-sm font-black rounded-md ${exportMode === 'json' ? 'bg-slate-950 text-white' : 'border border-[#d5e3e5] bg-white text-slate-600'}`}>Данные</button>
          <button onClick={onCopy} className="inline-flex items-center gap-2 border border-[#9edddb] bg-[#e6f9f8] px-3 py-2 text-sm font-black text-[#12676a] rounded-md">
            <Copy size={16} />
            {copied ? 'Скопировано' : 'Скопировать'}
          </button>
          <button onClick={onDownload} className="inline-flex items-center gap-2 border border-[#c8e1ef] bg-[#eaf5fb] px-3 py-2 text-sm font-black text-[#255b7a] rounded-md">
            <Download size={16} />
            Скачать
          </button>
        </div>
        <textarea readOnly value={data} className="h-[58vh] w-full resize-none border border-[#d5e3e5] bg-white p-4 font-mono text-sm leading-6 text-slate-800 outline-none rounded-md" />
      </motion.section>
    </motion.div>
  );
}

function ConfirmCloseDay({ day, evaluation, onCancel, onConfirm }) {
  const tier = TIERS[evaluation.id] || TIERS.base;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#102f36]/45 p-4 backdrop-blur-sm">
      <motion.section initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12 }} className="w-full max-w-lg border border-[#bcd5da] bg-white p-5 shadow-2xl rounded-lg">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="mb-1 text-sm font-black text-[#2f6c76]">День {day.day}</div>
            <h2 className="text-2xl font-black text-slate-950">Точно закрыть день?</h2>
          </div>
          <div className="border px-3 py-2 text-sm font-black rounded-md" style={{ backgroundColor: tier.bg, borderColor: tier.border, color: tier.text }}>
            {evaluation.title}
          </div>
        </div>
        <p className="leading-7 text-slate-600">
          После подтверждения данные этого дня нельзя будет изменить ни с телефона, ни с компьютера. В статистику попадёт текущий результат: {evaluation.score}% и {evaluation.xp} очков.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button type="button" onClick={onCancel} className="border border-[#cfdde0] bg-white px-4 py-3 font-black text-slate-700 rounded-md">Нет, проверить</button>
          <button type="button" onClick={onConfirm} className="bg-[#18a957] px-4 py-3 font-black text-white transition hover:bg-[#138747] rounded-md">Да, закрыть</button>
        </div>
      </motion.section>
    </motion.div>
  );
}

function ConfirmStart({ onCancel, onConfirm }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 grid place-items-center bg-slate-900/35 p-4 backdrop-blur-sm">
      <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} className="w-full max-w-lg border border-[#f0b6a9] bg-white p-5 shadow-2xl rounded-lg">
        <div className="grid h-12 w-12 place-items-center bg-[#fff0ec] text-[#ef5f42] rounded-md"><ShieldCheck size={25} /></div>
        <h2 className="mt-4 text-2xl font-black text-slate-950">Запустить 120 дней сегодня?</h2>
        <p className="mt-3 leading-7 text-slate-600">После подтверждения дата станет неизменяемой. Кнопки сброса и повторного старта не будет. Все дни, включая сложные и пропущенные, останутся частью настоящего пути.</p>
        <div className="mt-4 border border-[#c9e5d5] bg-[#f1fbf5] p-3 text-sm font-bold leading-6 text-[#126b55] rounded-md"><Heart size={17} className="mr-2 inline" />Ты проходишь этот путь не потому, что с тобой что-то не так. Ты выбираешь действовать, потому что любишь себя и свою жизнь.</div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button type="button" onClick={onCancel} className="border border-[#d5e3e5] bg-white px-4 py-3 font-black text-slate-700 rounded-md">Ещё не сейчас</button>
          <button type="button" onClick={onConfirm} className="bg-[#ef5f42] px-4 py-3 font-black text-white rounded-md">Да, это мой выбор</button>
        </div>
      </motion.section>
    </motion.div>
  );
}

function ConfirmCareerDecision({ choice, onCancel, onConfirm }) {
  const isPassed = choice === 'passed';
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 grid place-items-center bg-slate-900/35 p-4 backdrop-blur-sm">
      <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} className="w-full max-w-lg border border-[#cbdde1] bg-white p-5 shadow-2xl rounded-lg">
        <div className={`grid h-12 w-12 place-items-center text-white rounded-md ${isPassed ? 'bg-[#16a36a]' : 'bg-[#6657c8]'}`}>{isPassed ? <BadgeCheck size={25} /> : <Route size={25} />}</div>
        <h2 className="mt-4 text-2xl font-black text-slate-950">{isPassed ? 'Испытательный срок пройден?' : 'Зафиксировать смену маршрута?'}</h2>
        <p className="mt-3 leading-7 text-slate-600">{isPassed ? 'После подтверждения главная карьерная цель изменится на закрепление и рост внутри Контура.' : 'После подтверждения приложение сохранит результат честно и переключит карьерный курс на мощное возвращение к 1С. Это не обнуление марафона.'}</p>
        <div className="mt-4 border border-[#dbe7ee] bg-[#f8fbfd] p-3 text-sm font-bold leading-6 text-slate-600 rounded-md">Решение фиксируется один раз и попадёт в финальную историю 120 дней.</div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button type="button" onClick={onCancel} className="border border-[#d5e3e5] bg-white px-4 py-3 font-black text-slate-700 rounded-md">Нет, проверить</button>
          <button type="button" onClick={onConfirm} className={`px-4 py-3 font-black text-white rounded-md ${isPassed ? 'bg-[#16a36a]' : 'bg-[#6657c8]'}`}>Да, зафиксировать</button>
        </div>
      </motion.section>
    </motion.div>
  );
}

export default App;
