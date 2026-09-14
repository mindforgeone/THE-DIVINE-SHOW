import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Archive, ArrowDownRight, ArrowLeft, ArrowRight, BarChart3, CalendarDays, CalendarRange,
  Check, CheckCircle2, ChevronDown, Copy, Crown, Edit3, Flame, Footprints,
  History, Layers3, ListFilter, MoreHorizontal, Plus, RotateCcw, Search, Sparkles,
  Trash2, X, Zap,
} from 'lucide-react';
import { createId, formatShortDate, todayKey } from '../marathon/model';
import {
  activeItem, achievementsFor, calculateStepsStats, categoryName, completeStep,
  currentBoss, ENERGY_STATUSES, historyForStep, LEVELS, levelFor, takeStep,
  validScore, weekBounds,
} from './model';
import './steps.css';

const TABS = [
  { id: 'map', label: 'Карта шагов', icon: Footprints },
  { id: 'unload', label: 'Разгрузка', icon: Layers3 },
  { id: 'boss', label: 'Боссы', icon: Crown },
  { id: 'stats', label: 'Статистика', icon: BarChart3 },
];
const PERIODS = [['today', 'Сегодня'], ['week', 'Неделя'], ['month', 'Месяц'], ['quarter', 'Квартал'], ['year', 'Год'], ['all', 'Всё время']];
const BUTTON = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-bold transition active:scale-[.98]';

export default function StepsModule({ state, commit, syncState, error, retry, newStepRequest = 0 }) {
  const [tab, setTab] = useState('map');
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');
  const [showArchived, setShowArchived] = useState(false);
  const [stepEditor, setStepEditor] = useState(null);
  const [taskEditor, setTaskEditor] = useState(null);
  const [categoryEditor, setCategoryEditor] = useState(false);
  const [scheduleStep, setScheduleStep] = useState(null);
  const [finishStep, setFinishStep] = useState(null);
  const [historyStep, setHistoryStep] = useState(null);
  const [editExecution, setEditExecution] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [period, setPeriod] = useState('week');
  const [undo, setUndo] = useState(null);
  const [celebration, setCelebration] = useState(null);
  const undoTimer = useRef(null);
  const lastNewStepRequest = useRef(newStepRequest);
  const today = todayKey();

  useEffect(() => {
    if (newStepRequest === lastNewStepRequest.current) return;
    lastNewStepRequest.current = newStepRequest;
    setTab('map');
    setStepEditor({});
  }, [newStepRequest]);

  const stats = useMemo(() => state ? calculateStepsStats(state, period, today) : null, [state, period, today]);
  const week = weekBounds(today);
  const activeSteps = state?.steps.filter(activeItem) || [];
  const activeCommitments = state?.commitments.filter((item) => item.status === 'active' && !item.deletedAt && activeSteps.some((step) => step.id === item.stepId)) || [];
  const todayFocus = activeCommitments.filter((item) => item.dueDate === today && item.scope !== 'week');
  const weekFocus = activeCommitments.filter((item) => item.scope === 'week' && item.dueDate >= today && item.dueDate <= week.end);
  const overdue = activeCommitments.filter((item) => item.dueDate < today);
  const scheduled = activeCommitments.filter((item) => item.dueDate > today && !weekFocus.some((focus) => focus.id === item.id));
  const boss = state ? currentBoss(state) : null;
  const pendingTasks = state?.energyTasks.filter((item) => !item.deletedAt && item.status !== 'done').length || 0;
  const recent = state?.executions.filter((item) => !item.deletedAt).sort((a, b) => b.completedAt.localeCompare(a.completedAt)).slice(0, 4) || [];

  const showUndo = (label, action) => {
    clearTimeout(undoTimer.current);
    const id = createId('undo');
    setUndo({ id, label, action });
    undoTimer.current = window.setTimeout(() => setUndo((current) => current?.id === id ? null : current), 6000);
  };
  const changeRecord = (collection, id, patch, label = 'Изменено', withUndo = true) => {
    const previous = state[collection].find((item) => item.id === id);
    if (!previous) return;
    const before = Object.fromEntries(Object.keys(patch).map((key) => [key, previous[key] ?? null]));
    commit((current, now) => ({ ...current, [collection]: current[collection].map((item) => item.id === id ? { ...item, ...patch, updatedAt: now } : item) }));
    if (withUndo) showUndo(label, () => commit((current, now) => ({ ...current, [collection]: current[collection].map((item) => item.id === id ? { ...item, ...before, updatedAt: now } : item) })));
  };
  const take = (stepId, scope, dueDate) => {
    let createdId;
    commit((current, now) => {
      const next = takeStep(current, stepId, scope, today, { dueDate }, now);
      if (next !== current) createdId = next.commitments.at(-1)?.id;
      return next;
    });
    if (createdId) showUndo('Шаг взят в фокус', () => commit((current, now) => ({ ...current, commitments: current.commitments.map((item) => item.id === createdId ? { ...item, deletedAt: now, updatedAt: now } : item) })));
  };
  const schedule = (target, date) => {
    if (target.commitment) changeRecord('commitments', target.commitment.id, { scope: 'date', dueDate: date }, 'Шаг перенесён');
    else take(target.step.id, 'date', date);
    setScheduleStep(null);
  };
  const saveStep = (draft) => {
    const title = draft.title.trim();
    if (!title) return;
    const exists = Boolean(draft.id);
    commit((current, now) => {
      const next = { ...draft, id: draft.id || createId('step'), title, description: draft.description?.trim() || '', notes: draft.notes?.trim() || '', categoryId: draft.categoryId || 'other', difficulty: levelFor(draft.difficulty).id, createdAt: draft.createdAt || now, updatedAt: now, archivedAt: draft.archivedAt || null, deletedAt: null };
      return { ...current, steps: exists ? current.steps.map((item) => item.id === next.id ? next : item) : [...current.steps, next] };
    });
    setStepEditor(null);
  };
  const duplicateStep = (step) => {
    commit((current, now) => ({ ...current, steps: [...current.steps, { ...step, id: createId('step'), title: `${step.title} · копия`, createdAt: now, updatedAt: now, archivedAt: null, deletedAt: null }] }));
    setStepEditor(null);
  };
  const saveExecution = (draft) => {
    if (!['before', 'during', 'after'].every((field) => validScore(draft[field]))) return;
    if (editExecution) {
      commit((current, now) => ({ ...current, executions: current.executions.map((item) => item.id === editExecution.id ? { ...item, before: Number(draft.before), during: Number(draft.during), after: Number(draft.after), reality: draft.reality?.trim() || '', repeat: draft.repeat, date: draft.date, difficulty: draft.difficulty, points: levelFor(draft.difficulty).points, updatedAt: now } : item) }));
      setEditExecution(null);
      return;
    }
    const step = activeSteps.find((item) => item.id === finishStep?.id);
    if (!step) return;
    let executionId;
    commit((current, now) => {
      const next = completeStep(current, step.id, draft, now, today);
      executionId = next.executions.at(-1)?.id;
      return next;
    });
    setFinishStep(null);
    setCelebration({ id: executionId, points: levelFor(step.difficulty).points, boss: step.difficulty === 'boss' });
    window.setTimeout(() => setCelebration(null), 2400);
    if (executionId) showUndo('Шаг сделан', () => commit((current, now) => {
      const execution = current.executions.find((item) => item.id === executionId);
      return { ...current, executions: current.executions.map((item) => item.id === executionId ? { ...item, deletedAt: now, updatedAt: now } : item), commitments: execution?.commitmentId ? current.commitments.map((item) => item.id === execution.commitmentId ? { ...item, status: 'active', completedAt: null, updatedAt: now } : item) : current.commitments };
    }));
  };
  const saveTask = (draft) => {
    const title = draft.title.trim();
    if (!title) return;
    commit((current, now) => {
      const task = { ...draft, id: draft.id || createId('energy'), title, description: draft.description?.trim() || '', createdAt: draft.createdAt || now, updatedAt: now, status: draft.status || 'hanging', annoyance: Number(draft.annoyance) || 1, estimatedMinutes: draft.estimatedMinutes === '' ? '' : Number(draft.estimatedMinutes), estimatedCost: draft.estimatedCost === '' ? '' : Number(draft.estimatedCost), deletedAt: null };
      return { ...current, energyTasks: draft.id ? current.energyTasks.map((item) => item.id === task.id ? task : item) : [...current.energyTasks, task] };
    });
    setTaskEditor(null);
  };
  const moveTask = (id, status) => {
    const current = state.energyTasks.find((item) => item.id === id);
    if (!current || current.status === status) return;
    changeRecord('energyTasks', id, { status, completedAt: status === 'done' ? new Date().toISOString() : null }, status === 'done' ? 'Снято с головы' : 'Статус изменён');
  };
  const archiveCategory = (category) => {
    const affected = state.steps.filter((item) => item.categoryId === category.id && activeItem(item)).map((item) => item.id);
    const affectedTasks = state.energyTasks.filter((item) => item.categoryId === category.id && !item.deletedAt).map((item) => item.id);
    commit((current, now) => ({ ...current, categories: current.categories.map((item) => item.id === category.id ? { ...item, archivedAt: now, updatedAt: now } : item), steps: current.steps.map((item) => affected.includes(item.id) ? { ...item, categoryId: 'other', updatedAt: now } : item), energyTasks: current.energyTasks.map((item) => affectedTasks.includes(item.id) ? { ...item, categoryId: 'other', updatedAt: now } : item) }));
    showUndo('Категория удалена', () => commit((current, now) => ({ ...current, categories: current.categories.map((item) => item.id === category.id ? { ...item, archivedAt: null, updatedAt: now } : item), steps: current.steps.map((item) => affected.includes(item.id) && item.categoryId === 'other' ? { ...item, categoryId: category.id, updatedAt: now } : item), energyTasks: current.energyTasks.map((item) => affectedTasks.includes(item.id) && item.categoryId === 'other' ? { ...item, categoryId: category.id, updatedAt: now } : item) })));
  };
  const confirmDelete = (kind, item) => setConfirm({ kind, item });
  const deleteConfirmed = () => {
    const { kind, item } = confirm;
    if (kind === 'category') archiveCategory(item);
    else changeRecord(kind, item.id, { deletedAt: new Date().toISOString() }, 'Удалено');
    if (kind === 'steps') { setStepEditor(null); setHistoryStep(null); }
    if (kind === 'energyTasks') setTaskEditor(null);
    if (kind === 'executions') setEditExecution(null);
    setConfirm(null);
  };

  if (!state) return <section className="border border-[#d8e3e7] bg-white p-5 rounded-lg"><span className="font-bold">Загружаю шаги...</span></section>;
  const filteredSteps = activeSteps.filter((step) => {
    const matchesText = `${step.title} ${step.description} ${step.notes}`.toLocaleLowerCase('ru-RU').includes(query.toLocaleLowerCase('ru-RU'));
    return matchesText && (categoryFilter === 'all' || step.categoryId === categoryFilter) && (levelFilter === 'all' || step.difficulty === levelFilter);
  });
  const actions = { take, changeRecord, setFinishStep, setScheduleStep, setStepEditor, setHistoryStep, duplicateStep };

  return (
    <div className="steps-module grid gap-4">
      {error && <div role="status" className="flex flex-wrap items-center justify-between gap-2 border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900 rounded-md"><span>{error}</span><button type="button" onClick={retry} className="font-bold underline">Повторить</button></div>}
      <div className="flex flex-wrap items-end justify-between gap-3"><div><div className="text-xs font-black uppercase text-[#0d8fb9]">Мой опыт в действиях</div><h1 className="mt-1 text-2xl font-black sm:text-3xl">Шаги, которые уже сделаны</h1></div><span className="text-xs font-bold text-slate-500">{syncState === 'synced' ? 'Сохранено в облаке' : syncState === 'saving' ? 'Сохраняю...' : 'На устройстве'}</span></div>
      <section className="steps-overview grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Обзор шагов">
        <OverviewButton icon={<CalendarDays size={18} />} label="Сегодня" value={todayFocus.length} hint="в фокусе" color="teal" onClick={() => setTab('map')} />
        <OverviewButton icon={<CalendarRange size={18} />} label="Эта неделя" value={weekFocus.length} hint="в фокусе" color="blue" onClick={() => setTab('map')} />
        <OverviewButton icon={<Crown size={18} />} label="Текущий Босс" value={boss ? '1' : '—'} hint={boss ? boss.title : 'выбери шаг'} color="violet" onClick={() => setTab('boss')} />
        <OverviewButton icon={<Layers3 size={18} />} label="Разгрузка" value={pendingTasks} hint="висит в голове" color="coral" onClick={() => setTab('unload')} />
      </section>
      <nav aria-label="Разделы шагов" className="steps-tabs flex gap-1 overflow-x-auto border-b border-[#d8e3e7] pb-1">{TABS.map((item) => <button key={item.id} type="button" onClick={() => setTab(item.id)} aria-current={tab === item.id ? 'page' : undefined} className={`${BUTTON} shrink-0 ${tab === item.id ? 'bg-[#102a43] text-white' : 'text-slate-600 hover:bg-white'}`}><item.icon size={17} />{item.label}</button>)}</nav>

      {tab === 'map' && <>
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-black">Карта шагов</h2><div className="flex gap-2"><button type="button" onClick={() => setCategoryEditor(true)} className={`${BUTTON} border border-[#d8e3e7] bg-white text-slate-700`} title="Управлять категориями"><ListFilter size={17} /><span className="hidden sm:inline">Категории</span></button><button type="button" onClick={() => setStepEditor({})} className={`${BUTTON} bg-[#16a36a] text-white`}><Plus size={18} />Новый шаг</button></div></div>
        <FocusZone title="Сегодня" count={todayFocus.length} items={todayFocus} state={state} actions={actions} onChange={changeRecord} today={today} />
        <FocusZone title="Эта неделя" count={weekFocus.length} items={weekFocus} state={state} actions={actions} onChange={changeRecord} today={today} />
        {overdue.length > 0 && <FocusZone title="Срок прошёл" count={overdue.length} items={overdue} state={state} actions={actions} onChange={changeRecord} today={today} overdue />}
        {scheduled.length > 0 && <FocusZone title="Запланировано" count={scheduled.length} items={scheduled} state={state} actions={actions} onChange={changeRecord} today={today} />}
        <div className="flex flex-wrap gap-2"><label className="relative min-w-[180px] flex-1"><Search size={17} className="pointer-events-none absolute left-3 top-3.5 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Найти шаг" className="field-control pl-10" /></label><select aria-label="Категория" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="field-control max-w-[160px]"> <option value="all">Все категории</option>{state.categories.filter(activeItem).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><select aria-label="Сложность" value={levelFilter} onChange={(event) => setLevelFilter(event.target.value)} className="field-control max-w-[145px]"><option value="all">Все уровни</option>{LEVELS.map((level) => <option key={level.id} value={level.id}>{level.label}</option>)}</select></div>
        {filteredSteps.length ? <div className="grid gap-2 md:grid-cols-2">{filteredSteps.map((step) => <StepCard key={step.id} step={step} state={state} actions={actions} />)}</div> : <EmptyState title={activeSteps.length ? 'По фильтрам пока пусто' : 'Первый шаг начинается здесь'} />}
        {state.steps.some((step) => step.archivedAt && !step.deletedAt) && <section className="steps-band"><button type="button" onClick={() => setShowArchived((value) => !value)} aria-expanded={showArchived} className="flex w-full items-center justify-between text-left text-sm font-black"><span>Архив шагов · {state.steps.filter((step) => step.archivedAt && !step.deletedAt).length}</span><ChevronDown size={18} className={showArchived ? 'rotate-180' : ''} /></button>{showArchived && <div className="mt-3 grid gap-2 sm:grid-cols-2">{state.steps.filter((step) => step.archivedAt && !step.deletedAt).map((step) => <div key={step.id} className="flex items-center justify-between gap-2 border border-[#d8e3e7] bg-white p-3 rounded-md"><div className="min-w-0"><strong className="block truncate text-sm">{step.title}</strong><span className="text-xs text-slate-500">{historyForStep(state, step.id).count} выполнений</span></div><div className="flex gap-1"><button type="button" onClick={() => setHistoryStep(step)} className="icon-command h-9 w-9" title="История"><History size={16} /></button><button type="button" onClick={() => changeRecord('steps', step.id, { archivedAt: null }, 'Шаг восстановлен')} className="icon-command h-9 w-9" title="Восстановить"><RotateCcw size={16} /></button></div></div>)}</div>}</section>}
        {recent.length > 0 && <section className="steps-band"><div className="mb-3 flex items-center gap-2 text-sm font-black"><Sparkles size={17} className="text-[#d46c65]" />Последние победы</div><div className="grid gap-2 sm:grid-cols-2">{recent.map((item) => <div key={item.id} className="flex items-center justify-between gap-2 border-l-2 border-[#16a36a] bg-[#f3f9f7] px-3 py-2 text-sm"><strong className="min-w-0 truncate">{item.title}</strong><span className="shrink-0 font-bold text-slate-500">{formatShortDate(item.date)}</span></div>)}</div></section>}
      </>}

      {tab === 'unload' && <UnloadView state={state} stats={stats} onAdd={() => setTaskEditor({})} onEdit={setTaskEditor} onMove={moveTask} onDelete={confirmDelete} />}
      {tab === 'boss' && <BossView state={state} boss={boss} actions={actions} onAdd={() => setStepEditor({ difficulty: 'boss' })} />}
      {tab === 'stats' && <StepsStats state={state} stats={stats} period={period} onPeriod={setPeriod} />}

      <AnimatePresence>
        {stepEditor && <StepEditor key={stepEditor.id || 'new'} step={stepEditor} categories={state.categories.filter(activeItem)} onSave={saveStep} onDuplicate={duplicateStep} onArchive={(step) => { changeRecord('steps', step.id, { archivedAt: new Date().toISOString() }, 'Шаг в архиве'); setStepEditor(null); }} onDelete={(step) => confirmDelete('steps', step)} onClose={() => setStepEditor(null)} />}
        {scheduleStep && <ScheduleModal key="schedule" target={scheduleStep} today={today} onSchedule={schedule} onClose={() => setScheduleStep(null)} />}
        {finishStep && <ExecutionModal key={`complete-${finishStep.id}`} step={finishStep} commitment={activeCommitments.find((item) => item.stepId === finishStep.id)} onSave={saveExecution} onClose={() => setFinishStep(null)} />}
        {historyStep && <HistoryModal key={`history-${historyStep.id}`} step={historyStep} state={state} onEdit={setEditExecution} onRepeat={() => { setHistoryStep(null); setFinishStep(historyStep); }} onClose={() => setHistoryStep(null)} />}
        {editExecution && <ExecutionModal key={`edit-${editExecution.id}`} execution={editExecution} step={state.steps.find((item) => item.id === editExecution.stepId)} onSave={saveExecution} onDelete={() => confirmDelete('executions', editExecution)} onClose={() => setEditExecution(null)} />}
        {taskEditor && <TaskEditor key={taskEditor.id || 'new'} task={taskEditor} categories={state.categories.filter(activeItem)} onSave={saveTask} onDelete={(task) => confirmDelete('energyTasks', task)} onClose={() => setTaskEditor(null)} />}
        {categoryEditor && <CategoryEditor key="categories" state={state} commit={commit} onDelete={(category) => confirmDelete('category', category)} onClose={() => setCategoryEditor(false)} />}
        {confirm && <Dialog key="confirm-delete" title="Удалить запись?" onClose={() => setConfirm(null)}><p className="text-sm leading-6 text-slate-600">История останется защищённой от случайного нажатия. Статистика будет пересчитана по оставшимся записям.</p><div className="mt-5 flex gap-2"><button type="button" onClick={() => setConfirm(null)} className={`${BUTTON} flex-1 border border-[#d8e3e7]`}>Отмена</button><button type="button" onClick={deleteConfirmed} className={`${BUTTON} flex-1 bg-[#b84b52] text-white`}>Удалить</button></div></Dialog>}
      </AnimatePresence>
      {undo && <div role="status" className="steps-undo fixed bottom-[82px] left-1/2 z-[80] flex max-w-[calc(100vw-24px)] -translate-x-1/2 items-center gap-3 border border-[#c6d9df] bg-[#102a43] px-4 py-2 text-sm font-bold text-white shadow-xl rounded-md sm:bottom-5"><span className="truncate">{undo.label}</span><button type="button" onClick={() => { undo.action(); setUndo(null); }} className="inline-flex shrink-0 items-center gap-1 text-[#9fe0c5]"><RotateCcw size={16} />Отменить</button></div>}
      <AnimatePresence>{celebration && <motion.div key={celebration.id} initial={{ opacity: 0, y: 20, scale: .95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -14 }} className="pointer-events-none fixed inset-x-4 top-24 z-[90] mx-auto flex max-w-sm items-center gap-3 border border-[#bde3d5] bg-white p-4 shadow-xl rounded-lg"><span className={`grid h-12 w-12 shrink-0 place-items-center rounded-md ${celebration.boss ? 'bg-[#eeeafa] text-[#5344a8]' : 'bg-[#e6f7ef] text-[#16865f]'}`}>{celebration.boss ? <Crown size={24} /> : <CheckCircle2 size={24} />}</span><span><strong className="block text-lg font-black">{celebration.boss ? 'Босс пройден' : 'Шаг сделан'}</strong><small className="font-bold text-slate-500">+{celebration.points} очков роста</small></span></motion.div>}</AnimatePresence>
    </div>
  );
}

function OverviewButton({ icon, label, value, hint, color, onClick }) {
  return <button type="button" onClick={onClick} className={`steps-overview-item steps-${color} min-w-0 border p-3 text-left rounded-md`}><span className="flex items-center gap-1.5 text-xs font-black">{icon}{label}</span><strong className="mt-2 block text-2xl font-black leading-none">{value}</strong><span className="mt-1 block truncate text-xs font-semibold opacity-80">{hint}</span></button>;
}

function LevelBadge({ id }) {
  const level = levelFor(id);
  const Icon = id === 'warmup' ? Sparkles : id === 'step' ? Footprints : id === 'brave' ? Flame : id === 'leap' ? Zap : Crown;
  return <span className="inline-flex shrink-0 items-center gap-1 rounded-sm px-1.5 py-1 text-[11px] font-black" style={{ backgroundColor: `${level.color}18`, color: level.color }}><Icon size={13} />{level.label} · {level.points}</span>;
}

function FocusZone({ title, count, items, state, actions, onChange, today, overdue = false }) {
  return <section className="steps-band"><div className="mb-3 flex items-center justify-between"><h3 className="text-base font-black">{title}</h3><span className="text-xs font-bold text-slate-500">{count}</span></div>{items.length ? <div className="grid gap-2 sm:grid-cols-2">{items.map((item) => {
    const step = state.steps.find((candidate) => candidate.id === item.stepId);
    if (!step) return null;
    return <div key={item.id} className={`min-w-0 border-l-2 bg-white p-3 ${overdue ? 'border-[#d38260]' : 'border-[#16a36a]'}`}><div className="flex items-start justify-between gap-2"><div className="min-w-0"><strong className="block text-sm">{step.title}</strong><span className="text-xs font-semibold text-slate-500">{formatShortDate(item.dueDate)} · {categoryName(state, step.categoryId)}</span></div><LevelBadge id={step.difficulty} /></div><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => actions.setFinishStep(step)} className={`${BUTTON} bg-[#16a36a] text-white`}><Check size={16} />Выполнено</button>{overdue && <button type="button" onClick={() => onChange('commitments', item.id, { scope: 'today', dueDate: today }, 'Перенесено на сегодня')} className={`${BUTTON} border border-[#d8e3e7] bg-white`}>На сегодня</button>}<button type="button" onClick={() => actions.setScheduleStep({ step, commitment: item })} className={`${BUTTON} border border-[#d8e3e7] bg-white`} title="Перенести"><CalendarDays size={16} /></button><button type="button" onClick={() => onChange('commitments', item.id, { status: 'returned' }, 'Возвращено в карту')} className={`${BUTTON} border border-[#d8e3e7] bg-white`} title="Вернуть в карту"><ArrowLeft size={16} /></button>{overdue && <button type="button" onClick={() => onChange('commitments', item.id, { status: 'cancelled' }, 'Обязательство отменено')} className={`${BUTTON} border border-[#d8e3e7] bg-white`} title="Отменить"><X size={16} /></button>}</div><details className="mt-2 text-xs text-slate-500"><summary className="cursor-pointer font-bold">Перед действием</summary><div className="mt-2 grid gap-2 sm:grid-cols-2"><label>Насколько не хочется / страшно<input type="number" min="0" max="10" value={item.before ?? ''} onChange={(event) => onChange('commitments', item.id, { before: event.target.value }, 'Прогноз сохранён', false)} placeholder="0–10" className="field-control mt-1" /></label><label>Что, кажется, произойдёт?<input value={item.prediction || ''} onChange={(event) => onChange('commitments', item.id, { prediction: event.target.value }, 'Прогноз сохранён', false)} className="field-control mt-1" /></label></div></details></div>;
  })}</div> : <p className="text-sm font-semibold text-slate-500">Пока свободно. Выбери шаг из карты, когда появится возможность.</p>}</section>;
}

function StepCard({ step, state, actions }) {
  const [more, setMore] = useState(false);
  const [swipe, setSwipe] = useState(null);
  const touch = useRef(null);
  const history = historyForStep(state, step.id);
  const focus = state.commitments.some((item) => item.stepId === step.id && item.status === 'active' && !item.deletedAt);
  return <article className="steps-card border border-[#d8e3e7] bg-white p-3 shadow-sm rounded-md" onTouchStart={(event) => { touch.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }; }} onTouchEnd={(event) => { if (!touch.current) return; const dx = event.changedTouches[0].clientX - touch.current.x; const dy = event.changedTouches[0].clientY - touch.current.y; if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.3) setSwipe(dx > 0 ? 'today' : 'done'); touch.current = null; }}><div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="text-xs font-bold text-[#0d8fb9]">{categoryName(state, step.categoryId)}{focus ? ' · В фокусе' : ''}</div><h3 className="mt-1 break-words text-base font-black leading-snug">{step.title}</h3></div><LevelBadge id={step.difficulty} /></div>{step.description && <p className="mt-2 line-clamp-2 text-sm leading-5 text-slate-600">{step.description}</p>}{step.notes && <details className="mt-2 text-xs text-slate-500"><summary className="cursor-pointer font-bold">Заметка</summary><p className="mt-1 break-words leading-5">{step.notes}</p></details>}<div className="mt-2 flex items-center gap-3 text-xs font-semibold text-slate-500"><span>{history.count ? `${history.count} выполнений` : 'Ещё не выполнен'}</span><span>Создан {formatShortDate(step.createdAt.slice(0, 10))}</span></div>{swipe && <div className="mt-2 flex items-center justify-between bg-[#eaf8f4] px-2 py-1 text-xs font-bold text-[#16865f]"><span>Быстрое действие</span><button type="button" onClick={() => { swipe === 'today' ? actions.take(step.id, 'today') : actions.setFinishStep(step); setSwipe(null); }} className="inline-flex items-center gap-1 py-1">{swipe === 'today' ? 'На сегодня' : 'Выполнено'}<ArrowRight size={14} /></button></div>}<div className="mt-3 flex flex-wrap items-center gap-1.5"><button type="button" onClick={() => actions.setFinishStep(step)} className={`${BUTTON} bg-[#102a43] text-white`}><Check size={16} />Выполнено</button><button type="button" onClick={() => actions.take(step.id, 'today')} className={`${BUTTON} border border-[#d8e3e7] bg-white`} title="Взять на сегодня"><CalendarDays size={16} /><span className="hidden xs:inline">Сегодня</span></button><button type="button" onClick={() => actions.take(step.id, 'week')} className={`${BUTTON} border border-[#d8e3e7] bg-white`} title="Взять на неделю"><CalendarRange size={16} /></button><button type="button" onClick={() => setMore((value) => !value)} aria-expanded={more} className={`${BUTTON} border border-[#d8e3e7] bg-white`} title="Другие действия"><MoreHorizontal size={18} /></button></div>{more && <div className="mt-2 flex flex-wrap gap-2 border-t border-[#e1e9ec] pt-2"><button type="button" onClick={() => actions.setScheduleStep(step)} className={`${BUTTON} text-slate-600`}><CalendarDays size={15} />Дата</button><button type="button" onClick={() => actions.setHistoryStep(step)} className={`${BUTTON} text-slate-600`}><History size={15} />История</button><button type="button" onClick={() => actions.setStepEditor(step)} className={`${BUTTON} text-slate-600`}><Edit3 size={15} />Изменить</button><button type="button" onClick={() => actions.duplicateStep(step)} className={`${BUTTON} text-slate-600`}><Copy size={15} />Копия</button><button type="button" onClick={() => actions.changeRecord('steps', step.id, { archivedAt: new Date().toISOString() }, 'Шаг в архиве')} className={`${BUTTON} text-slate-600`}><Archive size={15} />В архив</button></div>}</article>;
}

function EmptyState({ title, action, onClick }) {
  return <div className="grid min-h-40 place-items-center border border-dashed border-[#c6d9df] bg-white px-4 py-6 text-center rounded-md"><div><p className="font-black">{title}</p>{action && <button type="button" onClick={onClick} className={`${BUTTON} mt-3 bg-[#16a36a] text-white`}><Plus size={16} />{action}</button>}</div></div>;
}

function Dialog({ title, children, onClose }) {
  return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] grid place-items-center bg-[#102a43]/45 p-3" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><motion.section role="dialog" aria-modal="true" aria-label={title} initial={{ y: 14, scale: .98 }} animate={{ y: 0, scale: 1 }} exit={{ y: 14, scale: .98 }} className="max-h-[min(90vh,850px)] w-full max-w-lg overflow-y-auto border border-[#d8e3e7] bg-white p-4 shadow-2xl rounded-lg sm:p-5"><div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-xl font-black">{title}</h2><button type="button" onClick={onClose} className="icon-command" title="Закрыть"><X size={19} /></button></div>{children}</motion.section></motion.div>;
}

function StepEditor({ step, categories, onSave, onDuplicate, onArchive, onDelete, onClose }) {
  const [draft, setDraft] = useState({ title: '', description: '', notes: '', categoryId: 'other', difficulty: 'step', ...step });
  return <Dialog title={step.id ? 'Изменить шаг' : 'Новый шаг'} onClose={onClose}><form onSubmit={(event) => { event.preventDefault(); onSave(draft); }} className="grid gap-3"><label className="form-label">Название<input autoFocus maxLength={120} required value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Что хочу попробовать?" className="field-control mt-1" /></label><label className="form-label">Короткое описание<textarea maxLength={400} rows={2} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} className="field-control mt-1 resize-none" /></label><label className="form-label">Категория<select value={draft.categoryId} onChange={(event) => setDraft({ ...draft, categoryId: event.target.value })} className="field-control mt-1">{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><div className="form-label">Сложность<div className="mt-2 grid grid-cols-5 gap-1">{LEVELS.map((level) => <button key={level.id} type="button" onClick={() => setDraft({ ...draft, difficulty: level.id })} aria-pressed={draft.difficulty === level.id} className={`min-h-14 min-w-0 border p-1 text-[10px] font-black leading-4 rounded-md ${draft.difficulty === level.id ? 'border-[#102a43] bg-[#eaf3f5] text-[#102a43]' : 'border-[#d8e3e7] bg-white text-slate-500'}`}><span className="block text-lg" style={{ color: level.color }}>{level.points}</span>{level.label}</button>)}</div></div><label className="form-label">Заметка для себя<textarea maxLength={500} rows={2} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} className="field-control mt-1 resize-none" /></label><button type="submit" className={`${BUTTON} min-h-12 bg-[#16a36a] text-white`}>Сохранить шаг</button></form>{step.id && <div className="mt-4 flex flex-wrap gap-2 border-t border-[#e1e9ec] pt-3"><button type="button" onClick={() => onDuplicate(step)} className={`${BUTTON} border border-[#d8e3e7]`}><Copy size={16} />Дублировать</button><button type="button" onClick={() => onArchive(step)} className={`${BUTTON} border border-[#d8e3e7]`}><Archive size={16} />В архив</button><button type="button" onClick={() => onDelete(step)} className={`${BUTTON} text-[#b84b52]`}><Trash2 size={16} />Удалить</button></div>}</Dialog>;
}

function ScheduleModal({ target, today, onSchedule, onClose }) {
  const [date, setDate] = useState(today);
  return <Dialog title="Назначить день" onClose={onClose}><p className="mb-3 text-sm font-semibold text-slate-600">{target.step?.title || target.title}</p><input type="date" min={today} value={date} onChange={(event) => setDate(event.target.value)} className="field-control" /><button type="button" disabled={!date} onClick={() => onSchedule(target.step ? target : { step: target }, date)} className={`${BUTTON} mt-3 w-full bg-[#16a36a] text-white`}>Взять на {date ? formatShortDate(date) : 'дату'}</button></Dialog>;
}

function ExecutionModal({ step, commitment, execution, onSave, onDelete, onClose }) {
  const [draft, setDraft] = useState({ before: commitment?.before ?? '', during: '', after: '', reality: '', repeat: 'unknown', difficulty: step?.difficulty || 'step', date: execution?.date || todayKey(), ...execution });
  const valid = ['before', 'during', 'after'].every((field) => validScore(draft[field]));
  return <Dialog title={execution ? 'Исправить запись' : 'Шаг сделан'} onClose={onClose}><p className="mb-4 text-sm font-bold text-slate-600">{step?.title || execution?.title}</p><form onSubmit={(event) => { event.preventDefault(); if (valid) onSave(draft); }} className="grid gap-3"><div className="grid grid-cols-3 gap-2">{[['before', 'До'], ['during', 'В процессе'], ['after', 'После']].map(([key, label]) => <label key={key} className="form-label">{label}<input type="number" min="0" max="10" step="1" required value={draft[key]} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} placeholder="0–10" className="field-control mt-1 text-center" /></label>)}</div>{!execution && commitment?.prediction && <p className="border-l-2 border-[#d8e3e7] pl-3 text-xs text-slate-500">Ожидал: {commitment.prediction}</p>}<label className="form-label">Что произошло на самом деле?<textarea rows={2} maxLength={700} value={draft.reality} onChange={(event) => setDraft({ ...draft, reality: event.target.value })} className="field-control mt-1 resize-none" /></label><fieldset><legend className="form-label">Хочу повторить?</legend><div className="mt-2 grid grid-cols-3 gap-1">{[['yes', 'Да'], ['no', 'Нет'], ['unknown', 'Не знаю']].map(([id, label]) => <button key={id} type="button" aria-pressed={draft.repeat === id} onClick={() => setDraft({ ...draft, repeat: id })} className={`${BUTTON} min-w-0 border ${draft.repeat === id ? 'border-[#16865f] bg-[#eaf8f4] text-[#16865f]' : 'border-[#d8e3e7] text-slate-500'}`}>{label}</button>)}</div></fieldset>{execution && <><label className="form-label">Дата<input type="date" value={draft.date} max={todayKey()} onChange={(event) => setDraft({ ...draft, date: event.target.value })} className="field-control mt-1" /></label><label className="form-label">Уровень в этом выполнении<select value={draft.difficulty} onChange={(event) => setDraft({ ...draft, difficulty: event.target.value })} className="field-control mt-1">{LEVELS.map((level) => <option key={level.id} value={level.id}>{level.label} · {level.points} очков</option>)}</select></label></>}<button type="submit" disabled={!valid} className={`${BUTTON} min-h-12 bg-[#16a36a] text-white disabled:bg-slate-300`}>{execution ? 'Сохранить исправление' : `Засчитать действие · +${levelFor(step?.difficulty).points}`}</button></form>{execution && <button type="button" onClick={onDelete} className={`${BUTTON} mt-3 text-[#b84b52]`}><Trash2 size={16} />Удалить запись</button>}</Dialog>;
}

function HistoryModal({ step, state, onEdit, onRepeat, onClose }) {
  const { history, count, first, last, avgBefore, avgAfter } = historyForStep(state, step.id);
  return <Dialog title={step.title} onClose={onClose}><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{[['Выполнено', count], ['Впервые', first ? formatShortDate(first) : '—'], ['До, среднее', avgBefore ?? '—'], ['После, среднее', avgAfter ?? '—']].map(([label, value]) => <div key={label} className="bg-[#f3f7f8] p-2 rounded-md"><div className="text-[11px] font-bold text-slate-500">{label}</div><strong className="text-lg">{value}</strong></div>)}</div>{last && <p className="mt-2 text-xs font-bold text-slate-500">Последний раз: {formatShortDate(last)}</p>}{history.length > 1 && <HistoryTrend history={history} />}<div className="mt-3 grid max-h-64 gap-2 overflow-y-auto">{[...history].reverse().map((item) => <button key={item.id} type="button" onClick={() => onEdit(item)} className="flex items-start justify-between gap-2 border border-[#d8e3e7] p-3 text-left text-sm rounded-md"><span><strong>{formatShortDate(item.date)} · {item.before} → {item.during} → {item.after}</strong><small className="mt-1 block leading-5 text-slate-600">{item.reality || 'Действие сделано'}</small></span><Edit3 size={16} className="shrink-0 text-slate-400" /></button>)}</div><button type="button" onClick={onRepeat} className={`${BUTTON} mt-4 w-full bg-[#102a43] text-white`}><RotateCcw size={17} />Повторить шаг</button></Dialog>;
}

function HistoryTrend({ history }) {
  const width = 380; const height = 105;
  const point = (item, index, field) => `${20 + index / (history.length - 1) * (width - 40)},${10 + (10 - item[field]) / 10 * (height - 25)}`;
  return <div className="mt-4"><div className="mb-1 flex gap-4 text-xs font-bold"><span className="text-[#df764a]">До</span><span className="text-[#168ca8]">После</span></div><svg viewBox={`0 0 ${width} ${height}`} className="h-28 w-full" role="img" aria-label="Динамика состояния до и после повторений">{[0, 5, 10].map((score) => <line key={score} x1="20" x2={width - 20} y1={10 + (10 - score) / 10 * (height - 25)} y2={10 + (10 - score) / 10 * (height - 25)} stroke="#e1e9ec" />)}<polyline points={history.map((item, index) => point(item, index, 'before')).join(' ')} fill="none" stroke="#df764a" strokeWidth="3" /><polyline points={history.map((item, index) => point(item, index, 'after')).join(' ')} fill="none" stroke="#168ca8" strokeWidth="3" /></svg></div>;
}

function CategoryEditor({ state, commit, onDelete, onClose }) {
  const [name, setName] = useState('');
  const add = () => { if (!name.trim()) return; commit((current, now) => ({ ...current, categories: [...current.categories, { id: createId('category'), name: name.trim(), createdAt: now, updatedAt: now, archivedAt: null }] })); setName(''); };
  return <Dialog title="Категории" onClose={onClose}><div className="grid gap-2">{state.categories.filter(activeItem).map((item) => <CategoryRow key={item.id} category={item} onRename={(newName) => commit((current, now) => ({ ...current, categories: current.categories.map((entry) => entry.id === item.id ? { ...entry, name: newName, updatedAt: now } : entry) }))} onDelete={() => onDelete(item)} />)}</div><form onSubmit={(event) => { event.preventDefault(); add(); }} className="mt-4 flex gap-2"><input value={name} maxLength={50} onChange={(event) => setName(event.target.value)} placeholder="Новая категория" className="field-control" /><button type="submit" disabled={!name.trim()} className={`${BUTTON} bg-[#16a36a] text-white disabled:bg-slate-300`} title="Добавить категорию"><Plus size={18} /></button></form></Dialog>;
}

function CategoryRow({ category, onRename, onDelete }) {
  const [name, setName] = useState(category.name);
  return <div className="flex items-center gap-2"><input aria-label={`Название категории ${category.name}`} value={name} maxLength={50} onChange={(event) => setName(event.target.value)} onBlur={() => { if (name.trim() && name.trim() !== category.name) onRename(name.trim()); else setName(category.name); }} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} className="field-control" />{category.id !== 'other' && <button type="button" onClick={onDelete} className="icon-command danger" title={`Удалить категорию ${category.name}`}><Trash2 size={17} /></button>}</div>;
}

function TaskEditor({ task, categories, onSave, onDelete, onClose }) {
  const [draft, setDraft] = useState({ title: '', description: '', categoryId: 'life', estimatedMinutes: '', estimatedCost: '', actualMinutes: '', actualCost: '', annoyance: 3, status: 'hanging', ...task });
  return <Dialog title={task.id ? 'Изменить дело' : 'Новое дело'} onClose={onClose}><form onSubmit={(event) => { event.preventDefault(); onSave(draft); }} className="grid gap-3"><label className="form-label">Что висит в голове?<input required maxLength={120} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} className="field-control mt-1" /></label><label className="form-label">Описание<textarea rows={2} maxLength={500} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} className="field-control mt-1 resize-none" /></label><label className="form-label">Категория<select value={draft.categoryId} onChange={(event) => setDraft({ ...draft, categoryId: event.target.value })} className="field-control mt-1">{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><div className="grid grid-cols-2 gap-2"><label className="form-label">Примерно минут<input type="number" min="0" value={draft.estimatedMinutes} onChange={(event) => setDraft({ ...draft, estimatedMinutes: event.target.value })} className="field-control mt-1" /></label><label className="form-label">Примерно ₽<input type="number" min="0" value={draft.estimatedCost} onChange={(event) => setDraft({ ...draft, estimatedCost: event.target.value })} className="field-control mt-1" /></label></div>{task.status === 'done' && <div className="grid grid-cols-2 gap-2"><label className="form-label">По факту минут<input type="number" min="0" value={draft.actualMinutes ?? ''} onChange={(event) => setDraft({ ...draft, actualMinutes: event.target.value })} className="field-control mt-1" /></label><label className="form-label">По факту ₽<input type="number" min="0" value={draft.actualCost ?? ''} onChange={(event) => setDraft({ ...draft, actualCost: event.target.value })} className="field-control mt-1" /></label></div>}<label className="form-label">Насколько висит в голове: {draft.annoyance} из 5<input type="range" min="1" max="5" value={draft.annoyance} onChange={(event) => setDraft({ ...draft, annoyance: event.target.value })} className="mt-2 w-full" /></label><button type="submit" className={`${BUTTON} min-h-12 bg-[#16a36a] text-white`}>Сохранить дело</button></form>{task.id && <button type="button" onClick={() => onDelete(task)} className={`${BUTTON} mt-3 text-[#b84b52]`}><Trash2 size={16} />Удалить</button>}</Dialog>;
}

function UnloadView({ state, stats, onAdd, onEdit, onMove, onDelete }) {
  const tasks = state.energyTasks.filter((item) => !item.deletedAt);
  const archived = tasks.filter((item) => item.status === 'done').sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  const [showDone, setShowDone] = useState(false);
  return <><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-xl font-black">Разгрузка</h2><p className="text-sm font-semibold text-slate-500">Дела, которые ждут своего времени.</p></div><button type="button" onClick={onAdd} className={`${BUTTON} bg-[#16a36a] text-white`}><Plus size={18} />Добавить дело</button></div><section className="steps-band"><div className="flex items-center gap-2 text-sm font-black text-[#16865f]"><CheckCircle2 size={18} />Снято с головы · {stats.period === 'week' ? 'эта неделя' : PERIODS.find(([id]) => id === stats.period)?.[1].toLowerCase()}</div><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{[['Дел', stats.energy.count], ['Времени', `${Math.floor(stats.energy.minutes / 60)} ч ${stats.energy.minutes % 60} мин`], ['Потрачено', `${stats.energy.cost.toLocaleString('ru-RU')} ₽`], ['Источников напряжения', stats.energy.count]].map(([label, value]) => <div key={label} className="border-l-2 border-[#16a36a] bg-white p-2"><span className="block text-xs font-bold text-slate-500">{label}</span><strong className="text-base">{value}</strong></div>)}</div></section><div className="steps-kanban grid gap-2 lg:grid-cols-3">{ENERGY_STATUSES.filter((status) => status.id !== 'done').map((status) => <section key={status.id} className="min-h-36 border border-[#d8e3e7] bg-[#f7fafb] p-3 rounded-md" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const id = event.dataTransfer.getData('text/plain'); if (id) onMove(id, status.id); }}><div className="mb-3 flex justify-between text-sm font-black"><h3>{status.label}</h3><span className="text-slate-400">{tasks.filter((task) => task.status === status.id).length}</span></div><div className="grid gap-2">{tasks.filter((task) => task.status === status.id).map((task) => <TaskCard key={task.id} task={task} state={state} onEdit={onEdit} onMove={onMove} onDelete={onDelete} />)}</div></section>)}</div>{archived.length > 0 && <section className="steps-band"><button type="button" onClick={() => setShowDone((value) => !value)} aria-expanded={showDone} className="flex w-full items-center justify-between text-left font-black"><span>Готово · {archived.length}</span><ChevronDown size={18} className={showDone ? 'rotate-180' : ''} /></button>{showDone && <div className="mt-3 grid gap-2 sm:grid-cols-2">{archived.map((task) => <TaskCard key={task.id} task={task} state={state} onEdit={onEdit} onMove={onMove} onDelete={onDelete} />)}</div>}</section>}</>;
}

function TaskCard({ task, state, onEdit, onMove, onDelete }) {
  return <article draggable onDragStart={(event) => event.dataTransfer.setData('text/plain', task.id)} className="steps-card border border-[#d8e3e7] bg-white p-3 rounded-md"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="text-xs font-bold text-[#0d8fb9]">{categoryName(state, task.categoryId)} · {task.annoyance}/5</div><h4 className="mt-1 break-words text-sm font-black">{task.title}</h4></div><button type="button" onClick={() => onEdit(task)} className="icon-command h-8 w-8 shrink-0" title="Редактировать дело"><Edit3 size={15} /></button></div>{task.description && <p className="mt-2 text-xs leading-5 text-slate-500">{task.description}</p>}<div className="mt-2 flex gap-3 text-xs font-semibold text-slate-500"><span>{task.estimatedMinutes || 0} мин</span><span>{Number(task.estimatedCost || 0).toLocaleString('ru-RU')} ₽</span><span>{formatShortDate(task.createdAt.slice(0, 10))}</span></div><div className="mt-3 flex items-center gap-2"><select aria-label={`Статус: ${task.title}`} value={task.status} onChange={(event) => onMove(task.id, event.target.value)} className="field-control min-h-10 py-1 text-xs">{ENERGY_STATUSES.map((status) => <option key={status.id} value={status.id}>{status.label}</option>)}</select>{task.status !== 'done' ? <button type="button" onClick={() => onMove(task.id, 'done')} className="icon-command h-10 w-10 shrink-0 bg-[#eaf8f4] text-[#16865f]" title="Готово"><Check size={17} /></button> : <button type="button" onClick={() => onDelete('energyTasks', task)} className="icon-command h-10 w-10 shrink-0" title="Удалить"><Trash2 size={16} /></button>}</div></article>;
}

function BossView({ state, boss, actions, onAdd }) {
  const defeated = state.executions.filter((item) => item.difficulty === 'boss' && !item.deletedAt).sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  return <><div className="flex items-center justify-between gap-2"><h2 className="text-xl font-black">Боссы</h2><button type="button" onClick={onAdd} className={`${BUTTON} border border-[#d8e3e7] bg-white`}><Plus size={17} />Новый Босс</button></div>{boss ? <section className="steps-boss relative overflow-hidden border border-[#cfc8ed] bg-[#f4f1fc] p-5 rounded-lg"><div className="relative z-10"><div className="flex items-center gap-2 text-xs font-black uppercase text-[#5344a8]"><Crown size={18} />Текущий Босс</div><h3 className="mt-3 max-w-xl break-words text-xl font-black">{boss.title}</h3>{boss.description && <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">{boss.description}</p>}<div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => actions.setFinishStep(boss)} className={`${BUTTON} bg-[#5344a8] text-white`}><Check size={17} />Выполнено · +12</button><button type="button" onClick={() => actions.take(boss.id, 'today')} className={`${BUTTON} border border-[#cfc8ed] bg-white`}><CalendarDays size={17} />На сегодня</button><button type="button" onClick={() => actions.setHistoryStep(boss)} className={`${BUTTON} border border-[#cfc8ed] bg-white`}><History size={17} />История</button></div></div><Crown size={170} strokeWidth={.6} className="pointer-events-none absolute -bottom-12 -right-6 text-[#dcd5f4]" /></section> : <EmptyState title="Пока нет текущего Босса" action="Создать Босса" onClick={onAdd} />}<section className="steps-band"><h3 className="mb-3 text-base font-black">Побеждённые Боссы · {defeated.length}</h3>{defeated.length ? <div className="grid gap-2 sm:grid-cols-2">{defeated.map((item) => <div key={item.id} className="flex items-center gap-3 border-l-2 border-[#5344a8] bg-white p-3"><Crown size={18} className="shrink-0 text-[#5344a8]" /><div className="min-w-0"><strong className="block truncate text-sm">{item.title}</strong><span className="text-xs text-slate-500">{formatShortDate(item.date)} · +{item.points} очков</span></div></div>)}</div> : <p className="text-sm font-semibold text-slate-500">Здесь останется история каждого Босса.</p>}</section></>;
}

function StepsStats({ state, stats, period, onPeriod }) {
  const { current, previous, delta } = stats;
  const all = calculateStepsStats(state, 'all');
  const progress = stats.days.slice(-Math.min(45, stats.days.length));
  const maxDaily = Math.max(1, ...progress.map((item) => item.count));
  const categoryRows = Object.entries(current.byCategory).sort((a, b) => b[1] - a[1]);
  const levelRows = LEVELS.map((level) => ({ ...level, count: current.byLevel[level.id] || 0 }));
  const achievements = achievementsFor(state);
  return <><div><h2 className="text-xl font-black">Опыт в цифрах</h2><div className="steps-periods mt-3 flex gap-1 overflow-x-auto">{PERIODS.map(([id, label]) => <button key={id} type="button" onClick={() => onPeriod(id)} aria-pressed={period === id} className={`${BUTTON} shrink-0 ${period === id ? 'bg-[#102a43] text-white' : 'border border-[#d8e3e7] bg-white text-slate-600'}`}>{label}</button>)}</div></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{[['Шагов', current.count, '#168ca8'], ['Очков роста', current.points, '#16a36a'], ['Смело', current.byLevel.brave || 0, '#df764a'], ['Боссов', current.byLevel.boss || 0, '#5344a8']].map(([label, value, color]) => <div key={label} className="border border-[#d8e3e7] bg-white p-3 rounded-md"><div className="h-1 w-9 rounded-sm" style={{ backgroundColor: color }} /><span className="mt-3 block text-xs font-bold text-slate-500">{label}</span><strong className="mt-1 block text-2xl font-black">{value}</strong></div>)}</div>{stats.bounds.previous && <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-600">{delta >= 0 ? <ArrowRight size={17} className="text-[#16a36a]" /> : <ArrowDownRight size={17} className="text-[#df764a]" />}{delta >= 0 ? '+' : ''}{delta} шагов к прошлому периоду ({previous.count} → {current.count}) · {current.points - previous.points >= 0 ? '+' : ''}{current.points - previous.points} очков</p>}<section className="steps-band"><div className="mb-3 flex justify-between gap-3"><div><h3 className="text-base font-black">Активность по дням</h3><p className="text-xs font-semibold text-slate-500">{current.activeDays} активных дней за период</p></div><span className="text-xs font-bold text-slate-500">{stats.bounds.start} – {stats.bounds.end}</span></div>{progress.length ? <div className="steps-daily-bars flex h-32 items-end gap-1 overflow-x-auto border-b border-[#cbd8dd] pb-1" role="img" aria-label="График выполненных шагов по дням">{progress.map((item) => <div key={item.date} title={`${item.date}: ${item.count} шагов`} className="flex h-full w-3 shrink-0 items-end"><div className="w-full bg-[#168ca8] rounded-t-sm" style={{ height: item.count ? `${Math.max(10, item.count / maxDaily * 100)}%` : '3px', opacity: item.count ? 1 : .18 }} /></div>)}</div> : <p className="text-sm text-slate-500">Пока нет отметок.</p>}<div className="mt-3 overflow-x-auto"><div className={stats.days.length < 14 ? 'steps-heatmap flex w-max gap-1' : 'steps-heatmap grid w-max grid-flow-col grid-rows-7 gap-1'}>{Array.from({ length: stats.days.length < 14 ? 0 : (new Date(`${stats.bounds.start}T12:00:00`).getDay() + 6) % 7 }, (_, index) => <span key={`empty-${index}`} />)}{stats.days.map((item) => <span key={item.date} title={`${item.date}: ${item.count} шагов`} className="h-3 w-3 rounded-sm" style={{ backgroundColor: item.count === 0 ? '#e2ebed' : item.count === 1 ? '#9ddac2' : item.count === 2 ? '#4ab394' : '#16865f' }} />)}</div></div></section><div className="grid gap-3 lg:grid-cols-2"><section className="steps-band"><h3 className="mb-3 text-base font-black">По уровням</h3>{levelRows.map((level) => <BarRow key={level.id} label={level.label} value={level.count} max={Math.max(1, current.count)} color={level.color} />)}<p className="mt-4 text-xs font-bold text-slate-500">Разных действий: {current.distinct} · Повторов: {current.repeats}</p></section><section className="steps-band"><h3 className="mb-3 text-base font-black">По категориям</h3>{categoryRows.length ? categoryRows.map(([id, count]) => <BarRow key={id} label={categoryName(state, id)} value={count} max={Math.max(1, current.count)} color="#168ca8" />) : <p className="text-sm font-semibold text-slate-500">Появятся после первого шага.</p>}<p className="mt-4 text-xs font-bold text-slate-500">Взято обязательств: {stats.commitments.total} · выполнено: {stats.commitments.done} · {stats.commitments.rate === null ? '—' : `${stats.commitments.rate}%`}</p></section></div><section className="steps-band"><h3 className="mb-3 text-base font-black">Сложность действий</h3><DifficultyTrend executions={state.executions.filter((item) => !item.deletedAt && item.date >= stats.bounds.start && item.date <= stats.bounds.end).sort((a, b) => a.completedAt.localeCompare(b.completedAt))} /></section><section className="steps-band"><h3 className="mb-3 text-base font-black">Достижения</h3><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{achievements.map((item) => <div key={item.id} className={`min-h-20 border p-3 rounded-md ${item.earnedAt ? 'border-[#b8e0cb] bg-white' : 'border-[#e1e9ec] bg-[#f5f8f9] text-slate-400'}`}><CheckCircle2 size={18} className={item.earnedAt ? 'text-[#16a36a]' : ''} /><strong className="mt-1 block text-xs leading-4">{item.title}</strong>{item.earnedAt && <small className="text-[10px] text-slate-500">{formatShortDate(item.earnedAt.slice(0, 10))}</small>}</div>)}</div><p className="mt-3 text-xs font-bold text-slate-500">За всё время: {all.current.count} шагов · {all.current.points} очков</p></section></>;
}

function BarRow({ label, value, max, color }) {
  return <div className="mb-2"><div className="flex justify-between gap-2 text-xs font-bold"><span>{label}</span><span>{value}</span></div><div className="mt-1 h-2 bg-[#e9eff2] rounded-sm"><div className="h-full rounded-sm" style={{ width: `${value / max * 100}%`, backgroundColor: color }} /></div></div>;
}

function DifficultyTrend({ executions }) {
  if (!executions.length) return <p className="text-sm font-semibold text-slate-500">Появится после первого шага.</p>;
  const recent = executions.slice(-30);
  const max = 5;
  return <div><div className="flex h-24 items-end gap-1 border-b border-[#d8e3e7]">{recent.map((item) => <div key={item.id} title={`${formatShortDate(item.date)} · ${levelFor(item.difficulty).label}`} className="w-4 shrink-0 rounded-t-sm" style={{ height: `${(LEVELS.findIndex((level) => level.id === item.difficulty) + 1) / max * 100}%`, backgroundColor: levelFor(item.difficulty).color }} />)}</div><div className="mt-2 flex justify-between text-[11px] font-bold text-slate-500"><span>{formatShortDate(recent[0].date)}</span><span>Уровень каждого выполненного действия</span><span>{formatShortDate(recent.at(-1).date)}</span></div></div>;
}
