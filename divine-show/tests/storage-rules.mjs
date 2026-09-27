import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const cli = process.env.FIREBASE_TOOLS_PATH || 'firebase-tools';
const { getGlobalDefaultAccount } = require(`${cli}/lib/auth`);
const { requireAuth } = require(`${cli}/lib/requireAuth`);
const { Client } = require(`${cli}/lib/apiv2`);
const project = 'divine-show-db';
const bucket = 'divine-show-db.firebasestorage.app';
const adminUid = '5CMckLFqiCPoPCBQLz1YqBkgVXs1';
await requireAuth({ ...getGlobalDefaultAccount(), project });
const client = new Client({ urlPrefix: 'https://firebaserules.googleapis.com', apiVersion: 'v1' });
const files = [{ name: 'storage.rules', content: await readFile(new URL('../storage.rules', import.meta.url), 'utf8') }];
const cases = [];

function add(label, userId, method, auth, expectation) {
  const object = { bucket, name: `users/${userId}/progress/check.jpg`, size: 1024, contentType: 'image/jpeg', metadata: {} };
  cases.push({
    label,
    test: {
      expectation,
      request: { path: `/b/${bucket}/o/users/${userId}/progress/check.jpg`, method, auth, resource: { data: object } },
      resource: { data: object },
    },
  });
}

for (const method of ['get', 'create', 'update', 'delete']) {
  add(`owner ${method} own file`, 'rules-storage-owner', method, { uid: 'rules-storage-owner' }, 'ALLOW');
  add(`admin ${method} user file`, 'rules-storage-owner', method, { uid: adminUid }, 'ALLOW');
  add(`other ${method} user file`, 'rules-storage-owner', method, { uid: 'rules-storage-other' }, 'DENY');
  add(`signed out ${method} user file`, 'rules-storage-owner', method, null, 'DENY');
}
add('signed in cannot access unmatched path', 'rules-storage-owner', 'get', { uid: 'rules-storage-owner' }, 'DENY');
cases.at(-1).test.request.path = `/b/${bucket}/o/public/check.jpg`;

const response = await client.post(`/projects/${project}:test`, {
  source: { files },
  testSuite: { testCases: cases.map((item) => item.test) },
}, { skipLog: { body: true, resBody: true } });
const { issues = [], testResults = [] } = response.body;
assert.deepEqual(issues.filter((item) => item.severity === 'ERROR'), [], 'Storage rules compilation failed');
assert.equal(testResults.length, cases.length, 'Every storage access check must run');
const failed = testResults.flatMap((result, index) => result.state === 'SUCCESS' ? [] : [{ case: cases[index].label, state: result.state }]);
console.log(JSON.stringify({ source: 'local storage.rules', checks: cases.length, passed: cases.length - failed.length, failed }, null, 2));
assert.equal(failed.length, 0, 'Storage access isolation checks failed');
