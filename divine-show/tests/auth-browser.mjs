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
const user = { uid: 'auth-test-owner', email: 'auth-owner@example.test' };
const state = createInitialState('2026-09-06', '2026-09-06T08:00:00Z');
state.days[2].weight = '69.2';
const browser = await chromium.launch({ headless: true });
const pageErrors = [];

const authStub = `
const listeners = new Set();
const control = window.__authTest = {
  popupCalls: 0,
  emit(user) { window.__testAuth.currentUser = user; for (const cb of listeners) cb(user); },
};
export const onAuthStateChanged = (_auth, cb) => {
  listeners.add(cb); queueMicrotask(() => { if (listeners.has(cb)) cb(window.__testAuth.currentUser); });
  return () => listeners.delete(cb);
};
export const signInWithPopup = () => {
  control.popupCalls++;
  return new Promise((resolve, reject) => {
    control.complete = (user) => { control.emit(user); resolve({ user }); };
    control.fail = (code) => reject(Object.assign(new Error(code), { code }));
  });
};
export const signOut = async () => control.emit(null);
`;

const firestoreStub = `
const cloud = window.__cloudTest;
const subscribers = new Set();
const snapshot = () => ({ exists: () => true, data: () => cloud.document, metadata: { fromCache: false, hasPendingWrites: false } });
cloud.emit = () => { for (const item of subscribers) item.callback(snapshot()); };
cloud.fail = (code) => { for (const item of [...subscribers]) item.onError({ code }); };
export const doc = (_db, ...parts) => parts.join('/');
export const getFirestore = () => ({});
export const serverTimestamp = () => new Date().toISOString();
export const onSnapshot = (_path, _options, callback, onError) => {
  cloud.subscriptions++;
  const item = { callback, onError }; subscribers.add(item);
  if (!cloud.holdSnapshot) queueMicrotask(() => { if (subscribers.has(item)) callback(snapshot()); });
  return () => subscribers.delete(item);
};
export const runTransaction = async (_db, callback) => {
  cloud.transactions++;
  if (cloud.holdTransaction) await new Promise((resolve) => { cloud.release = resolve; });
  const result = await callback({
    get: async () => snapshot(),
    set: (_path, value) => { cloud.document = { ...cloud.document, ...value }; cloud.writes++; },
    delete: () => { throw new Error('Existing history must never be reset'); },
  });
  cloud.emit();
  return result;
};
`;

async function setup({ realAuth = false, blockCacheCleanup = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, timezoneId: 'Europe/Moscow' });
  await context.addInitScript(({ state, blockCacheCleanup }) => {
    window.__cloudTest = { document: { state, resetGeneration: '2026-09-06' }, transactions: 0, subscriptions: 0, writes: 0, holdSnapshot: false, holdTransaction: false };
    if (blockCacheCleanup) {
      const remove = Storage.prototype.removeItem;
      Storage.prototype.removeItem = function (key) {
        if (key.includes('marathon') || key.includes('growth')) throw new DOMException('Blocked cache', 'SecurityError');
        return remove.call(this, key);
      };
    }
  }, { state, blockCacheCleanup });
  await context.route('**/src/marathon/accountStorage.js*', async (route) => {
    const response = await route.fetch();
    const fingerprint = createHash('sha256').update(user.email).digest('hex');
    const body = (await response.text()).replace(/const REQUESTED_ACCOUNT_HASH = ["'][a-f0-9]+["']/, `const REQUESTED_ACCOUNT_HASH = '${fingerprint}'`);
    return route.fulfill({ response, body });
  });
  if (!realAuth) {
    await context.route('**/src/firebase.js*', (route) => route.fulfill({ contentType: 'text/javascript', body: 'export const auth=window.__testAuth={currentUser:null}; export const db={}; export const firebaseConfigured=true; export const googleProvider={};' }));
    await context.route(/\/firebase_auth\.js(\?|$)/, (route) => route.fulfill({ contentType: 'text/javascript', body: authStub }));
  }
  await context.route(/\/firebase_firestore\.js(\?|$)/, (route) => route.fulfill({ contentType: 'text/javascript', body: firestoreStub }));
  const page = await context.newPage();
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.clock.install({ time: new Date('2026-09-08T10:00:00Z') });
  return { context, page };
}

async function focusStorm(page) {
  await page.evaluate(() => {
    for (let i = 0; i < 8; i++) {
      window.dispatchEvent(new Event('focus'));
      document.dispatchEvent(new Event('visibilitychange'));
    }
  });
  await page.waitForTimeout(250);
}

try {
  const { context, page } = await setup();
  await page.goto(url);
  const login = page.getByRole('button', { name: 'Войти через Google', exact: true });
  await login.waitFor();
  await login.evaluate((button) => { button.click(); button.click(); });
  assert.equal(await page.getByRole('button', { name: 'Ожидаю Google…', exact: true }).isDisabled(), true);
  assert.equal(await page.evaluate(() => window.__authTest.popupCalls), 1, 'Double taps must not cancel the first popup');
  for (const [code, message] of [
    ['auth/popup-closed-by-user', 'Окно Google закрылось'],
    ['auth/popup-blocked', 'Браузер заблокировал'],
    ['auth/network-request-failed', 'Не удалось связаться с Google'],
  ]) {
    await page.evaluate((code) => window.__authTest.fail(code), code);
    await page.getByRole('alert').filter({ hasText: message }).waitFor();
    if (code === 'auth/popup-blocked') await page.screenshot({ path: join(output, 'auth-mobile-error.png'), fullPage: true });
    await login.click();
  }
  await page.evaluate((user) => {
    window.__cloudTest.holdTransaction = true;
    window.__cloudTest.holdSnapshot = true;
    window.__authTest.complete(user);
  }, user);
  await page.getByText('Загружаю историю', { exact: true }).waitFor();
  await page.waitForFunction(() => window.__cloudTest.transactions === 1);
  await focusStorm(page);
  await page.evaluate((user) => window.__authTest.emit({ ...user }), user);
  await focusStorm(page);
  assert.equal(await page.evaluate(() => window.__cloudTest.transactions), 1, 'Phone focus and same-UID notifications must not restart initialization');
  await page.evaluate(() => { window.__cloudTest.holdTransaction = false; window.__cloudTest.release(); });
  await page.waitForFunction(() => window.__cloudTest.subscriptions === 1);
  await focusStorm(page);
  assert.equal(await page.evaluate(() => window.__cloudTest.subscriptions), 1, 'Keep the pending Firebase listener');
  await page.clock.fastForward(13000);
  await page.getByRole('button', { name: 'Повторить загрузку', exact: true }).waitFor();
  await page.evaluate(() => window.__cloudTest.fail('permission-denied'));
  await page.getByRole('alert').filter({ hasText: 'Firebase не разрешает читать историю' }).waitFor();
  assert.equal(await page.getByRole('heading', { name: 'Мои аскезы', exact: true }).count(), 0, 'Access failure must not look like a new marathon');
  assert.equal(await login.count(), 0, 'Cloud failure must not sign the user out');
  await page.screenshot({ path: join(output, 'history-mobile-error.png'), fullPage: true });
  await page.evaluate(() => { window.__cloudTest.holdSnapshot = false; });
  await page.getByRole('button', { name: 'Повторить загрузку', exact: true }).click();
  await page.getByText('День 3 из 120', { exact: true }).waitFor();
  assert.equal(await page.getByRole('spinbutton', { name: 'Вес, кг', exact: true }).inputValue(), '69.2');
  assert.equal(await page.evaluate(() => window.__cloudTest.transactions), 1, 'Retry must not rerun the completed reset transaction');
  await page.getByRole('spinbutton', { name: 'Калории', exact: true }).fill('1850');
  await page.evaluate(() => window.__cloudTest.fail('unavailable'));
  await page.getByText('Аккаунт остаётся подключён.', { exact: false }).waitFor();
  await page.getByRole('button', { name: 'Повторить синхронизацию', exact: true }).click();
  assert.equal(await page.getByRole('spinbutton', { name: 'Калории', exact: true }).inputValue(), '1850', 'Retry must preserve unsent edits');
  await page.waitForTimeout(900);
  assert.equal(await page.evaluate(() => window.__cloudTest.document.state.days[2].calories), '1850');
  const before = await page.evaluate(() => window.__cloudTest.subscriptions);
  await page.evaluate((user) => window.__authTest.emit({ ...user }), user);
  await focusStorm(page);
  assert.equal(await page.evaluate(() => window.__cloudTest.subscriptions), before);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.evaluate(() => window.__authTest.emit(null));
  await login.waitFor();
  assert.equal(await page.locator('.day-tile').count(), 0, 'Logout must hide account history');
  await context.close();

  // Exercise the actual Firebase Auth SDK and its IndexedDB persistence. Only network
  // responses are synthetic: no real Google credentials or Firebase writes are used.
  const real = await setup({ realAuth: true, blockCacheCleanup: true });
  const now = Math.floor(new Date('2026-09-08T10:00:00Z').getTime() / 1000);
  const token = [
    { alg: 'none', typ: 'JWT' },
    { sub: user.uid, user_id: user.uid, email: user.email, email_verified: true, iat: now, exp: now + 3600, auth_time: now, aud: 'divine-show-db', iss: 'https://securetoken.google.com/divine-show-db', firebase: { sign_in_provider: 'google.com' } },
  ].map((value) => Buffer.from(JSON.stringify(value)).toString('base64url')).join('.') + '.synthetic';
  await real.context.route('https://identitytoolkit.googleapis.com/**', (route) => {
    const endpoint = route.request().url();
    const account = { localId: user.uid, email: user.email, emailVerified: true, providerUserInfo: [{ providerId: 'google.com', rawId: user.uid, email: user.email }] };
    if (endpoint.includes('accounts:signInWithIdp')) return route.fulfill({ json: { ...account, idToken: token, refreshToken: 'synthetic-refresh-token', expiresIn: '3600', providerId: 'google.com' } });
    if (endpoint.includes('accounts:lookup')) return route.fulfill({ json: { users: [account] } });
    return route.abort();
  });
  await real.context.route('https://securetoken.googleapis.com/**', (route) => route.fulfill({ json: { access_token: token, refresh_token: 'synthetic-refresh-token', expires_in: '3600', token_type: 'Bearer', user_id: user.uid, project_id: '765827208001' } }));
  await real.page.goto(url);
  await real.page.getByRole('button', { name: 'Войти через Google', exact: true }).waitFor();
  await real.page.evaluate(async () => {
    const { auth } = await import('/THE-DIVINE-SHOW/src/firebase.js');
    const { signInWithCredential, GoogleAuthProvider } = await import('/THE-DIVINE-SHOW/node_modules/.vite/deps/firebase_auth.js');
    await signInWithCredential(auth, GoogleAuthProvider.credential('synthetic-google-token'));
  });
  await real.page.getByText('День 3 из 120', { exact: true }).waitFor();
  await real.page.reload();
  await real.page.getByText('День 3 из 120', { exact: true }).waitFor();
  assert.equal(await real.page.getByRole('button', { name: 'Войти через Google', exact: true }).count(), 0, 'SDK session must survive reload');
  await focusStorm(real.page);
  assert.equal(await real.page.getByRole('spinbutton', { name: 'Вес, кг', exact: true }).inputValue(), '69.2');
  await real.page.screenshot({ path: join(output, 'auth-mobile-restored.png'), fullPage: true });
  await real.context.close();
  assert.deepEqual(pageErrors, []);
  console.log(JSON.stringify({ passed: true, checks: ['double-tap guard', 'cancelled and blocked popup recovery', 'network error recovery', 'phone focus during pending transaction', 'same UID notifications', 'pending listener retained', 'slow loading recovery', 'permission failure is not a new marathon or logout', 'retry preserves unsent edits', 'completed reset is not repeated', 'logout hides account data', 'real Firebase SDK persistence across reload', 'blocked old-cache cleanup does not block login', 'mobile overflow', 'no page errors'], screenshots: output }, null, 2));
} catch (error) {
  console.error({ pageErrors });
  for (const context of browser.contexts()) {
    for (const page of context.pages()) await page.screenshot({ path: join(output, 'auth-failure.png'), fullPage: true }).catch(() => {});
  }
  throw error;
} finally {
  await browser.close();
}
