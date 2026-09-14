import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { CLOUD_DOCUMENT_ID, LEGACY_DOCUMENT_IDS } from '../src/marathon/model.js';
import { resolveAccountStorage } from '../src/marathon/accountStorage.js';
import { createHash } from 'node:crypto';

// The Rules API evaluates synthetic requests, without executing document writes.
// Keep CLI authentication inside its own client; never print or store its tokens.
const require = createRequire(import.meta.url);
const cli = process.env.FIREBASE_TOOLS_PATH || 'firebase-tools';
const { getGlobalDefaultAccount } = require(`${cli}/lib/auth`);
const { requireAuth } = require(`${cli}/lib/requireAuth`);
const { Client } = require(`${cli}/lib/apiv2`);
const rulesApi = require(`${cli}/lib/gcp/rules`);
const project = 'divine-show-db';
await requireAuth({ ...getGlobalDefaultAccount(), project });
const client = new Client({ urlPrefix: 'https://firebaserules.googleapis.com', apiVersion: 'v1' });

let files;
let rulesetName;
if (process.argv.includes('--deployed')) {
  const releases = await rulesApi.listAllReleases(project);
  const release = releases.find((item) => item.name === `projects/${project}/releases/cloud.firestore`);
  assert.ok(release, 'Default database rules must be deployed');
  rulesetName = release.rulesetName;
  files = await rulesApi.getRulesetContent(rulesetName);
} else {
  files = [{ name: 'firestore.rules', content: await readFile(new URL('../firestore.rules', import.meta.url), 'utf8') }];
}

const owner = { uid: 'rules-test-owner', email: 'rules-owner@example.test' };
const resetStorage = await resolveAccountStorage(owner, createHash('sha256').update(owner.email).digest('hex'));
const trackerIds = [...new Set([...LEGACY_DOCUMENT_IDS, CLOUD_DOCUMENT_ID, resetStorage.documentId])];
const cases = [];
const add = (label, path, method, auth, expectation) => cases.push({
  label,
  test: {
    expectation,
    request: { path: `/databases/(default)/documents/${path}`, method, auth, resource: { data: { state: null } } },
    resource: { data: { state: null } },
  },
});

for (const path of [...trackerIds.map((id) => `users/${owner.uid}/trackers/${id}`), `divine_data/${owner.uid}`]) {
  for (const method of ['get', 'create', 'update', 'delete']) {
    add(`owner ${method} ${path}`, path, method, { uid: owner.uid }, 'ALLOW');
    add(`other account ${method} ${path}`, path, method, { uid: 'rules-test-other' }, 'DENY');
    add(`signed out ${method} ${path}`, path, method, null, 'DENY');
  }
}
for (const path of [`users/${owner.uid}`, `users/${owner.uid}/private/example`, `users/${owner.uid}/trackers/example/private/example`, `unrelated/${owner.uid}`]) {
  for (const method of ['get', 'create', 'update', 'delete']) {
    add(`unmatched path ${method} ${path}`, path, method, { uid: owner.uid }, 'DENY');
  }
}

const response = await client.post(`/projects/${project}:test`, {
  source: { files },
  testSuite: { testCases: cases.map((item) => item.test) },
}, { skipLog: { body: true, resBody: true } });
const { issues = [], testResults = [] } = response.body;
assert.deepEqual(issues.filter((item) => item.severity === 'ERROR'), [], 'Rules compilation failed');
assert.equal(testResults.length, cases.length, 'Every access check must run');
const failed = testResults.flatMap((result, index) => result.state === 'SUCCESS' ? [] : [{ case: cases[index].label, state: result.state }]);
console.log(JSON.stringify({ source: rulesetName || 'local firestore.rules', checks: cases.length, passed: cases.length - failed.length, failed }, null, 2));
assert.equal(failed.length, 0, 'Access isolation checks failed');
