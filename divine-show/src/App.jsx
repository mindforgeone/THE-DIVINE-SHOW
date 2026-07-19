import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  AlertCircle,
  BarChart3,
  BatteryCharging,
  BookOpen,
  BriefcaseBusiness,
  CalendarDays,
  CandyOff,
  CheckCircle2,
  ChevronRight,
  Cloud,
  Copy,
  Download,
  FileText,
  Flame,
  Footprints,
  Gauge,
  LineChart,
  Loader2,
  Lock,
  LogIn,
  LogOut,
  PackageCheck,
  Play,
  Plus,
  RotateCcw,
  Save,
  Scale,
  Settings2,
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
  { id: 'alcohol', name: 'Без алкоголя', active: true, createdAt: null },
  { id: 'sweet', name: 'Без сладкого вкуса', active: true, createdAt: null },
];
const WORK_WIN_TYPES = [
  'Разобрался в новом',
  'Сделал самостоятельно',
  'Получил хорошую обратную связь',
  'Помог команде',
  'Ускорил или улучшил работу',
  'Другое',
];

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
    title: 'Новая жизнь и привычки',
    shortTitle: 'Новая жизнь',
    header: '120 дней: новая жизнь',
    description: 'Новая личность, 65 кг с выраженным прессом и уверенно пройденный испытательный срок.',
    finish: 'Кем я стал, как выглядит моё тело и почему испытательный срок завершился победой.',
  },
};

const TIERS = {
  bad: {
    id: 'bad',
    title: 'Плохой день',
    short: 'Плохо',
    xp: 10,
    color: '#c65d5d',
    bg: '#fff1f1',
    border: '#efc6c6',
    text: '#8d3333',
    description: 'День зафиксирован честно, но он тянет результат вниз. Это не приговор, это сигнал.',
  },
  weak: {
    id: 'weak',
    title: 'Слабый день',
    short: 'Слабо',
    xp: 25,
    color: '#d18b47',
    bg: '#fff6e8',
    border: '#efd4aa',
    text: '#81501f',
    description: 'Минимальный факт есть, но фокус, питание или доказательства не дотянули до рабочего уровня.',
  },
  base: {
    id: 'base',
    title: 'Обычный день',
    short: 'Обычно',
    xp: 50,
    color: '#168b8f',
    bg: '#e6f9f8',
    border: '#9edddb',
    text: '#12676a',
    description: 'День закрыт нормально: система держится, форма и 1С не выпали.',
  },
  growth: {
    id: 'growth',
    title: 'Сильный день',
    short: 'Сильно',
    xp: 110,
    color: '#20a969',
    bg: '#e8fbf1',
    border: '#8de0b5',
    text: '#116b42',
    description: 'Есть заметный вклад в форму, 1С или рынок. Такой день двигает траекторию.',
  },
  breakthrough: {
    id: 'breakthrough',
    title: 'Идеальный день',
    short: 'Идеал',
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

const LIFE_PROOF_TYPES = [
  'Чтение',
  'Движение',
  'Порядок дома',
  'Важные дела',
  'Близкие',
  'Новый опыт',
  'Восстановление',
  'Другое',
];

const SIGNALS = [
  { minXp: 1200, text: 'Появился первый устойчивый контур. Движение уже видно.' },
  { minXp: 2800, text: 'Ритм начинает работать на тебя. Это уже не случайные дни.' },
  { minXp: 5200, text: '1С, форма и рынок становятся одной системой.' },
  { minXp: 9000, text: 'Рынок стал не страхом, а следствием твоей траектории.' },
];

const LIFE_SIGNALS = [
  { minXp: 1200, text: 'Новые решения уже повторяются. Это начинает быть не усилием, а твоим способом жить.' },
  { minXp: 2800, text: 'Трезвость, питание и чтение складываются в устойчивый ритм. Новая норма уже видна.' },
  { minXp: 5200, text: 'Старые привычки теряют власть: дистанция подтверждает, что ты умеешь выбирать себя.' },
  { minXp: 9000, text: 'Это уже не временный режим. Ты построил жизнь, в которой форма и ясность поддерживают друг друга.' },
];

const LIFE_TIER_DESCRIPTIONS = {
  bad: 'День отмечен честно, но старые привычки сегодня получили слишком много места. Завтра нужен один ясный возврат к себе.',
  weak: 'Часть курса удержана. Не обесценивай это, но посмотри, где именно решение ушло на автопилот.',
  base: 'Обычный устойчивый день: новая жизнь держится на нескольких правильных выборах без надрыва.',
  growth: 'Сильный день: питание, ясность и личное действие заметно укрепили новую норму.',
  breakthrough: 'Идеальный день: питание, активность, все выбранные привычки и осмысленное действие сошлись в один курс.',
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

function createInitialState(startDate = todayKey(), scenario = 'career') {
  const createdAt = new Date().toISOString();
  return {
    version: 4,
    scenario,
    journeyId: `journey-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
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

function normalizeState(raw) {
  if (!raw?.startDate) return null;
  const startDate = raw.startDate;
  return {
    ...createInitialState(startDate, raw.scenario || 'career'),
    ...raw,
    version: 4,
    scenario: raw.scenario || 'career',
    journeyId: raw.journeyId || `legacy-${raw.createdAt || startDate}`,
    profile: {
      ...DEFAULT_PROFILE,
      ...(raw.profile || {}),
    },
    habits: Array.isArray(raw.habits) && raw.habits.length
      ? raw.habits.map((habit) => ({ ...habit, active: habit.active !== false }))
      : DEFAULT_HABITS.map((habit) => ({ ...habit, createdAt: startDate })),
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
  const hasSummary = day.summary.trim().length >= 5;
  const canFix = hasWorkFields && hasNutritionFields && hasWeight && hasActivityFields && hasProof && hasSummary;

  const score = [
    hasWork ? 30 : hasWorkFields ? 14 : 0,
    hasNutrition ? 25 : hasNutritionFields ? 8 : 0,
    hasWeight ? 15 : 0,
    hasProof ? 15 : 0,
    hasSummary ? 15 : 0,
  ].reduce((sum, value) => sum + value, 0);

  const blockers = [];
  if (!hasWorkFields) blockers.push('1С/рынок: внеси минуты и конкретное действие');
  if (!hasProof) blockers.push('Доказательства дня: выбери хотя бы один пункт');
  if (!hasNutritionFields) blockers.push('Питание: внеси калории и количество приёмов пищи');
  if (!hasWeight) blockers.push('Вес: внеси текущий вес');
  if (!hasActivityFields) blockers.push('Активность: внеси активные калории и шаги, даже если значение равно 0');
  if (!hasSummary) blockers.push('Итог дня: одна короткая строка результата');

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
  if (workMinutes >= 120 && calories <= CALORIE_TOP && hasProof && hasSummary) {
    tier = TIERS.breakthrough;
  }

  return { ...tier, score, canFix, blockers: [], description: tier.description };
}

function evaluateLifeDay(day, habits) {
  const calories = num(day.calories);
  const meals = num(day.meals);
  const weight = num(day.weight);
  const readingMinutes = num(day.readingMinutes);
  const hasNutritionFields = calories > 0 && meals > 0;
  const hasNutrition = calories > 0 && calories <= CALORIE_LIMIT && meals >= 1 && meals <= 3;
  const hasTopNutrition = hasNutrition && calories <= CALORIE_TOP;
  const hasWeight = weight > 0;
  const activeHabits = getActiveHabits(habits);
  const habitAnswers = activeHabits.map((habit) => getHabitValue(day, habit.id));
  const answeredHabits = habitAnswers.filter((value) => typeof value === 'boolean').length;
  const keptHabits = habitAnswers.filter((value) => value === true).length;
  const hasHabitAnswers = answeredHabits === activeHabits.length;
  const habitRate = activeHabits.length ? keptHabits / activeHabits.length : 0;
  const hasReadingAnswer = day.readingMinutes !== '' && day.readingMinutes !== null && day.readingMinutes !== undefined;
  const hasActivityFields = day.activeCalories !== '' && day.steps !== '';
  const hasProof = Array.isArray(day.proofs) && day.proofs.length > 0;
  const hasAction = day.actionText.trim().length >= 5;
  const hasSummary = day.summary.trim().length >= 5;
  const canFix = hasNutritionFields
    && hasWeight
    && hasHabitAnswers
    && hasReadingAnswer
    && hasActivityFields
    && hasProof
    && hasAction
    && hasSummary;

  const score = [
    hasNutrition ? 20 : hasNutritionFields ? 8 : 0,
    hasWeight ? 5 : 0,
    hasActivityFields ? 10 : 0,
    Math.round(habitRate * 35),
    readingMinutes >= 20 ? 10 : readingMinutes > 0 ? 5 : 0,
    hasProof && hasAction ? 10 : 0,
    hasSummary ? 10 : 0,
  ].reduce((sum, value) => sum + value, 0);

  const blockers = [];
  if (!hasHabitAnswers) blockers.push(`Привычки: отметь все плитки (${answeredHabits}/${activeHabits.length})`);
  if (!hasNutritionFields) blockers.push('Питание: внеси калории и количество приёмов пищи');
  if (!hasWeight) blockers.push('Вес: внеси текущий вес');
  if (!hasActivityFields) blockers.push('Активность: внеси активные калории и шаги, даже если значение равно 0');
  if (!hasReadingAnswer) blockers.push('Чтение: внеси минуты, даже если сегодня было 0');
  if (!hasProof) blockers.push('Жизнь: выбери хотя бы одно доказательство движения');
  if (!hasAction) blockers.push('Новый шаг: коротко запиши, чем день отличался от автопилота');
  if (!hasSummary) blockers.push('Рефлексия: коротко напиши, где не справился и почему');

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

  let tier = TIERS.bad;
  if (score >= 35) tier = TIERS.weak;
  if (score >= 55) tier = TIERS.base;
  if (score >= 75) tier = TIERS.growth;
  if (hasTopNutrition && activeHabits.length > 0 && keptHabits === activeHabits.length && readingMinutes >= 20 && hasActivityFields) tier = TIERS.breakthrough;

  return {
    ...tier,
    score,
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

  const workMinutes = closedDays.reduce((sum, day) => sum + num(day.workMinutes), 0);
  const proofCount = closedDays.reduce((sum, day) => sum + (Array.isArray(day.proofs) ? day.proofs.length : 0), 0);
  const readingMinutes = recordedDays.reduce((sum, day) => sum + num(day.readingMinutes), 0);
  const readingDays = recordedDays.filter((day) => num(day.readingMinutes) > 0).length;
  const workWins = recordedDays.filter((day) => day.workWinType || day.workWinText?.trim());
  const artifacts = recordedDays.filter((day) => day.artifactText?.trim());
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
    workMinutes,
    proofCount,
    readingMinutes,
    readingDays,
    workWins,
    artifacts,
    habitStats,
    completionRate,
    emptyDays,
    streak,
    cleanStreak,
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
      readingMinutes: closed.reduce((sum, day) => sum + num(day.readingMinutes), 0),
      activeCalories: closed.reduce((sum, day) => sum + num(day.activeCalories), 0),
      steps: closed.reduce((sum, day) => sum + num(day.steps), 0),
      avgEnergyBalance: energyBalances.length ? Math.round(energyBalances.reduce((sum, value) => sum + value, 0) / energyBalances.length) : 0,
      workWins: closed.filter((day) => day.workWinType || day.workWinText?.trim()).length,
      artifacts: closed.filter((day) => day.artifactText?.trim()).length,
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
    readingMinutes: closed.reduce((sum, day) => sum + num(day.readingMinutes), 0),
    steps: closed.reduce((sum, day) => sum + num(day.steps), 0),
    avgEnergyBalance: energyBalances.length ? Math.round(energyBalances.reduce((sum, value) => sum + value, 0) / energyBalances.length) : 0,
    workWins: closed.filter((day) => day.workWinType || day.workWinText?.trim()).length,
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
      `Чтение: ${(stats.readingMinutes / 60).toFixed(1)} ч за ${stats.readingDays} дней`,
      `Побед испытательного срока: ${stats.workWins.length}`,
      `Артефактов дня: ${stats.artifacts.length}`,
    ]
    : [`1С/рынок часы: ${(stats.workMinutes / 60).toFixed(1)}`];
  const aiQuestion = isLife
    ? 'Проанализируй мой 120-дневный путь изменения личности без морализаторства. Найди, какие условия помогают удерживать выбранные привычки, питание, дефицит энергии, шаги и вес, а также успешно проходить испытательный срок. Покажи связи между срывами, энергобалансом, артефактами дня и рабочими победами. Дай 3 реалистичных рычага на следующую неделю.'
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
    `Вес: ${stats.firstWeight || 'нет'} -> ${stats.lastWeight || 'нет'} кг, дельта ${stats.weightDelta} кг`,
    `Доказательств роста: ${stats.proofCount}`,
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
        ? `- Неделя ${week.number}: закрыто ${week.closed.length}/7, очки ${week.xp}, привычки: ${week.habitStats.map((habit) => `${habit.name} ${habit.kept}/${habit.answered}`).join(', ') || '-'}, чтение ${(week.readingMinutes / 60).toFixed(1)} ч, шаги ${week.steps}, энергобаланс ${week.avgEnergyBalance > 0 ? '+' : ''}${week.avgEnergyBalance} ккал, рабочих побед ${week.workWins}, артефактов ${week.artifacts}, вес ${week.weightDelta > 0 ? '+' : ''}${week.weightDelta} кг.`
        : `- Неделя ${week.number}: закрыто ${week.closed.length}/7, очки ${week.xp}, 1С/рынок ${(week.work / 60).toFixed(1)} ч, средние ккал ${week.avgCalories || '-'}, дней <=1800: ${week.topCalories}, вес ${week.weightDelta > 0 ? '+' : ''}${week.weightDelta} кг, доказательств ${week.proofCount}.`
    )),
    '',
    '## Чекпоинты',
    ...checkpoints.map((item) => (
      isLife
        ? `- День ${item.day}: закрыто ${item.closed}/${item.elapsed}, очки ${item.xp}, привычки: ${item.habitStats.map((habit) => `${habit.name} ${habit.kept}`).join(', ')}, чтение ${(item.readingMinutes / 60).toFixed(1)} ч, шаги ${item.steps}, энергобаланс ${item.avgEnergyBalance > 0 ? '+' : ''}${item.avgEnergyBalance} ккал, вес ${item.weightDelta > 0 ? '+' : ''}${item.weightDelta} кг.`
        : `- День ${item.day}: закрыто ${item.closed}/${item.elapsed}, очки ${item.xp}, 1С/рынок ${(item.workMinutes / 60).toFixed(1)} ч, средние ккал ${item.avgCalories || '-'}, вес ${item.weightDelta > 0 ? '+' : ''}${item.weightDelta} кг, доказательств ${item.proofCount}.`
    )),
    '',
    '## Дни',
    ...closed.map((day) => (
      isLife
        ? `- День ${day.day} (${day.date}): ${TIERS[day.result]?.title || day.result}, очки ${day.xp}, привычки: ${state.habits.map((habit) => `${habit.name}: ${getHabitValue(day, habit.id) === true ? 'да' : getHabitValue(day, habit.id) === false ? 'нет' : '-'}`).join(', ')}, чтение ${day.readingMinutes || 0} мин, ккал ${day.calories}, активные ккал ${day.activeCalories || 0}, шаги ${day.steps || 0}, вес ${day.weight} кг, артефакт: ${day.artifactText || '-'}, победа испытательного срока: ${day.workWinType || '-'} ${day.workWinText || ''}, новый шаг: ${day.actionText}, где не справился и почему: ${day.summary || '-'}`
        : `- День ${day.day} (${day.date}): ${TIERS[day.result]?.title || day.result}, очки ${day.xp}, 1С/рынок ${day.workMinutes} мин, ккал ${day.calories}, активные ккал ${day.activeCalories || 0}, шаги ${day.steps || 0}, вес ${day.weight} кг, артефакт: ${day.artifactText || '-'}, доказательства: ${(day.proofs || []).join(', ') || '-'}, действие: ${day.actionText}, итог: ${day.summary || '-'}`
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
    const closedCount = Math.max(1, stats.closedDays.length);
    const activeHabitStats = stats.habitStats.filter((habit) => habit.active !== false);
    const weakestHabit = [...activeHabitStats].sort((a, b) => a.rate - b.rate)[0];
    const strongestHabit = [...activeHabitStats].sort((a, b) => b.rate - a.rate)[0];
    if (strongestHabit?.answered) items.push(`${strongestHabit.name}: ${strongestHabit.rate}% успешных отметок. Это самая устойчивая часть новой системы.`);
    if (weakestHabit?.answered && weakestHabit.id !== strongestHabit?.id) items.push(`${weakestHabit.name}: ${weakestHabit.rate}%. Здесь полезнее искать повторяющийся триггер, а не давить на себя.`);
    if (stats.readingDays >= Math.ceil(closedCount * 0.6)) items.push('Чтение стало регулярным действием, а не редким рывком. Это один из маркеров новой нормы.');
    else items.push('Чтение пока не встроилось в ритм. Самый простой рычаг - постоянное место и короткий минимум в 10 минут.');
    if (stats.avgEnergyBalance < 0) items.push(`Средний дефицит ${Math.abs(stats.avgEnergyBalance)} ккал. При таком темпе вес должен двигаться вниз, если отметки полные.`);
    else if (stats.energyBalances.length) items.push(`Средний профицит ${stats.avgEnergyBalance} ккал. Для цели 65 кг расход пока не перекрывает питание.`);
    if (stats.workWins.length) items.push(`Зафиксировано ${stats.workWins.length} побед испытательного срока. Они показывают профессиональное закрепление, а не только занятость.`);
    else items.push('Побед испытательного срока пока нет в данных. Записывай только конкретные рабочие факты, даже небольшие.');
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
  const [confirmReset, setConfirmReset] = useState(false);
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

  const startJourney = (scenario) => {
    const nextState = createInitialState(todayKey(), scenario);
    setState(nextState);
    setActiveDayIndex(getCurrentDayIndex(nextState.startDate));
    setActiveView('main');
  };

  if (authLoading) return <LoadingScreen text="Проверяю аккаунт..." />;
  if (!user) return <LoginScreen error={authError} onSignIn={signIn} configured={firebaseConfigured} />;
  if (!cloudReady) return <LoadingScreen text="Загружаю твою историю..." />;
  if (!state) return <StartScreen user={user} onStart={startJourney} onLogOut={logOut} />;

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
  const scenarioSignals = scenario === 'life' ? LIFE_SIGNALS : SIGNALS;
  const latestSignal = [...scenarioSignals].reverse().find((signal) => stats.xp >= signal.minXp);
  const exportData = buildExport(state, stats, weeks);
  const isFinalDay = currentDayIndex + 1 >= TOTAL_DAYS;
  const updateActiveDay = (nextDay) => {
    if (safeActiveDayIndex !== currentDayIndex || activeDay.result) return;
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
    if (safeActiveDayIndex !== currentDayIndex || activeDay.result) return;
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
    if (safeActiveDayIndex !== currentDayIndex || !evaluation.canFix || weeklyRequiredForActiveDay) return;
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

  const resetJourney = (nextScenario) => {
    const nextState = createInitialState(todayKey(), nextScenario);
    setConfirmReset(false);
    setState(nextState);
    setActiveDayIndex(0);
    setActiveView('main');
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
    <div className="min-h-screen overflow-x-hidden bg-[#eef7f9] text-slate-900">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(90deg,rgba(59,130,246,0.06)_1px,transparent_1px),linear-gradient(rgba(20,83,45,0.05)_1px,transparent_1px)] bg-[size:44px_44px]" />
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
          onReset={() => setConfirmReset(true)}
          onLogOut={logOut}
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
            <Dashboard scenario={scenario} days={state.days} stats={stats} currentWeek={currentWeek} weeks={weeks} habits={state.habits} profile={state.profile} range={statsRange} onRangeChange={setStatsRange} onProfileChange={updateProfile} />
            <Checkpoints scenario={scenario} days={state.days} currentDayIndex={currentDayIndex} habits={state.habits} profile={state.profile} />
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
        {confirmReset && (
          <ConfirmReset currentScenario={scenario} onCancel={() => setConfirmReset(false)} onConfirm={resetJourney} />
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
  const [selectedScenario, setSelectedScenario] = useState(null);
  const selected = selectedScenario ? SCENARIOS[selectedScenario] : null;
  return (
    <div className="min-h-screen bg-[#eef7f9] text-slate-900">
      <div className="mx-auto grid min-h-screen max-w-6xl place-items-center px-4 py-10">
        <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="grid w-full gap-6 lg:grid-cols-[1fr_0.82fr]">
          <div className="border border-[#cbdde1] bg-[#f4fafb] p-6 shadow-sm sm:p-8 rounded-lg">
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
              Выбери, чему служат следующие 120 дней
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
              Первый путь помогает выйти на рынок. Второй закрепляет новую жизнь после оффера. В обоих сценариях старт фиксируется сегодняшней датой, а история хранится в аккаунте.
            </p>
            <div className="mt-7">
              <ScenarioPicker selected={selectedScenario} onSelect={setSelectedScenario} />
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                onClick={() => onStart(selectedScenario)}
                disabled={!selectedScenario}
                className="inline-flex items-center gap-2 bg-slate-950 px-5 py-3 font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 rounded-md"
              >
                <Play size={18} />
                {selected ? `Начать «${selected.shortTitle}»` : 'Сначала выбери сценарий'}
              </button>
              <button onClick={onLogOut} className="inline-flex items-center gap-2 border border-[#d5e3e5] bg-white px-5 py-3 font-bold text-slate-700 shadow-sm transition hover:bg-[#f4fafb] rounded-md">
                <LogOut size={18} />
                Выйти
              </button>
            </div>
          </div>

          <div className="grid gap-3">
            {selectedScenario === 'life' ? (
              <>
                <StartMetric icon={<WineOff size={20} />} title="Ясность" text="Алкоголь уходит полностью, а каждый день даёт честное доказательство курса." />
                <StartMetric icon={<CandyOff size={20} />} title="Без сладкого вкуса" text="Не только сладости, но и привычка искать сладкий вкус перестаёт управлять выбором." />
                <StartMetric icon={<Utensils size={20} />} title="Форма и 65 кг" text="1800 как топ, 2300 как предел, вес и питание видны на графиках." />
                <StartMetric icon={<BookOpen size={20} />} title="Жизнь шире работы" text="Чтение и новые действия показывают, что меняется не только вес, но и сама жизнь." />
              </>
            ) : (
              <>
                <StartMetric icon={<Target size={20} />} title="1С и рынок" text="Учёба, практика, проект, вакансии, резюме, отклики." />
                <StartMetric icon={<Utensils size={20} />} title="Питание" text="1800 как топ, 2300 как верхняя граница." />
                <StartMetric icon={<Scale size={20} />} title="Вес" text="График покажет, куда реально идёт тело." />
                <StartMetric icon={<Trophy size={20} />} title="День 120" text="Финальная форма появится как отдельный экран в конце пути." />
              </>
            )}
          </div>
        </motion.section>
      </div>
    </div>
  );
}

function ScenarioPicker({ selected, onSelect, compact = false }) {
  return (
    <div className={`grid gap-3 ${compact ? '' : 'sm:grid-cols-2'}`}>
      {Object.values(SCENARIOS).map((scenario) => {
        const active = selected === scenario.id;
        const icon = scenario.id === 'life' ? <WineOff size={21} /> : <Target size={21} />;
        return (
          <button
            key={scenario.id}
            type="button"
            onClick={() => onSelect(scenario.id)}
            className={`min-h-[118px] border p-4 text-left transition rounded-lg ${active ? 'border-[#5f8f5d] bg-[#eef7eb] ring-2 ring-[#b8d9b3]' : 'border-[#cbdde2] bg-white hover:border-[#b8cdb2] hover:bg-[#fbfdf9]'}`}
          >
            <span className={`mb-3 grid h-9 w-9 place-items-center rounded-md ${active ? 'bg-[#d8ecd3] text-[#12676a]' : 'bg-[#f3efe7] text-slate-600'}`}>{icon}</span>
            <span className="block text-base font-black text-slate-950">{scenario.title}</span>
            <span className="mt-1 block text-sm font-semibold leading-6 text-slate-600">{scenario.description}</span>
          </button>
        );
      })}
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
  onReset,
  onLogOut,
}) {
  const syncText = syncState === 'saving' ? 'сохраняю' : syncState === 'offline' ? 'офлайн' : 'синхронно';
  return (
    <header className="border border-[#b9d7dd] bg-white/92 p-4 shadow-sm backdrop-blur rounded-lg">
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
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-black text-[#247184]">
              <span>Новая личность</span><span className="text-[#8bb7c0]">·</span>
              <span>65 кг и выраженный пресс</span><span className="text-[#8bb7c0]">·</span>
              <span>Испытательный срок пройден</span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 xl:items-end">
          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            <HeaderPill icon={<User size={16} />} label="Аккаунт" value={user.email || 'user'} />
            <IconButton onClick={onExport} icon={<Download size={16} />} label="Экспорт" tone="plain" compact />
            <IconButton onClick={onReset} icon={<RotateCcw size={16} />} label="Старт" tone="plain" compact />
            <IconButton onClick={onLogOut} icon={<LogOut size={16} />} label="Выйти" tone="plain" compact />
          </div>
          <div className="flex flex-wrap gap-2 xl:justify-end">
            <ViewButton active={activeView === 'main'} onClick={() => onViewChange('main')} icon={<Target size={16} />} label="Основной" />
            <ViewButton active={activeView === 'stats'} onClick={() => onViewChange('stats')} icon={<BarChart3 size={16} />} label="Статистика" />
          </div>
        </div>
      </div>
      <div className="mt-4 h-3 overflow-hidden bg-[#e6f0f2] rounded-md">
        <div className="h-full bg-[#19a7b8] transition-all duration-700" style={{ width: `${stats.levelProgress}%` }} />
      </div>
    </header>
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
}) {
  const isFixed = Boolean(day.result);
  const isToday = activeDayIndex === currentDayIndex;
  const isPast = activeDayIndex < currentDayIndex;
  const editable = isToday && !isFixed;
  const isLife = scenario === 'life';
  const activeHabits = getActiveHabits(habits);
  const answeredHabits = activeHabits.filter((habit) => typeof getHabitValue(day, habit.id) === 'boolean').length;
  const keptHabits = activeHabits.filter((habit) => getHabitValue(day, habit.id) === true).length;
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

      <div className="grid gap-4">
        {isLife ? (
          <HabitTracker
            habits={activeHabits}
            values={day.habitValues || {}}
            disabled={!editable}
            kept={keptHabits}
            answered={answeredHabits}
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

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <NumberField icon={<Utensils size={18} />} label="Калории" value={day.calories} disabled={!editable} min="0" onChange={(value) => onChange({ ...day, calories: value })} />
          <NumberField icon={<BatteryCharging size={18} />} label="Активные калории" value={day.activeCalories} disabled={!editable} min="0" onChange={(value) => onChange({ ...day, activeCalories: value })} />
          <NumberField icon={<Footprints size={18} />} label="Шаги" value={day.steps} disabled={!editable} min="0" onChange={(value) => onChange({ ...day, steps: value })} />
          <NumberField icon={<Activity size={18} />} label="Приёмы пищи" value={day.meals} disabled={!editable} min="0" onChange={(value) => onChange({ ...day, meals: value })} />
          <NumberField icon={<Scale size={18} />} label="Вес, кг" value={day.weight} disabled={!editable} min="0" step="0.1" onChange={(value) => onChange({ ...day, weight: value })} />
        </div>

        {isLife && (
          <>
            <NumberField icon={<BookOpen size={18} />} label="Чтение, минуты" value={day.readingMinutes} disabled={!editable} min="0" onChange={(value) => onChange({ ...day, readingMinutes: value })} />
            <ProofPicker
              label="Что сегодня оживило день?"
              proofTypes={LIFE_PROOF_TYPES}
              value={day.proofs || []}
              disabled={!editable}
              onChange={(proofs) => onChange({ ...day, proofs })}
            />
            <TextField
              icon={<Zap size={18} />}
              label="Какой шаг сегодня сделал жизнь другой?"
              value={day.actionText}
              disabled={!editable}
              placeholder="Например: прочитал главу, прошёлся без телефона, разобрал дела, позвонил близкому"
              onChange={(value) => onChange({ ...day, actionText: value })}
            />
          </>
        )}

        <div className="grid gap-3 lg:grid-cols-2">
          <TextField
            icon={<PackageCheck size={18} />}
            label="Артефакт дня"
            value={day.artifactText}
            disabled={!editable}
            placeholder="Что осталось после дня: результат, документ, решение, заметка, фотография"
            onChange={(value) => onChange({ ...day, artifactText: value })}
          />
          <div className="grid gap-3">
            <SelectField
              icon={<BriefcaseBusiness size={18} />}
              label="Победа испытательного срока"
              value={day.workWinType}
              disabled={!editable}
              options={WORK_WIN_TYPES}
              onChange={(value) => onChange({ ...day, workWinType: value })}
            />
            <TextField
              icon={<Trophy size={18} />}
              label="Что именно получилось на работе?"
              value={day.workWinText}
              disabled={!editable}
              placeholder="Короткий факт. Можно оставить пустым, если сегодня без отдельной победы."
              onChange={(value) => onChange({ ...day, workWinText: value })}
            />
          </div>
        </div>

        <TextField
          icon={<FileText size={18} />}
          label={isLife ? 'Где не справился и почему?' : 'Что стало сильнее во мне или системе?'}
          value={day.summary}
          disabled={!editable}
          placeholder={isLife ? 'Если всё получилось — так и напиши. Если нет — где и почему.' : 'Одна строка результата без лишней рефлексии'}
          onChange={(value) => onChange({ ...day, summary: value })}
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

function HabitTracker({ habits, values, disabled, kept, answered, onChange, onAdd, onRemove }) {
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
            <Settings2 size={18} />
            Привычки дня
          </div>
          <div className="mt-1 text-xs font-bold text-slate-500">Удержано {kept} · отмечено {answered}/{habits.length}</div>
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
            placeholder="Например: Без музыки"
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
            onRemove={showSettings ? () => onRemove(habit.id) : null}
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

function SelectField({ icon, label, value, onChange, disabled, options }) {
  return (
    <label className={`block border border-[#d5e3e5] p-3 rounded-lg ${disabled ? 'bg-[#f4f7f8]' : 'bg-white'}`}>
      <span className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-600">{icon}{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="w-full border border-[#cbdde2] bg-white px-3 py-2 text-base font-bold text-slate-950 outline-none focus:border-[#40a7b8] disabled:bg-[#eef2f4] disabled:text-slate-500 rounded-md"
      >
        <option value="">Без отдельной победы</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
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
          <MiniStat label="Плохо" value={stats.tierCounts.bad || 0} />
          <MiniStat label="Слабо" value={stats.tierCounts.weak || 0} />
          <MiniStat label="Обыч" value={stats.tierCounts.base || 0} />
          <MiniStat label="Сила" value={stats.tierCounts.growth || 0} />
          <MiniStat label="Идеал" value={stats.tierCounts.breakthrough || 0} />
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
        <PathInsight icon={<FileText size={18} />} label={isLife ? 'Живые действия' : 'Доказательства'} value={stats.proofCount} />
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

function Dashboard({ days, stats, currentWeek, weeks, scenario, habits, profile, range, onRangeChange, onProfileChange }) {
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
            <ChartCard icon={<BookOpen size={18} />} title="Чтение" subtitle={`${(stats.readingMinutes / 60).toFixed(1)} ч`} aside={<span className="text-sm font-black text-[#12676a]">{stats.readingDays} дн.</span>}>
              <ReadingProgress days={visibleRecordedDays} />
            </ChartCard>
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
        {isLife && <TrialWinsPanel wins={stats.workWins} artifacts={stats.artifacts} />}
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
    { id: 'all', label: 'Весь путь' },
  ];
  return (
    <div className="grid grid-cols-3 gap-1 border border-[#c6dce0] bg-[#eef6f8] p-1 rounded-md">
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

function TrialWinsPanel({ wins, artifacts }) {
  const recentWins = wins.slice(-4).reverse();
  return (
    <section className="border border-[#9dd8e1] bg-[#eefafd] p-4 rounded-lg">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-black text-[#126879]"><BriefcaseBusiness size={17} />Испытательный срок</div>
        <div className="text-sm font-black text-[#247184]">{wins.length} побед · {artifacts.length} артефактов</div>
      </div>
      {recentWins.length ? (
        <div className="grid gap-2">
          {recentWins.map((day) => (
            <div key={day.day} className="border border-[#c6e2e7] bg-white p-3 rounded-md">
              <div className="text-xs font-black text-[#247184]">День {day.day} · {day.workWinType || 'Победа'}</div>
              <div className="mt-1 text-sm font-semibold leading-6 text-slate-700">{day.workWinText || day.artifactText}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="border border-dashed border-[#acd2da] bg-white/70 p-3 text-sm font-semibold text-slate-500 rounded-md">Здесь появятся конкретные доказательства того, что ты закрепляешься в работе.</div>
      )}
    </section>
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
            <WeekMetric label="Рабочие победы" value={stats.workWins.length} />
            <WeekMetric label="Артефакты" value={stats.artifacts.length} />
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

function ReadingProgress({ days }) {
  const closed = days.filter((day) => day.result);
  if (!closed.length) return <EmptyChart text="Траектория чтения появится после первого дня" />;
  const cumulative = [];
  closed.reduce((sum, day) => {
    const next = sum + num(day.readingMinutes);
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
            <WeekMetric label="Рабочие победы" value={week.workWins} />
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
          <h2 className="text-2xl font-black text-slate-950">Неделя {week.number}: что реально произошло</h2>
        </div>
        <div className="text-sm font-bold text-slate-500">Дни {week.from}-{week.to}</div>
      </div>
      {required && (
        <div className="mb-3 border border-[#f1d2a7] bg-[#fff3df] p-3 text-sm font-black leading-6 text-[#81501f] rounded-lg">
          Заполни эти 3 поля, чтобы зафиксировать день {week.to}. После закрытия он больше не будет висеть каждый день.
        </div>
      )}
      <div className="grid gap-3 lg:grid-cols-3">
        <ReflectionField label="Что сработало?" value={review.worked} onChange={(value) => onChange({ worked: value })} placeholder={isLife ? 'Что помогало выбирать себя и удерживать новую норму?' : 'Что двигало форму, 1С или рынок?'} required={required} />
        <ReflectionField label={isLife ? 'Где включился старый автопилот?' : 'Где просел?'} value={review.blocked} onChange={(value) => onChange({ blocked: value })} placeholder={isLife ? 'Какая ситуация вернула тягу, сладкое, переедание или пустой вечер?' : 'Калории, пустые дни, мало 1С, хаос?'} required={required} />
        <ReflectionField label="Главный рычаг недели" value={review.nextLever} onChange={(value) => onChange({ nextLever: value })} placeholder={isLife ? 'Что упростит правильный выбор на следующей неделе?' : 'Один ход, который даст максимум.'} required={required} />
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
                  ? `${summary.closed}/${summary.elapsed} дней · ${summary.workWins} рабочих побед · ${summary.steps.toLocaleString('ru-RU')} шагов`
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
        <ReflectionField label={isLife ? 'Что стало моей новой нормой?' : 'Что получилось по рынку/офферу?'} value={review.offer} onChange={(value) => onChange({ offer: value })} placeholder={isLife ? 'Трезвость, вкус, чтение, решения, ритм жизни.' : 'Оффер, собесы, уровень, рынок.'} />
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

function ConfirmReset({ currentScenario, onCancel, onConfirm }) {
  const [selectedScenario, setSelectedScenario] = useState(null);
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 grid place-items-center bg-slate-900/35 p-4 backdrop-blur-sm">
      <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} className="w-full max-w-2xl border border-[#cbdde1] bg-[#ffffff] p-5 shadow-2xl rounded-lg">
        <h2 className="text-2xl font-black text-slate-950">Какой путь начать заново?</h2>
        <p className="mt-3 leading-7 text-slate-600">
          Сейчас активен сценарий «{SCENARIOS[currentScenario].shortTitle}». Выбери новый сценарий осознанно: после подтверждения текущий прогресс будет заменён стартом с сегодняшней даты.
        </p>
        <div className="mt-5">
          <ScenarioPicker selected={selectedScenario} onSelect={setSelectedScenario} />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button onClick={onCancel} className="border border-[#d5e3e5] bg-white px-4 py-3 font-black text-slate-700 rounded-md">Оставить</button>
          <button
            onClick={() => onConfirm(selectedScenario)}
            disabled={!selectedScenario}
            className="bg-slate-950 px-4 py-3 font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300 rounded-md"
          >
            Новый старт
          </button>
        </div>
      </motion.section>
    </motion.div>
  );
}

export default App;
