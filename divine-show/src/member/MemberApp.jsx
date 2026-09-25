import { lazy, Suspense, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, AlertTriangle, BarChart3, CalendarDays, Camera, Check, CheckCircle2, ChevronDown, Footprints, LogOut, RotateCcw, Scale, UserRound, Users, Utensils, X } from 'lucide-react';
import { CodexPanel, CodexStats } from '../life/LifePanels';
import { compressImageDataUrl, uploadLifeImage } from '../life/files';
import DayDetailsModal from '../marathon/DayDetailsModal';
import { MeasurementDashboard, ProgressPhotoGallery } from './BodyProgress';
import { MEASUREMENT_FIELDS, PHOTO_STAGES } from './bodyProgressData';
import { migrateMemberState } from './memberRules';
import {
  DAY_RESULTS,
  calculateEnergyBalance,
  calculateStats,
  calculateBmr,
  createId,
  evaluateDay,
  formatLongDate,
  formatShortDate,
  getCurrentDayIndex,
  getDayResult,
  hasDayData,
  todayKey,
  updateDayDraft,
} from '../marathon/model';

const CommunityModule = lazy(() => import('../community/CommunityModule'));

export default function MemberApp({ user, state, commit, currentDate, syncState, onReset, onLogOut }) {
  const [view, setView] = useState('today');
  const [range, setRange] = useState('30');
  const [showDays, setShowDays] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [dayPreviewIndex, setDayPreviewIndex] = useState(null);
  const userDisplayName = user.displayName;
  const userPhotoUrl = user.photoURL;
  const duration = state.durationDays;
  const currentIndex = getCurrentDayIndex(state.startDate, currentDate, duration);
  const day = state.days[currentIndex];
  const editable = !day.result && day.date === todayKey();
  const stats = calculateStats(state, currentIndex, range);
  const evaluation = day.result ? { ...DAY_RESULTS[day.result], score: day.score, xp: day.xp, canClose: true, blockers: [] } : evaluateDay(day, state.goals, state.dayCriteria, state.resultThresholds, state.codexRules);

  useEffect(() => {
    if (state.memberSchemaVersion >= 4) return;
    commit((current, now) => migrateMemberState(current, now, { displayName: userDisplayName, photoURL: userPhotoUrl }));
  }, [commit, state.memberSchemaVersion, userDisplayName, userPhotoUrl]);

  const updateDay = (patch) => {
    if (!editable) return;
    commit((current, now) => ({ ...current, days: current.days.map((item, index) => index === currentIndex ? updateDayDraft(item, patch, now) : item) }));
  };
  const closeDay = () => {
    const result = evaluateDay(day, state.goals, state.dayCriteria, state.resultThresholds, state.codexRules);
    if (!editable || !result.canClose) return;
    commit((current, now) => ({ ...current, days: current.days.map((item, index) => index === currentIndex ? { ...item, result: result.id, score: result.score, xp: result.xp, closedAt: now, closureMode: 'manual', draftSavedAt: item.draftSavedAt || now, draftUpdatedAt: now } : item) }));
    setConfirmClose(false);
  };

  const nav = [
    ['today', 'Сегодня', CheckCircle2],
    ['progress', 'Прогресс', BarChart3],
    ['profile', 'Профиль', UserRound],
    ['friends', 'Друзья', Users],
  ];
  return <div className="min-h-screen bg-[#f2f7f6] pb-24 text-[#15333b]">
    <header className="sticky top-0 z-40 border-b border-[#cfe0dc] bg-white/95 backdrop-blur-xl"><div className="mx-auto flex min-h-16 max-w-5xl items-center gap-3 px-3 sm:px-5"><button type="button" onClick={() => setView('today')} className="grid h-10 w-10 place-items-center bg-[#0d8b71] font-black text-white rounded-md">{duration}</button><div className="min-w-0 flex-1"><div className="flex justify-between text-xs font-black text-slate-500"><span>День {currentIndex + 1} из {duration}</span><span>{Math.round((currentIndex + 1) / duration * 100)}%</span></div><div className="mt-1 h-2 overflow-hidden bg-[#dfeae7] rounded-sm"><motion.div className="h-full bg-[#17a77f]" animate={{ width: `${(currentIndex + 1) / duration * 100}%` }} /></div></div><span className={`h-2.5 w-2.5 rounded-full ${syncState === 'synced' ? 'bg-emerald-500' : syncState === 'saving' ? 'animate-pulse bg-amber-400' : 'bg-rose-500'}`} />{state.profile?.photoUrl || user.photoURL ? <img src={state.profile?.photoUrl || user.photoURL} alt={state.profile?.displayName || user.displayName || 'Аватар'} className="h-10 w-10 shrink-0 border border-[#cfe0dc] bg-[#dfeae7] object-cover rounded-md" /> : <span className="grid h-10 w-10 shrink-0 place-items-center bg-[#dfeae7] font-black text-[#0d735f] rounded-md">{(state.profile?.displayName || user.displayName || user.email || 'Я').trim().charAt(0).toUpperCase()}</span>}<button type="button" onClick={onLogOut} className="icon-command" title="Выйти"><LogOut size={18} /></button></div><div className="mx-auto hidden max-w-5xl grid-cols-4 px-5 sm:grid">{nav.map(([id, label, Icon]) => <button key={id} type="button" onClick={() => setView(id)} className={`flex min-h-12 items-center justify-center gap-2 border-b-2 text-sm font-black ${view === id ? 'border-[#0d8b71] text-[#0d735f]' : 'border-transparent text-slate-500'}`}><Icon size={17} />{label}</button>)}</div></header>

    <main className="mx-auto grid max-w-5xl gap-4 px-3 py-4 sm:px-5">
      {view === 'today' && <>
        <button type="button" onClick={() => setShowDays((value) => !value)} className="border border-[#cfe0dc] bg-white p-4 text-left shadow-sm rounded-lg"><div className="flex items-center justify-between"><span className="flex items-center gap-2 font-black"><CalendarDays size={19} className="text-[#0d8b71]" />Карта марафона</span><ChevronDown size={18} className={showDays ? 'rotate-180' : ''} /></div><div className="mt-1 text-xs font-bold text-slate-500">{stats.credited.length} дней с результатом · {stats.completionRate}% пути закрыто</div></button>
        {showDays && <DayGrid state={state} currentIndex={currentIndex} onSelect={setDayPreviewIndex} />}
        <section className="border border-[#b9ddd3] bg-[#eaf8f4] p-4 rounded-lg"><div className="text-xs font-black uppercase text-[#0d735f]">{formatLongDate(day.date)}</div><h1 className="mt-1 text-2xl font-black">Сегодняшние доказательства</h1><p className="mt-2 text-sm font-semibold leading-6 text-slate-600">Честная отметка сильнее идеальной картинки. Один день не определяет тебя, но каждый выбор оставляет след.</p></section>
        <CodexPanel state={state} day={day} editable={editable} commit={commit} onDayChange={updateDay} />
        <BodyMetrics day={day} profile={state.profile} editable={editable} onChange={updateDay} />
        <details className="border border-[#cfe0dc] bg-white rounded-lg"><summary className="flex min-h-14 cursor-pointer items-center justify-between px-4 font-black"><span>Победа дня <small className="font-bold text-slate-400">необязательно</small></span><ChevronDown size={18} /></summary><div className="border-t border-[#dfeae7] p-4"><textarea value={day.evidence || ''} disabled={!editable} onChange={(event) => updateDay({ ...day, evidence: event.target.value })} placeholder="Какой факт сегодня доказывает движение?" className="field-control min-h-28 resize-y" /></div></details>
        <section className="border border-[#cfe0dc] bg-white p-4 rounded-lg"><div className="flex items-center justify-between gap-3"><div><div className="text-xs font-black uppercase text-slate-500">Результат дня</div><div className="mt-1 text-2xl font-black" style={{ color: evaluation.color }}>{evaluation.title}</div></div><div className="grid h-14 w-14 place-items-center border-4 font-black rounded-full" style={{ borderColor: evaluation.color, color: evaluation.color }}>{evaluation.score}%</div></div>{!evaluation.canClose && <div className="mt-3 grid gap-1 text-xs font-bold text-slate-500">{evaluation.blockers.map((item) => <span key={item}>{item}</span>)}</div>}{day.result ? <div className="mt-4 flex items-center gap-2 bg-[#eaf8f4] p-3 font-black text-[#0d735f] rounded-md"><Check size={18} />День закрыт</div> : <button type="button" disabled={!evaluation.canClose} onClick={() => setConfirmClose(true)} className="mt-4 min-h-12 w-full bg-[#0d8b71] font-black text-white disabled:bg-slate-300 rounded-md">Закрыть день</button>}</section>
      </>}
      {view === 'progress' && <MemberProgress state={state} stats={stats} range={range} onRange={setRange} commit={commit} />}
      {view === 'profile' && <MemberProfile user={user} state={state} commit={commit} onReset={onReset} />}
      {view === 'friends' && <Suspense fallback={<div className="p-6 text-center font-black">Открываю пространство друзей…</div>}><CommunityModule user={user} privateState={state} /></Suspense>}
    </main>
    <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-[#cfe0dc] bg-white/95 p-2 backdrop-blur sm:hidden">{nav.map(([id, label, Icon]) => <button key={id} type="button" onClick={() => setView(id)} className={`flex min-h-13 flex-col items-center justify-center gap-1 text-[11px] font-black rounded-md ${view === id ? 'bg-[#e4f6f0] text-[#0d735f]' : 'text-slate-500'}`}><Icon size={20} />{label}</button>)}</nav>
    {confirmClose && <Confirm title="Закрыть день?" text={`Будет зафиксирован результат «${evaluation.title}» — ${evaluation.score}%. После этого данные дня нельзя изменить.`} onConfirm={closeDay} onClose={() => setConfirmClose(false)} />}
    {dayPreviewIndex !== null && <DayDetailsModal state={state} dayIndex={dayPreviewIndex} onClose={() => setDayPreviewIndex(null)} />}
  </div>;
}

function BodyMetrics({ day, profile, editable, onChange }) {
  const bmr = calculateBmr(day.weight, profile);
  const balance = calculateEnergyBalance({ ...day, activeCalories: profile.trackActiveCalories ? day.activeCalories : 0 }, profile);
  return <section className="border border-[#cfe0dc] bg-white p-4 rounded-lg"><div className="flex items-center gap-2 font-black"><Activity size={19} className="text-[#0d8b71]" />Показатели тела</div><div className={`mt-4 grid grid-cols-2 gap-2 ${profile.trackActiveCalories ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}><Metric label="Калории" icon={<Utensils />} value={day.calories} disabled={!editable} onChange={(calories) => onChange({ ...day, calories })} />{profile.trackActiveCalories && <Metric label="Активные" icon={<Activity />} value={day.activeCalories} disabled={!editable} onChange={(activeCalories) => onChange({ ...day, activeCalories })} />}<Metric label="Шаги" icon={<Footprints />} value={day.steps} disabled={!editable} onChange={(steps) => onChange({ ...day, steps })} /><Metric label="Вес, кг" icon={<Scale />} value={day.weight} step="0.1" disabled={!editable} onChange={(weight) => onChange({ ...day, weight })} /></div>{bmr > 0 && <div className="mt-3 flex flex-wrap gap-4 text-xs font-bold text-slate-500"><span>Базовый обмен: <strong>{bmr} ккал</strong></span><span>Энергетический итог: <strong className={balance !== null && balance <= 0 ? 'text-[#0d735f]' : 'text-[#b24a42]'}>{balance === null ? 'нужны данные' : `${balance > 0 ? '+' : ''}${balance} ккал`}</strong></span></div>}</section>;
}

function Metric({ label, icon, value, disabled, onChange, step = '1' }) { return <label className="border border-[#d7e5e1] bg-[#f5faf8] p-3 rounded-md"><span className="flex items-center gap-1 text-xs font-black text-slate-500">{icon}{label}</span><input type="number" min="0" step={step} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full bg-transparent text-xl font-black outline-none" /></label>; }

function DayGrid({ state, currentIndex, onSelect }) {
  return <section className="border border-[#cfe0dc] bg-white p-3 rounded-lg"><div className="grid grid-cols-6 gap-2 sm:grid-cols-10">{state.days.map((day, index) => { const result = index <= currentIndex ? getDayResult(day, state.goals, state.dayCriteria, state.resultThresholds, state.codexRules) : null; const future = index > currentIndex; return <button type="button" disabled={future} onClick={() => onSelect(index)} key={day.day} title={`${future ? '' : 'Открыть: '}день ${day.day} · ${formatLongDate(day.date)}`} className={`grid min-h-14 place-items-center border text-center transition rounded-md ${future ? 'cursor-default border-slate-200 bg-slate-50 text-slate-400' : result ? 'text-white hover:brightness-95' : hasDayData(day) ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100' : 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'}`} style={result ? { backgroundColor: result.color, borderColor: result.color } : undefined}><span><strong className="block">{day.day}</strong><small className="text-[9px] font-bold">{formatShortDate(day.date)}</small></span></button>; })}</div><p className="mt-3 text-center text-xs font-bold text-slate-400">Нажми на прошедший день, чтобы открыть его показатели</p></section>;
}

function MemberProgress({ state, stats, range, onRange, commit }) {
  const weightDelta = stats.weights.length > 1 ? stats.weightDelta : null;
  return <div className="grid gap-4"><section className="border border-[#cfe0dc] bg-white p-4 rounded-lg"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="text-sm font-black text-[#0d735f]">Прогресс</div><h1 className="mt-1 text-2xl font-black">Результат виден по фактам</h1></div><div className="grid grid-cols-3 gap-1 bg-[#edf4f2] p-1 rounded-md">{[['7', '7 дней'], ['30', '30 дней'], ['all', 'Весь путь']].map(([id, label]) => <button key={id} type="button" onClick={() => onRange(id)} className={`min-h-9 px-2 text-xs font-black rounded-sm ${range === id ? 'bg-[#15333b] text-white' : 'text-slate-500'}`}>{label}</button>)}</div></div><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"><Stat label="Соблюдение" value={`${stats.completionRate}%`} /><Stat label="Вес" value={weightDelta === null ? 'Нужны 2 точки' : `${weightDelta > 0 ? '+' : ''}${weightDelta} кг`} /><Stat label="Шаги в среднем" value={stats.avgSteps.toLocaleString('ru-RU')} /><Stat label="Рефлексия" value={`${stats.reflectionRate}%`} /></div></section><CodexStats stats={stats.codexStats} state={state} commit={commit} /><section className="grid gap-3 sm:grid-cols-2"><ProgressBars title="Калории" data={stats.calories} color="#e35f5f" suffix="ккал" /><ProgressBars title="Шаги" data={stats.steps} color="#0d8b71" suffix="" /></section></div>;
}

function ProgressBars({ title, data, color, suffix }) { const visible = data.slice(-14); const max = Math.max(1, ...visible.map((item) => item.value)); return <section className="border border-[#cfe0dc] bg-white p-4 rounded-lg"><h2 className="font-black">{title}</h2><div className="mt-4 flex h-40 items-end gap-1">{visible.map((item) => <div key={item.day} className="group relative flex-1" title={`День ${item.day}: ${item.value} ${suffix}`}><div className="min-h-1 w-full rounded-t-sm" style={{ height: `${Math.max(4, item.value / max * 140)}px`, backgroundColor: color }} /></div>)}</div>{!visible.length && <div className="grid h-40 place-items-center text-sm font-bold text-slate-400">Нужны первые данные</div>}</section>; }
function Stat({ label, value }) { return <div className="border border-[#d7e5e1] bg-[#f5faf8] p-3 text-center rounded-md"><div className="text-xs font-bold text-slate-500">{label}</div><div className="mt-1 text-lg font-black">{value}</div></div>; }

function MemberProfile({ user, state, commit, onReset }) {
  const profile = state.profile;
  const existingPhotos = (state.bodyLogs || []).filter((item) => item.photoUrl);
  const emptyLog = (stage = existingPhotos.length ? 'checkpoint' : 'start') => ({ date: todayKey(), weight: '', waist: '', chest: '', hips: '', arm: '', thigh: '', photoUrl: '', photoStage: stage });
  const [draft, setDraft] = useState(profile);
  const [log, setLog] = useState(emptyLog);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const saveProfile = () => commit((current, now) => ({ ...current, profile: { ...current.profile, ...draft, updatedAt: now }, dayCriteria: current.dayCriteria.map((item) => item.field === 'activeCalories' ? { ...item, active: Boolean(draft.trackActiveCalories), required: Boolean(draft.trackActiveCalories) } : item) }));
  const addLog = () => commit((current, now) => ({ ...current, bodyLogs: [...(current.bodyLogs || []), { ...log, id: createId('body-log'), createdAt: now, updatedAt: now }], profile: { ...current.profile, ...(log.weight ? { currentWeight: log.weight } : {}) } }));
  const upload = async (file) => { if (!file) return; setUploading(true); setUploadError(''); try { let photoUrl; try { photoUrl = await uploadLifeImage(user.uid, 'progress', file); } catch { photoUrl = await compressImageDataUrl(file); } setLog((current) => ({ ...current, photoUrl })); } catch { setUploadError('Не удалось подготовить фото. Максимальный размер файла — 12 МБ.'); } finally { setUploading(false); } };
  const uploadAvatar = async (file) => { if (!file) return; setUploading(true); setUploadError(''); try { let photoUrl; try { photoUrl = await uploadLifeImage(user.uid, 'avatar', file); } catch { photoUrl = await compressImageDataUrl(file, 360, 0.7); } setDraft((current) => ({ ...current, photoUrl })); } catch { setUploadError('Не удалось подготовить фото. Максимальный размер файла — 12 МБ.'); } finally { setUploading(false); } };
  const avatar = draft.photoUrl || user.photoURL;
  const stage = PHOTO_STAGES.find((item) => item.id === log.photoStage) || PHOTO_STAGES[0];
  const submitLog = () => { addLog(); setLog(emptyLog('checkpoint')); };
  const reset = async () => { setResetting(true); const succeeded = await onReset(); setResetting(false); if (!succeeded) setConfirmReset(false); };

  return <div className="grid gap-4"><section className="border border-[#cfe0dc] bg-white p-4 rounded-lg"><div className="flex items-center gap-3">{avatar ? <img src={avatar} alt="" className="h-16 w-16 bg-[#dfeae7] object-cover rounded-md" /> : <span className="grid h-16 w-16 place-items-center bg-[#dfeae7] text-[#0d735f] rounded-md"><UserRound size={28} /></span>}<div><div className="text-sm font-black text-[#0d735f]">Личные данные</div><h1 className="text-2xl font-black">{draft.displayName || user.displayName || 'Мой профиль'}</h1></div></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><Field label="Имя"><input value={draft.displayName || ''} onChange={(event) => setDraft({ ...draft, displayName: event.target.value })} className="field-control mt-1" /></Field><Field label="Фото: ссылка"><input value={draft.photoUrl || ''} onChange={(event) => setDraft({ ...draft, photoUrl: event.target.value })} className="field-control mt-1" /></Field><label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 border border-[#b9ddd3] bg-[#eaf8f4] font-black text-[#0d735f] rounded-md sm:col-span-2"><Camera size={17} />{uploading ? 'Готовлю фото…' : 'Выбрать аватар'}<input type="file" accept="image/*" disabled={uploading} onChange={(event) => uploadAvatar(event.target.files?.[0])} className="sr-only" /></label><Field label="Возраст"><input type="number" value={draft.age || ''} onChange={(event) => setDraft({ ...draft, age: event.target.value })} className="field-control mt-1" /></Field><Field label="Рост, см"><input type="number" value={draft.height || ''} onChange={(event) => setDraft({ ...draft, height: event.target.value })} className="field-control mt-1" /></Field><Field label="Целевой вес, кг"><input type="number" step="0.1" value={draft.targetWeight || ''} onChange={(event) => setDraft({ ...draft, targetWeight: event.target.value })} className="field-control mt-1" /></Field><Field label="Лимит калорий"><input type="number" value={draft.calorieTarget || ''} onChange={(event) => setDraft({ ...draft, calorieTarget: event.target.value })} className="field-control mt-1" /></Field></div><label className="mt-3 flex items-start gap-3 border border-[#d7e5e1] bg-[#f5faf8] p-3 rounded-md"><input type="checkbox" checked={Boolean(draft.trackActiveCalories)} onChange={(event) => setDraft({ ...draft, trackActiveCalories: event.target.checked })} className="mt-1 h-5 w-5 accent-[#0d8b71]" /><span><strong className="block text-sm">У меня есть трекер активных калорий</strong><small className="text-slate-500">Если выключено, активные калории не требуются и не влияют на закрытие дня.</small></span></label><div className="mt-3 grid gap-2 sm:grid-cols-3"><Privacy checked={draft.discoverable !== false} label="Меня можно найти" onChange={(discoverable) => setDraft({ ...draft, discoverable })} /><Privacy checked={Boolean(draft.shareProgress)} label="Делиться процентом пути" onChange={(shareProgress) => setDraft({ ...draft, shareProgress })} /><Privacy checked={Boolean(draft.shareWeight)} label="Делиться весом" onChange={(shareWeight) => setDraft({ ...draft, shareWeight })} /></div>{uploadError && <div className="mt-2 text-xs font-bold text-rose-600">{uploadError}</div>}<button type="button" onClick={saveProfile} className="mt-4 min-h-12 w-full bg-[#0d8b71] font-black text-white rounded-md">Сохранить профиль</button></section>

    <section className="border border-[#cfe0dc] bg-white p-4 rounded-lg"><div className="flex items-center gap-2"><Scale size={19} className="text-[#0d8b71]" /><h2 className="text-xl font-black">Новая контрольная точка</h2></div><p className="mt-2 text-sm font-semibold leading-6 text-slate-500">Сделай стартовый замер до начала. Следующую точку добавь через 30 дней, финальную — в конце марафона. Измеряйся в похожих условиях.</p><div className="mt-4 grid grid-cols-3 gap-1 bg-[#edf4f2] p-1 rounded-md">{PHOTO_STAGES.map((item) => <button key={item.id} type="button" onClick={() => setLog({ ...log, photoStage: item.id })} className={`min-h-10 text-xs font-black rounded-sm ${log.photoStage === item.id ? 'bg-[#15333b] text-white' : 'text-slate-500'}`}>{item.label}</button>)}</div><div className="mt-2 text-center text-xs font-bold text-slate-500">{stage.hint}</div><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"><Field label="Дата"><input type="date" value={log.date} onChange={(event) => setLog({ ...log, date: event.target.value })} className="field-control mt-1" /></Field>{MEASUREMENT_FIELDS.map((item) => <Field key={item.id} label={`${item.label}, ${item.unit}`}><input type="number" step="0.1" value={log[item.id]} onChange={(event) => setLog({ ...log, [item.id]: event.target.value })} className="field-control mt-1" /></Field>)}</div><Field label="Ссылка на фото"><input value={log.photoUrl} onChange={(event) => setLog({ ...log, photoUrl: event.target.value })} className="field-control mt-1" /></Field>{log.photoUrl && <img src={log.photoUrl} alt="Предпросмотр" className="mt-2 max-h-72 w-full bg-[#eef5f3] object-contain rounded-md" />}<label className="mt-2 flex min-h-12 cursor-pointer items-center justify-center gap-2 border border-[#b9ddd3] bg-[#eaf8f4] font-black text-[#0d735f] rounded-md"><Camera size={17} />{uploading ? 'Загружаю…' : `Загрузить фото · ${stage.label.toLowerCase()}`}<input type="file" accept="image/*" disabled={uploading} onChange={(event) => upload(event.target.files?.[0])} className="sr-only" /></label><div className="mt-2 flex items-start gap-2 bg-[#f5faf8] p-3 text-xs font-bold leading-5 text-slate-500 rounded-md"><UserRound size={16} className="mt-0.5 shrink-0" />Фото доступны только тебе и администратору. Другие участники их не видят.</div>{uploadError && <div className="mt-2 text-xs font-bold text-rose-600">{uploadError}</div>}<button type="button" disabled={!Object.entries(log).some(([key, value]) => !['date', 'photoStage'].includes(key) && value)} onClick={submitLog} className="mt-3 min-h-12 w-full bg-[#15333b] font-black text-white disabled:bg-slate-300 rounded-md">Сохранить контрольную точку</button></section>

    <MeasurementDashboard logs={state.bodyLogs || []} />
    <ProgressPhotoGallery logs={state.bodyLogs || []} progressPhotos={state.progressPhotos || []} />

    <section className="border border-rose-200 bg-rose-50 p-4 rounded-lg"><div className="flex items-start gap-3"><AlertTriangle className="shrink-0 text-rose-600" /><div><h2 className="font-black text-rose-800">Сбросить текущий маршрут</h2><p className="mt-1 text-sm font-semibold leading-6 text-rose-700">Дни, замеры и фото текущего марафона будут удалены. После сброса появится стартовый экран.</p></div></div><button type="button" onClick={() => setConfirmReset(true)} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 border border-rose-300 bg-white font-black text-rose-700 rounded-md"><RotateCcw size={17} />Сбросить маршрут</button></section>
    {confirmReset && <Confirm title="Сбросить маршрут?" text="Ты точно уверен? Текущий марафон, заполненные дни, замеры и фотографии будут удалены без возможности восстановления." confirmLabel={resetting ? 'Сбрасываю…' : 'Да, сбросить'} danger loading={resetting} onConfirm={reset} onClose={() => setConfirmReset(false)} />}
  </div>;
}

function Field({ label, children }) { return <label className="min-w-0 text-xs font-black text-slate-500">{label}{children}</label>; }
function Privacy({ checked, label, onChange }) { return <label className="flex items-center gap-2 border border-[#d7e5e1] p-3 text-xs font-black rounded-md"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />{label}</label>; }
function Confirm({ title, text, confirmLabel = 'Да, закрыть', danger = false, loading = false, onConfirm, onClose }) { return <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-50 grid place-items-center bg-[#15333b]/50 p-3"><section className="w-full max-w-md bg-white p-5 shadow-2xl rounded-lg"><div className="flex items-start justify-between gap-3"><h2 className="text-2xl font-black">{title}</h2><button type="button" onClick={onClose} disabled={loading} className="icon-command"><X size={18} /></button></div><p className="mt-3 font-semibold leading-7 text-slate-600">{text}</p><div className="mt-5 grid grid-cols-2 gap-2"><button type="button" onClick={onClose} disabled={loading} className="min-h-12 border border-[#cfe0dc] font-black disabled:opacity-50 rounded-md">Отмена</button><button type="button" onClick={onConfirm} disabled={loading} className={`min-h-12 font-black text-white disabled:opacity-60 rounded-md ${danger ? 'bg-rose-600' : 'bg-[#0d8b71]'}`}>{confirmLabel}</button></div></section></div>; }
