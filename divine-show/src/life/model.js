import { createId, number, todayKey } from '../marathon/model.js';

export const LIFE_DOCUMENT_ID = 'life-v1';
export const LIFE_CACHE_KEY = 'marathon-life-v1';
export const LIFE_SCHEMA_VERSION = 2;

const INITIAL_TIME = '1970-01-01T00:00:00.000Z';

const skillGroups = [
  ['transport-edo', 'Транспортный ЭДО', ['ЭТрН', 'ЭЗЗ', 'ПЭ', 'ЭПЛ', 'Задание на перевозку', 'Экспедирование', 'Перевозчик', 'Самовывоз', 'Торговые сети', 'EDI', 'ORDERS', 'ORDRSP', 'DESADV', 'INVOIC/УПД', 'МЧД', 'Подписанты', 'Роли участников', 'PROD', 'Диагностика ошибок']],
  ['one-c', '1С', ['Документы', 'Справочники', 'Регистры', 'Запросы', 'Формы', 'Клиент/сервер', 'Отладчик', 'Расширения', 'JSON', 'XML', 'HTTP', 'Интеграции', 'Диагностика']],
  ['implementation', 'Внедрение', ['Аналитика', 'Тестовая база', 'Установка', 'Настройка', 'Демонстрация', 'Перенос в PROD', 'Опытная эксплуатация', 'Клиентские встречи', 'Самостоятельное закрытие сценария']],
];

export const DEFAULT_SKILL_AREAS = [
  ['professional', 'Профессиональное', '#0d8fb9'],
  ['creative', 'Творческое', '#d55784'],
  ['physical', 'Физическое', '#16a36a'],
  ['personal', 'Личность и мышление', '#7b5fc7'],
  ['business', 'Бизнес и капитал', '#d48732'],
];

const starterSkills = [
  ['creative', 'photography', 'Фотография', ['Коммерческая съёмка', 'Портрет', 'Свет', 'Отбор и ретушь']],
  ['creative', 'video', 'Видео', ['Съёмка видео', 'Монтаж', 'Сторителлинг']],
  ['physical', 'body', 'Форма и энергия', ['Силовая тренировка', 'Кардио и шаги', 'Питание по плану']],
  ['personal', 'expression', 'Самовыражение', ['Говорить прямо', 'Проявляться публично', 'Актёрская практика']],
  ['personal', 'mindset', 'Мышление', ['Решение без самокритики', 'Спокойствие в действии']],
  ['business', 'capital-growth', 'Капитал', ['Финансовая дисциплина', 'Рост дохода', 'Мышление владельца']],
  ['business', 'clients', 'Клиенты и продажи', ['Переговоры', 'Полезность клиенту', 'Закрытие договорённости']],
];

const areaRecord = ([id, title, color], order) => ({ id, title, color, order, createdAt: INITIAL_TIME, updatedAt: INITIAL_TIME, deletedAt: null });
const skillRecord = ({ id, areaId, groupId, group, title }) => ({ id, areaId, groupId, group, title, level: 0, evidences: [], createdAt: INITIAL_TIME, updatedAt: INITIAL_TIME, deletedAt: null });

function defaults() {
  const rules = [
    ['alcohol', 'Алкоголь: 0', 'boolean', 1, ''],
    ['wot', 'World of Tanks: 0', 'boolean', 1, ''],
    ['reels', 'Instagram / Reels', 'limit', 20, 'мин'],
    ['sweets', 'Не покупать сладости импульсивно', 'boolean', 1, ''],
    ['meal-plan', 'Питаться по недельному плану', 'boolean', 1, ''],
    ['activity', 'Ежедневная активность', 'boolean', 1, ''],
    ['profession', 'Профессиональное развитие', 'minimum', 30, 'мин'],
    ['recover', 'Следующий правильный выбор начинается сразу', 'text', 0, ''],
  ].map(([id, title, type, target, unit], order) => ({ id, title, type, target, unit, active: true, order, startDate: todayKey(), endDate: '', createdAt: INITIAL_TIME, updatedAt: INITIAL_TIME, deletedAt: null }));
  const vectors = [
    { id: 'body', title: 'Тело', description: 'Видимый пресс, чистое питание и энергия.', start: 70, current: 70, target: 65, unit: 'кг', milestone: '67 кг', imageUrl: '', color: '#16a36a' },
    { id: 'profession', title: 'Профессия', description: 'Самостоятельный специалист по внедрению 1С в транспортном ЭДО.', start: 0, current: 0, target: 100, unit: '%', milestone: 'Первый клиент в PROD', imageUrl: '', color: '#0d8fb9' },
    { id: 'capital', title: 'Капитал', description: 'Финансовая опора и дом.', start: 0, current: 187000, target: 5000000, unit: '₽', milestone: '250 000 ₽', imageUrl: '', color: '#d55784' },
  ].map((item) => ({ ...item, createdAt: INITIAL_TIME, updatedAt: INITIAL_TIME, deletedAt: null }));
  const professional = skillGroups.flatMap(([groupId, group, names]) => names.map((title, index) => skillRecord({ id: `${groupId}-${index + 1}`, areaId: 'professional', groupId, group, title })));
  const additional = starterSkills.flatMap(([areaId, groupId, group, names]) => names.map((title, index) => skillRecord({ id: `${groupId}-${index + 1}`, areaId, groupId, group, title })));
  return { version: LIFE_SCHEMA_VERSION, updatedAtClient: INITIAL_TIME, rules, ruleHistory: [], vectors, skillAreas: DEFAULT_SKILL_AREAS.map(areaRecord), skills: [...professional, ...additional], wishes: [], events: [], books: [], plans: [] };
}

export const createLifeState = defaults;

export function normalizeLifeState(raw) {
  const base = defaults();
  if (!raw || ![1, LIFE_SCHEMA_VERSION].includes(raw.version)) return base;
  const skillAreas = mergeItems(base.skillAreas, Array.isArray(raw.skillAreas) ? raw.skillAreas : []);
  const skills = mergeItems(base.skills, Array.isArray(raw.skills) ? raw.skills : []).map((skill) => ({ ...skill, areaId: skill.areaId || 'professional', evidences: Array.isArray(skill.evidences) ? skill.evidences : [] }));
  const wishes = Array.isArray(raw.wishes) ? raw.wishes.map(normalizeWish) : [];
  return {
    ...base,
    ...raw,
    version: LIFE_SCHEMA_VERSION,
    rules: Array.isArray(raw.rules) ? raw.rules : base.rules,
    ruleHistory: Array.isArray(raw.ruleHistory) ? raw.ruleHistory : [],
    vectors: Array.isArray(raw.vectors) ? raw.vectors.map((vector) => ({ ...vector, start: vector.start ?? vector.current ?? 0 })) : base.vectors,
    skillAreas,
    skills,
    wishes,
    events: Array.isArray(raw.events) ? raw.events : [],
    books: Array.isArray(raw.books) ? raw.books : [],
    plans: Array.isArray(raw.plans) ? raw.plans : [],
  };
}

function normalizeWish(wish) {
  const status = ({ want: 'active', thinking: 'planned', saving: 'active', ready: 'planned', bought: 'fulfilled', declined: 'abandoned' })[wish.status] || wish.status || 'active';
  return { ...wish, status, completedDate: wish.completedDate || wish.purchaseDate || '', actualAmount: wish.actualAmount ?? wish.purchaseAmount ?? '', completionNote: wish.completionNote || wish.purchaseComment || '' };
}

const timestamp = (item) => Date.parse(item?.updatedAt || item?.earnedAt || item?.createdAt || '') || 0;
function mergeItems(remote = [], local = []) {
  const map = new Map();
  [...remote, ...local].forEach((item) => {
    const current = map.get(item.id);
    if (!current || timestamp(item) >= timestamp(current)) map.set(item.id, item);
  });
  return [...map.values()];
}

function mergeSkills(remote = [], local = []) {
  const merged = mergeItems(remote, local);
  return merged.map((skill) => {
    const remoteSkill = remote.find((item) => item.id === skill.id);
    const localSkill = local.find((item) => item.id === skill.id);
    return { ...skill, evidences: mergeItems(remoteSkill?.evidences || [], localSkill?.evidences || []) };
  });
}

export function mergeLifeStates(remoteRaw, localRaw) {
  if (!remoteRaw) return normalizeLifeState(localRaw);
  if (!localRaw) return normalizeLifeState(remoteRaw);
  const remote = normalizeLifeState(remoteRaw);
  const local = normalizeLifeState(localRaw);
  return {
    version: LIFE_SCHEMA_VERSION,
    updatedAtClient: new Date(Math.max(Date.parse(remote.updatedAtClient) || 0, Date.parse(local.updatedAtClient) || 0)).toISOString(),
    rules: mergeItems(remote.rules, local.rules),
    ruleHistory: mergeItems(remote.ruleHistory, local.ruleHistory),
    vectors: mergeItems(remote.vectors, local.vectors),
    skillAreas: mergeItems(remote.skillAreas, local.skillAreas),
    skills: mergeSkills(remote.skills, local.skills),
    wishes: mergeItems(remote.wishes, local.wishes),
    events: mergeItems(remote.events, local.events),
    books: mergeItems(remote.books, local.books),
    plans: mergeItems(remote.plans, local.plans),
  };
}

export const active = (item) => !item?.deletedAt;
export const skillLevel = (skill) => Math.max(Number(skill?.level || 0), (skill?.evidences || []).filter((item) => !item.deletedAt).length);
export const skillBandProgress = (skill) => {
  const level = skillLevel(skill);
  return level === 0 ? 0 : ((level - 1) % 5) + 1;
};
export const progressFor = (item) => {
  const current = number(item.current ?? item.saved);
  const target = number(item.target ?? item.price);
  const start = number(item.start ?? 0);
  if (target === start) return current === target ? 100 : 0;
  const progress = target < start ? (start - current) / (start - target) : (current - start) / (target - start);
  return Math.max(0, Math.min(100, Math.round(progress * 100)));
};

export function addLifeEvent(state, event, now = new Date().toISOString()) {
  return { ...state, events: [...state.events, { id: createId('event'), date: event.date || todayKey(), type: event.type || 'life', title: event.title.trim(), description: event.description?.trim() || '', imageUrl: event.imageUrl || '', tags: event.tags || [], linked: event.linked || null, automatic: Boolean(event.automatic), createdAt: now, updatedAt: now, deletedAt: null }] };
}

export function calculateCharacter(life, marathon, steps) {
  const activeSkills = life.skills.filter(active);
  const evidences = activeSkills.flatMap((skill) => skill.evidences || []);
  const levelSum = activeSkills.reduce((sum, skill) => sum + skillLevel(skill), 0);
  const days = marathon?.days || [];
  const credited = days.filter((day) => day.result || day.score > 0);
  const green = credited.filter((day) => ['strong', 'expansion'].includes(day.result)).length;
  const workouts = marathon?.goals?.find((goal) => goal.id === 'acting') ? days.filter((day) => number(day.goalValues?.acting) > 0).length : 0;
  const courage = (steps?.executions || []).filter((item) => !item.deletedAt);
  const capital = life.vectors.find((item) => item.id === 'capital' && active(item));
  const completedWishes = life.wishes.filter((item) => active(item) && item.status === 'fulfilled');
  const completedPlans = (life.plans || []).filter((item) => active(item) && item.status === 'done');
  const attributes = [
    { id: 'discipline', title: 'Дисциплина', value: Math.min(100, Math.round((green / Math.max(1, credited.length)) * 70 + Math.min(30, green))) },
    { id: 'profession', title: 'Мастерство', value: Math.min(100, Math.round(Math.sqrt(Math.max(0, levelSum)) * 8 + Math.min(20, evidences.length))) },
    { id: 'knowledge', title: 'Знания', value: Math.min(100, Math.round((evidences.filter((item) => ['test', 'note', 'code'].includes(item.type)).length + (life.books?.length || 0) * 5) * 3)) },
    { id: 'body', title: 'Тело', value: Math.min(100, Math.round((days.filter((day) => number(day.steps) >= 8000).length + workouts * 2) * 3)) },
    { id: 'courage', title: 'Смелость', value: Math.min(100, courage.reduce((sum, item) => sum + Number(item.points || 0), 0) + completedPlans.length * 2) },
    { id: 'capital', title: 'Капитал', value: progressFor(capital || {}) },
  ];
  const achievements = [
    ['first-green', 'Первый зелёный день', green >= 1], ['green-7', '7 сильных дней', green >= 7], ['green-30', '30 сильных дней', green >= 30],
    ['skill-3', 'Первый навык уровня 3', activeSkills.some((skill) => skillLevel(skill) >= 3)], ['evidence-10', '10 доказательств развития', evidences.length >= 10], ['evidence-100', '100 доказательств развития', evidences.length >= 100],
    ['first-brave', 'Первый смелый шаг', courage.length >= 1], ['brave-10', '10 шагов смелости', courage.length >= 10],
    ['wish-first', 'Первое осуществлённое желание', completedWishes.length >= 1], ['plan-10', '10 выполненных планов', completedPlans.length >= 10],
    ['capital-100', '100 000 ₽ капитала', number(capital?.current) >= 100000], ['capital-250', '250 000 ₽ капитала', number(capital?.current) >= 250000],
  ].map(([id, title, earned]) => ({ id, title, earned }));
  const experience = evidences.length * 10 + green * 20 + courage.reduce((sum, item) => sum + Number(item.points || 0), 0) + completedWishes.length * 100 + completedPlans.length * 30;
  return { attributes, achievements, level: Math.max(1, Math.floor(experience / 100) + 1), experience, nextLevelAt: Math.max(100, (Math.floor(experience / 100) + 1) * 100), evidences: evidences.length };
}

export function factualPatterns(marathon) {
  const days = (marathon?.days || []).filter((day) => day.result || day.draftSavedAt);
  if (days.length < 7) return [{ id: 'insufficient', text: 'Пока недостаточно данных. Нужно минимум 7 заполненных дней.' }];
  const green = (items) => items.filter((day) => ['strong', 'expansion'].includes(day.result)).length;
  const active = days.filter((day) => number(day.steps) >= 8000);
  const quiet = days.filter((day) => number(day.steps) < 8000);
  const rate = (items) => items.length ? Math.round(green(items) / items.length * 100) : null;
  const patterns = [];
  if (active.length >= 3 && quiet.length >= 3) patterns.push({ id: 'steps-green', text: `В дни с 8 000+ шагов сильными были ${rate(active)}% дней, в остальные — ${rate(quiet)}%.` });
  const calories = days.filter((day) => number(day.calories));
  if (calories.length >= 5) patterns.push({ id: 'calories', text: `По ${calories.length} отметкам среднее питание — ${Math.round(calories.reduce((sum, day) => sum + number(day.calories), 0) / calories.length)} ккал.` });
  return patterns.length ? patterns : [{ id: 'insufficient-split', text: 'Данные уже есть, но пока мало сравнимых групп для фактического наблюдения.' }];
}

export function loadLifeCache(uid) {
  try { return JSON.parse(localStorage.getItem(`${LIFE_CACHE_KEY}:${uid}`) || 'null'); } catch { return null; }
}

export function saveLifeCache(uid, state) {
  try { localStorage.setItem(`${LIFE_CACHE_KEY}:${uid}`, JSON.stringify(state)); return true; } catch { return false; }
}
