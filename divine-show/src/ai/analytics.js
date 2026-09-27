import {
  calculateEnergyBalance,
  calculateStats,
  evaluateCodexRule,
  getDayResult,
  hasDayData,
  number,
} from '../marathon/model.js';

export const AI_PERIODS = [
  { id: 'today', label: 'Сегодня', range: 1 },
  { id: 'week', label: '7 дней', range: 7 },
  { id: 'month', label: '30 дней', range: 30 },
  { id: 'all', label: 'Весь путь', range: 'all' },
];

const round = (value, digits = 0) => {
  const scale = 10 ** digits;
  return Math.round((Number(value) || 0) * scale) / scale;
};

const average = (items) => items.length
  ? items.reduce((sum, item) => sum + Number(item || 0), 0) / items.length
  : null;

const active = (item) => !item?.deletedAt && !item?.archivedAt;

function linearTrend(points) {
  if (points.length < 2) return null;
  const xMean = average(points.map((item) => item.day));
  const yMean = average(points.map((item) => item.value));
  const denominator = points.reduce((sum, item) => sum + ((item.day - xMean) ** 2), 0);
  if (!denominator) return null;
  const slope = points.reduce((sum, item) => sum + ((item.day - xMean) * (item.value - yMean)), 0) / denominator;
  return {
    dailyKg: round(slope, 3),
    weeklyKg: round(slope * 7, 2),
  };
}

function rangeDays(elapsed, period) {
  const definition = AI_PERIODS.find((item) => item.id === period) || AI_PERIODS[1];
  return definition.range === 'all' ? elapsed : elapsed.slice(-definition.range);
}

function previousDays(elapsed, period, currentLength) {
  const definition = AI_PERIODS.find((item) => item.id === period) || AI_PERIODS[1];
  if (definition.range === 'all') return [];
  const end = Math.max(0, elapsed.length - currentLength);
  return elapsed.slice(Math.max(0, end - definition.range), end);
}

function summarizeDays(days, state) {
  const recorded = days.filter(hasDayData);
  const metric = (field, allowZero = false) => recorded
    .filter((day) => day[field] !== '' && day[field] !== null && day[field] !== undefined && (allowZero || number(day[field]) > 0))
    .map((day) => ({ day: day.day, date: day.date, value: number(day[field]) }));
  const weights = metric('weight');
  const calories = metric('calories');
  const activity = metric('activeCalories', true);
  const steps = metric('steps', true);
  const balances = recorded
    .map((day) => ({ day: day.day, date: day.date, value: calculateEnergyBalance(day, state.profile) }))
    .filter((item) => item.value !== null);
  const results = recorded
    .map((day) => getDayResult(day, state.goals, state.dayCriteria, state.resultThresholds, state.codexRules))
    .filter(Boolean);
  const strong = results.filter((result) => ['strong', 'expansion'].includes(result.id)).length;
  const weightTrend = linearTrend(weights);
  const weightSpan = weights.length > 1 ? weights.at(-1).day - weights[0].day : 0;
  const plateau = weights.length >= 7 && weightSpan >= 13 && weightTrend && Math.abs(weightTrend.weeklyKg) < 0.15;
  const totalBalance = balances.reduce((sum, item) => sum + item.value, 0);
  const expectedWeightChange = totalBalance / 7700;
  const actualWeightChange = weights.length > 1 ? weights.at(-1).value - weights[0].value : null;
  return {
    expectedDays: days.length,
    recordedDays: recorded.length,
    completeness: days.length ? Math.round((recorded.length / days.length) * 100) : 0,
    dateFrom: days[0]?.date || null,
    dateTo: days.at(-1)?.date || null,
    results: {
      total: results.length,
      strong,
      strongRate: results.length ? Math.round((strong / results.length) * 100) : 0,
      byType: results.reduce((acc, result) => ({ ...acc, [result.id]: (acc[result.id] || 0) + 1 }), {}),
    },
    body: {
      targetWeight: number(state.profile.targetWeight),
      weightRecords: weights.length,
      firstWeight: weights[0]?.value || null,
      lastWeight: weights.at(-1)?.value || null,
      actualWeightChange: actualWeightChange === null ? null : round(actualWeightChange, 2),
      weightTrend,
      plateau: Boolean(plateau),
      plateauRule: 'Не менее 7 измерений за 14 дней и тренд меньше 0,15 кг в неделю.',
      caloriesRecords: calories.length,
      averageCalories: calories.length ? Math.round(average(calories.map((item) => item.value))) : null,
      activityRecords: activity.length,
      averageActiveCalories: activity.length ? Math.round(average(activity.map((item) => item.value))) : null,
      stepsRecords: steps.length,
      averageSteps: steps.length ? Math.round(average(steps.map((item) => item.value))) : null,
      balanceRecords: balances.length,
      averageEnergyBalance: balances.length ? Math.round(average(balances.map((item) => item.value))) : null,
      totalEnergyBalance: Math.round(totalBalance),
      expectedWeightChange: round(expectedWeightChange, 2),
      projection: weights.length ? calculateStats(state, Math.max(0, days.at(-1).day - 1), 'all').weightProjection : null,
      series: { weights, calories, activity, steps, balances },
    },
    recorded,
  };
}

function codexSummary(days, rules) {
  return (rules || [])
    .filter((rule) => rule.active !== false && rule.statsVisible !== false)
    .map((rule) => {
      const evaluations = days
        .filter((day) => (!rule.startDate || rule.startDate <= day.date) && (!rule.endDate || rule.endDate >= day.date))
        .map((day) => evaluateCodexRule(day, rule))
        .filter((item) => item.answered);
      const passed = evaluations.filter((item) => item.passed).length;
      return {
        title: rule.title,
        answered: evaluations.length,
        passed,
        failed: evaluations.length - passed,
        rate: evaluations.length ? Math.round((passed / evaluations.length) * 100) : null,
      };
    });
}

function compare(current, previous) {
  const delta = (a, b, digits = 0) => a === null || b === null ? null : round(a - b, digits);
  return {
    available: previous.recordedDays > 0,
    recordedDays: delta(current.recordedDays, previous.recordedDays),
    strongRate: delta(current.results.strongRate, previous.results.strongRate),
    averageCalories: delta(current.body.averageCalories, previous.body.averageCalories),
    averageActiveCalories: delta(current.body.averageActiveCalories, previous.body.averageActiveCalories),
    averageSteps: delta(current.body.averageSteps, previous.body.averageSteps),
    averageEnergyBalance: delta(current.body.averageEnergyBalance, previous.body.averageEnergyBalance),
    weeklyWeightTrend: delta(current.body.weightTrend?.weeklyKg ?? null, previous.body.weightTrend?.weeklyKg ?? null, 2),
  };
}

function lifeSummary(lifeState) {
  if (!lifeState) return { vectors: [], skillEvidence: [], completedPlans: 0, fulfilledWishes: 0 };
  const skillEvidence = (lifeState.skills || [])
    .filter(active)
    .flatMap((skill) => (skill.evidences || []).map((evidence) => ({
      skill: skill.title,
      group: skill.group,
      title: evidence.title || evidence.text || evidence.note || 'Доказательство развития',
      date: evidence.date || evidence.createdAt || '',
    })))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 20);
  return {
    vectors: (lifeState.vectors || []).filter(active).map((vector) => ({
      title: vector.title,
      start: number(vector.start),
      current: number(vector.current),
      target: number(vector.target),
      unit: vector.unit || '',
      milestone: vector.milestone || '',
    })),
    skillEvidence,
    completedPlans: (lifeState.plans || []).filter((item) => active(item) && item.status === 'done').length,
    fulfilledWishes: (lifeState.wishes || []).filter((item) => active(item) && item.status === 'fulfilled').length,
  };
}

function stepsSummary(stepsState, from, to) {
  if (!stepsState) return { completed: 0, points: 0, recent: [] };
  const executions = (stepsState.executions || [])
    .filter(active)
    .filter((item) => (!from || item.date >= from) && (!to || item.date <= to));
  return {
    completed: executions.length,
    points: executions.reduce((sum, item) => sum + number(item.points), 0),
    averageAnxietyBefore: executions.length ? round(average(executions.map((item) => number(item.before))), 1) : null,
    averageAnxietyAfter: executions.length ? round(average(executions.map((item) => number(item.after))), 1) : null,
    recent: executions.slice(-15).map((item) => ({
      date: item.date,
      title: item.title,
      before: number(item.before),
      during: number(item.during),
      after: number(item.after),
      reality: item.reality || '',
    })),
  };
}

export function buildAiSnapshot({ state, stats, lifeState, stepsState, period = 'week' }) {
  const elapsed = stats?.elapsed || [];
  const currentDays = rangeDays(elapsed, period);
  const priorDays = previousDays(elapsed, period, currentDays.length);
  const current = summarizeDays(currentDays, state);
  const previous = summarizeDays(priorDays, state);
  const victoryNotes = current.recorded
    .filter((day) => day.evidence?.trim())
    .slice(-20)
    .map((day) => ({ day: day.day, date: day.date, text: day.evidence.trim() }));
  const actions = current.recorded
    .flatMap((day) => (day.actions || []).filter((item) => item.text?.trim()).map((item) => ({ day: day.day, date: day.date, text: item.text.trim() })))
    .slice(-20);
  const courage = current.recorded
    .flatMap((day) => (day.courageMoments || []).filter((item) => item.situation?.trim()).map((item) => ({
      day: day.day,
      date: day.date,
      situation: item.situation,
      context: item.context || '',
      before: number(item.before),
      during: number(item.during),
      after: number(item.after),
      action: item.action || '',
    })))
    .slice(-15);
  const weeklyReviews = (state.weeklyReviews || [])
    .filter((review) => Object.values(review).some((value) => typeof value === 'string' && value.trim()))
    .slice(-6)
    .map((review) => ({ week: review.week, happened: review.happened || '', worked: review.worked || '', adjust: review.adjust || '' }));
  const goals = (state.goals || []).filter((goal) => goal.active !== false).map((goal) => ({
    name: goal.name,
    cadence: goal.cadence,
    target: number(goal.target),
    unit: goal.unit || '',
    completedTasks: (state.tasks || []).filter((task) => task.goalId === goal.id && task.completedDay).length,
    openTasks: (state.tasks || []).filter((task) => task.goalId === goal.id && !task.completedDay && task.active !== false).length,
  }));
  const periodDefinition = AI_PERIODS.find((item) => item.id === period) || AI_PERIODS[1];
  const dataLimits = [];
  if (current.recordedDays < Math.min(3, current.expectedDays)) dataLimits.push('Мало заполненных дней для устойчивых выводов.');
  if (current.body.weightRecords < 2) dataLimits.push('Недостаточно измерений веса для тренда.');
  if (current.body.balanceRecords < Math.min(3, current.expectedDays)) dataLimits.push('Энергобаланс рассчитан не для всех дней периода.');
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    period: { id: periodDefinition.id, label: periodDefinition.label, from: current.dateFrom, to: current.dateTo },
    journey: {
      startDate: state.startDate,
      durationDays: state.durationDays || state.days.length,
      elapsedDay: elapsed.length,
      purpose: state.commitments?.purpose || '',
      careerDecision: state.careerDecision?.status || 'pending',
    },
    dataQuality: {
      expectedDays: current.expectedDays,
      recordedDays: current.recordedDays,
      completeness: current.completeness,
      limits: dataLimits,
    },
    current: {
      results: current.results,
      body: current.body,
      codex: codexSummary(currentDays, state.codexRules),
      victoryNotes,
      actions,
      courage,
      weeklyReviews,
      goals,
      tasks: {
        completed: (state.tasks || []).filter((task) => task.completedDay && currentDays.some((day) => day.day === task.completedDay)).length,
        open: (state.tasks || []).filter((task) => !task.completedDay && task.active !== false).length,
      },
      steps: stepsSummary(stepsState, current.dateFrom, current.dateTo),
      course: lifeSummary(lifeState),
    },
    previous: {
      periodAvailable: previous.recordedDays > 0,
      results: previous.results,
      body: previous.body,
    },
    changeFromPrevious: compare(current, previous),
  };
}

export function analysisReadiness(snapshot) {
  if (!snapshot?.dataQuality?.recordedDays) return { ready: false, message: 'Сначала заполни хотя бы один день.' };
  if (snapshot.period.id !== 'today' && snapshot.dataQuality.recordedDays < 3) {
    return { ready: true, message: 'Разбор возможен, но выводы будут предварительными: заполнено меньше трёх дней.' };
  }
  return { ready: true, message: `Для анализа доступно ${snapshot.dataQuality.recordedDays} из ${snapshot.dataQuality.expectedDays} дней.` };
}
