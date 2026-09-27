import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialState } from '../src/marathon/model.js';
import { createLifeState } from '../src/life/model.js';
import { eventsForDate, monthGrid, removePlan, savePlan } from '../src/planning/model.js';

test('plans can be created, completed and deleted without leaving the journey', () => {
  const base = createLifeState();
  const saved = savePlan(base, { title: 'Провести 10 аналитик', horizon: 'marathon', target: 10, current: 1, journeyId: 'journey-1' }, '2026-09-27T10:00:00.000Z');
  assert.equal(saved.plans[0].target, 10);
  const completed = savePlan(saved, { ...saved.plans[0], status: 'done', current: 10 }, '2026-09-28T10:00:00.000Z');
  assert.ok(completed.plans[0].completedAt);
  assert.ok(removePlan(completed, completed.plans[0].id, '2026-09-29T10:00:00.000Z').plans[0].deletedAt);
});

test('calendar always builds six weeks and combines factual events', () => {
  assert.equal(monthGrid('2026-09').length, 42);
  const marathon = createInitialState('2026-09-27', '2026-09-27T08:00:00.000Z', null, 30);
  marathon.days[0].score = 80;
  const life = createLifeState();
  life.skills[0].evidences = [{ id: 'e-1', date: '2026-09-27', text: 'Провёл аналитику' }];
  const events = eventsForDate('2026-09-27', marathon, life, { executions: [] });
  assert.equal(events.count, 2);
  assert.equal(events.evidences[0].title, life.skills[0].title);
});
