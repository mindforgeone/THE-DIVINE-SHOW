export const TOTAL_DAYS = 120;
export const MARATHON_DURATIONS = [30, 90, 120];
export const STORAGE_KEY = 'marathon-120-v9';
export const CLOUD_DOCUMENT_ID = 'marathon120-v9';
export const LEGACY_DOCUMENT_IDS = ['growth120', 'marathon120-v8'];
export const LEGACY_STORAGE_KEYS = ['growth-120-account-state-v2', 'offer-growth-120-v1', 'marathon-120-v8'];
export const CALORIE_TARGET = 1800;
export const CALORIE_LIMIT = 2300;

export const DEFAULT_DAY_CRITERIA = [
  { id: 'calories', label: 'Калории', field: 'calories', operator: 'max', target: 2300, unit: 'ккал', required: true, weight: 25, active: true },
  { id: 'active-calories', label: 'Активные калории', field: 'activeCalories', operator: 'min', target: 0, unit: 'ккал', required: true, weight: 10, active: true },
  { id: 'steps', label: 'Шаги', field: 'steps', operator: 'min', target: 8000, unit: 'шагов', required: true, weight: 15, active: true },
  { id: 'weight', label: 'Вес', field: 'weight', operator: 'min', target: 1, unit: 'кг', required: true, weight: 5, active: true },
  { id: 'evidence', label: 'Победа дня', field: 'evidence', operator: 'text', target: 5, unit: 'символов', required: false, weight: 15, active: true },
];

export const PROFILE_DEFAULTS = {
  age: 39,
  height: 167,
  sex: 'male',
  targetWeight: 65,
};

export const DAY_RESULTS = {
  return: { id: 'return', title: 'Честный возврат', short: 'Возврат', xp: 20, color: '#f06c5f', pale: '#fff0ee' },
  steady: { id: 'steady', title: 'Курс удержан', short: 'Курс', xp: 55, color: '#f3a52f', pale: '#fff7e8' },
  strong: { id: 'strong', title: 'Сильный день', short: 'Сильный', xp: 100, color: '#16a36a', pale: '#ecfbf3' },
  expansion: { id: 'expansion', title: 'Расширил границы', short: 'Прорыв', xp: 165, color: '#0d8fb9', pale: '#eaf8fd' },
};

export const GOAL_COLORS = ['#16a36a', '#0d8fb9', '#f06c5f', '#7c63d6', '#f3a52f', '#d55784', '#167b80'];

export const GOAL_TYPES = [
  { id: 'binary', label: 'Да / нет' },
  { id: 'count', label: 'Количество' },
];

export const GOAL_CADENCES = [
  { id: 'daily', label: 'Каждый день' },
  { id: 'weekly', label: 'За неделю' },
  { id: 'total', label: 'За весь марафон' },
];

export function defaultCodexRules(startDate) {
  const base = [
    { id: 'alcohol', title: 'Без алкоголя', type: 'boolean', target: 1, unit: '', critical: true },
    { id: 'wot', title: 'Без World of Tanks', type: 'boolean', target: 1, unit: '', critical: true },
    { id: 'reels', title: 'Instagram / Reels не больше 20 минут', type: 'boolean', target: 1, unit: '' },
    { id: 'nutrition-1850', title: 'Питание не больше 1850 ккал', type: 'limit', target: 1850, unit: 'ккал', sourceField: 'calories' },
    { id: 'recover', title: 'Следующий правильный выбор начинается сразу', type: 'text', target: 0, unit: '', scoreEnabled: false, required: false, todayVisible: false, statsVisible: false },
  ];
  return base.map((rule, order) => ({
    ...rule,
    active: true,
    required: rule.required !== false,
    scoreEnabled: rule.scoreEnabled !== false,
    todayVisible: rule.todayVisible !== false,
    statsVisible: rule.statsVisible !== false,
    order,
    startDate,
    endDate: '',
    createdAt: `${startDate}T00:00:00.000Z`,
    updatedAt: `${startDate}T00:00:00.000Z`,
    deletedAt: null,
  }));
}

export const COURAGE_CONTEXTS = [
  'Работа',
  'Общение',
  'Самовыражение',
  'Фотография',
  'Актёрское мастерство',
  'Новое действие',
  'Другое',
];

export function todayKey() {
  return toDateKey(new Date());
}

export function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function dateFromKey(key) {
  return new Date(`${key}T00:00:00`);
}

export function addDays(key, offset) {
  const date = dateFromKey(key);
  date.setDate(date.getDate() + offset);
  return toDateKey(date);
}

export function formatShortDate(key) {
  return dateFromKey(key).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

export function formatLongDate(key) {
  return dateFromKey(key).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function number(value) {
  const parsed = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function normalizeDuration(value) {
  const duration = Number(value);
  return MARATHON_DURATIONS.includes(duration) ? duration : TOTAL_DAYS;
}

export function getCurrentDayIndex(startDate, currentDate = todayKey(), durationDays = TOTAL_DAYS) {
  const elapsed = Math.round((dateFromKey(currentDate).getTime() - dateFromKey(startDate).getTime()) / 86400000);
  return clamp(elapsed, 0, normalizeDuration(durationDays) - 1);
}

export function isJourneyEnded(startDate, durationDays = TOTAL_DAYS) {
  return dateFromKey(todayKey()).getTime() > dateFromKey(addDays(startDate, normalizeDuration(durationDays) - 1)).getTime();
}

export function userCacheKey(uid, namespace = STORAGE_KEY) {
  return `${namespace}:${uid || 'local'}`;
}

export function createId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function defaultGoals(startDate, durationDays = TOTAL_DAYS) {
  const duration = normalizeDuration(durationDays);
  return [
    {
      id: 'alcohol-zero',
      name: 'Алкоголь: 0',
      description: 'Ни в каких количествах. Это мой выбор, а не наказание.',
      type: 'binary', cadence: 'daily', target: 1, unit: 'день', color: '#16a36a', locked: true, active: true, createdDay: 1, createdAt: startDate, updatedAt: startDate,
    },
    {
      id: 'sweet-zero',
      name: 'Сладкое: 0',
      description: `Без сладостей и сладкого вкуса. Чистая линия на ${duration} дней.`,
      type: 'binary', cadence: 'daily', target: 1, unit: 'день', color: '#f06c5f', locked: true, active: true, createdDay: 1, createdAt: startDate, updatedAt: startDate,
    },
    {
      id: 'daily-action',
      name: 'Действие к цели',
      description: 'Один конкретный шаг. Что именно сделал — в доказательстве дня.',
      type: 'binary', cadence: 'daily', target: 1, unit: 'день', color: '#0d8fb9', locked: false, active: true, createdDay: 1, createdAt: startDate, updatedAt: startDate,
    },
    {
      id: 'kontur-value',
      name: 'Стать ценным в Контуре',
      description: 'Фиксировать конкретные рабочие действия и результаты.',
      type: 'count', cadence: 'weekly', target: 3, unit: 'действия', color: '#0d8fb9', locked: false, active: true, createdDay: 1, createdAt: startDate, updatedAt: startDate,
    },
    {
      id: 'acting',
      name: 'Актёрское мастерство',
      description: 'Стабильно заниматься и расширять свободу проявления.',
      type: 'count', cadence: 'weekly', target: 2, unit: 'занятия', color: '#7c63d6', locked: false, active: true, createdDay: 1, createdAt: startDate, updatedAt: startDate,
    },
    {
      id: 'photo',
      name: 'Фотосъёмки',
      description: 'Не ждать уверенности, а снова создавать кадры.',
      type: 'count', cadence: 'total', target: 1, unit: 'съёмка', color: '#f3a52f', locked: false, active: true, createdDay: 1, createdAt: startDate, updatedAt: startDate,
    },
  ];
}

export function createDay(day, startDate) {
  return {
    day,
    date: addDays(startDate, day - 1),
    calories: '',
    activeCalories: '',
    steps: '',
    weight: '',
    goalValues: {},
    codexValues: {},
    focusActions: [],
    visibleGoalIds: null,
    fieldUpdatedAt: {},
    actions: [],
    courageMoments: [],
    evidence: '',
    returnContext: '',
    draftSavedAt: null,
    draftUpdatedAt: null,
    result: null,
    score: 0,
    xp: 0,
    closedAt: null,
    closureMode: null,
  };
}

export function createWeeklyReview(index) {
  return { week: index + 1, victories: '', pattern: '', nextChoice: '', updatedAt: null };
}

export function createInitialState(startDate = todayKey(), acceptedAt = null, commitments = null, durationDays = TOTAL_DAYS) {
  const now = new Date().toISOString();
  const duration = normalizeDuration(durationDays);
  return {
    version: 12,
    resetGeneration: '2026-09-24-life-platform-v1',
    journeyId: createId('journey'),
    durationDays: duration,
    startDate,
    contractAcceptedAt: acceptedAt,
    commitments,
    createdAt: now,
    updatedAtClient: now,
    profile: { ...PROFILE_DEFAULTS },
    dayCriteria: DEFAULT_DAY_CRITERIA.map((item) => ({ ...item })),
    resultThresholds: { steady: 50, strong: 85, expansion: 95 },
    codexRules: defaultCodexRules(startDate),
    codexHistory: [],
    bodyLogs: [],
    progressPhotos: [],
    goals: defaultGoals(startDate, duration),
    tasks: [],
    days: Array.from({ length: duration }, (_, index) => createDay(index + 1, startDate)),
    weeklyReviews: Array.from({ length: Math.ceil(duration / 7) }, (_, index) => createWeeklyReview(index)),
    careerDecision: { status: 'pending', decidedAt: null },
    finalReview: { body: '', career: '', identity: '', next: '', updatedAt: null },
  };
}

function normalizeGoal(goal, index, startDate, durationDays) {
  return {
    id: goal.id || createId('goal'),
    name: goal.name || `Цель ${index + 1}`,
    description: goal.description || '',
    type: goal.type === 'binary' ? 'binary' : 'count',
    cadence: ['daily', 'weekly', 'total'].includes(goal.cadence) ? goal.cadence : 'total',
    target: Math.max(1, number(goal.target) || 1),
    unit: goal.unit || (goal.type === 'binary' ? 'день' : 'раз'),
    color: goal.color || GOAL_COLORS[index % GOAL_COLORS.length],
    locked: Boolean(goal.locked),
    active: goal.active !== false,
    createdDay: clamp(number(goal.createdDay) || 1, 1, durationDays),
    createdAt: goal.createdAt || startDate,
    updatedAt: goal.updatedAt || goal.createdAt || startDate,
  };
}

export function normalizeState(raw) {
  if (!raw?.startDate || Number(raw.version || 0) < 9) return null;
  const durationDays = normalizeDuration(raw.durationDays || raw.days?.length || TOTAL_DAYS);
  const base = createInitialState(raw.startDate, raw.contractAcceptedAt || null, raw.commitments || null, durationDays);
  return {
    ...base,
    ...raw,
    version: 12,
    durationDays,
    profile: { ...PROFILE_DEFAULTS, ...(raw.profile || {}) },
    dayCriteria: Array.isArray(raw.dayCriteria) ? raw.dayCriteria.map((item) => ({ ...item, active: item.active !== false, required: Boolean(item.required), weight: Math.max(0, number(item.weight)), target: number(item.target) })) : base.dayCriteria,
    resultThresholds: { ...base.resultThresholds, ...(raw.resultThresholds || {}) },
    codexRules: Array.isArray(raw.codexRules) ? raw.codexRules.map((rule, index) => ({
      type: 'boolean', target: 1, unit: '', active: true, required: true, scoreEnabled: true, todayVisible: true, statsVisible: true,
      ...rule,
      id: rule.id || createId('rule'),
      title: rule.title || `Правило ${index + 1}`,
      order: Number.isFinite(Number(rule.order)) ? Number(rule.order) : index,
      startDate: rule.startDate || raw.startDate,
      endDate: rule.endDate || '',
      deletedAt: rule.deletedAt || null,
    })) : base.codexRules,
    codexHistory: Array.isArray(raw.codexHistory) ? raw.codexHistory : [],
    bodyLogs: Array.isArray(raw.bodyLogs) ? raw.bodyLogs : [],
    progressPhotos: Array.isArray(raw.progressPhotos) ? raw.progressPhotos : [],
    goals: Array.isArray(raw.goals) ? raw.goals.map((goal, index) => normalizeGoal(goal, index, raw.startDate, durationDays)) : base.goals,
    tasks: Array.isArray(raw.tasks) ? raw.tasks.map((task) => ({ ...task, updatedAt: task.updatedAt || task.createdAt || raw.startDate })) : [],
    days: Array.from({ length: durationDays }, (_, index) => {
      const previous = raw.days?.[index] || {};
      return {
        ...createDay(index + 1, raw.startDate),
        ...previous,
        goalValues: previous.goalValues || {},
        codexValues: previous.codexValues || {},
        focusActions: Array.isArray(previous.focusActions) ? previous.focusActions : [],
        actions: Array.isArray(previous.actions) ? previous.actions : [],
        courageMoments: Array.isArray(previous.courageMoments) ? previous.courageMoments : [],
        day: index + 1,
        date: addDays(raw.startDate, index),
      };
    }),
    weeklyReviews: Array.from({ length: Math.ceil(durationDays / 7) }, (_, index) => ({
      ...createWeeklyReview(index),
      ...(raw.weeklyReviews?.[index] || {}),
      week: index + 1,
    })),
    careerDecision: { status: 'pending', decidedAt: null, ...(raw.careerDecision || {}) },
    finalReview: { ...base.finalReview, ...(raw.finalReview || {}) },
  };
}

function timestamp(item) {
  return Date.parse(item?.closedAt || item?.draftUpdatedAt || item?.updatedAt || item?.updatedAtClient || item?.createdAt || '') || 0;
}

function mergeById(first = [], second = []) {
  const map = new Map();
  [...first, ...second].forEach((item) => {
    const current = map.get(item.id);
    if (!current || timestamp(item) >= timestamp(current)) map.set(item.id, item);
  });
  return [...map.values()];
}

const DAY_FIELDS = ['calories', 'activeCalories', 'steps', 'weight', 'actions', 'courageMoments', 'evidence', 'returnContext', 'visibleGoalIds', 'focusActions'];

export function updateDayDraft(day, patch, changedAt) {
  const next = { ...day, ...patch, fieldUpdatedAt: { ...day.fieldUpdatedAt }, draftUpdatedAt: changedAt, draftSavedAt: changedAt };
  DAY_FIELDS.forEach((field) => {
    if (JSON.stringify(next[field]) !== JSON.stringify(day[field])) next.fieldUpdatedAt[field] = changedAt;
  });
  Object.keys(next.goalValues || {}).forEach((id) => {
    if (next.goalValues[id] !== day.goalValues?.[id]) next.fieldUpdatedAt[`goal:${id}`] = changedAt;
  });
  Object.keys(next.codexValues || {}).forEach((id) => {
    if (next.codexValues[id] !== day.codexValues?.[id]) next.fieldUpdatedAt[`codex:${id}`] = changedAt;
  });
  return next;
}

function mergeDayDrafts(remote, local) {
  const newer = timestamp(local) >= timestamp(remote) ? local : remote;
  const merged = { ...newer, goalValues: {}, codexValues: {}, fieldUpdatedAt: {} };
  const fieldTime = (day, field, value) => Date.parse(day.fieldUpdatedAt?.[field] || ((value !== '' && value !== null && value !== undefined && (!Array.isArray(value) || value.length)) ? day.draftUpdatedAt || day.closedAt : '') || '') || 0;
  const choose = (field, remoteValue, localValue) => {
    const remoteTime = fieldTime(remote, field, remoteValue);
    const localTime = fieldTime(local, field, localValue);
    if (remoteTime || localTime) merged.fieldUpdatedAt[field] = new Date(Math.max(remoteTime, localTime)).toISOString();
    return localTime > remoteTime ? localValue : remoteValue ?? localValue;
  };
  DAY_FIELDS.forEach((field) => { merged[field] = choose(field, remote[field], local[field]); });
  const ids = new Set([...Object.keys(remote.goalValues || {}), ...Object.keys(local.goalValues || {})]);
  ids.forEach((id) => { merged.goalValues[id] = choose(`goal:${id}`, remote.goalValues?.[id], local.goalValues?.[id]); });
  const codexIds = new Set([...Object.keys(remote.codexValues || {}), ...Object.keys(local.codexValues || {})]);
  codexIds.forEach((id) => { merged.codexValues[id] = choose(`codex:${id}`, remote.codexValues?.[id], local.codexValues?.[id]); });
  const draftTime = Math.max(Date.parse(remote.draftUpdatedAt || '') || 0, Date.parse(local.draftUpdatedAt || '') || 0);
  if (draftTime) merged.draftUpdatedAt = new Date(draftTime).toISOString();
  const contentChanged = DAY_FIELDS.some((field) => JSON.stringify(merged[field]) !== JSON.stringify(newer[field])) || JSON.stringify(merged.goalValues) !== JSON.stringify(newer.goalValues) || JSON.stringify(merged.codexValues) !== JSON.stringify(newer.codexValues);
  if (merged.closureMode === 'automatic' && contentChanged) {
    Object.assign(merged, { result: null, closureMode: null, closedAt: null, xp: 0, score: 0 });
  }
  return merged;
}

export function mergeStates(remoteRaw, localRaw) {
  if (!remoteRaw) return normalizeState(localRaw);
  if (!localRaw) return normalizeState(remoteRaw);
  const remote = normalizeState(remoteRaw);
  const local = normalizeState(localRaw);
  if (!remote) return local;
  if (!local) return remote;
  // The cloud's accepted start wins over a second device starting the same marathon.
  if (remote.journeyId !== local.journeyId) return remote.contractAcceptedAt ? remote : local;
  const newer = timestamp(local) >= timestamp(remote) ? local : remote;
  return {
    ...remote,
    ...local,
    ...newer,
    goals: mergeById(remote.goals, local.goals),
    codexRules: mergeById(remote.codexRules, local.codexRules),
    codexHistory: mergeById(remote.codexHistory, local.codexHistory),
    bodyLogs: mergeById(remote.bodyLogs, local.bodyLogs),
    progressPhotos: mergeById(remote.progressPhotos, local.progressPhotos),
    tasks: mergeById(remote.tasks, local.tasks),
    days: remote.days.map((remoteDay, index) => {
      const localDay = local.days[index];
      if (remoteDay.result && remoteDay.closureMode !== 'automatic') return remoteDay;
      if (localDay.result && localDay.closureMode !== 'automatic') return localDay;
      return mergeDayDrafts(remoteDay, localDay);
    }),
    weeklyReviews: remote.weeklyReviews.map((review, index) => timestamp(local.weeklyReviews[index]) >= timestamp(review) ? local.weeklyReviews[index] : review),
    updatedAtClient: new Date(Math.max(timestamp(remote), timestamp(local))).toISOString(),
  };
}

export function loadCachedState(uid, namespace = STORAGE_KEY) {
  try {
    return normalizeState(JSON.parse(localStorage.getItem(userCacheKey(uid, namespace)) || 'null'));
  } catch {
    return null;
  }
}

export function saveCachedState(uid, state, namespace = STORAGE_KEY) {
  try {
    localStorage.setItem(userCacheKey(uid, namespace), JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function clearCachedState(uid, namespace = STORAGE_KEY) {
  try {
    localStorage.removeItem(userCacheKey(uid, namespace));
  } catch {
    // Cloud state remains authoritative when browser storage is unavailable.
  }
}

export function clearLegacyCache(uid) {
  LEGACY_STORAGE_KEYS.forEach((key) => {
    localStorage.removeItem(key);
    localStorage.removeItem(`${key}:${uid}`);
  });
}

export function calculateBmr(weight, profile = PROFILE_DEFAULTS) {
  const currentWeight = number(weight);
  if (!currentWeight) return 0;
  const base = 10 * currentWeight + 6.25 * number(profile.height) - 5 * number(profile.age);
  return Math.round(base + (profile.sex === 'female' ? -161 : 5));
}

export function calculateEnergyBalance(day, profile) {
  const calories = number(day.calories);
  const bmr = calculateBmr(day.weight, profile);
  if (!calories || !bmr || day.activeCalories === '') return null;
  return Math.round(calories - bmr - number(day.activeCalories));
}

export function isActionComplete(action) {
  return Boolean(action?.goalId && action?.text?.trim().length >= 3);
}

export function isCourageComplete(moment) {
  return Boolean(moment?.context && moment?.situation?.trim().length >= 3 && moment?.before !== '' && moment?.after !== '' && moment?.action?.trim().length >= 3);
}

export function isWeeklyReviewComplete(review) {
  return Boolean(review?.victories?.trim() && review?.pattern?.trim() && review?.nextChoice?.trim());
}

export function visibleGoalsForDay(day, goals) {
  return goals.filter((goal) => goal.active !== false && goal.createdDay <= day.day && (
    goal.locked || (Array.isArray(day.visibleGoalIds)
      ? day.visibleGoalIds.includes(goal.id)
      : goal.cadence === 'daily' || Object.hasOwn(day.goalValues || {}, goal.id))
  ));
}

export function activeCodexRulesForDay(day, rules = []) {
  return rules
    .filter((rule) => !rule.deletedAt && rule.active !== false)
    .filter((rule) => (!rule.startDate || rule.startDate <= day.date) && (!rule.endDate || rule.endDate >= day.date))
    .sort((a, b) => number(a.order) - number(b.order));
}

export function codexValueForDay(day, rule) {
  return rule.sourceField ? day[rule.sourceField] : day.codexValues?.[rule.id];
}

export function evaluateCodexRule(day, rule) {
  const value = codexValueForDay(day, rule);
  const parsed = Number(String(value ?? '').replace(',', '.'));
  const answered = rule.type === 'text'
    ? String(value || '').trim().length > 0
    : rule.type === 'boolean'
      ? typeof value === 'boolean'
      : value !== '' && value !== null && value !== undefined && Number.isFinite(parsed) && parsed >= 0;
  const passed = answered && (rule.type === 'boolean'
    ? value === true
    : rule.type === 'text'
      ? String(value).trim().length >= Math.max(1, number(rule.target))
      : rule.type === 'limit'
        ? parsed <= number(rule.target)
        : parsed >= number(rule.target));
  return { rule, value, answered, passed };
}

export function evaluateDay(day, goals, criteria = DEFAULT_DAY_CRITERIA, thresholds = { steady: 50, strong: 80, expansion: 95 }, codexRules = []) {
  const activeGoals = visibleGoalsForDay(day, goals);
  const dailyBinary = activeGoals.filter((goal) => goal.type === 'binary' && goal.cadence === 'daily');
  const answered = dailyBinary.filter((goal) => typeof day.goalValues?.[goal.id] === 'boolean');
  const kept = dailyBinary.filter((goal) => day.goalValues?.[goal.id] === true);
  const codexState = activeCodexRulesForDay(day, codexRules).filter((rule) => rule.scoreEnabled !== false && (rule.todayVisible !== false || rule.sourceField)).map((rule) => evaluateCodexRule(day, rule));
  const useCodex = codexState.length > 0;
  const coreBroken = useCodex ? codexState.some((item) => item.rule.critical && item.answered && !item.passed) : ['alcohol-zero', 'sweet-zero'].some((id) => day.goalValues?.[id] === false);
  const allDailyAnswered = useCodex
    ? codexState.filter((item) => item.rule.required !== false).every((item) => item.answered)
    : answered.length === dailyBinary.length;
  const activeCriteria = (criteria || DEFAULT_DAY_CRITERIA).filter((item) => item.active !== false);
  const criterionState = activeCriteria.map((criterion) => {
    const raw = day[criterion.field];
    const parsed = Number(String(raw ?? '').replace(',', '.'));
    const answered = criterion.operator === 'text' ? String(raw || '').trim().length > 0 : raw !== '' && raw !== null && raw !== undefined && Number.isFinite(parsed) && parsed >= 0;
    const passed = answered && (criterion.operator === 'text' ? String(raw).trim().length >= number(criterion.target) : criterion.operator === 'max' ? number(raw) <= number(criterion.target) : number(raw) >= number(criterion.target));
    return { criterion, answered, passed };
  });
  const healthComplete = criterionState.filter((item) => item.criterion.required).every((item) => item.answered);
  const evidenceComplete = day.evidence?.trim().length >= 5;
  const actionsComplete = (day.actions || []).every(isActionComplete);
  const courageComplete = (day.courageMoments || []).every(isCourageComplete);
  const returnComplete = useCodex || !coreBroken || day.returnContext?.trim().length >= 3;
  const evidenceRequired = activeCriteria.some((item) => item.field === 'evidence' && item.required);
  const canClose = allDailyAnswered && healthComplete && (!evidenceRequired || evidenceComplete) && actionsComplete && courageComplete && returnComplete;
  const actionCount = (day.actions || []).filter(isActionComplete).length;
  const courageCount = (day.courageMoments || []).filter(isCourageComplete).length;
  const criteriaWeight = criterionState.reduce((sum, item) => sum + number(item.criterion.weight), 0);
  const criteriaScore = criterionState.reduce((sum, item) => sum + (item.passed ? number(item.criterion.weight) : 0), 0);
  const codexPassed = codexState.filter((item) => item.passed).length;
  const dailyScore = useCodex ? (codexPassed / codexState.length) * 50 : dailyBinary.length ? (kept.length / dailyBinary.length) * 30 : 30;
  const criteriaShare = useCodex ? 40 : 60;
  const score = Math.min(100, Math.round(dailyScore + (criteriaWeight ? criteriaScore / criteriaWeight * criteriaShare : criteriaShare) + Math.min(10, actionCount * 5 + courageCount * 5)));
  const blockers = [];
  if (!allDailyAnswered) blockers.push(useCodex ? `Отметь правила Кодекса (${codexState.filter((item) => item.answered).length}/${codexState.filter((item) => item.rule.required !== false).length})` : `Отметь ежедневные цели (${answered.length}/${dailyBinary.length})`);
  criterionState.filter((item) => item.criterion.required && !item.answered).forEach((item) => blockers.push(`Заполни: ${item.criterion.label}`));
  if (evidenceRequired && !evidenceComplete) blockers.push('Запиши победу дня');
  if (!actionsComplete) blockers.push('Заверши или удали добавленный факт действия');
  if (!courageComplete) blockers.push('Заверши или удали добавленную ситуацию');
  if (!returnComplete) blockers.push('Коротко зафиксируй контекст возврата');
  if (!canClose) return { id: 'draft', title: 'День в процессе', short: 'Черновик', xp: 0, score, canClose, blockers, color: '#94a3b8', pale: '#f1f5f9' };
  const codexRate = useCodex ? codexPassed / codexState.length : 1;
  let result = coreBroken || codexRate < 0.5 || score < number(thresholds.steady) ? DAY_RESULTS.return : score >= number(thresholds.strong) ? DAY_RESULTS.strong : DAY_RESULTS.steady;
  if (!coreBroken && score >= number(thresholds.expansion) && (actionCount > 0 || courageCount > 0)) result = DAY_RESULTS.expansion;
  return { ...result, score, canClose, blockers: [] };
}

function isValidMetric(value, minimum) {
  if (value === '' || value === null || value === undefined) return false;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= minimum;
}

export function hasDayData(day) {
  return Boolean(day.result || day.draftUpdatedAt || day.draftSavedAt || ['weight', 'calories', 'activeCalories', 'steps'].some((key) => day[key] !== '' && day[key] !== null && day[key] !== undefined) || Object.keys(day.goalValues || {}).length || Object.keys(day.codexValues || {}).length || day.evidence?.trim() || day.actions?.length || day.courageMoments?.length);
}

export function getDayResult(day, goals, criteria, thresholds, codexRules = []) {
  if (day.result) return { ...DAY_RESULTS[day.result], score: day.score, xp: day.xp, canClose: true, blockers: [] };
  const evaluation = evaluateDay(day, goals, criteria, thresholds, codexRules);
  return evaluation.canClose ? evaluation : null;
}

export function finalizePastDays(state, currentDate = todayKey(), finalizedAt = new Date().toISOString()) {
  if (!state?.contractAcceptedAt) return state;
  let changed = false;
  const days = state.days.map((day) => {
    if (day.result || day.date >= currentDate || !hasDayData(day)) return day;
    const result = evaluateDay(day, state.goals, state.dayCriteria, state.resultThresholds, state.codexRules);
    if (!result.canClose) return day;
    changed = true;
    return { ...day, result: result.id, score: result.score, xp: result.xp, closedAt: finalizedAt, closureMode: 'automatic', draftSavedAt: day.draftSavedAt || day.draftUpdatedAt || finalizedAt };
  });
  return changed ? { ...state, days, updatedAtClient: finalizedAt } : state;
}

function goalPeriodTarget(goal, eligibleDays) {
  if (goal.type === 'binary') return eligibleDays;
  if (goal.cadence === 'daily') return goal.target * eligibleDays;
  if (goal.cadence === 'weekly') return goal.target * Math.max(1, Math.ceil(eligibleDays / 7));
  return goal.target;
}

export function calculateGoalStats(goal, days, tasks, elapsedDayNumber) {
  const eligible = days.filter((day) => day.day >= goal.createdDay && day.day <= elapsedDayNumber);
  const recorded = eligible.filter((day) => day.result || day.draftSavedAt || Object.hasOwn(day.goalValues || {}, goal.id));
  const values = recorded.map((day) => ({ day: day.day, value: goal.type === 'binary' ? (day.goalValues?.[goal.id] === true ? 1 : 0) : number(day.goalValues?.[goal.id]) }));
  const achieved = values.reduce((sum, item) => sum + item.value, 0);
  const target = goalPeriodTarget(goal, eligible.length);
  const completedTasks = tasks.filter((task) => task.goalId === goal.id && task.completedDay).length;
  const actionCount = eligible.reduce((sum, day) => sum + (day.actions || []).filter((action) => action.goalId === goal.id && isActionComplete(action)).length, 0);
  let streak = 0;
  if (goal.cadence === 'daily') {
    [...eligible].reverse().some((day) => {
      const value = goal.type === 'binary' ? day.goalValues?.[goal.id] === true : number(day.goalValues?.[goal.id]) >= goal.target;
      if (value) { streak += 1; return false; }
      return Boolean(day.result);
    });
  }
  const cumulative = [];
  values.reduce((sum, item) => {
    const next = sum + item.value;
    cumulative.push({ day: item.day, value: next });
    return next;
  }, 0);
  return {
    goal,
    achieved,
    target,
    progress: target ? Math.min(100, Math.round((achieved / target) * 100)) : 0,
    recorded: recorded.length,
    eligible: eligible.length,
    completionRate: recorded.length ? Math.round((values.filter((item) => item.value > 0).length / recorded.length) * 100) : 0,
    streak,
    completedTasks,
    actionCount,
    cumulative,
  };
}

export function calculateCodexStats(rule, days, elapsedDayNumber) {
  const eligible = days
    .filter((day) => day.day <= elapsedDayNumber)
    .filter((day) => (!rule.startDate || rule.startDate <= day.date) && (!rule.endDate || rule.endDate >= day.date));
  const evaluations = eligible.map((day) => ({ day: day.day, date: day.date, ...evaluateCodexRule(day, rule) })).filter((item) => item.answered);
  const passed = evaluations.filter((item) => item.passed).length;
  let streak = 0;
  [...evaluations].reverse().some((item) => {
    if (item.passed) { streak += 1; return false; }
    return true;
  });
  return {
    rule,
    eligible: eligible.length,
    recorded: evaluations.length,
    passed,
    failed: evaluations.length - passed,
    completionRate: evaluations.length ? Math.round((passed / evaluations.length) * 100) : 0,
    streak,
    points: evaluations.map((item) => ({ day: item.day, value: item.passed ? 1 : 0 })),
  };
}

export function calculateWeightProjection(weights, targetWeight, elapsedDayNumber, durationDays = TOTAL_DAYS) {
  const target = number(targetWeight);
  const latest = weights.at(-1);
  if (!latest?.value || !target) return null;
  const remaining = Math.max(0, latest.value - target);
  const first = weights[0];
  const observedSpan = latest.day - first.day;
  const observedDailyChange = observedSpan > 0 ? (latest.value - first.value) / observedSpan : null;
  const trendDays = remaining === 0 ? 0 : observedDailyChange < 0 ? Math.ceil(remaining / Math.abs(observedDailyChange)) : null;
  const duration = normalizeDuration(durationDays);
  const remainingMarathonDays = Math.max(1, duration - elapsedDayNumber);
  const requiredDailyDeficit = remaining > 0 ? Math.ceil((remaining * 7700) / remainingMarathonDays) : 0;
  const scenarios = [
    { id: 'light', title: 'Спокойно', deficit: 300, color: '#0d8fb9' },
    { id: 'steady', title: 'Рабочий темп', deficit: 500, color: '#16a36a' },
    { id: 'fast', title: 'Быстро', deficit: 700, color: '#f06c5f' },
  ].map((scenario) => {
    const days = remaining === 0 ? 0 : Math.ceil((remaining * 7700) / scenario.deficit);
    const finishDay = elapsedDayNumber + days;
    return { ...scenario, days, finishDay, withinMarathon: finishDay <= duration };
  });
  return {
    currentWeight: latest.value,
    target,
    remaining: Number(remaining.toFixed(1)),
    trendDays,
    trendFinishDay: trendDays === null ? null : elapsedDayNumber + trendDays,
    requiredDailyDeficit,
    scenarios,
  };
}

export function calculateStats(state, currentDayIndex, range = '30') {
  const durationDays = normalizeDuration(state.durationDays || state.days?.length);
  const elapsedDayNumber = currentDayIndex + 1;
  const elapsed = state.days.slice(0, elapsedDayNumber);
  const rangeSize = range === 'all' ? durationDays : number(range);
  const visible = elapsed.slice(-rangeSize);
  const recorded = visible.filter(hasDayData);
  const allRecorded = elapsed.filter(hasDayData);
  const closed = elapsed.filter((day) => day.result);
  const credited = elapsed.filter((day) => getDayResult(day, state.goals, state.dayCriteria, state.resultThresholds, state.codexRules));
  const weights = recorded.map((day) => ({ day: day.day, value: number(day.weight) })).filter((item) => item.value);
  const allWeights = allRecorded.map((day) => ({ day: day.day, value: number(day.weight) })).filter((item) => item.value);
  const calories = recorded.map((day) => ({ day: day.day, value: number(day.calories) })).filter((item) => item.value);
  const activity = recorded.filter((day) => isValidMetric(day.activeCalories, 0)).map((day) => ({ day: day.day, value: number(day.activeCalories) }));
  const steps = recorded.filter((day) => isValidMetric(day.steps, 0)).map((day) => ({ day: day.day, value: number(day.steps) }));
  const balances = recorded.map((day) => ({ day: day.day, value: calculateEnergyBalance(day, state.profile) })).filter((item) => item.value !== null);
  const allActions = elapsed.flatMap((day) => (day.actions || []).filter(isActionComplete).map((action) => ({ ...action, day: day.day, date: day.date })));
  const courage = elapsed.flatMap((day) => (day.courageMoments || []).filter(isCourageComplete).map((moment) => ({ ...moment, day: day.day, date: day.date })));
  const goalStats = state.goals.filter((goal) => goal.active !== false || goal.createdDay <= elapsedDayNumber).map((goal) => calculateGoalStats(goal, state.days, state.tasks, elapsedDayNumber));
  const codexStats = (state.codexRules || []).filter((rule) => rule.statsVisible !== false).map((rule) => calculateCodexStats(rule, state.days, elapsedDayNumber));
  const xp = credited.reduce((sum, day) => sum + getDayResult(day, state.goals, state.dayCriteria, state.resultThresholds, state.codexRules).xp, 0);
  const reflections = recorded.filter((day) => day.evidence?.trim().length >= 5);
  const avg = (items) => items.length ? Math.round(items.reduce((sum, item) => sum + item.value, 0) / items.length) : 0;
  return {
    elapsed,
    visible,
    recorded,
    closed,
    credited,
    goalStats,
    codexStats,
    reflections,
    reflectionRate: recorded.length ? Math.round((reflections.length / recorded.length) * 100) : 0,
    weights,
    calories,
    activity,
    steps,
    balances,
    allActions,
    courage,
    xp,
    level: Math.max(1, Math.floor(xp / 700) + 1),
    completionRate: elapsed.length ? Math.round((credited.length / elapsed.length) * 100) : 0,
    avgCalories: avg(calories),
    avgActivity: avg(activity),
    avgSteps: avg(steps),
    avgBalance: avg(balances),
    totalBalance: balances.reduce((sum, item) => sum + item.value, 0),
    firstWeight: weights[0]?.value || 0,
    lastWeight: weights.at(-1)?.value || 0,
    weightDelta: weights.length > 1 ? Number((weights.at(-1).value - weights[0].value).toFixed(1)) : 0,
    weightProjection: calculateWeightProjection(allWeights, state.profile.targetWeight, elapsedDayNumber, durationDays),
    tasksDone: state.tasks.filter((task) => task.completedDay).length,
    tasksOpen: state.tasks.filter((task) => !task.completedDay && task.active !== false).length,
    resultCounts: credited.reduce((acc, day) => { const result = getDayResult(day, state.goals, state.dayCriteria, state.resultThresholds, state.codexRules); return { ...acc, [result.id]: (acc[result.id] || 0) + 1 }; }, {}),
  };
}

export function buildMarathonSummary(state, extras = {}) {
  const normalized = normalizeState(state);
  if (!normalized) return null;
  const totalDays = normalized.durationDays;
  const stats = calculateStats(normalized, totalDays - 1, 'all');
  const greenDays = (stats.resultCounts.strong || 0) + (stats.resultCounts.expansion || 0);
  const redDays = stats.resultCounts.return || 0;
  const yellowDays = stats.resultCounts.steady || 0;
  const completionRate = stats.completionRate;
  const status = completionRate >= 85 ? 'Пройден мощно' : completionRate >= 65 ? 'Курс удержан' : 'Честно завершён';
  return {
    journeyId: normalized.journeyId,
    durationDays: totalDays,
    startDate: normalized.startDate,
    finishDate: normalized.days.at(-1)?.date,
    completedAt: normalized.completedAt || new Date().toISOString(),
    status,
    completionRate,
    greenDays,
    yellowDays,
    redDays,
    recordedDays: stats.recorded.length,
    xp: stats.xp,
    startWeight: stats.firstWeight || null,
    finishWeight: stats.lastWeight || null,
    weightDelta: stats.weightDelta,
    actions: stats.allActions.length,
    courageMoments: stats.courage.length,
    stepsCompleted: Number(extras.stepsCompleted || normalized.completionSummary?.stepsCompleted || 0),
    purpose: normalized.commitments?.purpose || '',
    finalReview: { ...normalized.finalReview },
  };
}

export function buildExport(state, stats) {
  const codexLines = stats.codexStats.map((item) => `- ${item.rule.title}: ${item.passed}/${item.recorded}, соблюдение ${item.completionRate}%, текущая серия ${item.streak}`);
  const dayLines = state.days.filter(hasDayData).map((day) => {
    const result = getDayResult(day, state.goals, state.dayCriteria, state.resultThresholds, state.codexRules);
    const codex = (state.codexRules || []).filter((rule) => rule.scoreEnabled !== false && (!rule.startDate || rule.startDate <= day.date) && (!rule.endDate || rule.endDate >= day.date)).map((rule) => `${rule.title}: ${evaluateCodexRule(day, rule).passed ? 'да' : evaluateCodexRule(day, rule).answered ? 'нет' : '-'}`).join('; ');
    return `- День ${day.day} (${day.date}): ${result?.title || 'Заполнен частично'}, ${result?.score ?? day.score}%, ${result?.xp || 0} очков, ${day.closureMode === 'automatic' ? 'закрыт автоматически' : day.result ? 'закрыт вручную' : 'сохранён'}, вес ${day.weight || '-'}, калории ${day.calories || '-'}, активные ${day.activeCalories || '-'}, шаги ${day.steps || '-'}, Кодекс [${codex}], победа дня: ${day.evidence || '-'}, действия: ${(day.actions || []).map((action) => action.text).join('; ') || '-'}, ситуации: ${(day.courageMoments || []).map((moment) => `${moment.situation} ${moment.before}->${moment.after}`).join('; ') || '-'}`;
  });
  const markdown = [
    `# Марафон ${state.durationDays || state.days.length} дней`,
    '',
    `Старт: ${state.startDate}`,
    `Ради чего: ${state.commitments?.purpose || '-'}`,
    `Обязательства приняты: ${state.commitments?.acceptedAt || '-'}`,
    ...(state.commitments?.items || []).map((item) => `- ${item.title}: ${item.text} (${item.metric})`),
    `Закрыто: ${stats.closed.length}/${stats.elapsed.length}`,
    `Дней с результатом: ${stats.credited.length}; очки: ${stats.xp}`,
    `Вес: ${stats.firstWeight || '-'} -> ${stats.lastWeight || '-'} кг`,
    `Средний энергобаланс: ${stats.avgBalance} ккал`,
    `Карьерное решение: ${state.careerDecision.status}`,
    '',
    '## Мой кодекс',
    ...codexLines,
    `Рефлексия заполнена: ${stats.reflections.length}/${stats.recorded.length} дней (${stats.reflectionRate}%)`,
    '',
    '## Задачи',
    ...state.tasks.map((task) => `- ${task.completedDay ? '[x]' : '[ ]'} ${task.title}${task.goalId ? ` -> ${state.goals.find((goal) => goal.id === task.goalId)?.name || 'цель'}` : ''}${task.completedDay ? `, день ${task.completedDay}` : ''}`),
    '',
    '## Вопрос для анализа',
    'Проанализируй путь без морализаторства. Найди повторяющиеся условия сильных дней и возвратов, динамику каждой цели, связь энергобаланса с весом и ситуации, где действие уменьшало тревогу. Назови три конкретных рычага следующей недели.',
    '',
    '## Дни',
    ...dayLines,
  ].join('\n');
  return { markdown, json: JSON.stringify({ state, stats, exportedAt: new Date().toISOString() }, null, 2) };
}
