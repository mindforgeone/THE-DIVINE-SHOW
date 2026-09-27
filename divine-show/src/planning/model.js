import { addDays, createId, todayKey } from '../marathon/model.js';

export const PLAN_HORIZONS = [
  ['marathon', 'Марафон'], ['month', 'Месяц'], ['week', 'Неделя'], ['day', 'День'],
];

export function savePlan(state, draft, now = new Date().toISOString()) {
  const plan = {
    id: draft.id || createId('plan'),
    journeyId: draft.journeyId || '',
    title: String(draft.title || '').trim(),
    horizon: draft.horizon || 'day',
    target: Math.max(1, Number(draft.target) || 1),
    current: Math.max(0, Number(draft.current) || 0),
    unit: String(draft.unit || '').trim(),
    dueDate: draft.dueDate || '',
    vectorId: draft.vectorId || '',
    skillId: draft.skillId || '',
    wishId: draft.wishId || '',
    status: draft.status || 'active',
    resultNote: String(draft.resultNote || '').trim(),
    completedAt: draft.status === 'done' ? (draft.completedAt || now) : null,
    createdAt: draft.createdAt || now,
    updatedAt: now,
    deletedAt: null,
  };
  const exists = (state.plans || []).some((item) => item.id === plan.id);
  return { ...state, plans: exists ? state.plans.map((item) => item.id === plan.id ? plan : item) : [...(state.plans || []), plan] };
}

export function removePlan(state, id, now = new Date().toISOString()) {
  return { ...state, plans: (state.plans || []).map((plan) => plan.id === id ? { ...plan, deletedAt: now, updatedAt: now } : plan) };
}

export function monthGrid(monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  const first = `${year}-${String(month).padStart(2, '0')}-01`;
  const weekday = (new Date(`${first}T12:00:00`).getDay() + 6) % 7;
  const cells = [];
  for (let offset = -weekday; offset < 42 - weekday; offset += 1) cells.push(addDays(first, offset));
  return cells;
}

export function eventsForDate(date, marathon, life, steps) {
  const day = marathon?.days?.find((item) => item.date === date);
  const executions = (steps?.executions || []).filter((item) => !item.deletedAt && (item.completedAt || '').slice(0, 10) === date);
  const evidences = (life?.skills || []).flatMap((skill) => (skill.evidences || []).filter((item) => !item.deletedAt && item.date === date).map((item) => ({ ...item, title: skill.title, kind: 'evidence' })));
  const wishes = (life?.wishes || []).filter((item) => !item.deletedAt && item.status === 'fulfilled' && item.completedDate === date).map((item) => ({ ...item, kind: 'wish' }));
  const plans = (life?.plans || []).filter((item) => !item.deletedAt && (item.dueDate === date || (item.completedAt || '').slice(0, 10) === date)).map((item) => ({ ...item, kind: 'plan' }));
  return { day, executions, evidences, wishes, plans, count: executions.length + evidences.length + wishes.length + plans.length + (day?.score > 0 ? 1 : 0) };
}

export function defaultDueDate(horizon, marathon) {
  const today = todayKey();
  if (horizon === 'day') return today;
  if (horizon === 'week') return addDays(today, 6);
  if (horizon === 'month') return addDays(today, 29);
  return marathon?.days?.at(-1)?.date || addDays(today, 119);
}
