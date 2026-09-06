import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createInitialState } from '../src/marathon/model.js';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url = process.env.MARATHON_TEST_URL || 'http://127.0.0.1:5180/THE-DIVINE-SHOW/';
const output = process.env.MARATHON_TEST_OUTPUT || join(import.meta.dirname, '../test-output');
await mkdir(output, { recursive: true });
const owner = { uid: 'test-owner', email: 'owner@example.test' };
const oldPath = 'users/test-owner/trackers/marathon120-v9';
const newPath = 'users/test-owner/trackers/marathon120-20260906';
const cloud = new Map([[oldPath, { state: createInitialState('2026-08-30', '2026-08-30T08:00:00Z') }]]);
let offline = false;
let writes = 0;
const browser = await chromium.launch({ headless: true });

const firestoreStub = `
const subscribers = new Set();
const request = async (body) => {
  const response = await fetch('/__test__/cloud', { method: 'POST', body: JSON.stringify(body) });
  if (!response.ok) throw new Error('Test offline');
  return response.json();
};
const snapshot = (data) => ({ exists: () => data !== null, data: () => data || undefined, metadata: { fromCache: false, hasPendingWrites: false } });
export const doc = (_db, ...parts) => parts.join('/');
export const serverTimestamp = () => new Date().toISOString();
export const onSnapshot = (path, _options, callback, onError) => {
  const item = { path, callback }; subscribers.add(item);
  request({ type: 'get', path }).then((value) => { if(subscribers.has(item)) callback(snapshot(value)); }).catch(onError);
  return () => subscribers.delete(item);
};
export const runTransaction = async (_db, callback) => {
  const operations = [];
  const result = await callback({
    get: async (path) => snapshot(await request({ type: 'get', path })),
    set: (path, value, options) => operations.push({ type: 'set', path, value, merge: options?.merge }),
    delete: (path) => operations.push({ type: 'delete', path }),
  });
  if (operations.length) await request({ type: 'write', operations });
  for(const item of subscribers) item.callback(snapshot(await request({ type: 'get', path: item.path })));
  return result;
};`;

async function setup(context, user = owner) {
  // Substitute only the configured account fingerprint, using a synthetic test identity.
  await context.route('**/src/marathon/accountStorage.js*', async (route) => {
    const response = await route.fetch();
    const fingerprint = createHash('sha256').update(owner.email).digest('hex');
    const body = (await response.text()).replace(/const REQUESTED_ACCOUNT_HASH = ["'][a-f0-9]+["']/, `const REQUESTED_ACCOUNT_HASH = '${fingerprint}'`);
    return route.fulfill({ response, body });
  });
  await context.route('**/src/firebase.js*', (route) => route.fulfill({ contentType: 'text/javascript', body: 'export const auth={}; export const db={}; export const firebaseConfigured=true; export const googleProvider={};' }));
  await context.route(/\/firebase_auth\.js(\?|$)/, (route) => route.fulfill({ contentType: 'text/javascript', body: `export const onAuthStateChanged=(_auth,cb)=>{queueMicrotask(()=>cb(${JSON.stringify(user)}));return ()=>{}}; export const signOut=async()=>{}; export const signInWithPopup=async()=>{};` }));
  await context.route(/\/firebase_firestore\.js(\?|$)/, (route) => route.fulfill({ contentType: 'text/javascript', body: firestoreStub }));
  await context.route('**/__test__/cloud', async (route) => {
    if (offline) return route.fulfill({ status: 503, body: '{}' });
    const request = route.request().postDataJSON();
    if (request.type === 'get') return route.fulfill({ contentType: 'application/json', body: JSON.stringify(cloud.get(request.path) || null) });
    for (const op of request.operations) {
      if (op.type === 'delete') cloud.delete(op.path);
      else { cloud.set(op.path, op.merge ? { ...cloud.get(op.path), ...op.value } : op.value); writes++; }
    }
    return route.fulfill({ contentType: 'application/json', body: '{}' });
  });
}

async function checkWidth(page, name) {
  const measure = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
  assert.ok(measure.content <= measure.viewport + 1, `${name}: ${JSON.stringify(measure)}`);
}

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Europe/Moscow' });
  await setup(context);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.clock.install({ time: new Date('2026-09-06T10:00:00Z') });
  await page.goto(url);
  await page.getByRole('heading', { name: 'Мои аскезы', exact: true }).waitFor();
  assert.equal(cloud.has(oldPath), false, 'Old cloud history must be deleted for the owner');
  assert.equal(cloud.get(newPath).state, null, 'Reset must not auto-start');
  const startButton = page.getByRole('button', { name: 'Принимаю обязательства. Начать', exact: true });
  assert.equal(await startButton.isEnabled(), false);
  assert.equal(await page.getByRole('checkbox').count(), 6);
  await page.screenshot({ path: join(output, 'start-mobile.png'), fullPage: true });
  await checkWidth(page, 'mobile start');
  for (const checkbox of await page.getByRole('checkbox').all()) await checkbox.check();
  assert.equal(await startButton.isEnabled(), false, 'Purpose is required too');
  await page.getByLabel('Ради чего я прохожу эти 120 дней', { exact: false }).fill('Хочу действовать свободно и сохранять здоровье.');
  await startButton.click();
  await page.getByRole('button', { name: 'Да, начинаю', exact: true }).click();
  await page.getByRole('heading', { name: 'Все 120 дней перед глазами', exact: true }).waitFor();
  assert.equal(await page.locator('.day-tile').count(), 120);
  assert.equal(cloud.get(newPath).state.commitments.items.length, 6);
  const journeyId = cloud.get(newPath).state.journeyId;

  // The test tab is disconnected from its fake cloud, then immediately reloaded after typing.
  offline = true;
  await page.getByRole('spinbutton', { name: 'Вес, кг', exact: true }).fill('69.3');
  await page.reload();
  await page.getByRole('spinbutton', { name: 'Вес, кг', exact: true }).waitFor();
  assert.equal(await page.getByRole('spinbutton', { name: 'Вес, кг', exact: true }).inputValue(), '69.3');
  offline = false;
  await page.getByRole('button', { name: 'Повторить синхронизацию', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Калории', exact: true }).fill('1850');
  await page.getByRole('spinbutton', { name: 'Активные', exact: true }).fill('400');
  await page.getByRole('spinbutton', { name: 'Шаги', exact: true }).fill('9000');
  for (const yes of await page.getByRole('button', { name: 'Да', exact: true }).all()) await yes.click();
  await page.getByPlaceholder('Что сегодня подтвердило: я могу действовать и держать слово себе?').fill('Сделал полезное действие и сохранил свой выбор.');
  await page.getByText('100 очков уже учтены.', { exact: false }).waitFor();
  assert.equal(await page.getByRole('spinbutton', { name: 'Калории', exact: true }).isEnabled(), true);
  await page.waitForFunction(() => document.querySelector('[aria-label="Сохранено в облаке"]'));
  await page.waitForTimeout(900);
  assert.equal(cloud.get(newPath).state.days[0].weight, '69.3');
  assert.equal(cloud.get(newPath).state.days[0].result, null, 'Today remains editable');
  assert.equal(cloud.get(newPath).state.days[0].calories, '1850');
  await checkWidth(page, 'mobile daily form');

  await page.clock.setSystemTime(new Date('2026-09-07T10:00:00Z'));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.getByText('День 2 из 120', { exact: true }).waitFor();
  await page.getByRole('button', { name: '1 06.09', exact: true }).click();
  await page.getByText('Закрыт автоматически по сохранённым данным', { exact: false }).waitFor();
  assert.equal(await page.getByRole('spinbutton', { name: 'Калории', exact: true }).isEnabled(), false);
  await page.waitForTimeout(1000);
  assert.equal(cloud.get(newPath).state.days[0].result, 'strong');
  assert.equal(cloud.get(newPath).state.days[0].xp, 100);
  await page.screenshot({ path: join(output, 'automatic-mobile.png'), fullPage: true });
  await page.reload();
  await page.getByText('День 2 из 120', { exact: true }).waitFor();
  assert.equal(cloud.get(newPath).state.journeyId, journeyId);
  assert.equal(cloud.get(newPath).state.days[0].xp, 100);
  await page.getByRole('button', { name: 'Статистика', exact: true }).last().click();
  await page.getByRole('heading', { name: 'Что меняется по фактам', exact: true }).waitFor();
  await checkWidth(page, 'mobile statistics');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: join(output, 'statistics-desktop.png'), fullPage: true });
  await checkWidth(page, 'desktop statistics');
  const beforeIdle = writes;
  await page.waitForTimeout(1600);
  assert.equal(writes, beforeIdle, 'Sync must settle without endless writes');
  assert.deepEqual(errors, []);
  await context.close();

  const other = { uid: 'test-other', email: 'other@example.test' };
  const otherPath = 'users/test-other/trackers/marathon120-v9';
  const otherState = createInitialState('2026-09-06', '2026-09-06T08:00:00Z');
  cloud.set(otherPath, { state: otherState });
  const otherContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await setup(otherContext, other);
  const otherPage = await otherContext.newPage();
  await otherPage.goto(url);
  await otherPage.getByRole('heading', { name: 'Все 120 дней перед глазами', exact: true }).waitFor();
  assert.equal(cloud.get(otherPath).state.journeyId, otherState.journeyId);
  await otherContext.close();
  console.log(JSON.stringify({ passed: true, checks: ['owner-only reset', 'six mandatory commitments', 'required purpose', '120 dates', 'immediate offline save and reload', 'cloud retry', 'live earned result', 'midnight auto-close', 'locked previous day', 'idempotent points', 'no repeated reset', 'other accounts preserved', 'mobile and desktop overflow', 'no page errors', 'no sync write loop'], screenshots: output }, null, 2));
} finally {
  await browser.close();
}
