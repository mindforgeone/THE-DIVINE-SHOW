import { addDays, createId, dateFromKey, todayKey } from '../marathon/model.js';

export const STEPS_DOCUMENT_ID = 'steps-v1';
export const STEPS_CACHE_KEY = 'marathon-steps-v1';
export const LEVELS = [
  { id: 'warmup', label: 'Разминка', points: 1, color: '#319b77' },
  { id: 'step', label: 'Шаг', points: 2, color: '#168ca8' },
  { id: 'brave', label: 'Смело', points: 4, color: '#df764a' },
  { id: 'leap', label: 'Рывок', points: 7, color: '#bd6086' },
  { id: 'boss', label: 'Босс', points: 12, color: '#5344a8' },
];
export const ENERGY_STATUSES = [
  { id: 'hanging', label: 'Backlog' },
  { id: 'planned', label: 'Запланировано' },
  { id: 'today', label: 'Сегодня' },
  { id: 'working', label: 'В работе' },
  { id: 'done', label: 'Готово' },
];
export const DEFAULT_CATEGORIES = [
  ['communication', 'Общение'], ['speech', 'Речь'], ['work', 'Работа'],
  ['public', 'Публичность'], ['creative', 'Творчество'], ['life', 'Быт'],
  ['money', 'Деньги'], ['health', 'Здоровье'], ['other', 'Другое'],
];

const INITIAL_TIME = '1970-01-01T00:00:00.000Z';
const empty = () => ({ version: 1, updatedAtClient: INITIAL_TIME, categories: DEFAULT_CATEGORIES.map(([id, name]) => ({ id, name, createdAt: INITIAL_TIME, updatedAt: INITIAL_TIME, archivedAt: null })), steps: [], executions: [], commitments: [], energyTasks: [] });
export const createStepsState = empty;

export function normalizeStepsState(raw) {
  if (raw?.version !== 1) return empty();
  const base = empty();
  return {
    ...base,
    ...raw,
    categories: Array.isArray(raw.categories) ? raw.categories : base.categories,
    steps: Array.isArray(raw.steps) ? raw.steps : [],
    executions: Array.isArray(raw.executions) ? raw.executions : [],
    commitments: Array.isArray(raw.commitments) ? raw.commitments : [],
    energyTasks: Array.isArray(raw.energyTasks) ? raw.energyTasks : [],
  };
}

const time = (item) => Date.parse(item?.updatedAt || item?.completedAt || item?.createdAt || '') || 0;
function mergeItems(remote, local) {
  const merged = new Map();
  for (const item of remote) merged.set(item.id, item);
  for (const item of local) if (!merged.has(item.id) || time(item) > time(merged.get(item.id))) merged.set(item.id, item);
  return [...merged.values()];
}

export function mergeStepsStates(remoteRaw, localRaw) {
  if (!remoteRaw) return normalizeStepsState(localRaw);
  if (!localRaw) return normalizeStepsState(remoteRaw);
  const remote = normalizeStepsState(remoteRaw);
  const local = normalizeStepsState(localRaw);
  return {
    version: 1,
    updatedAtClient: new Date(Math.max(Date.parse(remote.updatedAtClient) || 0, Date.parse(local.updatedAtClient) || 0)).toISOString(),
    categories: mergeItems(remote.categories, local.categories),
    steps: mergeItems(remote.steps, local.steps),
    executions: mergeItems(remote.executions, local.executions),
    commitments: mergeItems(remote.commitments, local.commitments),
    energyTasks: mergeItems(remote.energyTasks, local.energyTasks),
  };
}

export const activeItem = (item) => !item?.archivedAt && !item?.deletedAt;
export const levelFor = (id) => LEVELS.find((level) => level.id === id) || LEVELS[1];
export const categoryName = (state, id, fallback = 'Другое') => state.categories.find((category) => category.id === id)?.name || fallback;
export const validScore = (value) => Number.isInteger(Number(value)) && Number(value) >= 0 && Number(value) <= 10 && String(value).trim() !== '';

export function weekBounds(date = todayKey()) {
  const weekday = (dateFromKey(date).getDay() + 6) % 7;
  const monday = addDays(date, -weekday);
  return { start: monday, end: addDays(monday, 6) };
}

export function takeStep(state, stepId, scope, date = todayKey(), details = {}, now = new Date().toISOString()) {
  if (!state.steps.some((step) => step.id === stepId && activeItem(step))) return state;
  const dueDate = scope === 'week' ? weekBounds(date).end : scope === 'date' ? details.dueDate : date;
  if (!dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return state;
  if (state.commitments.some((item) => item.stepId === stepId && item.status === 'active' && item.scope === scope && item.dueDate === dueDate && !item.deletedAt)) return state;
  return { ...state, commitments: [...state.commitments, { id: createId('commitment'), stepId, scope, dueDate, before: details.before ?? '', prediction: details.prediction || '', status: 'active', createdAt: now, updatedAt: now, completedAt: null }] };
}

export function completeStep(state, stepId, answers, now = new Date().toISOString(), date = todayKey()) {
  const step = state.steps.find((item) => item.id === stepId && activeItem(item));
  if (!step || !['before', 'during', 'after'].every((field) => validScore(answers[field]))) return state;
  const level = levelFor(step.difficulty);
  const commitment = state.commitments.find((item) => item.stepId === stepId && item.status === 'active' && !item.deletedAt);
  const execution = {
    id: createId('execution'), stepId, commitmentId: commitment?.id || null,
    title: step.title, categoryId: step.categoryId,
    difficulty: level.id, points: level.points,
    before: Number(answers.before), during: Number(answers.during), after: Number(answers.after),
    reality: answers.reality?.trim() || '', repeat: answers.repeat || 'unknown',
    prediction: commitment?.prediction || answers.prediction?.trim() || '',
    date, completedAt: now, createdAt: now, updatedAt: now, deletedAt: null,
  };
  return {
    ...state,
    executions: [...state.executions, execution],
    commitments: commitment ? state.commitments.map((item) => item.id === commitment.id ? { ...item, status: 'completed', completedAt: now, updatedAt: now } : item) : state.commitments,
  };
}

export function currentBoss(state) {
  const bosses = state.steps.filter((step) => activeItem(step) && step.difficulty === 'boss');
  return bosses.find((step) => state.commitments.some((item) => item.stepId === step.id && item.status === 'active')) || bosses.find((step) => !state.executions.some((item) => item.stepId === step.id && !item.deletedAt)) || null;
}

export function periodBounds(period, date = todayKey(), firstDate = date) {
  if (period === 'all') return { start: firstDate < date ? firstDate : date, end: date, previous: null };
  if (period === 'today') return { start: date, end: date, previous: { start: addDays(date, -1), end: addDays(date, -1) } };
  if (period === 'week') {
    const { start, end } = weekBounds(date);
    return { start, end, previous: { start: addDays(start, -7), end: addDays(start, -1) } };
  }
  const parts = date.split('-').map(Number);
  const year = parts[0];
  const month = parts[1];
  const startMonth = period === 'quarter' ? Math.floor((month - 1) / 3) * 3 + 1 : period === 'year' ? 1 : month;
  const months = period === 'year' ? 12 : period === 'quarter' ? 3 : 1;
  const start = `${year}-${String(startMonth).padStart(2, '0')}-01`;
  const endDay = new Date(year, startMonth - 1 + months, 0);
  const end = `${endDay.getFullYear()}-${String(endDay.getMonth() + 1).padStart(2, '0')}-${String(endDay.getDate()).padStart(2, '0')}`;
  const previousStartDate = new Date(year, startMonth - 1 - months, 1);
  const previousStart = `${previousStartDate.getFullYear()}-${String(previousStartDate.getMonth() + 1).padStart(2, '0')}-01`;
  return { start, end, previous: { start: previousStart, end: addDays(start, -1) } };
}

function summarize(executions) {
  const byLevel = Object.fromEntries(LEVELS.map((level) => [level.id, 0]));
  const byCategory = {};
  const perStep = new Map();
  const perDay = {};
  for (const execution of executions) {
    byLevel[execution.difficulty] = (byLevel[execution.difficulty] || 0) + 1;
    byCategory[execution.categoryId] = (byCategory[execution.categoryId] || 0) + 1;
    perStep.set(execution.stepId, (perStep.get(execution.stepId) || 0) + 1);
    perDay[execution.date] = (perDay[execution.date] || 0) + 1;
  }
  return {
    count: executions.length,
    points: executions.reduce((sum, execution) => sum + Number(execution.points || 0), 0),
    byLevel, byCategory, perDay,
    distinct: perStep.size,
    repeats: [...perStep.values()].reduce((sum, count) => sum + Math.max(0, count - 1), 0),
    activeDays: Object.keys(perDay).length,
  };
}

export function achievementsFor(state) {
  const executions = state.executions.filter((item) => !item.deletedAt).sort((a, b) => a.completedAt.localeCompare(b.completedAt));
  const boss = executions.filter((item) => item.difficulty === 'boss');
  const days = [...new Set(executions.map((item) => item.date))];
  const repeat = executions.find((item, index) => ['brave', 'leap', 'boss'].includes(item.difficulty) && executions.slice(0, index).some((earlier) => earlier.stepId === item.stepId));
  return [
    ['first', 'Первый шаг', executions[0]?.completedAt],
    ['ten', '10 шагов', executions[9]?.completedAt],
    ['fifty', '50 шагов', executions[49]?.completedAt],
    ['hundred', '100 шагов', executions[99]?.completedAt],
    ['first-boss', 'Первый Босс', boss[0]?.completedAt],
    ['five-bosses', '5 Боссов', boss[4]?.completedAt],
    ['brave-repeat', 'Повторил сложное', repeat?.completedAt],
    ['seven-days', '7 активных дней', days[6]],
  ].map(([id, title, earnedAt]) => ({ id, title, earnedAt: earnedAt || null }));
}

export function calculateStepsStats(state, period = 'week', date = todayKey()) {
  const executions = state.executions.filter((item) => !item.deletedAt);
  const firstDate = [...executions.map((item) => item.date), ...state.commitments.map((item) => item.createdAt?.slice(0, 10)), ...state.energyTasks.map((item) => item.createdAt?.slice(0, 10)), date].filter(Boolean).sort()[0];
  const bounds = periodBounds(period, date, firstDate);
  const within = (value, range = bounds) => value && value >= range.start && value <= range.end;
  const currentExecutions = executions.filter((item) => within(item.date));
  const previousExecutions = bounds.previous ? executions.filter((item) => within(item.date, bounds.previous)) : [];
  const current = summarize(currentExecutions);
  const previous = summarize(previousExecutions);
  const commitments = state.commitments.filter((item) => !item.deletedAt && within(item.createdAt?.slice(0, 10)));
  const energyDone = state.energyTasks.filter((item) => !item.deletedAt && item.status === 'done' && within(item.completedAt?.slice(0, 10)));
  const actualOrEstimate = (actual, estimate) => Number(actual === '' || actual === null || actual === undefined ? estimate || 0 : actual);
  const days = [];
  for (let cursor = bounds.start; cursor <= bounds.end && days.length < 3660; cursor = addDays(cursor, 1)) {
    if (cursor > date) break;
    days.push({ date: cursor, count: current.perDay[cursor] || 0 });
  }
  return {
    period, bounds, current, previous,
    delta: current.count - previous.count,
    commitments: { total: commitments.length, done: commitments.filter((item) => item.status === 'completed').length, rate: commitments.length ? Math.round(commitments.filter((item) => item.status === 'completed').length / commitments.length * 100) : null },
    energy: { count: energyDone.length, minutes: energyDone.reduce((sum, item) => sum + actualOrEstimate(item.actualMinutes, item.estimatedMinutes), 0), cost: energyDone.reduce((sum, item) => sum + actualOrEstimate(item.actualCost, item.estimatedCost), 0) },
    days, achievements: achievementsFor(state),
  };
}

export function historyForStep(state, stepId) {
  const history = state.executions.filter((item) => item.stepId === stepId && !item.deletedAt).sort((a, b) => a.completedAt.localeCompare(b.completedAt));
  const average = (field) => history.length ? Math.round(history.reduce((sum, item) => sum + Number(item[field]), 0) / history.length * 10) / 10 : null;
  return { history, count: history.length, first: history[0]?.date || null, last: history.at(-1)?.date || null, avgBefore: average('before'), avgAfter: average('after') };
}

export function loadStepsCache(uid) {
  try { return JSON.parse(localStorage.getItem(`${STEPS_CACHE_KEY}:${uid}`) || 'null'); } catch { return null; }
}

export function saveStepsCache(uid, state) {
  try { localStorage.setItem(`${STEPS_CACHE_KEY}:${uid}`, JSON.stringify(state)); return true; } catch { return false; }
}
