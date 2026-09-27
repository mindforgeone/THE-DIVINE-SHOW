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
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
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

async function requestGroq(snapshot, env) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.GROQ_MODEL || 'openai/gpt-oss-120b',
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user', content: `Проведи анализ этого проверенного снимка данных:\n${JSON.stringify(snapshot)}` },
      ],
      reasoning_effort: 'medium',
      temperature: 0.2,
      max_completion_tokens: 5000,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'day_one_analysis',
          strict: true,
          schema: ANALYSIS_SCHEMA,
        },
      },
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = payload.error?.message || 'Groq временно не отвечает.';
    throw new Error(response.status === 429 ? 'Лимит анализов временно исчерпан. Попробуй позже.' : detail);
  }
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error('Модель вернула пустой ответ.');
  return { analysis: JSON.parse(content), model: payload.model || env.GROQ_MODEL || 'openai/gpt-oss-120b' };
}

export async function handleRequest(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = allowedOrigins(env);
  if (origin && !allowed.includes(origin)) return json({ error: 'Источник запроса не разрешён.' }, 403);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin || allowed[0]) });
  if (request.method !== 'POST') return json({ error: 'Используй POST.' }, 405, origin);
  if (!env.GROQ_API_KEY || !env.FIREBASE_API_KEY || !env.ADMIN_UID) return json({ error: 'Сервер аналитика не настроен.' }, 503, origin);
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return json({ error: 'Нужна авторизация.' }, 401, origin);
  const firebaseUser = await verifyFirebaseToken(auth.slice(7), env);
  if (!firebaseUser?.localId) return json({ error: 'Сессия недействительна.' }, 401, origin);
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
    const result = await requestGroq(body.snapshot, env);
    return json({ ...result, generatedAt: new Date().toISOString(), snapshotDigest: await digestSnapshot(body.snapshot) }, 200, origin);
  } catch (error) {
    return json({ error: error?.message || 'Не удалось провести анализ.' }, 502, origin);
  }
}

export default {
  fetch: handleRequest,
};
