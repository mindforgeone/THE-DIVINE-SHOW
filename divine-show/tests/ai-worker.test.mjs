import test from 'node:test';
import assert from 'node:assert/strict';
import { ANALYSIS_SCHEMA, buildSystemPrompt, handleRequest, parseAiPayload } from '../ai-worker/src/index.js';

const env = {
  ADMIN_UID: 'admin',
  FIREBASE_API_KEY: 'test',
  AI: { run: async () => ({}) },
  ALLOWED_ORIGINS: 'https://mindforgeone.github.io',
};

function fakeD1() {
  const rows = new Map();
  return {
    prepare(sql) {
      let args = [];
      return {
        bind(...values) { args = values; return this; },
        async first() { return rows.get(`${args[0]}:${args[1]}`) || null; },
        async run() {
          if (sql.startsWith('UPDATE')) {
            const [payload, revision, updatedAt, uid, resource, expected] = args;
            const key = `${uid}:${resource}`;
            const current = rows.get(key);
            if (!current || current.revision !== expected) return { meta: { changes: 0 } };
            rows.set(key, { payload, revision, updated_at: updatedAt });
            return { meta: { changes: 1 } };
          }
          const [uid, resource, revision, payload, updatedAt] = args;
          const key = `${uid}:${resource}`;
          if (rows.has(key)) return { meta: { changes: 0 } };
          rows.set(key, { payload, revision, updated_at: updatedAt });
          return { meta: { changes: 1 } };
        },
      };
    },
  };
}

test('analyst schema requires evidence, hypotheses and measurable priorities', () => {
  assert.equal(ANALYSIS_SCHEMA.additionalProperties, false);
  assert.ok(ANALYSIS_SCHEMA.required.includes('facts'));
  assert.ok(ANALYSIS_SCHEMA.required.includes('hypotheses'));
  assert.ok(ANALYSIS_SCHEMA.required.includes('priorities'));
  assert.equal(ANALYSIS_SCHEMA.properties.priorities.items.properties.metric.type, 'string');
  assert.match(buildSystemPrompt(), /только по-русски/i);
  assert.match(buildSystemPrompt(), /Не придумывай/i);
  assert.match(buildSystemPrompt(), /plateau равно false/i);
});

test('worker parses both Workers AI object and chat payloads', () => {
  const analysis = { headline: 'Курс держится', summary: 'Есть факты', facts: [], hypotheses: [], priorities: [] };
  assert.deepEqual(parseAiPayload({ response: analysis }), analysis);
  assert.deepEqual(parseAiPayload({ choices: [{ message: { content: JSON.stringify(analysis) } }] }), analysis);
});

test('worker rejects foreign origins before touching authentication', async () => {
  const response = await handleRequest(new Request('https://worker.example/analyze', {
    method: 'POST',
    headers: { Origin: 'https://attacker.example', Authorization: 'Bearer stolen' },
    body: '{}',
  }), env);
  assert.equal(response.status, 403);
});

test('worker rejects anonymous requests from the allowed app', async () => {
  const response = await handleRequest(new Request('https://worker.example/analyze', {
    method: 'POST',
    headers: { Origin: 'https://mindforgeone.github.io' },
    body: '{}',
  }), env);
  assert.equal(response.status, 401);
});

test('worker rejects a valid Firebase session that is not the administrator', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ users: [{ localId: 'member' }] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  }));
  const response = await handleRequest(new Request('https://worker.example/analyze', {
    method: 'POST',
    headers: { Origin: 'https://mindforgeone.github.io', Authorization: 'Bearer valid-member-token' },
    body: JSON.stringify({ snapshot: { schemaVersion: 1 } }),
  }), env);
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, 'Аналитик доступен только администратору.');
});

test('sync storage isolates by verified uid and rejects stale writes', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ users: [{ localId: 'member-1' }] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  }));
  const syncEnv = { ...env, SYNC_DB: fakeD1() };
  const headers = { Origin: 'https://mindforgeone.github.io', Authorization: 'Bearer valid-member-token', 'Content-Type': 'application/json' };
  const endpoint = 'https://worker.example/sync/v1/marathon';

  const empty = await handleRequest(new Request(endpoint, { method: 'GET', headers }), syncEnv);
  assert.deepEqual(await empty.json(), { payload: null, revision: 0, updatedAt: null });

  const saved = await handleRequest(new Request(endpoint, { method: 'PUT', headers, body: JSON.stringify({ baseRevision: 0, payload: { state: { journeyId: 'one' } } }) }), syncEnv);
  assert.equal(saved.status, 200);
  assert.equal((await saved.json()).revision, 1);

  const loaded = await handleRequest(new Request(endpoint, { method: 'GET', headers }), syncEnv);
  assert.equal((await loaded.json()).payload.state.journeyId, 'one');

  const conflict = await handleRequest(new Request(endpoint, { method: 'PUT', headers, body: JSON.stringify({ baseRevision: 0, payload: { state: { journeyId: 'stale' } } }) }), syncEnv);
  assert.equal(conflict.status, 409);
  assert.equal((await conflict.json()).payload.state.journeyId, 'one');
});
