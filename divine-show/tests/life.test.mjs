import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialState } from '../src/marathon/model.js';
import { addLifeEvent, calculateCharacter, createLifeState, factualPatterns, mergeLifeStates } from '../src/life/model.js';

test('life foundation contains editable codex, vectors and professional skill tree', () => {
  const state = createLifeState();
  assert.ok(state.rules.length >= 8);
  assert.deepEqual(state.vectors.map((item) => item.id), ['body', 'profession', 'capital']);
  assert.ok(state.skills.length >= 40);
  assert.ok(state.skills.some((item) => item.title === 'Перенос в PROD'));
});

test('offline life records merge by id without losing independent entities', () => {
  const base = createLifeState();
  const first = addLifeEvent(base, { title: 'Первое событие', date: '2026-09-24' }, '2026-09-24T08:00:00Z');
  const second = addLifeEvent(base, { title: 'Второе событие', date: '2026-09-24' }, '2026-09-24T09:00:00Z');
  const merged = mergeLifeStates(first, second);
  assert.equal(merged.events.length, 2);
});

test('character is derived from evidence and patterns refuse premature conclusions', () => {
  const life = createLifeState();
  const marathon = createInitialState('2026-09-24', '2026-09-24T08:00:00Z');
  const character = calculateCharacter(life, marathon, { executions: [] });
  assert.equal(character.attributes.length, 6);
  assert.match(factualPatterns(marathon)[0].text, /недостаточно данных/i);
});
