import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialState } from '../src/marathon/model.js';
import { addLifeEvent, calculateCharacter, createLifeState, factualPatterns, mergeLifeStates, normalizeLifeState, progressFor, skillBandProgress, skillLevel } from '../src/life/model.js';

test('life foundation contains editable codex, vectors and professional skill tree', () => {
  const state = createLifeState();
  assert.ok(state.rules.length >= 8);
  assert.deepEqual(state.vectors.map((item) => item.id), ['body', 'profession', 'capital']);
  assert.ok(state.skills.length >= 40);
  assert.ok(state.skills.some((item) => item.title === 'Перенос в PROD'));
  assert.equal(state.skillAreas.length, 5);
  assert.ok(state.skills.some((item) => item.areaId === 'creative' && item.group === 'Фотография'));
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

test('descending body goal grows from the starting weight toward the lower target', () => {
  assert.equal(progressFor({ start: 72, current: 72, target: 65 }), 0);
  assert.equal(progressFor({ start: 72, current: 68.5, target: 65 }), 50);
  assert.equal(progressFor({ start: 72, current: 65, target: 65 }), 100);
});

test('skill levels have no ceiling and keep a five-part visual cycle', () => {
  const skill = { level: 0, evidences: Array.from({ length: 100 }, (_, index) => ({ id: `e-${index}` })) };
  assert.equal(skillLevel(skill), 100);
  assert.equal(skillBandProgress(skill), 5);
  assert.equal(skillBandProgress({ level: 101, evidences: [] }), 1);
});

test('version one life data migrates wishes and preserves custom skills', () => {
  const old = createLifeState();
  old.version = 1;
  old.skills.push({ id: 'custom-skill', title: 'Мой навык', group: 'Своя группа', level: 8, evidences: [] });
  old.wishes = [{ id: 'wish-1', title: 'Камера', status: 'bought', purchaseDate: '2026-09-20', purchaseComment: 'Сделано' }];
  const migrated = normalizeLifeState(old);
  assert.equal(migrated.version, 2);
  assert.equal(migrated.skills.find((item) => item.id === 'custom-skill').areaId, 'professional');
  assert.equal(migrated.wishes[0].status, 'fulfilled');
  assert.equal(migrated.wishes[0].completionNote, 'Сделано');
});
