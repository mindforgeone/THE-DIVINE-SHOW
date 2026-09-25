import { motion } from 'framer-motion';
import { Activity, Check, CircleDashed, Footprints, Scale, Utensils, X } from 'lucide-react';
import {
  activeCodexRulesForDay,
  calculateEnergyBalance,
  evaluateCodexRule,
  formatLongDate,
  getDayResult,
  hasDayData,
  number,
} from './model';

const metricValue = (value, suffix = '') => value === '' || value === null || value === undefined
  ? 'Нет данных'
  : `${number(value).toLocaleString('ru-RU')}${suffix}`;

export default function DayDetailsModal({ state, dayIndex, onClose }) {
  const day = state.days[dayIndex];
  if (!day) return null;
  const result = getDayResult(day, state.goals, state.dayCriteria, state.resultThresholds, state.codexRules);
  const balance = calculateEnergyBalance(day, state.profile);
  const rules = activeCodexRulesForDay(day, state.codexRules).map((rule) => evaluateCodexRule(day, rule));
  const status = result?.title || (hasDayData(day) ? 'Сохранён частично' : 'Нет записей');
  const statusColor = result?.color || (hasDayData(day) ? '#b7791f' : '#64748b');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`День ${day.day}`}
      className="fixed inset-0 z-[70] grid place-items-end bg-[#102a43]/55 p-0 sm:place-items-center sm:p-4"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <motion.section initial={{ y: 28 }} animate={{ y: 0 }} exit={{ y: 28 }} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto bg-white p-4 shadow-2xl rounded-t-lg sm:rounded-lg sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div><div className="text-xs font-black uppercase text-slate-500">День {day.day} · {formatLongDate(day.date)}</div><h2 className="mt-1 text-2xl font-black" style={{ color: statusColor }}>{status}</h2><p className="mt-1 text-xs font-bold text-slate-500">{day.result ? day.closureMode === 'automatic' ? 'Зафиксирован автоматически' : 'День закрыт' : 'Показаны сохранённые данные'}</p></div>
          <button type="button" onClick={onClose} className="icon-command shrink-0" title="Закрыть"><X size={19} /></button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Metric icon={<Utensils />} label="Калории" value={metricValue(day.calories, ' ккал')} />
          <Metric icon={<Activity />} label="Активные" value={metricValue(day.activeCalories, ' ккал')} />
          <Metric icon={<Footprints />} label="Шаги" value={metricValue(day.steps)} />
          <Metric icon={<Scale />} label="Вес" value={metricValue(day.weight, ' кг')} />
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 border border-[#d8e3e7] bg-[#f4f8f9] p-3 rounded-md"><span className="text-sm font-bold text-slate-500">Энергетический итог</span><strong className={balance !== null && balance <= 0 ? 'text-emerald-700' : 'text-rose-600'}>{balance === null ? 'Недостаточно данных' : `${balance > 0 ? '+' : ''}${balance} ккал`}</strong></div>

        {rules.length > 0 && <section className="mt-4"><h3 className="font-black">Правила дня</h3><div className="mt-2 grid gap-2">{rules.map(({ rule, value, answered, passed }) => <div key={rule.id} className="flex items-center gap-3 border border-[#dfe8e6] p-3 rounded-md"><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-md ${!answered ? 'bg-slate-100 text-slate-400' : passed ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'}`}>{answered ? passed ? <Check size={17} /> : <X size={17} /> : <CircleDashed size={17} />}</span><span className="min-w-0 flex-1"><strong className="block text-sm">{rule.title}</strong><small className="font-bold text-slate-500">{!answered ? 'Нет отметки' : rule.type === 'boolean' ? passed ? 'Соблюдено' : 'Не выполнено' : `${value}${rule.unit ? ` ${rule.unit}` : ''}`}</small></span></div>)}</div></section>}

        {(day.evidence || day.actions?.length || day.courageMoments?.length) && <section className="mt-4 border border-[#d8e3e7] bg-white p-4 rounded-lg"><h3 className="font-black">След дня</h3>{day.evidence && <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-600">{day.evidence}</p>}<div className="mt-3 flex flex-wrap gap-2 text-xs font-black text-slate-500">{day.actions?.length > 0 && <span className="bg-[#eef7fa] px-2 py-1 rounded-sm">Действий роста: {day.actions.length}</span>}{day.courageMoments?.length > 0 && <span className="bg-[#f6f0ff] px-2 py-1 rounded-sm">Ситуаций смелости: {day.courageMoments.length}</span>}</div></section>}
      </motion.section>
    </div>
  );
}

function Metric({ icon, label, value }) {
  return <div className="border border-[#d8e3e7] bg-[#f8fbfb] p-3 rounded-md"><span className="flex items-center gap-1 text-xs font-black text-slate-500">{icon}{label}</span><strong className="mt-2 block text-base">{value}</strong></div>;
}
