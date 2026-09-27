import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAiSnapshot, analysisReadiness } from '../src/ai/analytics.js';
import { createInitialState } from '../src/marathon/model.js';
import { createLifeState } from '../src/life/model.js';
import { createStepsState } from '../src/steps/model.js';

function preparedState() {
  const state = createInitialState('2026-09-01', '2026-09-01T08:00:00Z', null, 30);
  state.days.slice(0, 14).forEach((day, index) => {
    day.weight = Number((72 - index * 0.05).toFixed(2));
    day.calories = 1800 + (index % 2) * 100;
    day.activeCalories = 350;
    day.steps = 8000 + index * 100;
    day.evidence = `Победа ${index + 1}`;
    day.draftSavedAt = `2026-09-${String(index + 1).padStart(2, '0')}T20:00:00Z`;
    day.codexValues = Object.fromEntries(state.codexRules.map((rule) => [rule.id, rule.type === 'limit' ? day.calories : true]));
  });
  return state;
}

test('AI snapshot separates deterministic body facts from future interpretation', () => {
  const state = preparedState();
  const stats = { elapsed: state.days.slice(0, 14) };
  const snapshot = buildAiSnapshot({ state, stats, lifeState: createLifeState(), stepsState: createStepsState(), period: 'week' });
  assert.equal(snapshot.dataQuality.recordedDays, 7);
  assert.equal(snapshot.current.body.weightRecords, 7);
  assert.ok(snapshot.current.body.weightTrend.weeklyKg < 0);
  assert.equal(snapshot.current.body.plateau, false);
  assert.equal(snapshot.changeFromPrevious.available, true);
  assert.equal(snapshot.current.codex.length, state.codexRules.filter((rule) => rule.statsVisible !== false).length);
  assert.equal(analysisReadiness(snapshot).ready, true);
});

test('plateau is never declared from a short or sparse period', () => {
  const state = preparedState();
  state.days.slice(0, 14).forEach((day) => { day.weight = 72; });
  const stats = { elapsed: state.days.slice(0, 14) };
  const week = buildAiSnapshot({ state, stats, period: 'week' });
  const full = buildAiSnapshot({ state, stats, period: 'all' });
  assert.equal(week.current.body.plateau, false);
  assert.equal(full.current.body.plateau, true);
});

test('empty journey refuses a fabricated analysis', () => {
  const state = createInitialState('2026-09-01', '2026-09-01T08:00:00Z', null, 30);
  const snapshot = buildAiSnapshot({ state, stats: { elapsed: state.days.slice(0, 1) }, period: 'today' });
  assert.equal(snapshot.dataQuality.recordedDays, 0);
  assert.equal(analysisReadiness(snapshot).ready, false);
});

test('expected weight change keeps the sign of both deficit and surplus', () => {
  const deficitState = preparedState();
  deficitState.days.slice(0, 7).forEach((day) => { day.calories = 1200; });
  const deficit = buildAiSnapshot({ state: deficitState, stats: { elapsed: deficitState.days.slice(0, 7) }, period: 'week' });
  assert.ok(deficit.current.body.expectedWeightChange < 0);

  const surplusState = preparedState();
  surplusState.days.slice(0, 7).forEach((day) => { day.calories = 4000; day.activeCalories = 0; });
  const surplus = buildAiSnapshot({ state: surplusState, stats: { elapsed: surplusState.days.slice(0, 7) }, period: 'week' });
  assert.ok(surplus.current.body.expectedWeightChange > 0);
});
