import test from 'node:test';
import assert from 'node:assert/strict';
import { ANALYSIS_SCHEMA, buildSystemPrompt, handleRequest, parseAiPayload } from '../ai-worker/src/index.js';

const env = {
  ADMIN_UID: 'admin',
  FIREBASE_API_KEY: 'test',
  AI: { run: async () => ({}) },
  ALLOWED_ORIGINS: 'https://mindforgeone.github.io',
};

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
