export const ANALYSIS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['status', 'headline', 'summary', 'facts', 'dynamics', 'hypotheses', 'priorities', 'reinforcement', 'dataLimits'],
  properties: {
    status: { type: 'string', enum: ['on_track', 'attention', 'insufficient_data'] },
    headline: { type: 'string' },
    summary: { type: 'string' },
    facts: {
      type: 'array', minItems: 2, maxItems: 6,
      items: {
        type: 'object', additionalProperties: false,
        required: ['title', 'observation', 'evidence'],
        properties: {
          title: { type: 'string' },
          observation: { type: 'string' },
          evidence: { type: 'string' },
        },
      },
    },
    dynamics: {
      type: 'array', minItems: 1, maxItems: 6,
      items: {
        type: 'object', additionalProperties: false,
        required: ['area', 'trend', 'observation'],
        properties: {
          area: { type: 'string' },
          trend: { type: 'string', enum: ['up', 'down', 'flat', 'mixed'] },
          observation: { type: 'string' },
        },
      },
    },
    hypotheses: {
      type: 'array', minItems: 1, maxItems: 4,
      items: {
        type: 'object', additionalProperties: false,
        required: ['hypothesis', 'confidence', 'evidence', 'howToVerify'],
        properties: {
          hypothesis: { type: 'string' },
          confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
          evidence: { type: 'string' },
          howToVerify: { type: 'string' },
        },
      },
    },
    priorities: {
      type: 'array', minItems: 1, maxItems: 3,
      items: {
        type: 'object', additionalProperties: false,
        required: ['title', 'why', 'action', 'metric'],
        properties: {
          title: { type: 'string' },
          why: { type: 'string' },
          action: { type: 'string' },
          metric: { type: 'string' },
        },
      },
    },
    reinforcement: { type: 'string' },
    dataLimits: { type: 'array', maxItems: 5, items: { type: 'string' } },
  },
};

export function buildSystemPrompt() {
  return [
    'Ты — русскоязычный аналитик личного развития внутри приложения Day One.',
    'Твоя задача — усиливать решения пользователя на основании его фактических данных, а не поддерживать разговор ради разговора.',
    'Пиши только по-русски, ясно, прямо и уважительно. Не используй англицизмы без необходимости.',
    'Никогда не стыди, не морализируй, не сравнивай пользователя с другими и не ставь медицинских или психиатрических диагнозов.',
    'Не придумывай отсутствующие события, причины или значения. Если данных недостаточно, так и скажи.',
    'Строго разделяй факт, статистическую связь и причинную гипотезу. Корреляцию не называй причиной.',
    'Все расчётные поля снимка считаются приложением и являются источником истины. Не пересчитывай их произвольно.',
    'Правило 7700 ккал на килограмм и активные калории являются приближениями. Указывай это при выводах о весе.',
    'Не называй вес застоем, если поле plateau равно false. Суточные колебания веса не трактуй как набор жира.',
    'Сначала оцени качество данных. Затем найди динамику, повторяющиеся условия сильных дней и расхождения между ожиданием и фактом.',
    'Статус insufficient_data используй только если заполнено меньше 3 дней. При 3 и более днях выбери on_track или attention по фактам.',
    'Гипотезы ранжируй по уверенности и для каждой предлагай способ проверки следующими наблюдениями.',
    'Дай не больше трёх приоритетов. Каждый приоритет должен содержать конкретное действие и проверяемую метрику.',
    'Учитывай тело, дисциплину, действия, смелость, цели, профессиональное развитие и жизненные векторы только при наличии данных.',
    'Тон: спокойный, сильный, без пустой мотивации. Поддержка должна опираться на уже совершённые действия.',
    'Ответ обязан соответствовать переданной JSON-схеме.',
  ].join('\n');
}

function json(data, status = 200, origin = '') {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...(origin ? corsHeaders(origin) : {}),
    },
  });
}

function allowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || 'https://mindforgeone.github.io,http://localhost:5173,http://localhost:5180')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

const SYNC_RESOURCES = new Set(['marathon']);
const MAX_SYNC_BYTES = 900_000;

function parseStoredPayload(value) {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

async function readSyncRow(env, uid, resource) {
  return env.SYNC_DB.prepare('SELECT revision, payload, updated_at FROM user_state WHERE uid = ?1 AND resource = ?2')
    .bind(uid, resource)
    .first();
}

function syncRowResponse(row, status, origin) {
  return json({
    payload: parseStoredPayload(row?.payload),
    revision: Number(row?.revision || 0),
    updatedAt: row?.updated_at || null,
  }, status, origin);
}

async function handleSyncRequest(request, env, origin, firebaseUser, resource) {
  if (!env.SYNC_DB) return json({ error: 'Облачное хранилище не настроено.' }, 503, origin);
  if (!SYNC_RESOURCES.has(resource)) return json({ error: 'Неизвестный раздел синхронизации.' }, 404, origin);
  const uid = firebaseUser.localId;
  if (request.method === 'GET') return syncRowResponse(await readSyncRow(env, uid, resource), 200, origin);
  if (request.method !== 'PUT') return json({ error: 'Используй GET или PUT.' }, 405, origin);

  let body;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_SYNC_BYTES) return json({ error: 'Состояние слишком большое для синхронизации.' }, 413, origin);
    body = JSON.parse(rawBody);
  } catch {
    return json({ error: 'Некорректный JSON.' }, 400, origin);
  }
  const baseRevision = Number(body?.baseRevision);
  if (!Number.isInteger(baseRevision) || baseRevision < 0 || !body || !Object.hasOwn(body, 'payload')) {
    return json({ error: 'Некорректная версия синхронизации.' }, 400, origin);
  }
  const encoded = JSON.stringify(body.payload);
  if (new TextEncoder().encode(encoded).byteLength > MAX_SYNC_BYTES) return json({ error: 'Состояние слишком большое для синхронизации.' }, 413, origin);

  const current = await readSyncRow(env, uid, resource);
  if (Number(current?.revision || 0) !== baseRevision) return syncRowResponse(current, 409, origin);
  const updatedAt = new Date().toISOString();
  const nextRevision = baseRevision + 1;
  const result = current
    ? await env.SYNC_DB.prepare('UPDATE user_state SET payload = ?1, revision = ?2, updated_at = ?3 WHERE uid = ?4 AND resource = ?5 AND revision = ?6')
      .bind(encoded, nextRevision, updatedAt, uid, resource, baseRevision)
      .run()
    : await env.SYNC_DB.prepare('INSERT OR IGNORE INTO user_state (uid, resource, revision, payload, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)')
      .bind(uid, resource, nextRevision, encoded, updatedAt)
      .run();
  if (Number(result.meta?.changes || 0) !== 1) return syncRowResponse(await readSyncRow(env, uid, resource), 409, origin);
  return json({ revision: nextRevision, updatedAt }, 200, origin);
}

async function verifyFirebaseToken(token, env) {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(env.FIREBASE_API_KEY)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: token }),
  });
  if (!response.ok) return null;
  const data = await response.json();
  return data.users?.[0] || null;
}

async function digestSnapshot(snapshot) {
  const bytes = new TextEncoder().encode(JSON.stringify(snapshot));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('').slice(0, 20);
}

function validateSnapshot(snapshot) {
  if (!snapshot || snapshot.schemaVersion !== 1) return 'Неподдерживаемый формат данных.';
  if (!snapshot.period?.id || !snapshot.dataQuality || !snapshot.current) return 'Снимок данных неполный.';
  if (!Number.isFinite(Number(snapshot.dataQuality.recordedDays))) return 'Некорректная полнота данных.';
  return '';
}

function parseJsonText(value) {
  const text = String(value || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return text ? JSON.parse(text) : null;
}

export function parseAiPayload(payload) {
  const direct = payload?.response ?? payload?.result?.response;
  if (direct && typeof direct === 'object') return direct;
  if (typeof direct === 'string') return parseJsonText(direct);
  const chat = payload?.choices?.[0]?.message?.content;
  if (typeof chat === 'string') return parseJsonText(chat);
  if (typeof payload?.output_text === 'string') return parseJsonText(payload.output_text);
  const outputText = payload?.output
    ?.flatMap((item) => item?.content || [])
    .find((item) => item?.type === 'output_text')?.text;
  return parseJsonText(outputText);
}

function validAnalysis(value) {
  return value
    && typeof value.headline === 'string'
    && typeof value.summary === 'string'
    && Array.isArray(value.facts)
    && Array.isArray(value.hypotheses)
    && Array.isArray(value.priorities);
}

async function runWorkersModel(model, snapshot, env) {
  const options = {
    messages: [
      { role: 'system', content: buildSystemPrompt() },
      { role: 'user', content: `Проведи анализ этого проверенного снимка данных:\n${JSON.stringify(snapshot)}` },
    ],
    temperature: 0.2,
    max_tokens: 5000,
    response_format: {
      type: 'json_schema',
      json_schema: ANALYSIS_SCHEMA,
    },
  };
  if (model.includes('gpt-oss')) options.reasoning = { effort: 'medium' };
  const payload = await env.AI.run(model, options);
  const analysis = parseAiPayload(payload);
  if (!validAnalysis(analysis)) throw new Error('Модель вернула неполный структурированный разбор.');
  return { analysis, model };
}

export async function requestWorkersAi(snapshot, env) {
  const primary = env.PRIMARY_MODEL || '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
  const fallback = env.FALLBACK_MODEL || '@cf/openai/gpt-oss-120b';
  try {
    return await runWorkersModel(primary, snapshot, env);
  } catch (primaryError) {
    try {
      return await runWorkersModel(fallback, snapshot, env);
    } catch (fallbackError) {
      const message = String(fallbackError?.message || primaryError?.message || 'Workers AI временно не отвечает.');
      throw new Error(/quota|limit|neuron|3036/i.test(message) ? 'Бесплатный лимит анализов на сегодня исчерпан.' : message, { cause: fallbackError });
    }
  }
}

export async function handleRequest(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = allowedOrigins(env);
  if (origin && !allowed.includes(origin)) return json({ error: 'Источник запроса не разрешён.' }, 403);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin || allowed[0]) });
  if (!env.FIREBASE_API_KEY) return json({ error: 'Проверка аккаунта не настроена.' }, 503, origin);
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return json({ error: 'Нужна авторизация.' }, 401, origin);
  const firebaseUser = await verifyFirebaseToken(auth.slice(7), env);
  if (!firebaseUser?.localId) return json({ error: 'Сессия недействительна.' }, 401, origin);

  const syncMatch = new URL(request.url).pathname.match(/^\/sync\/v1\/([a-z-]+)$/);
  if (syncMatch) return handleSyncRequest(request, env, origin, firebaseUser, syncMatch[1]);

  if (request.method !== 'POST') return json({ error: 'Используй POST.' }, 405, origin);
  if (!env.AI || !env.ADMIN_UID) return json({ error: 'Сервер аналитика не настроен.' }, 503, origin);
  if (firebaseUser.localId !== env.ADMIN_UID) return json({ error: 'Аналитик доступен только администратору.' }, 403, origin);
  let body;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > 180_000) return json({ error: 'Слишком большой снимок данных.' }, 413, origin);
    body = JSON.parse(rawBody);
  } catch {
    return json({ error: 'Некорректный JSON.' }, 400, origin);
  }
  const validationError = validateSnapshot(body.snapshot);
  if (validationError) return json({ error: validationError }, 400, origin);
  try {
    const result = await requestWorkersAi(body.snapshot, env);
    return json({ ...result, generatedAt: new Date().toISOString(), snapshotDigest: await digestSnapshot(body.snapshot) }, 200, origin);
  } catch (error) {
    return json({ error: error?.message || 'Не удалось провести анализ.' }, 502, origin);
  }
}

export default {
  fetch: handleRequest,
};
