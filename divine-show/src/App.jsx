import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  AlertCircle,
  BarChart3,
  BrainCircuit,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Copy,
  Download,
  FileText,
  Flag,
  Flame,
  Heart,
  History,
  LineChart,
  Lock,
  Play,
  RotateCcw,
  Scale,
  Sparkles,
  Star,
  Target,
  Timer,
  Trophy,
  Utensils,
  XCircle,
  Zap,
} from 'lucide-react';

const TOTAL_DAYS = 120;
const STORAGE_KEY = 'offer-growth-120-v1';
const CALORIE_TOP = 1800;
const CALORIE_LIMIT = 2300;
const LEVEL_STEP = 650;
const CHECKPOINT_DAYS = [7, 14, 30, 60, 90, 120];

const TIERS = {
  base: {
    id: 'base',
    title: 'Поддержание',
    short: 'База',
    xp: 50,
    color: '#7c9a78',
    bg: '#eef6e9',
    border: '#cfe2c8',
    text: '#365f36',
    description: 'Минимум закрыт. Ты остался на линии роста.',
  },
  growth: {
    id: 'growth',
    title: 'Рост',
    short: 'Рост',
    xp: 110,
    color: '#4f8fb9',
    bg: '#eaf5fb',
    border: '#c8e1ef',
    text: '#255b7a',
    description: 'День заметно двинул форму, 1С и рынок.',
  },
  breakthrough: {
    id: 'breakthrough',
    title: 'Прорыв',
    short: 'Топ',
    xp: 190,
    color: '#d18b47',
    bg: '#fff3df',
    border: '#f1d2a7',
    text: '#81501f',
    description: 'Топовый день. Есть фокус, доказательства и чистая дисциплина.',
  },
};

const PROOF_TYPES = [
  '1С обучение',
  'Практика 1С',
  'Конспект',
  'Сертификат',
  'Проект',
  'Задача',
  'Разбор вакансий',
  'Резюме',
  'Отклик',
  'Собеседование',
  'Тестовое',
  'Портфолио',
  'Другое',
];

const SIGNALS = [
  { minXp: 1200, text: 'Собран первый устойчивый контур. Движение видно.' },
  { minXp: 2800, text: 'Появился ритм. Теперь система начинает работать на тебя.' },
  { minXp: 5200, text: 'Ты уже не вспоминаешь цель. Ты в ней живёшь.' },
  { minXp: 9000, text: 'Рынок стал не страхом, а следствием твоей траектории.' },
];

const todayKey = () => toDateKey(new Date());

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateFromKey(key) {
  return new Date(`${key}T00:00:00`);
}

function addDays(dateKey, offset) {
  const date = dateFromKey(dateKey);
  date.setDate(date.getDate() + offset);
  return toDateKey(date);
}

function formatDate(dateKey) {
  return dateFromKey(dateKey).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
  }).replace('.', '');
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function num(value) {
  const parsed = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function createDay(day, startDate) {
  return {
    day,
    date: addDays(startDate, day - 1),
    nsDone: false,
    nsMinutes: '',
    offerMinutes: '',
    offerAction: '',
    artifactType: '',
    proofs: [],
    calories: '',
    meals: '',
    weight: '',
    summary: '',
    result: null,
    xp: 0,
    closedAt: null,
  };
}

function createInitialState(startDate = todayKey()) {
  return {
    version: 1,
    startDate,
    createdAt: new Date().toISOString(),
    days: Array.from({ length: TOTAL_DAYS }, (_, index) => createDay(index + 1, startDate)),
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.days?.length || !parsed.startDate) return null;
    return {
      ...parsed,
      days: Array.from({ length: TOTAL_DAYS }, (_, index) => ({
        ...createDay(index + 1, parsed.startDate),
        ...parsed.days[index],
        day: index + 1,
        date: addDays(parsed.startDate, index),
        proofs: Array.isArray(parsed.days[index]?.proofs)
          ? parsed.days[index].proofs
          : parsed.days[index]?.artifactType
            ? [parsed.days[index].artifactType]
            : [],
      })),
    };
  } catch {
    return null;
  }
}

function getCurrentDayIndex(startDate) {
  const start = dateFromKey(startDate).getTime();
  const today = dateFromKey(todayKey()).getTime();
  return clamp(Math.floor((today - start) / 86400000), 0, TOTAL_DAYS - 1);
}

function evaluateDay(day) {
  const nsMinutes = num(day.nsMinutes);
  const offerMinutes = num(day.offerMinutes);
  const calories = num(day.calories);
  const meals = num(day.meals);
  const weight = num(day.weight);
  const hasNs = nsMinutes >= 10;
  const hasOffer = offerMinutes >= 25 && day.offerAction.trim().length >= 5;
  const hasNutrition = calories > 0 && calories <= CALORIE_LIMIT && meals >= 1 && meals <= 3;
  const hasWeight = weight > 0;
  const hasSummary = day.summary.trim().length >= 5;
  const proofs = Array.isArray(day.proofs) ? day.proofs : [];
  const hasProof = proofs.length > 0;

  const score = [
    hasNs ? 22 : nsMinutes > 0 ? 12 : 0,
    hasOffer ? 24 : offerMinutes > 0 || day.offerAction.trim() ? 12 : 0,
    hasNutrition ? 20 : calories > 0 || meals > 0 ? 8 : 0,
    hasWeight ? 12 : 0,
    hasProof ? 12 : 0,
    hasSummary ? 10 : 0,
  ].reduce((sum, value) => sum + value, 0);

  const blockers = [];
  if (!hasNs) blockers.push('Опора: минимум 10 минут ресурса или восстановления');
  if (!hasOffer) blockers.push('1С/рынок: минимум 25 минут и конкретное действие');
  if (!hasNutrition) blockers.push('Питание: до 2300 ккал и 1-3 приёма пищи');
  if (!hasWeight) blockers.push('Вес: внеси текущий вес');

  if (!(hasNs && hasOffer && hasNutrition && hasWeight)) {
    return {
      id: 'draft',
      title: 'Черновик',
      short: 'Черновик',
      xp: 0,
      color: '#94a3b8',
      bg: '#f1f5f9',
      border: '#dbe3eb',
      text: '#475569',
      score,
      blockers,
      description: 'День ещё не даёт чистого результата.',
    };
  }

  let tier = TIERS.base;
  if (offerMinutes >= 60 && hasSummary && (hasProof || day.offerAction.trim().length >= 24)) {
    tier = TIERS.growth;
  }
  if (offerMinutes >= 120 && calories <= CALORIE_TOP && nsMinutes >= 20 && hasProof && hasSummary) {
    tier = TIERS.breakthrough;
  }

  return { ...tier, score, blockers: [], description: tier.description };
}

function calculateStats(days, currentDayIndex) {
  const elapsedDays = days.slice(0, currentDayIndex + 1);
  const closedDays = elapsedDays.filter((day) => day.result);
  const xp = days.reduce((sum, day) => sum + (day.xp || 0), 0);
  const level = Math.max(1, Math.floor(xp / LEVEL_STEP) + 1);
  const levelProgress = Math.round(((xp % LEVEL_STEP) / LEVEL_STEP) * 100);
  const tierCounts = closedDays.reduce((acc, day) => {
    acc[day.result] = (acc[day.result] || 0) + 1;
    return acc;
  }, {});

  const calories = closedDays.map((day) => num(day.calories)).filter(Boolean);
  const avgCalories = calories.length
    ? Math.round(calories.reduce((sum, value) => sum + value, 0) / calories.length)
    : 0;

  const weights = closedDays.map((day) => ({ day: day.day, value: num(day.weight) })).filter((item) => item.value);
  const firstWeight = weights[0]?.value || 0;
  const lastWeight = weights.at(-1)?.value || 0;
  const weightDelta = firstWeight && lastWeight ? Number((lastWeight - firstWeight).toFixed(1)) : 0;

  const offerMinutes = closedDays.reduce((sum, day) => sum + num(day.offerMinutes), 0);
  const nsMinutes = closedDays.reduce((sum, day) => sum + num(day.nsMinutes), 0);
  const focusMinutes = offerMinutes + nsMinutes;
  const proofs = closedDays.reduce((sum, day) => sum + (Array.isArray(day.proofs) ? day.proofs.length : 0), 0);
  const foodOverLimit = closedDays.filter((day) => num(day.calories) > CALORIE_LIMIT).length;
  const emptyDays = elapsedDays.filter((day) => !day.result).length;
  const completionRate = elapsedDays.length ? Math.round((closedDays.length / elapsedDays.length) * 100) : 0;

  const streak = [...elapsedDays].reverse().reduce((acc, day) => {
    if (acc.done) return acc;
    if (day.result) return { count: acc.count + 1, done: false };
    return { count: acc.count, done: true };
  }, { count: 0, done: false }).count;

  const breakthroughStreak = [...elapsedDays].reverse().reduce((acc, day) => {
    if (acc.done) return acc;
    if (day.result === 'breakthrough') return { count: acc.count + 1, done: false };
    return { count: acc.count, done: true };
  }, { count: 0, done: false }).count;

  return {
    elapsedDays,
    closedDays,
    xp,
    level,
    levelProgress,
    tierCounts,
    avgCalories,
    firstWeight,
    lastWeight,
    weightDelta,
    offerMinutes,
    nsMinutes,
    focusMinutes,
    proofs,
    foodOverLimit,
    emptyDays,
    completionRate,
    streak,
    breakthroughStreak,
  };
}

function getWeeks(days) {
  return Array.from({ length: Math.ceil(TOTAL_DAYS / 7) }, (_, index) => {
    const weekDays = days.slice(index * 7, index * 7 + 7);
    const closed = weekDays.filter((day) => day.result);
    const xp = closed.reduce((sum, day) => sum + (day.xp || 0), 0);
    const offer = closed.reduce((sum, day) => sum + num(day.offerMinutes), 0);
    const ns = closed.reduce((sum, day) => sum + num(day.nsMinutes), 0);
    const avgCalories = closed.length
      ? Math.round(closed.reduce((sum, day) => sum + num(day.calories), 0) / closed.length)
      : 0;
    const weights = closed.map((day) => num(day.weight)).filter(Boolean);
    const weightDelta = weights.length > 1 ? Number((weights.at(-1) - weights[0]).toFixed(1)) : 0;
    return {
      number: index + 1,
      from: weekDays[0]?.day,
      to: weekDays.at(-1)?.day,
      closed,
      xp,
      offer,
      ns,
      avgCalories,
      weightDelta,
      breakthrough: closed.filter((day) => day.result === 'breakthrough').length,
      growth: closed.filter((day) => day.result === 'growth').length,
      base: closed.filter((day) => day.result === 'base').length,
    };
  });
}

function getTrendLabel(weightDelta) {
  if (!weightDelta) return { label: 'данных мало', tone: 'text-slate-500', icon: Activity };
  if (weightDelta < -0.4) return { label: 'вес уходит вниз', tone: 'text-emerald-700', icon: TrendingDownIcon };
  if (weightDelta > 0.4) return { label: 'вес растёт', tone: 'text-rose-700', icon: TrendingUpIcon };
  return { label: 'вес держится', tone: 'text-sky-700', icon: Activity };
}

function buildExport(state, stats, weeks) {
  const closed = state.days.filter((day) => day.result);
  const checkpoints = CHECKPOINT_DAYS.map((dayNumber) => checkpointSummary(state.days, dayNumber));
  const markdown = [
    '# 120 дней роста: экспорт для анализа',
    '',
    `Старт: ${state.startDate}`,
    `Дней прошло: ${stats.elapsedDays.length}/${TOTAL_DAYS}`,
    `Закрыто дней: ${stats.closedDays.length}`,
    `XP: ${stats.xp}, уровень: ${stats.level}`,
    `1С/рынок часы: ${(stats.offerMinutes / 60).toFixed(1)}`,
    `Ресурс/опора часы: ${(stats.nsMinutes / 60).toFixed(1)}`,
    `Средние калории: ${stats.avgCalories || 'нет данных'}`,
    `Вес: ${stats.firstWeight || 'нет'} -> ${stats.lastWeight || 'нет'} кг, дельта ${stats.weightDelta} кг`,
    '',
    '## Вопрос к нейросети',
    'Проанализируй мой 120-дневный путь. Найди паттерны роста, причины просадок, связь 1С/рынок действий с результатом, связь питания/веса с энергией. Объясни, почему я приближаюсь к офферу, идеальной форме и сильному рыночному состоянию или почему не добираю. Дай 3 главных рычага на следующую неделю.',
    '',
    '## Недельные итоги',
    ...weeks.filter((week) => week.closed.length).map((week) => (
      `- Неделя ${week.number}: закрыто ${week.closed.length}/7, XP ${week.xp}, 1С/рынок ${(week.offer / 60).toFixed(1)} ч, ресурс ${(week.ns / 60).toFixed(1)} ч, средние ккал ${week.avgCalories || '-'}, вес ${week.weightDelta > 0 ? '+' : ''}${week.weightDelta} кг, топ-дней ${week.breakthrough}.`
    )),
    '',
    '## Чекпоинты',
    ...checkpoints.map((item) => (
      `- День ${item.day}: закрыто ${item.closed}/${item.elapsed}, XP ${item.xp}, 1С/рынок ${(item.offerMinutes / 60).toFixed(1)} ч, средние ккал ${item.avgCalories || '-'}, вес ${item.weightDelta > 0 ? '+' : ''}${item.weightDelta} кг.`
    )),
    '',
    '## Дни',
    ...closed.map((day) => (
      `- День ${day.day} (${day.date}): ${TIERS[day.result]?.title || day.result}, XP ${day.xp}, ресурс ${day.nsMinutes} мин, 1С/рынок ${day.offerMinutes} мин, ккал ${day.calories}, приёмов ${day.meals}, вес ${day.weight} кг, доказательства: ${(day.proofs || []).join(', ') || '-'}, действие: ${day.offerAction}, итог: ${day.summary || '-'}`
    )),
  ].join('\n');

  const json = JSON.stringify({
    meta: {
      startDate: state.startDate,
      totalDays: TOTAL_DAYS,
      exportedAt: new Date().toISOString(),
    },
    stats,
    weeks,
    checkpoints,
    days: state.days,
  }, null, 2);

  return { markdown, json };
}

function checkpointSummary(days, dayNumber) {
  const slice = days.slice(0, dayNumber);
  const closed = slice.filter((day) => day.result);
  const calories = closed.map((day) => num(day.calories)).filter(Boolean);
  const weights = closed.map((day) => num(day.weight)).filter(Boolean);
  return {
    day: dayNumber,
    elapsed: slice.length,
    closed: closed.length,
    xp: closed.reduce((sum, day) => sum + (day.xp || 0), 0),
    offerMinutes: closed.reduce((sum, day) => sum + num(day.offerMinutes), 0),
    avgCalories: calories.length ? Math.round(calories.reduce((sum, value) => sum + value, 0) / calories.length) : 0,
    weightDelta: weights.length > 1 ? Number((weights.at(-1) - weights[0]).toFixed(1)) : 0,
    topDays: closed.filter((day) => day.result === 'breakthrough').length,
  };
}

function App() {
  const [state, setState] = useState(() => loadState());
  const currentDayIndex = useMemo(
    () => state ? getCurrentDayIndex(state.startDate) : 0,
    [state],
  );
  const [activeDayIndex, setActiveDayIndex] = useState(currentDayIndex);
  const [showExport, setShowExport] = useState(false);
  const [exportMode, setExportMode] = useState('markdown');
  const [copied, setCopied] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (!state) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const stats = useMemo(
    () => state ? calculateStats(state.days, currentDayIndex) : null,
    [state, currentDayIndex],
  );
  const weeks = useMemo(() => state ? getWeeks(state.days) : [], [state]);
  const safeActiveDayIndex = state ? clamp(activeDayIndex, 0, currentDayIndex) : 0;
  const activeDay = state?.days?.[safeActiveDayIndex] || null;
  const activeEvaluation = useMemo(() => activeDay ? evaluateDay(activeDay) : null, [activeDay]);
  const currentWeek = weeks[Math.floor(currentDayIndex / 7)] || weeks[0];
  const exportData = useMemo(
    () => state && stats ? buildExport(state, stats, weeks) : { markdown: '', json: '' },
    [state, stats, weeks],
  );

  const latestSignal = useMemo(() => {
    if (!stats) return null;
    return [...SIGNALS].reverse().find((signal) => stats.xp >= signal.minXp);
  }, [stats]);

  if (!state || !stats) {
    return <StartScreen onStart={() => setState(createInitialState())} />;
  }

  const updateActiveDay = (nextDay) => {
    setState((prev) => ({
      ...prev,
      days: prev.days.map((day, index) => (
        index === safeActiveDayIndex
          ? { ...nextDay, result: null, xp: 0, closedAt: null }
          : day
      )),
    }));
  };

  const saveDay = () => {
    const evaluation = evaluateDay(activeDay);
    const nextDays = state.days.map((day, index) => {
      if (index !== safeActiveDayIndex) return day;
      const result = evaluation.id === 'draft' ? null : evaluation.id;
      return {
        ...activeDay,
        result,
        xp: result ? evaluation.xp : 0,
        closedAt: result ? new Date().toISOString() : null,
      };
    });
    setState({ ...state, days: nextDays });
  };

  const resetJourney = () => {
    localStorage.removeItem(STORAGE_KEY);
    setConfirmReset(false);
    setState(null);
  };

  const copyExport = async () => {
    const text = exportMode === 'markdown' ? exportData.markdown : exportData.json;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const downloadExport = () => {
    const isMarkdown = exportMode === 'markdown';
    const blob = new Blob([isMarkdown ? exportData.markdown : exportData.json], {
      type: isMarkdown ? 'text/markdown;charset=utf-8' : 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = isMarkdown ? 'offer-growth-120-export.md' : 'offer-growth-120-export.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#fbf7ef] text-slate-900">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(90deg,rgba(59,130,246,0.06)_1px,transparent_1px),linear-gradient(rgba(20,83,45,0.05)_1px,transparent_1px)] bg-[size:44px_44px]" />
      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <Header
          stats={stats}
          currentDayIndex={currentDayIndex}
          onExport={() => setShowExport(true)}
          onReset={() => setConfirmReset(true)}
        />

        <section className="grid gap-4 lg:grid-cols-[1.05fr_1.35fr]">
          <TodayPanel
            day={activeDay}
            evaluation={activeEvaluation}
            onChange={updateActiveDay}
            onSave={saveDay}
            activeDayIndex={safeActiveDayIndex}
            currentDayIndex={currentDayIndex}
          />

          <PathPanel
            days={state.days}
            activeDayIndex={safeActiveDayIndex}
            currentDayIndex={currentDayIndex}
            onSelect={(index) => {
              setActiveDayIndex(index);
            }}
            stats={stats}
            signal={latestSignal}
          />
        </section>

        <Dashboard days={state.days} stats={stats} currentWeek={currentWeek} weeks={weeks} />
        <Checkpoints days={state.days} currentDayIndex={currentDayIndex} />
      </div>

      <AnimatePresence>
        {showExport && (
          <ExportModal
            exportMode={exportMode}
            setExportMode={setExportMode}
            data={exportMode === 'markdown' ? exportData.markdown : exportData.json}
            copied={copied}
            onCopy={copyExport}
            onDownload={downloadExport}
            onClose={() => setShowExport(false)}
          />
        )}

        {confirmReset && (
          <ConfirmReset onCancel={() => setConfirmReset(false)} onConfirm={resetJourney} />
        )}
      </AnimatePresence>
    </div>
  );
}

function StartScreen({ onStart }) {
  return (
    <div className="min-h-screen bg-[#fbf7ef] text-slate-900">
      <div className="mx-auto grid min-h-screen max-w-6xl place-items-center px-4 py-10">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid w-full gap-6 lg:grid-cols-[1fr_0.82fr]"
        >
          <div className="border border-[#eadfcd] bg-[#fffaf1] p-6 shadow-sm sm:p-8 rounded-lg">
            <div className="mb-8 inline-flex items-center gap-2 border border-[#d6e5d2] bg-[#eef7eb] px-3 py-2 text-sm font-semibold text-[#436841] rounded-md">
              <Sparkles size={18} />
              120 дней роста
            </div>
            <h1 className="max-w-3xl text-4xl font-black leading-tight text-slate-950 sm:text-5xl">
              Форма, 1С и рынок в одной живой панели
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
              Старт фиксируется сегодняшней датой. Дальше приложение считает 120 дней,
              показывает рост по времени, весу, питанию, доказательствам и результатам.
            </p>
            <button
              onClick={onStart}
              className="mt-8 inline-flex items-center gap-2 bg-slate-950 px-5 py-3 font-bold text-white shadow-sm transition hover:bg-slate-800 rounded-md"
            >
              <Play size={18} />
              Начать сегодня
            </button>
          </div>

          <div className="grid gap-3">
            <StartMetric icon={<Target size={20} />} title="1С и рынок" text="Учёба, практика, проект, вакансии, резюме, отклики." />
            <StartMetric icon={<Utensils size={20} />} title="Питание" text="1800 как топ, 2300 как верхняя граница." />
            <StartMetric icon={<Scale size={20} />} title="Вес" text="График покажет, куда реально идёт тело." />
            <StartMetric icon={<BrainCircuit size={20} />} title="Опора" text="Ресурс, восстановление и внутренняя устойчивость." />
          </div>
        </motion.section>
      </div>
    </div>
  );
}

function StartMetric({ icon, title, text }) {
  return (
    <div className="border border-[#e7ddca] bg-white/75 p-5 shadow-sm rounded-lg">
      <div className="mb-3 flex items-center gap-3 text-slate-900">
        <span className="grid h-10 w-10 place-items-center bg-[#eff6ff] text-[#356d92] rounded-md">{icon}</span>
        <h2 className="text-lg font-black">{title}</h2>
      </div>
      <p className="leading-7 text-slate-600">{text}</p>
    </div>
  );
}

function Header({ stats, currentDayIndex, onExport, onReset }) {
  return (
    <header className="border border-[#eadfcd] bg-white/85 p-4 shadow-sm backdrop-blur rounded-lg">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm font-semibold text-[#5c7955]">
            <CalendarDays size={16} />
            День {currentDayIndex + 1} из {TOTAL_DAYS}
            <span className="text-slate-300">/</span>
            Уровень {stats.level}
          </div>
          <h1 className="text-3xl font-black leading-tight text-slate-950 sm:text-4xl">
            120 дней: форма, 1С, рынок
          </h1>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex">
          <HeaderPill icon={<Flame size={16} />} label="XP" value={stats.xp} />
          <HeaderPill icon={<Target size={16} />} label="1С/рынок" value={`${(stats.offerMinutes / 60).toFixed(1)} ч`} />
          <HeaderPill icon={<Scale size={16} />} label="Вес" value={stats.lastWeight ? `${stats.lastWeight} кг` : '--'} />
          <button
            onClick={onExport}
            className="inline-flex items-center justify-center gap-2 border border-[#c8d9e7] bg-[#edf7ff] px-3 py-2 text-sm font-bold text-[#255b7a] transition hover:bg-[#dff0fc] rounded-md"
          >
            <Download size={16} />
            Экспорт
          </button>
          <button
            onClick={onReset}
            className="inline-flex items-center justify-center gap-2 border border-[#ecd3c6] bg-[#fff4ed] px-3 py-2 text-sm font-bold text-[#8a4b2d] transition hover:bg-[#ffe9dc] rounded-md"
          >
            <RotateCcw size={16} />
            Старт
          </button>
        </div>
      </div>
      <div className="mt-4 h-3 overflow-hidden bg-[#edf1e8] rounded-md">
        <div
          className="h-full bg-[#7c9a78] transition-all duration-700"
          style={{ width: `${stats.levelProgress}%` }}
        />
      </div>
    </header>
  );
}

function HeaderPill({ icon, label, value }) {
  return (
    <div className="inline-flex items-center gap-2 border border-[#e5dccb] bg-[#fffaf1] px-3 py-2 rounded-md">
      <span className="text-[#7c9a78]">{icon}</span>
      <span className="text-xs font-semibold text-slate-500">{label}</span>
      <span className="font-black text-slate-950">{value}</span>
    </div>
  );
}

function TodayPanel({ day, evaluation, onChange, onSave, activeDayIndex, currentDayIndex }) {
  if (!day) return null;
  const editable = activeDayIndex <= currentDayIndex;
  const tier = evaluation.id === 'draft' ? evaluation : TIERS[evaluation.id];

  return (
    <section className="border border-[#eadfcd] bg-white/90 p-4 shadow-sm rounded-lg">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="mb-1 text-sm font-bold text-slate-500">{formatDate(day.date)}</div>
          <h2 className="text-2xl font-black text-slate-950">День {day.day}</h2>
        </div>
        <ResultBadge evaluation={evaluation} />
      </div>

      <div className="mb-5 grid gap-2 sm:grid-cols-3">
        <ScoreChip label="Калории" value={day.calories ? `${day.calories}` : '--'} tone={num(day.calories) <= CALORIE_TOP && num(day.calories) > 0 ? 'top' : num(day.calories) <= CALORIE_LIMIT && num(day.calories) > 0 ? 'ok' : 'draft'} />
        <ScoreChip label="1С/рынок" value={day.offerMinutes ? `${day.offerMinutes} мин` : '--'} tone={num(day.offerMinutes) >= 120 ? 'top' : num(day.offerMinutes) >= 60 ? 'ok' : 'draft'} />
        <ScoreChip label="Score" value={`${evaluation.score}%`} tone={evaluation.id === 'breakthrough' ? 'top' : evaluation.id !== 'draft' ? 'ok' : 'draft'} />
      </div>

      <div className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <NumberField
            icon={<BrainCircuit size={18} />}
            label="Опора / ресурс, минуты"
            value={day.nsMinutes}
            disabled={!editable}
            min="0"
            onChange={(value) => onChange({ ...day, nsMinutes: value, nsDone: num(value) >= 10 })}
          />
          <NumberField
            icon={<Target size={18} />}
            label="1С / рынок, минуты"
            value={day.offerMinutes}
            disabled={!editable}
            min="0"
            onChange={(value) => onChange({ ...day, offerMinutes: value })}
          />
        </div>

        <ProofPicker
          value={day.proofs || []}
          disabled={!editable}
          onChange={(proofs) => onChange({ ...day, proofs, artifactType: proofs[0] || '' })}
        />

        <TextField
          icon={<Zap size={18} />}
          label="Что сегодня приблизило к форме, 1С или рынку?"
          value={day.offerAction}
          disabled={!editable}
          placeholder="Например: 1С Skillbox, практика, сертификат, проект, разбор вакансий, резюме"
          onChange={(value) => onChange({ ...day, offerAction: value })}
        />

        <div className="grid gap-3 sm:grid-cols-3">
          <NumberField
            icon={<Utensils size={18} />}
            label="Калории"
            value={day.calories}
            disabled={!editable}
            min="0"
            onChange={(value) => onChange({ ...day, calories: value })}
          />
          <NumberField
            icon={<Activity size={18} />}
            label="Приёмы пищи"
            value={day.meals}
            disabled={!editable}
            min="0"
            onChange={(value) => onChange({ ...day, meals: value })}
          />
          <NumberField
            icon={<Scale size={18} />}
            label="Вес, кг"
            value={day.weight}
            disabled={!editable}
            min="0"
            step="0.1"
            onChange={(value) => onChange({ ...day, weight: value })}
          />
        </div>

        <TextField
          icon={<Heart size={18} />}
          label="Что стало сильнее во мне или системе?"
          value={day.summary}
          disabled={!editable}
          placeholder="Одна строка результата без лишней рефлексии"
          onChange={(value) => onChange({ ...day, summary: value })}
        />
      </div>

      <div className="mt-5 border border-[#e8dfce] bg-[#fffaf1] p-4 rounded-lg">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <div className="text-sm font-bold text-slate-500">Живой результат</div>
            <div className="text-xl font-black" style={{ color: tier.text }}>{evaluation.title}</div>
          </div>
          <div className="text-right">
            <div className="text-sm font-bold text-slate-500">XP</div>
            <div className="text-2xl font-black text-slate-950">+{evaluation.xp}</div>
          </div>
        </div>
        <div className="h-2 overflow-hidden bg-white rounded-md">
          <div
            className="h-full transition-all duration-500"
            style={{ width: `${evaluation.score}%`, backgroundColor: tier.color }}
          />
        </div>
        {evaluation.blockers.length > 0 && (
          <div className="mt-3 grid gap-2">
            {evaluation.blockers.map((blocker) => (
              <div key={blocker} className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                <AlertCircle size={15} className="text-[#d18b47]" />
                {blocker}
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={onSave}
        disabled={!editable}
        className="mt-4 flex w-full items-center justify-center gap-2 bg-slate-950 px-4 py-3 font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 rounded-md"
      >
        <CheckCircle2 size={18} />
        Зафиксировать день
      </button>
    </section>
  );
}

function ProofPicker({ value, onChange, disabled }) {
  const selected = Array.isArray(value) ? value : [];
  const toggleProof = (proof) => {
    if (selected.includes(proof)) {
      onChange(selected.filter((item) => item !== proof));
      return;
    }
    onChange([...selected, proof]);
  };

  return (
    <div className="border border-[#e8dfce] bg-white p-3 rounded-lg">
      <span className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-600">
        <FileText size={18} />
        Доказательства дня
      </span>
      <div className="flex flex-wrap gap-2">
        {PROOF_TYPES.map((proof) => {
          const isSelected = selected.includes(proof);
          return (
            <button
              key={proof}
              type="button"
              disabled={disabled}
              onClick={() => toggleProof(proof)}
              className={`inline-flex items-center gap-2 border px-3 py-2 text-sm font-bold transition rounded-md ${
                isSelected
                  ? 'border-[#cfe2c8] bg-[#eef6e9] text-[#365f36]'
                  : 'border-[#e8dfce] bg-[#fffdf8] text-slate-600 hover:bg-[#fffaf1]'
              }`}
            >
              {isSelected ? <CheckCircle2 size={15} /> : <span className="h-[15px] w-[15px] border border-slate-300 rounded-sm" />}
              {proof}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function NumberField({ icon, label, value, onChange, disabled, min, step = '1' }) {
  return (
    <label className="block border border-[#e8dfce] bg-white p-3 rounded-lg">
      <span className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-600">
        {icon}
        {label}
      </span>
      <input
        type="number"
        value={value}
        min={min}
        step={step}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="w-full border border-[#e6dcc8] bg-[#fffdf8] px-3 py-2 text-lg font-black text-slate-950 outline-none transition focus:border-[#8fb989] disabled:text-slate-400 rounded-md"
      />
    </label>
  );
}

function TextField({ icon, label, value, onChange, disabled, placeholder }) {
  return (
    <label className="block border border-[#e8dfce] bg-white p-3 rounded-lg">
      <span className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-600">
        {icon}
        {label}
      </span>
      <textarea
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-20 w-full resize-none border border-[#e6dcc8] bg-[#fffdf8] px-3 py-2 text-base font-semibold leading-6 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#8fb989] disabled:text-slate-400 rounded-md"
      />
    </label>
  );
}

function ResultBadge({ evaluation }) {
  const tier = evaluation.id === 'draft' ? evaluation : TIERS[evaluation.id];
  return (
    <div
      className="inline-flex items-center gap-2 border px-3 py-2 text-sm font-black rounded-md"
      style={{ backgroundColor: tier.bg, borderColor: tier.border, color: tier.text }}
    >
      {evaluation.id === 'breakthrough' ? <Trophy size={17} /> : evaluation.id === 'growth' ? <Sparkles size={17} /> : <CheckCircle2 size={17} />}
      {evaluation.short}
    </div>
  );
}

function ScoreChip({ label, value, tone }) {
  const styles = {
    top: 'border-[#f1d2a7] bg-[#fff3df] text-[#81501f]',
    ok: 'border-[#c8e1ef] bg-[#eaf5fb] text-[#255b7a]',
    draft: 'border-[#e8dfce] bg-[#fffaf1] text-slate-600',
  };
  return (
    <div className={`border p-3 rounded-lg ${styles[tone]}`}>
      <div className="text-xs font-bold">{label}</div>
      <div className="mt-1 text-xl font-black">{value}</div>
    </div>
  );
}

function PathPanel({ days, activeDayIndex, currentDayIndex, onSelect, stats, signal }) {
  return (
    <section className="border border-[#eadfcd] bg-white/90 p-4 shadow-sm rounded-lg">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm font-bold text-slate-500">
            <Flag size={16} />
            Путь 120 дней
          </div>
          <h2 className="text-2xl font-black text-slate-950">Рост видно на дистанции</h2>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <MiniStat label="База" value={stats.tierCounts.base || 0} />
          <MiniStat label="Рост" value={stats.tierCounts.growth || 0} />
          <MiniStat label="Топ" value={stats.tierCounts.breakthrough || 0} />
        </div>
      </div>

      <div className="grid grid-cols-10 gap-1 sm:grid-cols-[repeat(15,minmax(0,1fr))] md:grid-cols-[repeat(20,minmax(0,1fr))]">
        {days.map((day, index) => {
          const locked = index > currentDayIndex;
          const tier = day.result ? TIERS[day.result] : null;
          const isActive = index === activeDayIndex;
          const isToday = index === currentDayIndex;
          return (
            <button
              key={day.day}
              type="button"
              disabled={locked}
              onClick={() => onSelect(index)}
              title={`День ${day.day}: ${day.result ? tier.title : locked ? 'будущий' : 'не отмечен'}`}
              className={`relative grid aspect-square min-h-[34px] place-items-center border text-xs font-black transition rounded-md ${
                locked ? 'cursor-not-allowed border-[#ede5d8] bg-[#f6f0e6] text-slate-300' : 'hover:scale-[1.03]'
              } ${isActive ? 'ring-2 ring-slate-950 ring-offset-2 ring-offset-white' : ''}`}
              style={{
                backgroundColor: tier ? tier.bg : isToday ? '#edf7ff' : '#fffdf8',
                borderColor: tier ? tier.border : isToday ? '#b9d9ed' : '#e8dfce',
                color: tier ? tier.text : isToday ? '#255b7a' : '#64748b',
              }}
            >
              {locked ? <Lock size={13} /> : day.day}
              {day.result === 'breakthrough' && <Star size={10} className="absolute right-1 top-1 fill-current" />}
            </button>
          );
        })}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <PathInsight icon={<Flame size={18} />} label="Серия" value={`${stats.streak} дн`} />
        <PathInsight icon={<Target size={18} />} label="Доказательства" value={stats.proofs} />
        <PathInsight icon={<CalendarDays size={18} />} label="Закрытие пути" value={`${stats.completionRate}%`} />
      </div>

      {signal && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 border border-[#d8e6d2] bg-[#f1f8ed] p-4 text-[#42653f] rounded-lg"
        >
          <div className="flex items-center gap-2 font-black">
            <Sparkles size={18} />
            {signal.text}
          </div>
        </motion.div>
      )}
    </section>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="min-w-[72px] border border-[#e8dfce] bg-[#fffaf1] px-3 py-2 rounded-md">
      <div className="text-lg font-black text-slate-950">{value}</div>
      <div className="text-xs font-bold text-slate-500">{label}</div>
    </div>
  );
}

function PathInsight({ icon, label, value }) {
  return (
    <div className="border border-[#e8dfce] bg-[#fffaf1] p-3 rounded-lg">
      <div className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-500">{icon}{label}</div>
      <div className="text-2xl font-black text-slate-950">{value}</div>
    </div>
  );
}

function Dashboard({ days, stats, currentWeek, weeks }) {
  const weightTrend = getTrendLabel(stats.weightDelta);
  const TrendIcon = weightTrend.icon;
  const diagnosis = getDiagnosis(stats, currentWeek);

  return (
    <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          icon={<LineChart size={18} />}
          title="Вес"
          subtitle={`${stats.firstWeight || '--'} -> ${stats.lastWeight || '--'} кг`}
          aside={<span className={`inline-flex items-center gap-1 text-sm font-black ${weightTrend.tone}`}><TrendIcon size={16} />{weightTrend.label}</span>}
        >
          <LineChartSvg
            data={days.map((day) => ({ day: day.day, value: num(day.weight) })).filter((item) => item.value)}
            color="#7c9a78"
            fill="#e5f2de"
            unit="кг"
            targetValue={stats.firstWeight ? stats.firstWeight - 5 : null}
          />
        </ChartCard>

        <ChartCard
          icon={<Utensils size={18} />}
          title="Калории"
          subtitle={`среднее ${stats.avgCalories || '--'} ккал`}
          aside={<span className="text-sm font-black text-[#81501f]">1800 / 2300</span>}
        >
          <LineChartSvg
            data={days.map((day) => ({ day: day.day, value: num(day.calories) })).filter((item) => item.value)}
            color="#d18b47"
            fill="#fff1dc"
            unit="ккал"
            guideValues={[CALORIE_TOP, CALORIE_LIMIT]}
          />
        </ChartCard>

        <ChartCard
          icon={<Timer size={18} />}
          title="Время"
          subtitle={`фокус ${(stats.focusMinutes / 60).toFixed(1)} ч`}
          aside={<span className="text-sm font-black text-[#255b7a]">опора + 1С</span>}
        >
          <TimeBars days={days} />
        </ChartCard>

        <ChartCard
          icon={<Target size={18} />}
          title="1С и рынок"
          subtitle={`${stats.proofs} доказательств`}
          aside={<span className="text-sm font-black text-[#365f36]">{(stats.offerMinutes / 60).toFixed(1)} ч</span>}
        >
          <OfferProgress days={days} />
        </ChartCard>
      </div>

      <div className="grid gap-4">
        <WeeklyPanel week={currentWeek} />
        <DiagnosisPanel items={diagnosis} />
        <WeeksStrip weeks={weeks} />
      </div>
    </section>
  );
}

function ChartCard({ icon, title, subtitle, aside, children }) {
  return (
    <div className="border border-[#eadfcd] bg-white/90 p-4 shadow-sm rounded-lg">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm font-bold text-slate-500">{icon}{title}</div>
          <div className="text-xl font-black text-slate-950">{subtitle}</div>
        </div>
        {aside}
      </div>
      {children}
    </div>
  );
}

function LineChartSvg({ data, color, fill, unit, guideValues = [], targetValue = null }) {
  if (!data.length) {
    return <EmptyChart text="Нужна первая отметка" />;
  }

  const values = data.map((item) => item.value);
  const guides = [...guideValues, targetValue].filter(Boolean);
  const minValue = Math.min(...values, ...guides);
  const maxValue = Math.max(...values, ...guides);
  const pad = Math.max(1, (maxValue - minValue) * 0.14);
  const yMin = minValue - pad;
  const yMax = maxValue + pad;
  const width = 420;
  const height = 180;
  const left = 34;
  const right = 12;
  const top = 12;
  const bottom = 28;

  const xFor = (day) => left + ((day - 1) / (TOTAL_DAYS - 1)) * (width - left - right);
  const yFor = (value) => top + ((yMax - value) / (yMax - yMin)) * (height - top - bottom);
  const line = data.map((item) => `${xFor(item.day)},${yFor(item.value)}`).join(' ');
  const area = data.length === 1
    ? `${xFor(data[0].day) - 3},${height - bottom} ${line} ${xFor(data[0].day) + 3},${height - bottom}`
    : `${left},${height - bottom} ${line} ${xFor(data.at(-1).day)},${height - bottom}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-[220px] w-full overflow-visible">
      {[0, 1, 2, 3].map((index) => {
        const y = top + index * ((height - top - bottom) / 3);
        return <line key={index} x1={left} y1={y} x2={width - right} y2={y} stroke="#e7ddca" strokeWidth="1" />;
      })}
      {[1, 30, 60, 90, 120].map((day) => (
        <g key={day}>
          <line x1={xFor(day)} y1={top} x2={xFor(day)} y2={height - bottom} stroke="#efe7d8" strokeWidth="1" />
          <text x={xFor(day)} y={height - 8} textAnchor="middle" fontSize="10" fill="#64748b">{day}</text>
        </g>
      ))}
      {guideValues.map((guide) => (
        <g key={guide}>
          <line x1={left} y1={yFor(guide)} x2={width - right} y2={yFor(guide)} stroke="#d18b47" strokeDasharray="5 5" strokeWidth="1.4" />
          <text x={left + 4} y={yFor(guide) - 5} fontSize="10" fill="#81501f">{guide}</text>
        </g>
      ))}
      {targetValue && (
        <g>
          <line x1={left} y1={yFor(targetValue)} x2={width - right} y2={yFor(targetValue)} stroke="#7c9a78" strokeDasharray="5 5" strokeWidth="1.4" />
          <text x={left + 4} y={yFor(targetValue) - 5} fontSize="10" fill="#365f36">-5 кг</text>
        </g>
      )}
      <polygon points={area} fill={fill} opacity="0.9" />
      <polyline points={line} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      {data.map((item) => (
        <g key={`${item.day}-${item.value}`}>
          <circle cx={xFor(item.day)} cy={yFor(item.value)} r="4.5" fill="#fffdf8" stroke={color} strokeWidth="3" />
          <title>{`День ${item.day}: ${item.value} ${unit}`}</title>
        </g>
      ))}
      <text x={left} y={top + 3} fontSize="10" fill="#64748b">{Math.round(yMax)} {unit}</text>
      <text x={left} y={height - bottom - 4} fontSize="10" fill="#64748b">{Math.round(yMin)} {unit}</text>
    </svg>
  );
}

function EmptyChart({ text }) {
  return (
    <div className="grid h-[220px] place-items-center border border-dashed border-[#e1d6c3] bg-[#fffaf1] text-center text-sm font-bold text-slate-500 rounded-lg">
      {text}
    </div>
  );
}

function TimeBars({ days }) {
  const filled = days.filter((day) => num(day.nsMinutes) || num(day.offerMinutes)).slice(-21);
  if (!filled.length) return <EmptyChart text="Время появится после первых отметок" />;
  const maxValue = Math.max(...filled.map((day) => num(day.nsMinutes) + num(day.offerMinutes)), 60);
  return (
    <div className="flex h-[220px] items-end gap-2 border border-[#e8dfce] bg-[#fffdf8] p-3 rounded-lg">
      {filled.map((day) => {
        const ns = num(day.nsMinutes);
        const offer = num(day.offerMinutes);
        const total = ns + offer;
        return (
          <div key={day.day} className="flex h-full flex-1 flex-col justify-end gap-1">
            <div className="flex min-h-[148px] flex-col justify-end overflow-hidden rounded-md bg-[#f3ecdf]">
              <div
                className="bg-[#4f8fb9] transition-all"
                style={{ height: `${(offer / maxValue) * 100}%` }}
                title={`1С/рынок ${offer} мин`}
              />
              <div
                className="bg-[#7c9a78] transition-all"
                style={{ height: `${(ns / maxValue) * 100}%` }}
                title={`Опора ${ns} мин`}
              />
            </div>
            <div className="text-center text-[10px] font-bold text-slate-500">{day.day}</div>
            <div className="text-center text-[10px] font-black text-slate-700">{total}</div>
          </div>
        );
      })}
    </div>
  );
}

function OfferProgress({ days }) {
  const closed = days.filter((day) => day.result);
  if (!closed.length) return <EmptyChart text="Траектория заполнится после закрытия дня" />;
  const cumulative = [];
  closed.reduce((sum, day) => {
    const next = sum + num(day.offerMinutes);
    cumulative.push({ day: day.day, value: Number((next / 60).toFixed(1)) });
    return next;
  }, 0);
  return <LineChartSvg data={cumulative} color="#4f8fb9" fill="#eaf5fb" unit="ч" />;
}

function WeeklyPanel({ week }) {
  if (!week) return null;
  return (
    <div className="border border-[#eadfcd] bg-white/90 p-4 shadow-sm rounded-lg">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm font-bold text-slate-500">
            <History size={16} />
            Неделя {week.number}
          </div>
          <h3 className="text-2xl font-black text-slate-950">Итог дней {week.from}-{week.to}</h3>
        </div>
        <div className="text-right">
          <div className="text-sm font-bold text-slate-500">XP</div>
          <div className="text-3xl font-black text-slate-950">{week.xp}</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <WeekMetric label="Закрыто" value={`${week.closed.length}/7`} />
        <WeekMetric label="1С/рынок" value={`${(week.offer / 60).toFixed(1)} ч`} />
        <WeekMetric label="Средние ккал" value={week.avgCalories || '--'} />
        <WeekMetric label="Вес" value={`${week.weightDelta > 0 ? '+' : ''}${week.weightDelta} кг`} />
      </div>
    </div>
  );
}

function WeekMetric({ label, value }) {
  return (
    <div className="border border-[#e8dfce] bg-[#fffaf1] p-3 rounded-lg">
      <div className="text-xs font-bold text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-black text-slate-950">{value}</div>
    </div>
  );
}

function DiagnosisPanel({ items }) {
  return (
    <div className="border border-[#eadfcd] bg-white/90 p-4 shadow-sm rounded-lg">
      <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-500">
        <BarChart3 size={16} />
        Почему результат такой
      </div>
      <div className="grid gap-2">
        {items.map((item) => (
          <div key={item} className="flex items-start gap-2 border border-[#e8dfce] bg-[#fffaf1] p-3 text-sm font-semibold leading-6 text-slate-700 rounded-lg">
            <ChevronRight size={16} className="mt-1 shrink-0 text-[#7c9a78]" />
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function getDiagnosis(stats, week) {
  const items = [];
  if (!stats.closedDays.length) {
    return ['Пока нет закрытых дней. Первый ответ появится после фиксации базы.'];
  }
  if (stats.offerMinutes / Math.max(1, stats.closedDays.length) >= 75) {
    items.push('1С и рынок получают сильное время. Это главный двигатель оффера.');
  } else {
    items.push('1С/рынок пока недобирает фокус. Увеличь среднее время до 60-90 минут в день.');
  }
  if (stats.avgCalories && stats.avgCalories <= CALORIE_TOP) {
    items.push('Питание идёт в топ-режиме: средние калории держатся в зоне сушки.');
  } else if (stats.avgCalories && stats.avgCalories <= CALORIE_LIMIT) {
    items.push('Питание в рабочей зоне. Для ускорения снижения веса чаще попадай в 1800.');
  } else {
    items.push('Питание выше нужной рамки или данных мало. Это будет мешать видеть чистый рост.');
  }
  if (stats.weightDelta < -0.4) {
    items.push('Вес снижается. Дистанция подтверждает, что система работает.');
  } else if (stats.weightDelta > 0.4) {
    items.push('Вес растёт. Смотри дни с калориями выше 2300 и количеством приёмов пищи.');
  } else {
    items.push('Вес пока держится. Нужны ещё отметки или мягкое усиление питания.');
  }
  if (week?.closed.length >= 5) {
    items.push('Неделя достаточно плотная: уже можно анализировать паттерны, а не настроение.');
  } else {
    items.push('Неделе не хватает закрытых дней. Главный рычаг сейчас — регулярность отметок.');
  }
  return items;
}

function WeeksStrip({ weeks }) {
  return (
    <div className="border border-[#eadfcd] bg-white/90 p-4 shadow-sm rounded-lg">
      <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-500">
        <CalendarDays size={16} />
        17 недель
      </div>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {weeks.map((week) => {
          const intensity = clamp(week.xp / 900, 0, 1);
          return (
            <div
              key={week.number}
              className="min-h-[58px] border p-2 rounded-md"
              style={{
                backgroundColor: `rgba(124, 154, 120, ${0.08 + intensity * 0.28})`,
                borderColor: week.closed.length ? '#cfe2c8' : '#eadfcd',
              }}
              title={`Неделя ${week.number}: ${week.xp} XP`}
            >
              <div className="text-xs font-bold text-slate-500">W{week.number}</div>
              <div className="text-lg font-black text-slate-950">{week.closed.length}/7</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Checkpoints({ days, currentDayIndex }) {
  return (
    <section className="border border-[#eadfcd] bg-white/90 p-4 shadow-sm rounded-lg">
      <div className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-500">
        <Trophy size={16} />
        Промежуточные итоги
      </div>
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {CHECKPOINT_DAYS.map((dayNumber) => {
          const summary = checkpointSummary(days, dayNumber);
          const reached = currentDayIndex + 1 >= dayNumber;
          return (
            <div key={dayNumber} className={`border p-4 rounded-lg ${reached ? 'border-[#cfe2c8] bg-[#f1f8ed]' : 'border-[#e8dfce] bg-[#fffaf1]'}`}>
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-bold text-slate-500">День {dayNumber}</div>
                {reached ? <CheckCircle2 size={17} className="text-[#5f8f5d]" /> : <Lock size={16} className="text-slate-400" />}
              </div>
              <div className="text-2xl font-black text-slate-950">{summary.xp} XP</div>
              <div className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                {summary.closed}/{summary.elapsed} дней · {(summary.offerMinutes / 60).toFixed(1)} ч 1С/рынок
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ExportModal({ exportMode, setExportMode, data, copied, onCopy, onDownload, onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 grid place-items-center bg-slate-900/35 p-4 backdrop-blur-sm"
    >
      <motion.section
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        className="w-full max-w-4xl border border-[#eadfcd] bg-[#fffdf8] p-4 shadow-2xl rounded-lg"
      >
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2 text-sm font-bold text-slate-500">
              <Download size={16} />
              Экспорт для анализа
            </div>
            <h2 className="text-2xl font-black text-slate-950">Данные 120-дневного пути</h2>
          </div>
          <button onClick={onClose} className="self-start text-slate-500 transition hover:text-slate-950">
            <XCircle size={26} />
          </button>
        </div>
        <div className="mb-3 flex flex-wrap gap-2">
          <button
            onClick={() => setExportMode('markdown')}
            className={`px-3 py-2 text-sm font-black rounded-md ${exportMode === 'markdown' ? 'bg-slate-950 text-white' : 'border border-[#e8dfce] bg-white text-slate-600'}`}
          >
            Markdown
          </button>
          <button
            onClick={() => setExportMode('json')}
            className={`px-3 py-2 text-sm font-black rounded-md ${exportMode === 'json' ? 'bg-slate-950 text-white' : 'border border-[#e8dfce] bg-white text-slate-600'}`}
          >
            JSON
          </button>
          <button onClick={onCopy} className="inline-flex items-center gap-2 border border-[#cfe2c8] bg-[#eef6e9] px-3 py-2 text-sm font-black text-[#365f36] rounded-md">
            <Copy size={16} />
            {copied ? 'Скопировано' : 'Скопировать'}
          </button>
          <button onClick={onDownload} className="inline-flex items-center gap-2 border border-[#c8e1ef] bg-[#eaf5fb] px-3 py-2 text-sm font-black text-[#255b7a] rounded-md">
            <Download size={16} />
            Скачать
          </button>
        </div>
        <textarea
          readOnly
          value={data}
          className="h-[58vh] w-full resize-none border border-[#e8dfce] bg-white p-4 font-mono text-sm leading-6 text-slate-800 outline-none rounded-md"
        />
      </motion.section>
    </motion.div>
  );
}

function ConfirmReset({ onCancel, onConfirm }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 grid place-items-center bg-slate-900/35 p-4 backdrop-blur-sm"
    >
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 12 }}
        className="w-full max-w-md border border-[#eadfcd] bg-[#fffdf8] p-5 shadow-2xl rounded-lg"
      >
        <h2 className="text-2xl font-black text-slate-950">Начать заново?</h2>
        <p className="mt-3 leading-7 text-slate-600">
          Текущий локальный прогресс будет очищен, а новый старт снова привяжется к сегодняшней дате.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button onClick={onCancel} className="border border-[#e8dfce] bg-white px-4 py-3 font-black text-slate-700 rounded-md">
            Оставить
          </button>
          <button onClick={onConfirm} className="bg-slate-950 px-4 py-3 font-black text-white rounded-md">
            Новый старт
          </button>
        </div>
      </motion.section>
    </motion.div>
  );
}

function TrendingDownIcon(props) {
  return <LineChart {...props} />;
}

function TrendingUpIcon(props) {
  return <Activity {...props} />;
}

export default App;
