import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createInitialState } from '../src/marathon/model.js';
import { createLifeState } from '../src/life/model.js';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url = process.env.MARATHON_TEST_URL || 'http://127.0.0.1:5173/THE-DIVINE-SHOW/';
const output = join(import.meta.dirname, '../test-output');
await mkdir(output, { recursive: true });
const admin = { uid: 'finance-test-admin', email: 'finance-admin@example.test', displayName: 'Admin' };
const member = { uid: 'finance-test-member', email: 'finance-member@example.test', displayName: 'Member' };
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });

const started = createInitialState('2026-09-01', '2026-09-01T08:00:00Z');
started.days.slice(0, 27).forEach((day, index) => {
  day.weight = Number((72 - index * 0.04).toFixed(2));
  day.calories = 1800 + (index % 3) * 80;
  day.activeCalories = 320 + (index % 4) * 20;
  day.steps = 8200 + index * 50;
  day.evidence = `Доказательство дня ${index + 1}`;
  day.draftSavedAt = `${day.date}T20:00:00Z`;
  day.codexValues = Object.fromEntries(started.codexRules.map((rule) => [rule.id, rule.type === 'limit' ? day.calories : true]));
});
const lifeState = createLifeState();
lifeState.vectors = lifeState.vectors.map((vector) => vector.id === 'capital' ? { ...vector, current: 0 } : vector);
const cloud = new Map([
  [`users/${admin.uid}/trackers/marathon-current-v11`, { state: started, resetGeneration: '2026-09-24-life-platform-v1' }],
  [`users/${admin.uid}/trackers/life-v1`, { state: lifeState }],
  [`users/${admin.uid}/finance/root`, { onboarded: true, openingCapital: 187000, expectedIncome: 125000, budgetMinimum: 60000, budgetComfort: 70000, budgetMaximum: 90000, defaultTaxRate: 4, defaultCoolingHours: 72, currency: 'RUB' }],
  [`users/${admin.uid}/finance/root/accounts/main`, { name: 'Основной счёт', openingBalance: 187000, color: '#cde8a5' }],
  [`users/${admin.uid}/finance/root/goals/home`, { name: 'Дом', target: 5000000, openingSaved: 187000, createdAt: '2026-09-01', priority: 1, primary: true, milestones: [{ id: 'm1', amount: 250000 }, { id: 'm2', amount: 5000000 }] }],
]);

const firestoreStub = `
const request = async (body) => {
  const response = await fetch('/__finance_test__/cloud', { method: 'POST', body: JSON.stringify(body) });
  if (!response.ok) throw new Error('Test cloud unavailable');
  return response.json();
};
const subscribers = new Set();
const isCollection = (path) => ['friendRequests','publicProfiles','friendships','conversations','challenges'].includes(path) || /\\/finance\\/root\\/(accounts|categories|transactions|goals|debts|recurring|wishes|assets|accelerators)$/.test(path);
const documentSnapshot = (data) => ({ exists: () => data !== null, data: () => data || undefined, metadata: { fromCache: false, hasPendingWrites: false } });
const collectionSnapshot = (items) => ({ docs: items.map((item) => ({ id: item.id, data: () => item.data })), metadata: { fromCache: false, hasPendingWrites: false } });
const snapshot = async (path) => isCollection(path) ? collectionSnapshot(await request({ type: 'list', path })) : documentSnapshot(await request({ type: 'get', path }));
const pathFor = (base, parts) => typeof base === 'string' ? [base, ...parts].join('/') : parts.join('/');
export const doc = (base, ...parts) => pathFor(base, parts);
export const collection = (base, ...parts) => pathFor(base, parts);
export const query = (path) => path;
export const where = (...parts) => parts;
export const orderBy = (...parts) => parts;
export const serverTimestamp = () => new Date().toISOString();
export const getFirestore = () => ({});
export const setDoc = async (path, value, options) => request({ type: 'write', operations: [{ type: 'set', path, value, merge: options?.merge }] });
export const updateDoc = async (path, value) => request({ type: 'write', operations: [{ type: 'set', path, value, merge: true }] });
export const deleteDoc = async (path) => request({ type: 'write', operations: [{ type: 'delete', path }] });
export const addDoc = async (path, value) => request({ type: 'write', operations: [{ type: 'set', path: path + '/generated', value }] });
export const getDocs = async (path) => collectionSnapshot(await request({ type: 'list', path }));
export const writeBatch = () => { const operations = []; return { set: (path, value, options) => operations.push({ type: 'set', path, value, merge: options?.merge }), update: (path, value) => operations.push({ type: 'set', path, value, merge: true }), delete: (path) => operations.push({ type: 'delete', path }), commit: () => request({ type: 'write', operations }) }; };
export const onSnapshot = (path, options, callback, onError) => {
  if (typeof options === 'function') { onError = callback; callback = options; }
  const item = { path, callback }; subscribers.add(item);
  snapshot(path).then((value) => { if (subscribers.has(item)) callback(value); }).catch(onError);
  return () => subscribers.delete(item);
};
export const runTransaction = async (_db, callback) => {
  const operations = [];
  const result = await callback({
    get: async (path) => documentSnapshot(await request({ type: 'get', path })),
    set: (path, value, options) => operations.push({ type: 'set', path, value, merge: options?.merge }),
    delete: (path) => operations.push({ type: 'delete', path }),
  });
  if (operations.length) await request({ type: 'write', operations });
  return result;
};`;

async function setup(context, user, isAdmin) {
  await context.addInitScript(() => { window.__DAY_ONE_AI_URL__ = 'https://ai.test/analyze'; });
  await context.route('**/src/marathon/accountStorage.js*', async (route) => {
    const response = await route.fetch();
    const fingerprint = createHash('sha256').update(isAdmin ? user.email : admin.email).digest('hex');
    const body = (await response.text()).replace(/const REQUESTED_ACCOUNT_HASH = ["'][a-f0-9]+["']/, `const REQUESTED_ACCOUNT_HASH = '${fingerprint}'`);
    return route.fulfill({ response, body });
  });
  await context.route('**/src/auth/roles.js*', async (route) => {
    const response = await route.fetch();
    const body = (await response.text()).replace(/export const ADMIN_UID = ["'][^"']+["']/, `export const ADMIN_UID = '${isAdmin ? user.uid : admin.uid}'`);
    return route.fulfill({ response, body });
  });
  await context.route('**/src/firebase.js*', (route) => route.fulfill({ contentType: 'text/javascript', body: 'export const auth={}; export const db={}; export const storage=null; export const firebaseConfigured=true; export const googleProvider={};' }));
  await context.route(/\/firebase_auth\.js(\?|$)/, (route) => route.fulfill({ contentType: 'text/javascript', body: `const user=${JSON.stringify(user)}; user.getIdToken=async()=>"synthetic-token"; export const onAuthStateChanged=(_auth,cb)=>{queueMicrotask(()=>cb(user));return ()=>{}}; export const signOut=async()=>{}; export const signInWithPopup=async()=>{}; export const signInWithRedirect=async()=>{};` }));
  await context.route(/\/firebase_firestore\.js(\?|$)/, (route) => route.fulfill({ contentType: 'text/javascript', body: firestoreStub }));
  await context.route('https://ai.test/analyze', (route) => route.fulfill({ json: {
    generatedAt: '2026-09-27T12:00:00.000Z', model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', snapshotDigest: 'synthetic',
    analysis: {
      status: 'on_track', headline: 'Курс держится, пора усилить точность', summary: 'Вес движется вниз, а заполненность позволяет сравнивать ожидание с фактом.',
      facts: [{ title: 'Вес снижается', observation: 'Сглаженный тренд направлен вниз.', evidence: '27 измерений веса.' }, { title: 'Активность стабильна', observation: 'Шаги держатся выше базового ориентира.', evidence: 'Среднее выше 8 000 шагов.' }],
      dynamics: [{ area: 'Тело', trend: 'up', observation: 'Направление соответствует цели.' }],
      hypotheses: [{ hypothesis: 'Точность питания поддерживает темп', confidence: 'medium', evidence: 'Записи калорий заполнены регулярно.', howToVerify: 'Сравнить ещё семь дней без изменения условий.' }],
      priorities: [{ title: 'Сохранить измеримость', why: 'Данные уже дают рабочий тренд.', action: 'Заполнять вес и питание ежедневно.', metric: '7 из 7 заполненных дней.' }],
      reinforcement: 'Ты уже создал последовательность, на которую можно опираться.', dataLimits: ['Активные калории остаются приблизительной оценкой.'],
    },
  } }));
  await context.route('**/__finance_test__/cloud', async (route) => {
    const request = route.request().postDataJSON();
    if (request.type === 'get') return route.fulfill({ json: cloud.get(request.path) || null });
    if (request.type === 'list') {
      const prefix = `${request.path}/`;
      const items = [...cloud.entries()].filter(([path]) => path.startsWith(prefix) && !path.slice(prefix.length).includes('/')).map(([path, data]) => ({ id: path.slice(prefix.length), data }));
      return route.fulfill({ json: items });
    }
    for (const operation of request.operations || []) {
      if (operation.type === 'delete') cloud.delete(operation.path);
      else cloud.set(operation.path, operation.merge ? { ...cloud.get(operation.path), ...operation.value } : operation.value);
    }
    return route.fulfill({ json: {} });
  });
}

async function width(page) {
  return page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
}

try {
  const adminContext = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Europe/Moscow' });
  await setup(adminContext, admin, true);
  const adminPage = await adminContext.newPage();
  const errors = [];
  adminPage.on('pageerror', (error) => errors.push(error.message));
  await adminPage.goto(url);
  await adminPage.getByRole('button', { name: 'Капитал', exact: true }).last().click();
  await adminPage.getByRole('heading', { name: /Добрый день/ }).waitFor();
  await adminPage.getByText('На счетах', { exact: true }).waitFor();
  await adminPage.waitForFunction(async ({ uid }) => {
    const response = await fetch('/__finance_test__/cloud', { method: 'POST', body: JSON.stringify({ type: 'get', path: `users/${uid}/trackers/life-v1` }) });
    const document = await response.json();
    return document?.state?.vectors?.find((vector) => vector.id === 'capital')?.current === 187000;
  }, { uid: admin.uid });
  assert.equal(await adminPage.getByRole('button', { name: '120 дней', exact: true }).count(), 1);
  const mobileWidth = await width(adminPage);
  assert.ok(mobileWidth.content <= mobileWidth.viewport + 1, JSON.stringify(mobileWidth));
  await adminPage.screenshot({ path: join(output, 'finance-mobile.png'), fullPage: true });
  await adminPage.setViewportSize({ width: 1440, height: 900 });
  await adminPage.getByRole('button', { name: 'Операции', exact: true }).click();
  await adminPage.getByRole('heading', { name: 'Операции.', exact: true }).waitFor();
  const desktopWidth = await width(adminPage);
  assert.ok(desktopWidth.content <= desktopWidth.viewport + 1, JSON.stringify(desktopWidth));
  await adminPage.screenshot({ path: join(output, 'finance-desktop.png'), fullPage: true });
  await adminPage.getByRole('button', { name: '120 дней', exact: true }).last().click();
  await adminPage.getByRole('button', { name: 'Статистика', exact: true }).click();
  await adminPage.getByRole('button', { name: 'Аналитик', exact: true }).click();
  await adminPage.getByRole('heading', { name: 'Не мнение. Разбор по твоим данным.', exact: true }).waitFor();
  await adminPage.getByRole('button', { name: 'Провести разбор', exact: true }).click();
  await adminPage.getByRole('heading', { name: 'Курс держится, пора усилить точность', exact: true }).waitFor();
  await adminPage.screenshot({ path: join(output, 'ai-desktop.png'), fullPage: true });
  await adminPage.setViewportSize({ width: 390, height: 844 });
  const aiMobileWidth = await width(adminPage);
  assert.ok(aiMobileWidth.content <= aiMobileWidth.viewport + 1, JSON.stringify(aiMobileWidth));
  await adminPage.screenshot({ path: join(output, 'ai-mobile.png'), fullPage: true });
  assert.deepEqual(errors, []);
  await adminContext.close();

  const memberState = createInitialState('2026-09-01', '2026-09-01T08:00:00Z');
  cloud.set(`users/${member.uid}/trackers/marathon-member-v12`, { state: memberState, resetGeneration: '2026-09-25-all-members-fresh-start-v2' });
  const memberContext = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Europe/Moscow' });
  await setup(memberContext, member, false);
  const memberPage = await memberContext.newPage();
  await memberPage.goto(url);
  await memberPage.getByRole('heading', { name: 'Сегодняшние доказательства', exact: true }).waitFor();
  assert.equal(await memberPage.getByRole('button', { name: 'Капитал', exact: true }).count(), 0, 'Участник не должен видеть админский финансовый раздел');
  assert.equal(await memberPage.getByRole('button', { name: 'Аналитик', exact: true }).count(), 0, 'Участник не должен видеть административный AI-аналитик');
  await memberContext.close();
  console.log(JSON.stringify({ passed: true, checks: ['admin finance navigation', 'embedded finance data', 'capital vector sync', 'mobile overflow', 'desktop finance navigation', 'AI analyst workflow', 'AI report persistence', 'member finance isolation', 'member AI isolation'] }, null, 2));
} finally {
  await browser.close();
}
