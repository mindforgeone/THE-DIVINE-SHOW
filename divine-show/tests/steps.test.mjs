import test from 'node:test';
import assert from 'node:assert/strict';
import { achievementsFor, calculateStepsStats, completeStep, createStepsState, historyForStep, mergeStepsStates, periodBounds, takeStep } from '../src/steps/model.js';

const stamp = '2026-09-14T12:00:00.000Z';
const makeStep = (id = 'step-1', difficulty = 'brave') => ({ id, title: 'Высказаться на встрече', description: '', notes: '', categoryId: 'work', difficulty, createdAt: stamp, updatedAt: stamp, archivedAt: null, deletedAt: null });

test('a repeated step keeps every execution and freezes historical difficulty and points', () => {
  let state = { ...createStepsState(), steps: [makeStep()] };
  state = takeStep(state, 'step-1', 'today', '2026-09-14', { before: 8, prediction: 'Никто не ответит' }, stamp);
  state = completeStep(state, 'step-1', { before: 8, during: 6, after: 3, reality: 'Ответили спокойно', repeat: 'yes' }, stamp, '2026-09-14');
  assert.equal(state.commitments[0].status, 'completed');
  state.steps[0] = { ...state.steps[0], difficulty: 'warmup', updatedAt: '2026-09-15T12:00:00.000Z' };
  state = completeStep(state, 'step-1', { before: 4, during: 3, after: 1, reality: 'Уже знакомо', repeat: 'yes' }, '2026-09-15T12:00:00.000Z', '2026-09-15');
  assert.deepEqual(state.executions.map((item) => [item.difficulty, item.points]), [['brave', 4], ['warmup', 1]]);
  assert.equal(state.executions[0].prediction, 'Никто не ответит');
  assert.equal(historyForStep(state, 'step-1').count, 2);
  assert.equal(historyForStep(state, 'step-1').avgBefore, 6);
  assert.equal(calculateStepsStats(state, 'all', '2026-09-15').current.points, 5);
});

test('different offline executions and edits merge by id without duplicate points', () => {
  const base = { ...createStepsState(), steps: [makeStep()] };
  const a = completeStep(base, 'step-1', { before: 8, during: 6, after: 4 }, stamp, '2026-09-14');
  const b = completeStep(base, 'step-1', { before: 7, during: 5, after: 2 }, '2026-09-14T13:00:00.000Z', '2026-09-14');
  const merged = mergeStepsStates(a, b);
  assert.equal(merged.executions.length, 2);
  assert.equal(calculateStepsStats(merged, 'today', '2026-09-14').current.points, 8);
  assert.equal(calculateStepsStats(mergeStepsStates(merged, a), 'today', '2026-09-14').current.count, 2);
  const corrected = { ...merged, executions: merged.executions.map((item, index) => index === 0 ? { ...item, before: 3, updatedAt: '2026-09-15T12:00:00.000Z' } : item) };
  assert.equal(mergeStepsStates(merged, corrected).executions.find((item) => item.id === merged.executions[0].id).before, 3);
});

test('deleting a completion removes its derived statistics and achievements', () => {
  const base = { ...createStepsState(), steps: [makeStep()] };
  const done = completeStep(base, 'step-1', { before: 8, during: 7, after: 4 }, stamp, '2026-09-14');
  assert.ok(achievementsFor(done).find((item) => item.id === 'first').earnedAt);
  const removed = { ...done, executions: [{ ...done.executions[0], deletedAt: '2026-09-15T12:00:00.000Z', updatedAt: '2026-09-15T12:00:00.000Z' }] };
  assert.equal(calculateStepsStats(removed, 'all', '2026-09-15').current.points, 0);
  assert.equal(achievementsFor(removed).find((item) => item.id === 'first').earnedAt, null);
});

test('periods and commitments use calendar boundaries', () => {
  assert.deepEqual(periodBounds('week', '2026-09-14'), { start: '2026-09-14', end: '2026-09-20', previous: { start: '2026-09-07', end: '2026-09-13' } });
  assert.deepEqual(periodBounds('month', '2026-09-14'), { start: '2026-09-01', end: '2026-09-30', previous: { start: '2026-08-01', end: '2026-08-31' } });
  assert.deepEqual(periodBounds('quarter', '2026-09-14'), { start: '2026-07-01', end: '2026-09-30', previous: { start: '2026-04-01', end: '2026-06-30' } });
  const base = { ...createStepsState(), steps: [makeStep()] };
  const accepted = takeStep(base, 'step-1', 'week', '2026-09-14', {}, stamp);
  assert.equal(accepted.commitments[0].dueDate, '2026-09-20');
  assert.equal(takeStep(accepted, 'step-1', 'week', '2026-09-14'), accepted, 'The same active commitment is not duplicated');
  assert.equal(calculateStepsStats(accepted, 'week', '2026-09-14').commitments.rate, 0);
  const done = completeStep(accepted, 'step-1', { before: 5, during: 4, after: 2 }, stamp, '2026-09-14');
  assert.equal(calculateStepsStats(done, 'week', '2026-09-14').commitments.rate, 100);
});

test('completed unloading tasks use estimates until actual time and cost are entered', () => {
  const base = createStepsState();
  base.energyTasks = [{ id: 'energy-1', title: 'Позвонить', categoryId: 'life', status: 'done', annoyance: 3, estimatedMinutes: 80, estimatedCost: 500, actualMinutes: '', actualCost: '', createdAt: stamp, updatedAt: stamp, completedAt: stamp }];
  const estimate = calculateStepsStats(base, 'week', '2026-09-14').energy;
  assert.deepEqual(estimate, { count: 1, minutes: 80, cost: 500 });
  base.energyTasks[0] = { ...base.energyTasks[0], actualMinutes: '55', actualCost: '350' };
  assert.deepEqual(calculateStepsStats(base, 'week', '2026-09-14').energy, { count: 1, minutes: 55, cost: 350 });
});
