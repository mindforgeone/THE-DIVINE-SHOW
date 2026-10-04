import { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Flame, Gauge, Target } from 'lucide-react';
import { dateFromKey, formatShortDate } from '../marathon/model';
import {
  buildEnergyOverview,
  buildMonthEnergyCalendar,
  buildWeekEnergyCalendar,
  buildYearEnergyCalendar,
  energyPeriodBounds,
  shiftEnergyAnchor,
} from './energyCalendarModel';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const compact = new Intl.NumberFormat('ru-RU', { notation: 'compact', maximumFractionDigits: 1 });
const integer = new Intl.NumberFormat('ru-RU');

function balanceText(value, recorded = 1) {
  if (!recorded) return 'Нет данных';
  if (value < 0) return `Дефицит ${integer.format(Math.abs(value))} ккал`;
  if (value > 0) return `Профицит ${integer.format(value)} ккал`;
  return 'Баланс 0 ккал';
}

function compactBalance(value, recorded = 1) {
  if (!recorded) return '—';
  if (!value) return '0';
  return `${value > 0 ? '+' : '−'}${compact.format(Math.abs(value))}`;
}

function balanceTone(value, recorded = 1) {
  if (!recorded) return 'border-[#dce6e9] bg-[#f6f8f9] text-slate-400';
  if (value < 0) return 'border-[#a8dcc8] bg-[#e8f8f2] text-[#0c765f]';
  if (value > 0) return 'border-[#efc3bd] bg-[#fff0ed] text-[#b24a42]';
  return 'border-[#b9dce8] bg-[#edf8fb] text-[#0d7ea5]';
}

function periodLabel(anchor, mode) {
  const date = dateFromKey(anchor);
  if (mode === 'year') return String(date.getFullYear());
  if (mode === 'month') return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
  const bounds = energyPeriodBounds(anchor, mode);
  return `${formatShortDate(bounds.start)} – ${formatShortDate(bounds.end)}`;
}

function SummaryTile({ label, summary, icon }) {
  return <article className={`border p-3 rounded-lg ${balanceTone(summary.total, summary.recorded)}`}><div className="flex items-center justify-between gap-2 text-xs font-black"><span>{label}</span>{icon}</div><div className="mt-2 text-lg font-black leading-tight">{balanceText(summary.total, summary.recorded)}</div><div className="mt-2 text-xs font-bold opacity-75">{summary.recorded}/{summary.possible} дней · {summary.recorded ? `≈ ${summary.estimatedKg > 0 ? '−' : summary.estimatedKg < 0 ? '+' : ''}${Math.abs(summary.estimatedKg).toFixed(2)} кг` : 'нужны записи'}</div></article>;
}

function EnergyDay({ day, compact: compactMode = false }) {
  const recorded = day.balance !== null && day.balance !== undefined && !day.future;
  const title = `${day.date}: ${balanceText(day.balance || 0, recorded ? 1 : 0)}`;
  return <div title={title} aria-label={title} className={`min-w-0 border text-center rounded-sm ${balanceTone(day.balance || 0, recorded ? 1 : 0)} ${day.inPeriod === false ? 'opacity-35' : ''} ${compactMode ? 'min-h-7 p-1' : 'min-h-14 p-1.5'}`}><div className={`${compactMode ? 'text-[9px]' : 'text-[11px]'} font-black`}>{day.dayNumber}</div>{!compactMode && <div className="mt-1 truncate text-[9px] font-black sm:text-[10px]">{recorded ? compactBalance(day.balance) : '—'}</div>}</div>;
}

function WeekTotal({ week }) {
  return <div className={`grid min-h-14 content-center border p-1.5 text-center rounded-sm ${balanceTone(week.total, week.recorded)}`} title={`${formatShortDate(week.start)}–${formatShortDate(week.end)}: ${balanceText(week.total, week.recorded)}`}><strong className="text-[10px] leading-tight sm:text-xs">{compactBalance(week.total, week.recorded)}</strong><span className="mt-1 text-[8px] font-bold opacity-75 sm:text-[9px]">{week.recorded ? `≈ ${Math.abs(week.estimatedKg).toFixed(2)} кг` : 'нет данных'}</span></div>;
}

function WeekGrid({ week }) {
  return <div className="grid grid-cols-[repeat(7,minmax(30px,1fr))_minmax(70px,0.9fr)] gap-1"><>{week.days.map((day) => <EnergyDay key={day.date} day={day} />)}</><WeekTotal week={week} /></div>;
}

function CalendarHeader() {
  return <div className="grid grid-cols-[repeat(7,minmax(30px,1fr))_minmax(70px,0.9fr)] gap-1">{WEEKDAYS.map((day) => <div key={day} className="py-1 text-center text-[9px] font-black text-slate-400 sm:text-[10px]">{day}</div>)}<div className="py-1 text-center text-[9px] font-black text-slate-400 sm:text-[10px]">Неделя</div></div>;
}

function MonthCalendar({ calendar }) {
  return <div className="grid gap-1"><CalendarHeader />{calendar.weeks.map((week) => <WeekGrid key={week.start} week={week} />)}</div>;
}

function YearCalendar({ months }) {
  return <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{months.map((month) => { const date = dateFromKey(month.start); return <article key={month.start} className="border border-[#dce6e9] bg-[#fbfcfc] p-3 rounded-lg"><div className="flex items-start justify-between gap-2"><strong>{MONTHS[date.getMonth()]}</strong><span className={`text-right text-xs font-black ${month.summary.total <= 0 ? 'text-[#0c765f]' : 'text-[#b24a42]'}`}>{compactBalance(month.summary.total, month.summary.recorded)} ккал</span></div><div className="mt-2 grid grid-cols-7 gap-1">{WEEKDAYS.map((day) => <span key={day} className="text-center text-[8px] font-black text-slate-400">{day.slice(0, 1)}</span>)}{month.weeks.flatMap((week) => week.days).map((day) => <EnergyDay key={day.date} day={day} compact />)}</div><div className="mt-2 text-xs font-bold text-slate-500">{month.summary.recorded}/{month.summary.possible} дней · {balanceText(month.summary.total, month.summary.recorded)}</div></article>; })}</div>;
}

export default function EnergyCalendar({ state, currentDate }) {
  const [mode, setMode] = useState('month');
  const [anchor, setAnchor] = useState(currentDate);
  const overview = useMemo(() => buildEnergyOverview(state, currentDate), [currentDate, state]);
  const month = useMemo(() => buildMonthEnergyCalendar(state, anchor, currentDate), [anchor, currentDate, state]);
  const week = useMemo(() => buildWeekEnergyCalendar(state, anchor, currentDate), [anchor, currentDate, state]);
  const year = useMemo(() => buildYearEnergyCalendar(state, anchor, currentDate), [anchor, currentDate, state]);
  const currentBounds = energyPeriodBounds(currentDate, mode);
  const shownBounds = energyPeriodBounds(anchor, mode);
  const canPrevious = shownBounds.start > state.startDate;
  const canNext = shownBounds.start < currentBounds.start;
  const targetDelta = overview.startWeight && overview.targetWeight ? Math.max(0, overview.startWeight - overview.targetWeight) : 0;

  return <section className="border border-[#cfe0dc] bg-white p-4 rounded-lg">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div><div className="flex items-center gap-2 text-sm font-black text-[#0d7ea5]"><Flame size={18} />Энергетический календарь</div><h2 className="mt-1 text-2xl font-black">Дефицит виден по дням и неделям</h2><p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-500">Зелёный — дефицит, красный — профицит. Расчёт: питание минус базовый обмен и активные калории.</p></div><div className="grid grid-cols-3 gap-1 border border-[#d8e3e7] bg-[#f3f6f7] p-1 rounded-md">{[['week', 'Неделя'], ['month', 'Месяц'], ['year', 'Год']].map(([id, label]) => <button key={id} type="button" onClick={() => { setMode(id); setAnchor(currentDate); }} className={`min-h-10 px-3 text-xs font-black rounded-sm ${mode === id ? 'bg-[#102a43] text-white' : 'text-slate-500'}`}>{label}</button>)}</div></div>

    <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4"><SummaryTile label="Текущая неделя" summary={overview.week} icon={<CalendarDays size={16} />} /><SummaryTile label={MONTHS[dateFromKey(currentDate).getMonth()]} summary={overview.month} icon={<Gauge size={16} />} /><SummaryTile label="От старта" summary={overview.journey} icon={<Flame size={16} />} /><article className="border border-[#c9bee9] bg-[#f5f2fd] p-3 text-[#55408e] rounded-lg"><div className="flex items-center justify-between text-xs font-black"><span>Энергия до цели</span><Target size={16} /></div><div className="mt-2 text-lg font-black leading-tight">{overview.targetKcal ? `${integer.format(overview.remainingKcal)} ккал осталось` : 'Нужен стартовый вес'}</div><div className="mt-2 text-xs font-bold opacity-80">{targetDelta ? `${overview.startWeight} → ${overview.targetWeight} кг · всего ≈ ${integer.format(overview.targetKcal)} ккал` : 'Укажи вес и цель в параметрах тела'}</div></article></div>

    {overview.targetKcal > 0 && <div className="mt-3 border border-[#ded7f2] bg-[#faf8ff] p-3 rounded-lg"><div className="flex items-center justify-between gap-3 text-xs font-black text-[#55408e]"><span>Энергетический путь к цели</span><span>{overview.progress}%</span></div><div className="mt-2 h-2 overflow-hidden bg-[#e7e1f5] rounded-sm"><div className="h-full bg-[#7056b5] transition-all" style={{ width: `${overview.progress}%` }} /></div><div className="mt-2 text-xs font-semibold leading-5 text-slate-500">Оценка использует 7700 ккал на 1 кг. Вес может временно расходиться с расчётом из-за воды и других факторов.</div></div>}

    <div className="mt-4 flex items-center justify-between gap-2"><button type="button" disabled={!canPrevious} onClick={() => setAnchor(shiftEnergyAnchor(anchor, mode, -1))} className="icon-command disabled:opacity-30" title="Предыдущий период"><ChevronLeft size={19} /></button><button type="button" onClick={() => setAnchor(currentDate)} className="min-w-0 px-2 text-center font-black text-[#102a43]">{periodLabel(anchor, mode)}</button><button type="button" disabled={!canNext} onClick={() => setAnchor(shiftEnergyAnchor(anchor, mode, 1))} className="icon-command disabled:opacity-30" title="Следующий период"><ChevronRight size={19} /></button></div>
    <div className="mt-3">{mode === 'week' ? <><CalendarHeader /><WeekGrid week={week} /></> : mode === 'month' ? <MonthCalendar calendar={month} /> : <YearCalendar months={year} />}</div>
  </section>;
}
