import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import {
  TOTAL_DAYS, createInitialState, evaluateDay, finalizePastDays, calculateStats,
  buildExport, updateDayDraft, mergeStates, saveCachedState, loadCachedState,
} from '../src/marathon/model.js';
import { START_COMMITMENTS, acceptCommitments } from '../src/marathon/commitments.js';
import { resolveAccountStorage } from '../src/marathon/accountStorage.js';

const START = '2026-09-06';
const MORNING = '2026-09-06T07:00:00.000Z';
const EVENING = '2026-09-06T18:00:00.000Z';
const NEXT = '2026-09-07T07:00:00.000Z';
const makeState = () => createInitialState(START, MORNING);
const completeDay = (state, index = 0, patch = {}) => updateDayDraft(state.days[index], {
  weight: '69.6', calories: '1850', activeCalories: '400', steps: '9000', evidence: 'Made one useful step toward a goal.',
  actions: [], courageMoments: [], returnContext: '',
  goalValues: { 'alcohol-zero': true, 'sweet-zero': true, 'daily-action': true }, ...patch,
}, EVENING);

test('all commitments and a personal purpose must be explicitly accepted', () => {
  const checked = Object.fromEntries(START_COMMITMENTS.map((item) => [item.id, true]));
  assert.equal(acceptCommitments({}, 'A meaningful personal purpose', MORNING), null);
  assert.equal(acceptCommitments(checked, 'short', MORNING), null);
  assert.equal(acceptCommitments({ ...checked, nutrition: false }, 'A meaningful personal purpose', MORNING), null);
  const accepted = acceptCommitments(checked, '  Act freely and stay healthy  ', MORNING);
  assert.equal(accepted.items.length, 6);
  assert.equal(accepted.purpose, 'Act freely and stay healthy');
  assert.equal(accepted.acceptedAt, MORNING);
  assert.ok(accepted.items.every((item) => item.accepted));
});

test('reset isolates only the requested account and preserves other account paths', async () => {
  const expectedHash = createHash('sha256').update('owner@example.test').digest('hex');
  const owner = await resolveAccountStorage({ email: ' OWNER@example.test ' }, expectedHash);
  const other = await resolveAccountStorage({ email: 'other@example.test' });
  assert.equal(owner.resetRequested, true);
  assert.ok(owner.oldDocumentIds.includes('marathon120-v9'));
  assert.equal(other.resetRequested, false);
  assert.equal(other.documentId, 'marathon120-v9');
  assert.notEqual(owner.cacheNamespace, other.cacheNamespace);
});

test('complete current day earns color and points without locking or clicking save', () => {
  const state = makeState();
  state.days[0] = completeDay(state);
  const untouched = finalizePastDays(state, START, EVENING);
  assert.strictEqual(untouched, state);
  assert.equal(state.days[0].result, null);
  const stats = calculateStats(state, 0, 'all');
  assert.equal(stats.credited.length, 1);
  assert.equal(stats.closed.length, 0);
  assert.equal(stats.xp, 100);
  assert.equal(stats.resultCounts.strong, 1);
  assert.match(buildExport(state, stats).markdown, /100/);
});

test('midnight or later reopen closes every complete past day exactly once', () => {
  const state = makeState();
  state.days[0] = completeDay(state);
  state.days[1] = completeDay(state, 1, { calories: '2500' });
  const result = finalizePastDays(state, '2026-09-09', NEXT);
  assert.equal(result.days[0].result, 'strong');
  assert.equal(result.days[1].result, 'steady');
  assert.equal(result.days[0].closureMode, 'automatic');
  assert.equal(result.days[2].result, null);
  assert.equal(calculateStats(result, 3, 'all').xp, 155);
  assert.strictEqual(finalizePastDays(result, '2026-09-09', NEXT), result);
  assert.equal(calculateStats(result, 3, 'all').xp, 155);
});

test('return and expansion use exactly the same grading for automatic and manual close', () => {
  const state = makeState();
  state.days[0] = completeDay(state, 0, { goalValues: { 'alcohol-zero': false, 'sweet-zero': true, 'daily-action': true }, returnContext: 'A difficult social situation' });
  state.days[1] = completeDay(state, 1, { actions: [{ id: 'a', goalId: 'kontur-value', text: 'Completed a useful task' }] });
  const expected = state.days.slice(0, 2).map((day) => evaluateDay(day, state.goals));
  const closed = finalizePastDays(state, '2026-09-09', NEXT);
  expected.forEach((grade, index) => {
    assert.equal(closed.days[index].result, grade.id);
    assert.equal(closed.days[index].score, grade.score);
    assert.equal(closed.days[index].xp, grade.xp);
  });
  assert.equal(closed.days[0].result, 'return');
  assert.equal(closed.days[1].result, 'expansion');
});

test('partial entries survive, appear in stats/export, and missing activity is not counted as zero', () => {
  const state = makeState();
  state.days[0] = updateDayDraft(state.days[0], { weight: '69.4' }, MORNING);
  const result = finalizePastDays(state, '2026-09-07', NEXT);
  assert.equal(result.days[0].result, null);
  const stats = calculateStats(result, 1, 'all');
  assert.equal(stats.weights.length, 1);
  assert.equal(stats.activity.length, 0);
  assert.equal(stats.steps.length, 0);
  assert.equal(stats.xp, 0);
  assert.match(buildExport(result, stats).markdown, /69.4/);
});

test('empty, invalid or unfinished entries never silently become a green day', () => {
  const state = makeState();
  for (const patch of [{ steps: '' }, { activeCalories: '-1' }, { steps: 'not-a-number' }, { evidence: '' }, { actions: [{ id: 'unfinished', text: '' }] }]) {
    state.days[0] = completeDay(state, 0, patch);
    assert.equal(finalizePastDays(state, '2026-09-07', NEXT).days[0].result, null);
  }
  state.days[0] = completeDay(state, 0, { steps: '0', activeCalories: '0' });
  assert.equal(finalizePastDays(state, '2026-09-07', NEXT).days[0].result, 'strong');
});

test('missing weekly reflection does not erase an earned daily result; day 120 also settles', () => {
  const state = makeState();
  state.days[6] = completeDay(state, 6);
  state.days[119] = completeDay(state, 119);
  const result = finalizePastDays(state, '2027-02-01', NEXT);
  assert.equal(result.days.length, TOTAL_DAYS);
  assert.equal(result.days[6].result, 'strong');
  assert.equal(result.days[119].result, 'strong');
  assert.equal(result.weeklyReviews[0].victories, '');
});

test('different offline fields merge without losing the morning weight', () => {
  const remote = makeState();
  const local = structuredClone(remote);
  remote.days[0] = updateDayDraft(remote.days[0], { weight: '69.1' }, MORNING);
  local.days[0] = updateDayDraft(local.days[0], { calories: '1950' }, EVENING);
  const merged = mergeStates(remote, local);
  assert.equal(merged.days[0].weight, '69.1');
  assert.equal(merged.days[0].calories, '1950');
  const cleared = structuredClone(merged);
  cleared.days[0] = updateDayDraft(cleared.days[0], { weight: '' }, NEXT);
  assert.equal(mergeStates(merged, cleared).days[0].weight, '');
});

test('later offline input recalculates automatic result but cannot change a manual lock', () => {
  const initial = makeState();
  initial.days[0] = completeDay(initial);
  const closed = finalizePastDays(initial, '2026-09-07', NEXT);
  const offline = structuredClone(initial);
  offline.days[0] = updateDayDraft(offline.days[0], { calories: '2600' }, '2026-09-06T20:00:00.000Z');
  const merged = finalizePastDays(mergeStates(closed, offline), '2026-09-07', NEXT);
  assert.equal(merged.days[0].result, 'steady');
  assert.equal(merged.days[0].xp, 55);
  closed.days[0].closureMode = 'manual';
  assert.equal(mergeStates(closed, offline).days[0].calories, '1850');
});

test('accepted cloud start cannot be replaced by a second device', () => {
  const remote = makeState();
  const duplicate = makeState();
  duplicate.startDate = '2026-09-09';
  duplicate.updatedAtClient = '2030-01-01T00:00:00.000Z';
  assert.equal(mergeStates(remote, duplicate).journeyId, remote.journeyId);
});

test('local save restores an unfinished entry and namespaces do not mix', () => {
  const memory = new Map();
  globalThis.localStorage = { getItem: (key) => memory.get(key) || null, setItem: (key, value) => memory.set(key, value) };
  try {
    const state = makeState();
    state.days[0] = updateDayDraft(state.days[0], { weight: '68.9' }, MORNING);
    assert.equal(saveCachedState('user', state, 'new-history'), true);
    assert.equal(loadCachedState('user', 'new-history').days[0].weight, '68.9');
    assert.equal(loadCachedState('user', 'old-history'), null);
  } finally { delete globalThis.localStorage; }
});
