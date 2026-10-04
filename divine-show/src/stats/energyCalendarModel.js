import {
  addDays,
  calculateEnergyBalance,
  dateFromKey,
  number,
  toDateKey,
} from '../marathon/model.js';

export const ENERGY_KCAL_PER_KG = 7700;

const clampProgress = (value, min, max) => Math.max(min, Math.min(max, value));

export function startOfMonday(key) {
  const date = dateFromKey(key);
  const offset = (date.getDay() + 6) % 7;
  return addDays(key, -offset);
}

export function endOfSunday(key) {
  return addDays(startOfMonday(key), 6);
}

export function monthStart(key) {
  const date = dateFromKey(key);
  return toDateKey(new Date(date.getFullYear(), date.getMonth(), 1));
}

export function monthEnd(key) {
  const date = dateFromKey(key);
  return toDateKey(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

export function yearStart(key) {
  const date = dateFromKey(key);
  return `${date.getFullYear()}-01-01`;
}

export function yearEnd(key) {
  const date = dateFromKey(key);
  return `${date.getFullYear()}-12-31`;
}

export function shiftEnergyAnchor(key, mode, amount) {
  const date = dateFromKey(key);
  if (mode === 'week') date.setDate(date.getDate() + amount * 7);
  if (mode === 'month') date.setMonth(date.getMonth() + amount, 1);
  if (mode === 'year') date.setFullYear(date.getFullYear() + amount, 0, 1);
  return toDateKey(date);
}

export function energyPeriodBounds(key, mode) {
  if (mode === 'week') return { start: startOfMonday(key), end: endOfSunday(key) };
  if (mode === 'year') return { start: yearStart(key), end: yearEnd(key) };
  return { start: monthStart(key), end: monthEnd(key) };
}

function energyEntry(day, profile) {
  if (!day) return null;
  const balance = calculateEnergyBalance(day, profile);
  return {
    date: day.date,
    day: day.day,
    balance,
    calories: number(day.calories) || null,
    activeCalories: day.activeCalories === '' ? null : number(day.activeCalories),
    weight: number(day.weight) || null,
  };
}

export function summarizeEnergyRange(state, start, end, through = end) {
  const eligible = (state.days || []).filter((day) => day.date >= start && day.date <= end && day.date <= through);
  const entries = eligible.map((day) => energyEntry(day, state.profile)).filter((entry) => entry.balance !== null);
  const total = entries.reduce((sum, entry) => sum + entry.balance, 0);
  return {
    start,
    end,
    total,
    recorded: entries.length,
    possible: eligible.length,
    deficit: Math.max(0, -total),
    surplus: Math.max(0, total),
    estimatedKg: Number((-total / ENERGY_KCAL_PER_KG).toFixed(2)),
    entries,
  };
}

export function buildEnergyOverview(state, currentDate) {
  const week = summarizeEnergyRange(state, startOfMonday(currentDate), endOfSunday(currentDate), currentDate);
  const month = summarizeEnergyRange(state, monthStart(currentDate), monthEnd(currentDate), currentDate);
  const journeyEnd = state.days?.at(-1)?.date || currentDate;
  const journeyThrough = currentDate < journeyEnd ? currentDate : journeyEnd;
  const journey = summarizeEnergyRange(state, state.startDate, journeyEnd, journeyThrough);
  const elapsed = (state.days || []).filter((day) => day.date <= journeyThrough);
  const weights = elapsed.map((day) => number(day.weight)).filter(Boolean);
  const startWeight = weights[0] || 0;
  const currentWeight = weights.at(-1) || 0;
  const targetWeight = number(state.profile?.targetWeight);
  const targetKcal = startWeight > targetWeight ? Math.round((startWeight - targetWeight) * ENERGY_KCAL_PER_KG) : 0;
  const remainingKcal = targetKcal ? Math.max(0, targetKcal + journey.total) : 0;
  const progress = targetKcal ? clampProgress(Math.round(((targetKcal - remainingKcal) / targetKcal) * 100), 0, 100) : 0;

  return {
    week,
    month,
    journey,
    startWeight,
    currentWeight,
    targetWeight,
    targetKcal,
    remainingKcal,
    progress,
  };
}

export function buildMonthEnergyCalendar(state, anchorDate, currentDate) {
  const start = monthStart(anchorDate);
  const end = monthEnd(anchorDate);
  const gridStart = startOfMonday(start);
  const gridEnd = endOfSunday(end);
  const dayMap = new Map((state.days || []).map((day) => [day.date, day]));
  const weeks = [];

  for (let weekStart = gridStart; weekStart <= gridEnd; weekStart = addDays(weekStart, 7)) {
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = addDays(weekStart, index);
      const entry = energyEntry(dayMap.get(date), state.profile);
      return {
        date,
        dayNumber: dateFromKey(date).getDate(),
        inPeriod: date >= start && date <= end,
        inJourney: dayMap.has(date),
        future: date > currentDate,
        ...entry,
      };
    });
    const recorded = days.filter((day) => Number.isFinite(day.balance) && day.date <= currentDate);
    const total = recorded.reduce((sum, day) => sum + day.balance, 0);
    weeks.push({
      start: weekStart,
      end: addDays(weekStart, 6),
      days,
      total,
      recorded: recorded.length,
      estimatedKg: Number((-total / ENERGY_KCAL_PER_KG).toFixed(2)),
    });
  }

  return {
    start,
    end,
    weeks,
    summary: summarizeEnergyRange(state, start, end, currentDate),
  };
}

export function buildWeekEnergyCalendar(state, anchorDate, currentDate) {
  const start = startOfMonday(anchorDate);
  const month = buildMonthEnergyCalendar(state, start, currentDate);
  return month.weeks.find((week) => week.start === start) || {
    start,
    end: addDays(start, 6),
    days: [],
    total: 0,
    recorded: 0,
    estimatedKg: 0,
  };
}

export function buildYearEnergyCalendar(state, anchorDate, currentDate) {
  const year = dateFromKey(anchorDate).getFullYear();
  return Array.from({ length: 12 }, (_, month) => buildMonthEnergyCalendar(
    state,
    toDateKey(new Date(year, month, 1)),
    currentDate,
  ));
}
