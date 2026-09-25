import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  AlertCircle,
  BarChart3,
  BatteryCharging,
  Brain,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Compass,
  Download,
  Edit3,
  Footprints,
  Gauge,
  Heart,
  Home,
  Loader2,
  Lock,
  LogIn,
  LogOut,
  Menu,
  Plus,
  Route,
  Save,
  Scale,
  Settings2,
  Trash2,
  Trophy,
  Utensils,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from './firebase';
import { useGoogleAuth } from './auth/useGoogleAuth';
import { roleForUser } from './auth/roles';
import { useMarathonStore } from './marathon/useMarathonStore';
import { useStepsStore } from './steps/useStepsStore';
import StepsModule from './steps/StepsModule';
import { useLifeStore } from './life/useLifeStore';
import CourseModule from './life/CourseModule';
import MemberApp from './member/MemberApp';
import DayDetailsModal from './marathon/DayDetailsModal';
import { usePublicProfileSync } from './community/usePublicProfileSync';
import { CodexPanel, CodexStats, EventsPanel, FocusActions, PatternsPanel } from './life/LifePanels';
import { acceptCommitments, acceptMemberCommitments, commitmentsForDuration, memberCommitmentsForDuration } from './marathon/commitments';
import journeyDawn from './assets/journey-dawn.jpg';
import {
  CALORIE_LIMIT,
  CALORIE_TARGET,
  COURAGE_CONTEXTS,
  DAY_RESULTS,
  GOAL_CADENCES,
  GOAL_COLORS,
  GOAL_TYPES,
  MARATHON_DURATIONS,
  TOTAL_DAYS,
  addDays,
  buildMarathonSummary,
  buildExport,
  calculateBmr,
  calculateEnergyBalance,
  calculateStats,
  clamp,
  createId,
  evaluateDay,
  formatLongDate,
  formatShortDate,
  getCurrentDayIndex,
  getDayResult,
  hasDayData,
  isJourneyEnded,
  isWeeklyReviewComplete,
  number,
  todayKey,
  updateDayDraft,
  visibleGoalsForDay,
} from './marathon/model';

const CommunityModule = lazy(() => import('./community/CommunityModule'));

function App() {
  const authSession = useGoogleAuth();
  return <AccountApp key={authSession.user?.uid || 'signed-out'} authSession={authSession} />;
}

function AccountApp({ authSession }) {
  const { user, loading: authLoading, signingIn, error: authError, signIn } = authSession;
  const role = roleForUser(user);
  const adminUser = role === 'admin' ? user : null;
  const { state, history, ready: cloudReady, syncState, error: storageError, starting, currentDate, start, startNext, commit, retry } = useMarathonStore(user);
  usePublicProfileSync(user, cloudReady ? state : undefined);
  const stepsStore = useStepsStore(cloudReady && state?.contractAcceptedAt ? adminUser : null);
  const lifeStore = useLifeStore(cloudReady && state?.contractAcceptedAt ? adminUser : null);
  const [activeDayIndex, setActiveDayIndex] = useState(null);
  const [view, setView] = useState('today');
  const [range, setRange] = useState('30');
  const [goalEditor, setGoalEditor] = useState(null);
  const [goalPickerOpen, setGoalPickerOpen] = useState(false);
  const [newStepRequest, setNewStepRequest] = useState(0);
  const [taskEditorOpen, setTaskEditorOpen] = useState(false);
  const [careerChoice, setCareerChoice] = useState(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [celebration, setCelebration] = useState(null);
  const [dayPreviewIndex, setDayPreviewIndex] = useState(null);

  const startJourney = async (commitments, durationDays) => {
    if (await start(commitments, durationDays)) {
      setActiveDayIndex(null);
      setView('today');
    }
  };

  if (authLoading) return <LoadingScreen text="Проверяю аккаунт" onRetry={() => window.location.reload()} />;
  if (!user) return <LoginScreen onSignIn={signIn} signingIn={signingIn} error={authError} />;
  if (!cloudReady) return <LoadingScreen key={user.uid} text="Загружаю историю" error={storageError} onRetry={retry} onLogOut={() => signOut(auth)} />;
  if (!state?.contractAcceptedAt) return <StartScreen member={role !== 'admin'} history={history} onStart={startJourney} starting={starting} error={storageError} onRetry={retry} onLogOut={() => signOut(auth)} />;
  if (state.completedAt) return <FinishedJourney summary={state.completionSummary || buildMarathonSummary(state)} history={history} onStartNext={startNext} onLogOut={() => signOut(auth)} />;
  if (role !== 'admin') return <MemberApp user={user} state={state} commit={commit} currentDate={currentDate} syncState={syncState} onLogOut={() => signOut(auth)} />;

  const durationDays = state.durationDays || TOTAL_DAYS;
  const currentDayIndex = getCurrentDayIndex(state.startDate, currentDate, durationDays);
  const currentDayNumber = currentDayIndex + 1;
  const selectedIndex = clamp(activeDayIndex ?? currentDayIndex, 0, currentDayIndex);
  const selectedDay = state.days[selectedIndex];
  const journeyEnded = isJourneyEnded(state.startDate, durationDays);
  const editable = selectedIndex === currentDayIndex && !selectedDay.result && !journeyEnded;
  const evaluation = selectedDay.result ? { ...DAY_RESULTS[selectedDay.result], score: selectedDay.score, canClose: true, blockers: [] } : evaluateDay(selectedDay, state.goals, state.dayCriteria, state.resultThresholds, state.codexRules);
  const stats = calculateStats(state, currentDayIndex, range);
  const exportData = buildExport(state, stats);
  const completedWeeks = Math.floor(currentDayNumber / 7);
  const dueReviewIndex = state.weeklyReviews.findIndex((review, index) => index < completedWeeks && !isWeeklyReviewComplete(review));
  const weeklyReview = dueReviewIndex >= 0 ? state.weeklyReviews[dueReviewIndex] : null;
  const weeklyReviewRequired = Boolean(weeklyReview);
  const finalReviewRequired = currentDayNumber === durationDays && !Object.values(state.finalReview || {}).filter((value) => typeof value === 'string').every((value) => value.trim().length >= 3);

  const mutateState = commit;

  const updateDay = (nextDay) => {
    if (!editable) return;
    mutateState((previous, changedAt) => ({
      ...previous,
      days: previous.days.map((day, index) => index === selectedIndex && !day.result && day.date === todayKey() ? updateDayDraft(day, nextDay, changedAt) : day),
    }));
  };

  const saveDraft = () => {
    if (!editable) return;
    mutateState((previous, changedAt) => ({
      ...previous,
      days: previous.days.map((day, index) => index === selectedIndex ? { ...day, draftSavedAt: changedAt, draftUpdatedAt: changedAt } : day),
    }));
  };

  const closeDay = () => {
    const fresh = evaluateDay(selectedDay, state.goals, state.dayCriteria, state.resultThresholds, state.codexRules);
    if (!editable || !fresh.canClose || weeklyReviewRequired || finalReviewRequired) return;
    mutateState((previous, changedAt) => {
      const next = {
        ...previous,
        days: previous.days.map((day, index) => index === selectedIndex ? { ...day, result: fresh.id, score: fresh.score, xp: fresh.xp, closedAt: changedAt, closureMode: 'manual', draftSavedAt: day.draftSavedAt || changedAt, draftUpdatedAt: changedAt } : day),
      };
      if (selectedIndex !== durationDays - 1) return next;
      const completed = { ...next, completedAt: changedAt };
      const stepsCompleted = stepsStore.state?.executions?.filter((item) => !item.deletedAt).length || 0;
      return { ...completed, completionSummary: buildMarathonSummary(completed, { stepsCompleted }) };
    });
    setConfirmClose(false);
    setCelebration(fresh);
    window.setTimeout(() => setCelebration(null), 2200);
  };

  const saveGoal = (draft) => {
    const currentDay = currentDayNumber;
    mutateState((previous, changedAt) => {
      const goal = {
        ...draft,
        id: draft.id || createId('goal'),
        target: Math.max(1, number(draft.target) || 1),
        createdDay: draft.createdDay || currentDay,
        createdAt: draft.createdAt || changedAt,
        updatedAt: changedAt,
        active: true,
        locked: Boolean(draft.locked),
      };
      const exists = previous.goals.some((item) => item.id === goal.id);
      const days = !exists && goalEditor?.addToDay && editable ? previous.days.map((day, index) => index === selectedIndex ? updateDayDraft(day, { visibleGoalIds: [...new Set([...visibleGoalsForDay(day, previous.goals).map((item) => item.id), goal.id])] }, changedAt) : day) : previous.days;
      return { ...previous, days, goals: exists ? previous.goals.map((item) => item.id === goal.id ? goal : item) : [...previous.goals, goal] };
    });
    setGoalEditor(null);
  };

  const archiveGoal = (goalId) => {
    mutateState((previous, changedAt) => ({
      ...previous,
      goals: previous.goals.map((goal) => goal.id === goalId && !goal.locked ? { ...goal, active: false, updatedAt: changedAt } : goal),
    }));
    setGoalEditor(null);
  };

  const addTask = (task) => {
    mutateState((previous, changedAt) => ({
      ...previous,
      tasks: [...previous.tasks, { ...task, id: createId('task'), active: true, createdAt: changedAt, updatedAt: changedAt, completedDay: null }],
    }));
    setTaskEditorOpen(false);
  };

  const toggleTask = (taskId) => {
    if (journeyEnded) return;
    mutateState((previous, changedAt) => ({
      ...previous,
      tasks: previous.tasks.map((task) => task.id === taskId ? { ...task, completedDay: task.completedDay ? null : currentDayNumber, updatedAt: changedAt } : task),
    }));
  };

  const deleteTask = (taskId) => mutateState((previous) => ({ ...previous, tasks: previous.tasks.filter((task) => task.id !== taskId) }));

  const updateReview = (patch) => {
    if (dueReviewIndex < 0) return;
    mutateState((previous, changedAt) => ({
      ...previous,
      weeklyReviews: previous.weeklyReviews.map((review, index) => index === dueReviewIndex ? { ...review, ...patch, updatedAt: changedAt } : review),
    }));
  };

  const updateFinalReview = (patch) => mutateState((previous, changedAt) => ({
    ...previous,
    finalReview: { ...previous.finalReview, ...patch, updatedAt: changedAt },
  }));

  const confirmCareer = () => {
    if (!careerChoice || state.careerDecision.status !== 'pending') return;
    mutateState((previous, changedAt) => {
      const goals = careerChoice === 'not_passed' && !previous.goals.some((goal) => goal.id === 'one-c-return')
        ? [...previous.goals, { id: 'one-c-return', name: 'Мощное возвращение к 1С', description: 'Навыки, практика и новый выход на рынок.', type: 'count', cadence: 'weekly', target: 5, unit: 'действия', color: '#7c63d6', active: true, locked: false, createdDay: currentDayNumber, createdAt: changedAt, updatedAt: changedAt }]
        : previous.goals;
      return { ...previous, goals, careerDecision: { status: careerChoice, decidedAt: changedAt } };
    });
    setCareerChoice(null);
  };

  const updateProfile = (patch) => mutateState((previous) => ({ ...previous, profile: { ...previous.profile, ...patch } }));
  const updateScoring = (patch) => mutateState((previous) => ({ ...previous, ...patch }));

  return (
    <div className="min-h-screen bg-[#f4f7f8] text-[#102a43]">
      <CompactHeader
        user={user}
        avatarUrl={state.profile?.photoUrl || user.photoURL}
        currentDay={currentDayNumber}
        totalDays={durationDays}
        progress={Math.round((currentDayNumber / durationDays) * 100)}
        syncState={syncState}
        view={view}
        onView={setView}
        onExport={() => setShowExport(true)}
        onLogOut={() => signOut(auth)}
      />

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-3 pb-24 pt-3 sm:px-5 lg:px-7">
        {storageError && <div role="status" className="flex flex-wrap items-center justify-between gap-2 border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 rounded-md"><span>{storageError}</span><button type="button" onClick={retry} className="font-bold underline">Повторить синхронизацию</button></div>}
        {['today', 'stats'].includes(view) && <JourneyMap
          days={state.days}
          goals={state.goals}
          codexRules={state.codexRules}
          criteria={state.dayCriteria}
          thresholds={state.resultThresholds}
          currentDayIndex={currentDayIndex}
          selectedIndex={selectedIndex}
          totalDays={durationDays}
          startDate={state.startDate}
          onSelect={(index) => { setActiveDayIndex(index); setDayPreviewIndex(index); }}
          stats={stats}
        />}

        {view === 'today' ? (
          <>
            {state.commitments && <CommitmentSummary commitments={state.commitments} totalDays={durationDays} />}
            <VisionStrip day={selectedDay} currentDayNumber={currentDayNumber} totalDays={durationDays} />
            <CareerStrip decision={state.careerDecision} onChoose={setCareerChoice} />
            <DailyEditor
              day={selectedDay}
              goals={state.goals}
              tasks={state.tasks}
              editable={editable}
              evaluation={evaluation}
              profile={state.profile}
              weeklyReview={weeklyReview}
              weeklyReviewRequired={weeklyReviewRequired}
              finalReview={state.finalReview}
              finalReviewRequired={finalReviewRequired}
              totalDays={durationDays}
              codexState={state}
              codexCommit={commit}
              onDayChange={updateDay}
              onSave={saveDraft}
              onClose={() => setConfirmClose(true)}
              onAddGoal={() => setGoalEditor({ mode: 'new', addToDay: true })}
              onEditGoal={(goal) => setGoalEditor({ mode: 'edit', goal })}
              onPickGoals={() => setGoalPickerOpen(true)}
              onAddTask={() => setTaskEditorOpen(true)}
              onToggleTask={toggleTask}
              onDeleteTask={deleteTask}
              onReviewChange={updateReview}
              onFinalReviewChange={updateFinalReview}
            />
          </>
        ) : view === 'steps' ? (
          <StepsModule {...stepsStore} goals={state.goals} lifeState={lifeStore.state} newStepRequest={newStepRequest} />
        ) : view === 'course' ? (
          <CourseModule user={user} {...lifeStore} marathon={state} steps={stepsStore.state} />
        ) : view === 'stats' ? (
          <StatsDashboard
            user={user}
            state={state}
            stats={stats}
            lifeState={lifeStore.state}
            lifeCommit={lifeStore.commit}
            codexCommit={commit}
            range={range}
            onRange={setRange}
            onEditGoal={(goal) => setGoalEditor({ mode: 'edit', goal })}
            onAddGoal={() => setGoalEditor({ mode: 'new' })}
            onProfileChange={updateProfile}
            onScoringChange={updateScoring}
            totalDays={durationDays}
          />
        ) : <Suspense fallback={<div className="p-8 text-center font-black">Открываю пространство друзей…</div>}><CommunityModule user={user} privateState={state} /></Suspense>}
      </div>

      <MobileNav view={view} onView={setView} onAdd={() => view === 'steps' ? setNewStepRequest((value) => value + 1) : setTaskEditorOpen(true)} />

      <AnimatePresence>
        {goalEditor && <GoalModal key="goal-editor" mode={goalEditor.mode} goal={goalEditor.goal} goals={state.goals} onSave={saveGoal} onArchive={archiveGoal} onClose={() => setGoalEditor(null)} />}
        {goalPickerOpen && <DayGoalPicker key="goal-picker" day={selectedDay} goals={state.goals} editable={editable} onChange={updateDay} onClose={() => setGoalPickerOpen(false)} />}
        {taskEditorOpen && <TaskModal key="task-editor" goals={state.goals} currentDay={currentDayNumber} totalDays={durationDays} onSave={addTask} onClose={() => setTaskEditorOpen(false)} />}
        {careerChoice && <ConfirmCareer key="career-choice" choice={careerChoice} onConfirm={confirmCareer} onClose={() => setCareerChoice(null)} />}
        {confirmClose && <ConfirmClose key="close-day" evaluation={evaluation} weeklyRequired={weeklyReviewRequired} finalRequired={finalReviewRequired} onConfirm={closeDay} onClose={() => setConfirmClose(false)} />}
        {showExport && <ExportModal key="export" data={exportData} totalDays={durationDays} onClose={() => setShowExport(false)} />}
        {celebration && <Celebration key="celebration" result={celebration} />}
        {dayPreviewIndex !== null && <DayDetailsModal key="day-details" state={state} dayIndex={dayPreviewIndex} onClose={() => setDayPreviewIndex(null)} />}
      </AnimatePresence>
    </div>
  );
}

function LoadingScreen({ text, error, onRetry, onLogOut }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 12000);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <div className="grid min-h-screen place-items-center bg-[#f4f7f8] p-5 text-[#102a43]">
      <div className="w-full max-w-md text-center">
        <div role="status" className="flex items-center justify-center gap-3 font-black">{error ? <AlertCircle className="shrink-0 text-amber-600" /> : <Loader2 className="shrink-0 animate-spin text-[#0d8fb9]" />}{error ? 'История пока недоступна' : text}</div>
        {(error || slow) && <>
          <p role={error ? 'alert' : undefined} className="mt-4 text-sm leading-6 text-slate-600">{error || 'Подключение занимает больше времени. Можно повторить загрузку без сброса данных.'}</p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <button type="button" onClick={onRetry} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-[#0d8fb9] px-4 font-bold text-white"><Route size={17} />Повторить загрузку</button>
            {onLogOut && <button type="button" onClick={onLogOut} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-[#dbe5e9] px-4 font-bold"><LogOut size={17} />Выйти</button>}
          </div>
        </>}
      </div>
    </div>
  );
}

function LoginScreen({ onSignIn, signingIn, error }) {
  return (
    <div className="grid min-h-screen place-items-center bg-[#f4f7f8] p-4">
      <section className="w-full max-w-lg border border-[#dbe5e9] bg-white p-6 shadow-sm rounded-lg">
        <div className="text-sm font-black uppercase tracking-wide text-[#0d8fb9]">Марафон перемен</div>
        <h1 className="mt-3 text-4xl font-black leading-tight">Один путь. Все данные на месте.</h1>
        <p className="mt-4 font-semibold leading-7 text-slate-600">Твой марафон, на телефоне и компьютере.</p>
        <button type="button" onClick={onSignIn} disabled={signingIn} aria-busy={signingIn} className="mt-6 inline-flex min-h-[50px] w-full items-center justify-center gap-2 bg-[#102a43] px-5 font-black text-white disabled:cursor-wait disabled:opacity-70 rounded-md">{signingIn ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}{signingIn ? 'Ожидаю Google…' : 'Войти через Google'}</button>
        {error && <div role="alert" className="mt-4 border border-rose-200 bg-rose-50 p-3 text-sm font-bold leading-6 text-rose-700 rounded-md">{error}</div>}
      </section>
    </div>
  );
}

function StartScreen({ member = false, history, onStart, starting, error, onRetry, onLogOut }) {
  const [checked, setChecked] = useState({});
  const [purpose, setPurpose] = useState('');
  const [durationDays, setDurationDays] = useState(TOTAL_DAYS);
  const [confirming, setConfirming] = useState(false);
  const commitments = member ? memberCommitmentsForDuration(durationDays) : commitmentsForDuration(durationDays);
  const acceptedCount = commitments.filter((item) => checked[item.id]).length;
  const acceptance = member ? acceptMemberCommitments : acceptCommitments;
  const accepted = Boolean(acceptance(checked, purpose, new Date().toISOString(), durationDays));
  const confirmStart = () => {
    const acceptedCommitments = acceptance(checked, purpose, new Date().toISOString(), durationDays);
    if (!acceptedCommitments || starting) return;
    onStart(acceptedCommitments, durationDays);
    setConfirming(false);
  };
  return (
    <div className="min-h-screen bg-[#f4f7f8] pb-8">
      <section className="relative overflow-hidden" style={{ backgroundImage: `url(${journeyDawn})`, backgroundPosition: 'center', backgroundSize: 'cover' }}>
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(248,252,253,0.98)_0%,rgba(248,252,253,0.88)_48%,rgba(248,252,253,0.12)_100%)]" />
        <div className="relative mx-auto max-w-4xl px-5 py-10 sm:py-14">
          <div className="flex items-center justify-between gap-3"><div className="text-sm font-black uppercase text-[#0d8fb9]">Мой осознанный выбор</div><button type="button" onClick={onLogOut} className="icon-command" title="Выйти"><LogOut size={18} /></button></div>
          <h1 className="mt-4 max-w-xl text-4xl font-black leading-tight text-[#102a43] sm:text-5xl">{durationDays} дней перемен</h1>
          <p className="mt-4 max-w-xl text-lg font-semibold leading-7 text-slate-700">{member ? 'Свой план тела, питания и движения. Честные отметки, понятная динамика и поддержка без давления.' : 'Я выбираю свободу от старых привычек. Сильное тело, действия к цели и доверие к себе.'}</p>
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm font-bold text-[#16865f]">{member ? <><span>Свой целевой вес</span><span>Измеримый прогресс</span><span>Друзья и вызовы</span></> : <><span>65 кг · форма и энергия</span><span>Ценность в работе</span><span>Свобода проявляться</span></>}</div>
        </div>
      </section>
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-5">
        <section className="mb-6 border border-[#b9dce8] bg-white p-4 shadow-sm rounded-lg">
          <div className="text-sm font-black text-[#0d7ea5]">Срок марафона</div>
          <div className="mt-3 grid grid-cols-3 gap-2">{MARATHON_DURATIONS.map((duration) => <button key={duration} type="button" onClick={() => setDurationDays(duration)} aria-pressed={durationDays === duration} className={`min-h-[52px] border px-3 font-black rounded-md ${durationDays === duration ? 'border-[#0d8fb9] bg-[#0d8fb9] text-white' : 'border-[#d8e3e7] bg-[#f7f9fa] text-slate-600'}`}>{duration} дней</button>)}</div>
        </section>
        <div className="flex items-center justify-between gap-3"><h2 className="text-2xl font-black">{member ? 'Правила пути' : 'Мои аскезы'}</h2><span className="shrink-0 text-sm font-bold text-[#16865f]">{acceptedCount} из {commitments.length}</span></div>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{member ? `Перед стартом я принимаю понятные правила на ${durationDays} дней. Конкретные ежедневные цели можно будет настроить в своём Кодексе.` : `Аскеза — добровольная практика самодисциплины ради выбранной цели. Здесь я принимаю конкретные обязательства на ${durationDays} календарных дней.`}</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {commitments.map((item, index) => <label key={item.id} className={`flex cursor-pointer items-start gap-3 border p-4 transition-colors rounded-lg ${checked[item.id] ? 'border-[#8dd6ad] bg-[#ecfbf3]' : 'border-[#d8e3e7] bg-white'}`}><input type="checkbox" aria-label={item.title} checked={Boolean(checked[item.id])} onChange={(event) => setChecked({ ...checked, [item.id]: event.target.checked })} className="mt-1 h-5 w-5 shrink-0 accent-[#16a36a]" /><span className="min-w-0"><span className="text-xs font-bold text-[#0d8fb9]">0{index + 1} · {item.metric}</span><strong className="mt-1 block text-base leading-6">{item.title}</strong><span className="mt-2 block text-sm leading-6 text-slate-600">{item.text}</span></span></label>)}
        </div>
        <label className="mt-6 block font-bold">Ради чего я прохожу эти {durationDays} дней<textarea value={purpose} onChange={(event) => setPurpose(event.target.value)} maxLength={1000} placeholder="Какие изменения я хочу увидеть в своих действиях, теле и отношении к себе?" className="field-control mt-2 min-h-[100px] resize-y" /><span className="mt-1 block text-xs font-normal text-slate-500">Мой личный смысл · минимум 10 символов</span></label>
        <div className="mt-5 border-y border-[#d8e3e7] py-4 text-sm leading-6 text-slate-600">Старт — {formatShortDate(todayKey())}. День {durationDays} — {formatShortDate(addDays(todayKey(), durationDays - 1))}. Подтверждая, я фиксирую дату старта и эти обязательства на весь марафон.</div>
        {error && <div role="alert" className="mt-4 text-sm text-rose-700">{error} <button type="button" onClick={onRetry} className="font-bold underline">Повторить синхронизацию</button></div>}
        <button type="button" disabled={!accepted || starting} onClick={() => setConfirming(true)} className="mt-5 inline-flex min-h-[54px] w-full items-center justify-center gap-2 bg-[#16a36a] px-4 text-base font-black text-white disabled:bg-slate-300 rounded-md">{starting ? <Loader2 size={19} className="animate-spin" /> : <Zap size={19} />}{starting ? 'Подтверждаю старт…' : 'Принимаю обязательства. Начать'}</button>
        <p className="mt-3 text-sm leading-6 text-slate-500">При физической зависимости от алкоголя прекращение употребления может потребовать помощи врача. Поддержка и лечение совместимы с этим выбором.</p>
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-[#0d7ea5]"><a href="https://bigenc.ru/c/asketizm-f52e39" target="_blank" rel="noreferrer" className="underline">Смысл аскезы: БРЭ</a><a href="https://www.niddk.nih.gov/health-information/diet-nutrition/changing-habits-better-health" target="_blank" rel="noreferrer" className="underline">Изменение привычек: NIDDK</a><a href="https://www.niaaa.nih.gov/publications/brochures-and-fact-sheets/understanding-alcohol-use-disorder" target="_blank" rel="noreferrer" className="underline">Об алкоголе и помощи: NIAAA</a></div>
        {history.length > 0 && <MarathonHall items={history} />}
      </div>
      <AnimatePresence>{confirming && <SimpleConfirm title={`Начать ${durationDays} дней?`} text={`Все ${commitments.length} обязательств приняты. Мой смысл: «${purpose.trim()}». Старт: ${formatLongDate(todayKey())}.`} confirm="Да, начинаю" disabled={!accepted || starting} onConfirm={confirmStart} onClose={() => setConfirming(false)} />}</AnimatePresence>
    </div>
  );
}

function FinishedJourney({ summary, history, onStartNext, onLogOut }) {
  const [confirming, setConfirming] = useState(false);
  const [starting, setStarting] = useState(false);
  const beginNext = async () => {
    setStarting(true);
    await onStartNext();
    setStarting(false);
    setConfirming(false);
  };
  return (
    <div className="min-h-screen bg-[#f4f7f8] px-4 py-8 text-[#102a43]">
      <div className="mx-auto max-w-4xl">
        <div className="flex justify-end"><button type="button" onClick={onLogOut} className="icon-command" title="Выйти"><LogOut size={18} /></button></div>
        <section className="mt-4 overflow-hidden border border-[#b8e0cb] bg-white shadow-xl rounded-lg">
          <div className="bg-[#102a43] p-6 text-white sm:p-8"><Trophy size={40} className="text-[#f2c14e]" /><div className="mt-4 text-sm font-black uppercase text-[#8bd9bd]">Марафон завершён</div><h1 className="mt-2 text-4xl font-black">{summary.status}</h1><p className="mt-3 font-semibold text-slate-200">{summary.durationDays} дней · {formatShortDate(summary.startDate)} — {formatShortDate(summary.finishDate)}</p></div>
          <div className="grid grid-cols-2 gap-px bg-[#d8e3e7] sm:grid-cols-4"><HallMetric label="Зачтено" value={`${summary.completionRate}%`} /><HallMetric label="Сильных дней" value={summary.greenDays} /><HallMetric label="Шагов" value={summary.stepsCompleted} /><HallMetric label="Вес" value={summary.finishWeight ? `${summary.finishWeight} кг` : '—'} /></div>
          <div className="p-5 sm:p-6"><p className="font-semibold leading-7 text-slate-600">{summary.purpose}</p><button type="button" onClick={() => setConfirming(true)} className="mt-5 inline-flex min-h-[50px] w-full items-center justify-center gap-2 bg-[#16a36a] px-4 font-black text-white rounded-md"><Zap size={18} />Начать новый марафон</button></div>
        </section>
        <MarathonHall items={history} />
      </div>
      <AnimatePresence>{confirming && <SimpleConfirm title="Перейти к новому марафону?" text="Завершённый путь останется в Зале пути. Затем откроется новый экран старта." confirm={starting ? 'Сохраняю…' : 'Да, перейти'} disabled={starting} onConfirm={beginNext} onClose={() => setConfirming(false)} />}</AnimatePresence>
    </div>
  );
}

function MarathonHall({ items }) {
  return <section className="mt-8 border-t border-[#d8e3e7] pt-6"><div className="flex items-center gap-2 text-sm font-black text-[#8b6b16]"><Trophy size={18} />Зал пути</div><h2 className="mt-1 text-2xl font-black">Завершённые марафоны</h2><div className="mt-4 grid gap-3">{items.map((item) => <details key={item.journeyId} className="border border-[#dfd6ad] bg-[#fffdf2] p-4 rounded-lg"><summary className="flex cursor-pointer items-center justify-between gap-3"><span><strong className="block">{item.status}</strong><small className="mt-1 block font-bold text-slate-500">{item.durationDays} дней · {formatShortDate(item.startDate)} — {formatShortDate(item.finishDate)}</small></span><ChevronDown size={18} /></summary><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"><SummaryMini label="Сильных" value={item.greenDays} /><SummaryMini label="Возвратов" value={item.redDays} /><SummaryMini label="Шагов" value={item.stepsCompleted} /><SummaryMini label="Вес" value={item.finishWeight ? `${item.finishWeight} кг` : '—'} /></div>{item.purpose && <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">{item.purpose}</p>}</details>)}</div></section>;
}

function HallMetric({ label, value }) {
  return <div className="bg-white p-4 text-center"><div className="text-xs font-black text-slate-500">{label}</div><div className="mt-1 text-2xl font-black">{value}</div></div>;
}

function CommitmentSummary({ commitments, totalDays }) {
  return <details className="border-y border-[#d8e3e7] py-3"><summary className="flex cursor-pointer items-center justify-between gap-3 text-sm font-bold text-[#16865f]"><span className="flex items-center gap-2"><Heart size={17} />Мой выбор на {totalDays} дней</span><ChevronDown size={17} /></summary><p className="mt-3 font-semibold leading-6">{commitments.purpose}</p><div className="mt-3 grid gap-3 sm:grid-cols-2">{commitments.items.map((item) => <div key={item.id}><h3 className="text-sm font-bold">{item.title}</h3><p className="mt-1 text-sm leading-6 text-slate-600">{item.text}</p></div>)}</div></details>;
}

function CompactHeader({ user, avatarUrl, currentDay, totalDays, progress, syncState, view, onView, onExport, onLogOut }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-[#d9e4e8] bg-white/95 backdrop-blur-xl">
      <div className="mx-auto flex min-h-[64px] max-w-7xl items-center gap-3 px-3 sm:px-5 lg:px-7">
        <button type="button" onClick={() => onView('today')} className="flex shrink-0 items-baseline gap-1 text-left"><strong className="text-2xl font-black text-[#102a43]">{totalDays}</strong><span className="hidden text-xs font-black uppercase text-[#0d8fb9] sm:inline">дней</span></button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2 text-xs font-black text-slate-500"><span>День {currentDay} из {totalDays}</span><span>{progress}%</span></div>
          <div className="mt-1 h-2 overflow-hidden bg-[#e9eff2] rounded-sm"><motion.div className="h-full bg-[#16a36a]" animate={{ width: `${progress}%` }} /></div>
        </div>
        <div className="hidden items-center gap-1 sm:flex">
          <NavButton active={view === 'today'} icon={<Home size={17} />} label="Сегодня" onClick={() => onView('today')} />
          <NavButton active={view === 'steps'} icon={<Footprints size={17} />} label="Шаги" onClick={() => onView('steps')} />
          <NavButton active={view === 'course'} icon={<Compass size={17} />} label="Курс" onClick={() => onView('course')} />
          <NavButton active={view === 'stats'} icon={<BarChart3 size={17} />} label="Статистика" onClick={() => onView('stats')} />
          <NavButton active={view === 'friends'} icon={<Users size={17} />} label="Друзья" onClick={() => onView('friends')} />
        </div>
        <span role="status" aria-label={syncState === 'offline' ? 'Сохранено на устройстве, ожидает синхронизации' : syncState === 'saving' ? 'Сохраняю в облако' : 'Сохранено в облаке'} className={`h-2.5 w-2.5 shrink-0 rounded-full ${syncState === 'offline' ? 'bg-rose-500' : syncState === 'saving' ? 'animate-pulse bg-amber-400' : 'bg-emerald-500'}`} title={syncState === 'offline' ? 'Сохранено на устройстве' : syncState === 'saving' ? 'Сохраняю в облако' : 'Сохранено в облаке'} />
        {avatarUrl ? <img src={avatarUrl} alt={user.displayName || 'Аватар'} className="h-10 w-10 shrink-0 border border-[#d9e4e8] bg-[#edf4f6] object-cover rounded-md" title={user.displayName || user.email || 'Профиль'} /> : <span className="grid h-10 w-10 shrink-0 place-items-center bg-[#eaf8fd] font-black text-[#0d7ea5] rounded-md" title={user.email || 'Профиль'}>{(user.displayName || user.email || 'Я').trim().charAt(0).toUpperCase()}</span>}
        <div className="relative">
          <button type="button" onClick={() => setMenuOpen((value) => !value)} className="grid h-10 w-10 place-items-center border border-[#d9e4e8] bg-white text-slate-700 rounded-md" title="Меню"><Menu size={19} /></button>
          <AnimatePresence>{menuOpen && <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="absolute right-0 top-12 z-50 w-52 border border-[#d9e4e8] bg-white p-2 shadow-xl rounded-lg"><MenuItem icon={<Download size={16} />} label="Экспорт" onClick={() => { onExport(); setMenuOpen(false); }} /><MenuItem icon={<LogOut size={16} />} label="Выйти" onClick={onLogOut} /></motion.div>}</AnimatePresence>
        </div>
      </div>
    </header>
  );
}

function NavButton({ active, icon, label, onClick }) {
  return <button type="button" onClick={onClick} className={`inline-flex min-h-[40px] items-center gap-2 px-3 text-sm font-black rounded-md ${active ? 'bg-[#102a43] text-white' : 'text-slate-600 hover:bg-[#f1f5f7]'}`}>{icon}{label}</button>;
}

function MenuItem({ icon, label, onClick }) {
  return <button type="button" onClick={onClick} className="flex min-h-[42px] w-full items-center gap-3 px-3 text-left text-sm font-black text-slate-700 hover:bg-[#f1f5f7] rounded-md">{icon}{label}</button>;
}

function MobileNav({ view, onView }) {
  return <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[#d9e4e8] bg-white/95 px-2 py-2 backdrop-blur-xl sm:hidden"><div className="mx-auto grid max-w-md grid-cols-5 gap-1"><MobileNavButton active={view === 'today'} icon={<Home />} label="Сегодня" onClick={() => onView('today')} /><MobileNavButton active={view === 'steps'} icon={<Footprints />} label="Шаги" onClick={() => onView('steps')} /><MobileNavButton active={view === 'course'} icon={<Compass />} label="Курс" onClick={() => onView('course')} /><MobileNavButton active={view === 'stats'} icon={<BarChart3 />} label="Статистика" onClick={() => onView('stats')} /><MobileNavButton active={view === 'friends'} icon={<Users />} label="Друзья" onClick={() => onView('friends')} /></div></nav>;
}

function MobileNavButton({ active, icon, label, onClick }) {
  return <button type="button" onClick={onClick} className={`flex min-h-[48px] flex-col items-center justify-center gap-1 text-[11px] font-black rounded-md ${active ? 'bg-[#eaf8fd] text-[#0d8fb9]' : 'text-slate-500'}`}>{icon}{label}</button>;
}

function JourneyMap({ days, goals, codexRules, criteria, thresholds, currentDayIndex, selectedIndex, totalDays, onSelect, stats }) {
  const [open, setOpen] = useState(false);
  const scrollerRef = useRef(null);
  const currentRef = useRef(null);
  useEffect(() => {
    const scroller = scrollerRef.current;
    const tile = currentRef.current;
    if (scroller && tile) scroller.scrollTop = Math.max(0, scroller.scrollTop + tile.getBoundingClientRect().top - scroller.getBoundingClientRect().top - scroller.clientHeight / 2 + tile.clientHeight / 2);
  }, [currentDayIndex]);
  const results = days.slice(0, currentDayIndex + 1).map((day) => getDayResult(day, goals, criteria, thresholds, codexRules));
  const isGreen = (result) => ['strong', 'expansion'].includes(result?.id);
  const green7 = results.slice(-7).filter(isGreen).length;
  const green30 = results.slice(-30).filter(isGreen).length;
  let currentStreak = 0;
  for (let index = results.length - 1; index >= 0 && isGreen(results[index]); index -= 1) currentStreak += 1;
  let bestStreak = 0; let running = 0;
  results.forEach((result) => { running = isGreen(result) ? running + 1 : 0; bestStreak = Math.max(bestStreak, running); });
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="w-full border border-[#d8e3e7] bg-white p-4 text-left shadow-sm rounded-lg"><div className="flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center bg-[#eaf8fd] text-[#0d7ea5] rounded-md"><CalendarDays size={20} /></span><div><div className="font-black">Дни</div><div className="text-xs font-bold text-slate-500">День {currentDayIndex + 1} из {totalDays} · зачтено {stats.completionRate}%</div></div></div><ChevronDown size={18} className="shrink-0 text-slate-400" /></div><div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs font-bold text-slate-500"><span>7 дней<strong className="mt-1 block text-base text-[#102a43]">{green7}</strong></span><span>30 дней<strong className="mt-1 block text-base text-[#102a43]">{green30}</strong></span><span>серия<strong className="mt-1 block text-base text-[#102a43]">{currentStreak}</strong></span><span>лучшая<strong className="mt-1 block text-base text-[#102a43]">{bestStreak}</strong></span></div></button>;
  return (
    <section className="border border-[#d8e3e7] bg-white shadow-sm rounded-lg">
      <div className="flex flex-col gap-3 border-b border-[#e1e9ec] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div><div className="flex items-center gap-2 text-sm font-black text-[#0d8fb9]"><CalendarDays size={18} />Карта марафона</div><h1 className="mt-1 text-2xl font-black">Все {totalDays} дней перед глазами</h1></div>
        <button type="button" onClick={() => setOpen(false)} className="icon-command ml-auto" title="Свернуть"><ChevronDown size={18} className="rotate-180" /></button>
        <div className="flex flex-wrap gap-2 text-xs font-black"><Legend color="#16a36a" label="сильный" /><Legend color="#0d8fb9" label="прорыв" /><Legend color="#f06c5f" label="возврат" /><Legend color="#cbd5e1" label="впереди" /></div>
      </div>
      <div ref={scrollerRef} className="journey-map-scroll max-h-[390px] overflow-y-auto p-3 sm:max-h-[430px] sm:p-4">
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-8 lg:grid-cols-12">
          {days.map((day, index) => {
            const future = index > currentDayIndex;
            const result = getDayResult(day, goals, criteria, thresholds, codexRules);
            const partial = index < currentDayIndex && !result && hasDayData(day);
            const missed = index < currentDayIndex && !result && !partial;
            const selected = index === selectedIndex;
            return (
              <motion.button
                ref={index === currentDayIndex ? currentRef : null}
                key={day.day}
                type="button"
                disabled={future}
                onClick={() => onSelect(index)}
                whileTap={!future ? { scale: 0.94 } : undefined}
                className={`day-tile relative min-h-[66px] border p-1.5 text-center transition rounded-md ${selected ? 'ring-2 ring-[#102a43] ring-offset-2' : ''} ${future ? 'border-[#e1e7ea] bg-[#f3f6f7] text-slate-400' : missed ? 'border-[#f3c0bb] bg-[#fff4f2] text-[#a7473e]' : result ? 'text-white shadow-sm' : 'border-[#63c3df] bg-[#eaf8fd] text-[#0d6f91]'}`}
                style={result ? { backgroundColor: result.color, borderColor: result.color } : undefined}
                title={`День ${day.day}, ${formatLongDate(day.date)}${result ? `: ${result.title}${day.closureMode === 'automatic' ? ', закрыт автоматически' : day.result ? '' : ', итог обновляется'}` : partial ? ': сохранён частично' : ''}`}
              >
                <span className="block text-base font-black leading-none">{day.day}</span>
                <span className={`mt-1 block text-[10px] font-black ${result ? 'text-white/85' : ''}`}>{formatShortDate(day.date)}</span>
                {day.result && <Check size={12} className="absolute right-1 top-1" />}
                {index === currentDayIndex && !day.result && <span className="absolute right-1 top-1 h-2 w-2 animate-pulse rounded-full bg-[#0d8fb9]" />}
              </motion.button>
            );
          })}
        </div>
      </div>
      <div className="grid grid-cols-3 border-t border-[#e1e9ec] text-center text-xs font-black text-slate-500"><MapStat label="Зачтено" value={`${stats.credited.length}`} /><MapStat label="Прогресс" value={`${stats.completionRate}%`} /><MapStat label="Очки" value={stats.xp.toLocaleString('ru-RU')} /></div>
    </section>
  );
}

function Legend({ color, label }) {
  return <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />{label}</span>;
}

function MapStat({ label, value }) {
  return <div className="border-r border-[#e1e9ec] px-2 py-3 last:border-r-0"><span>{label}</span><strong className="ml-1 text-[#102a43]">{value}</strong></div>;
}

function VisionStrip({ day, currentDayNumber, totalDays }) {
  return (
    <section className="relative min-h-[150px] overflow-hidden border border-[#b9dce8] bg-[#eaf8fd] rounded-lg" style={{ backgroundImage: `url(${journeyDawn})`, backgroundPosition: 'center right', backgroundSize: 'cover' }}>
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(244,251,253,0.98)_0%,rgba(244,251,253,0.89)_55%,rgba(244,251,253,0.15)_100%)]" />
      <div className="relative max-w-2xl p-4 sm:p-5"><div className="text-xs font-black uppercase tracking-wide text-[#0d8fb9]">День {day.day} · {formatLongDate(day.date)}</div><h2 className="mt-2 text-2xl font-black sm:text-3xl">Не ждать другого состояния. Сделать следующий выбор.</h2><p className="mt-2 max-w-xl text-sm font-semibold leading-6 text-slate-600">До финала {Math.max(0, totalDays - currentDayNumber)} дней. Карта сохранит не идеальную картинку, а реальный путь.</p></div>
    </section>
  );
}

function CareerStrip({ decision, onChoose }) {
  const status = decision.status || 'pending';
  const content = status === 'passed' ? ['Испытательный срок пройден', 'Дальше закрепляемся и растём внутри Контура.'] : status === 'not_passed' ? ['Маршрут изменился', 'Марафон продолжается: цель по 1С уже добавлена автоматически.'] : ['Испытательный срок идёт', 'Когда появится решение, зафиксируй его один раз.'];
  return (
    <section className="flex flex-col gap-3 border border-[#d8e3e7] bg-white p-4 rounded-lg lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-start gap-3"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-md ${status === 'pending' ? 'bg-[#fff7e8] text-[#bd741b]' : status === 'passed' ? 'bg-[#ecfbf3] text-[#16865f]' : 'bg-[#f2efff] text-[#6751bb]'}`}><Route size={20} /></span><div><div className="text-xs font-black uppercase tracking-wide text-slate-500">Карьерный маршрут</div><h3 className="mt-1 text-lg font-black">{content[0]}</h3><p className="mt-1 text-sm font-semibold text-slate-600">{content[1]}</p></div></div>
      {status === 'pending' && <div className="flex gap-2"><button type="button" onClick={() => onChoose('passed')} className="min-h-[42px] bg-[#16a36a] px-3 text-sm font-black text-white rounded-md">Прошёл</button><button type="button" onClick={() => onChoose('not_passed')} className="min-h-[42px] border border-[#cfc7ef] bg-[#f5f3ff] px-3 text-sm font-black text-[#5f4eaa] rounded-md">Не прошёл</button></div>}
    </section>
  );
}

function DailyEditor(props) {
  const { day, goals, tasks, editable, evaluation, profile, weeklyReview, weeklyReviewRequired, finalReview, finalReviewRequired, totalDays, codexState, codexCommit, onDayChange, onSave, onClose, onAddTask, onToggleTask, onDeleteTask, onReviewChange, onFinalReviewChange } = props;
  const availableGoals = goals.filter((goal) => goal.active !== false && goal.createdDay <= day.day);
  const energyBalance = calculateEnergyBalance(day, profile);
  const bmr = calculateBmr(day.weight, profile);
  const relevantTasks = tasks.filter((task) => task.active !== false && (!task.completedDay || task.completedDay === day.day));
  const saved = day.draftSavedAt && Date.parse(day.draftSavedAt) >= Date.parse(day.draftUpdatedAt || '');
  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-[1.18fr_0.82fr]">
      <div className="grid min-w-0 content-start gap-4">
        <FocusActions day={day} editable={editable} onDayChange={onDayChange} />
        {codexState && <CodexPanel state={codexState} day={day} editable={editable} commit={codexCommit} onDayChange={onDayChange} />}
        <Section title="Показатели тела" eyebrow={energyBalance === null ? 'Нужны данные' : energyBalance < 0 ? `Дефицит ${Math.abs(energyBalance)} ккал` : `Профицит ${energyBalance} ккал`} icon={<Activity />}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><NumberInput label="Калории" icon={<Utensils />} value={day.calories} disabled={!editable} onChange={(calories) => onDayChange({ ...day, calories })} /><NumberInput label="Активные" icon={<BatteryCharging />} value={day.activeCalories} disabled={!editable} onChange={(activeCalories) => onDayChange({ ...day, activeCalories })} /><NumberInput label="Шаги" icon={<Footprints />} value={day.steps} disabled={!editable} onChange={(steps) => onDayChange({ ...day, steps })} /><NumberInput label="Вес, кг" icon={<Scale />} value={day.weight} step="0.1" disabled={!editable} onChange={(weight) => onDayChange({ ...day, weight })} /></div>
          {(bmr > 0 || energyBalance !== null) && <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs font-bold text-slate-500"><span>Базовый обмен: <strong className="text-[#102a43]">{bmr || '—'} ккал</strong></span><span>Ориентир питания: <strong className="text-[#102a43]">{CALORIE_TARGET} / {CALORIE_LIMIT}</strong></span></div>}
        </Section>

      </div>

      <div className="grid min-w-0 content-start gap-4">
        <details className="border border-[#d8e3e7] bg-white rounded-lg"><summary className="flex min-h-[56px] cursor-pointer items-center justify-between gap-3 px-4 font-black"><span className="flex items-center gap-2"><Heart size={18} className="text-[#c65347]" />Рефлексия дня <small className="font-bold text-slate-400">необязательно</small></span><ChevronDown size={18} /></summary><div className="grid gap-4 border-t border-[#e1e9ec] p-4"><label className="block"><span className="text-sm font-black">Победа дня</span><textarea value={day.evidence || ''} disabled={!editable} onChange={(event) => onDayChange({ ...day, evidence: event.target.value })} placeholder="Какой факт сегодня доказывает, что я двигаюсь?" className="mt-2 h-28 w-full resize-none border border-[#eadfdc] bg-[#fffaf9] p-3 text-sm font-semibold leading-6 outline-none focus:border-[#f06c5f] rounded-md" /></label><ActionLog goals={availableGoals} actions={day.actions || []} disabled={!editable} onChange={(actions) => onDayChange({ ...day, actions })} /><CourageLog moments={day.courageMoments || []} disabled={!editable} onChange={(courageMoments) => onDayChange({ ...day, courageMoments })} /></div></details>

        <TaskPanel tasks={relevantTasks} goals={goals} disabled={!editable} onAdd={onAddTask} onToggle={onToggleTask} onDelete={onDeleteTask} />
        {weeklyReview && <WeeklyReview review={weeklyReview} required={weeklyReviewRequired} disabled={!editable} onChange={onReviewChange} />}
        {day.day === totalDays && <FinalReview review={finalReview} totalDays={totalDays} required={finalReviewRequired} disabled={!editable} onChange={onFinalReviewChange} />}

        <section className="border border-[#d8e3e7] bg-white p-4 rounded-lg">
          <div className="flex items-center justify-between gap-3"><div><div className="text-xs font-black uppercase tracking-wide text-slate-500">Результат дня</div><div className="mt-1 text-2xl font-black" style={{ color: evaluation.color }}>{evaluation.title}</div></div><div className="grid h-14 w-14 place-items-center border-4 text-sm font-black rounded-full" style={{ borderColor: evaluation.color, color: evaluation.color }}>{evaluation.score}%</div></div>
          {editable && <p role="status" className="mt-3 text-sm leading-6 text-slate-600">{evaluation.canClose ? `${evaluation.xp} очков уже учтены. Сегодня можно дополнять записи; при смене даты день закроется автоматически с итоговым результатом.` : hasDayData(day) ? 'Введённое сохраняется автоматически. Остальные поля можно заполнить в течение дня.' : 'Каждая отметка сохраняется сразу.'}</p>}
          {day.closureMode === 'automatic' && <p className="mt-3 text-sm font-semibold text-[#16865f]">Закрыт автоматически по сохранённым данным · {day.xp} очков</p>}
          {!editable && !day.result && hasDayData(day) && <p className="mt-3 text-sm text-slate-600">Сохранено частично. Все введённые показатели остались в истории и статистике.</p>}
          {!evaluation.canClose && <div className="mt-3 grid gap-1">{evaluation.blockers.map((blocker) => <div key={blocker} className="flex items-start gap-2 text-xs font-bold leading-5 text-slate-500"><AlertCircle size={14} className="mt-0.5 shrink-0 text-[#f3a52f]" />{blocker}</div>)}</div>}
          {weeklyReviewRequired && <div className="mt-3 border border-[#efd49f] bg-[#fff8e9] p-3 text-xs font-black text-[#8a5815] rounded-md">Сначала заполни недельный итог.</div>}
          {finalReviewRequired && <div className="mt-3 border border-[#cfc7ef] bg-[#f5f3ff] p-3 text-xs font-black text-[#5f4eaa] rounded-md">Финальный день закрывается только после итога пути.</div>}
          {day.result ? <div className="mt-4 flex items-center gap-2 border border-[#b8e0cb] bg-[#ecfbf3] p-3 font-black text-[#16865f] rounded-md"><Lock size={17} />День закрыт и больше не редактируется</div> : editable ? <div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={onSave} className="inline-flex min-h-[48px] items-center justify-center gap-2 border border-[#b9dce8] bg-[#edf9fd] font-black text-[#0d6f91] rounded-md"><Save size={17} />{saved ? 'Сохранено' : 'Сохранить'}</button><button type="button" disabled={!evaluation.canClose || weeklyReviewRequired || finalReviewRequired} onClick={onClose} className="inline-flex min-h-[48px] items-center justify-center gap-2 bg-[#16a36a] font-black text-white disabled:bg-slate-300 rounded-md"><CheckCircle2 size={17} />Закрыть</button></div> : <div className="mt-4 flex items-center gap-2 border border-[#d8e3e7] bg-[#f3f6f7] p-3 font-black text-slate-500 rounded-md"><Lock size={17} />Прошедший день недоступен</div>}
        </section>
      </div>
    </div>
  );
}

function Section({ title, eyebrow, icon, action, tone = 'blue', children }) {
  const toneClass = tone === 'coral' ? 'text-[#c65347] bg-[#fff2ef]' : 'text-[#0d7ea5] bg-[#eaf8fd]';
  return <section className="min-w-0 max-w-full border border-[#d8e3e7] bg-white p-4 shadow-sm rounded-lg"><div className="mb-4 flex items-start justify-between gap-3"><div className="flex min-w-0 items-start gap-3"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-md ${toneClass}`}>{icon}</span><div className="min-w-0"><h2 className="text-lg font-black leading-6">{title}</h2><p className="mt-0.5 text-xs font-bold text-slate-500">{eyebrow}</p></div></div>{action}</div>{children}</section>;
}

function NumberInput({ label, icon, value, onChange, disabled, step = '1' }) {
  return <label className="border border-[#dce6e9] bg-[#f7f9fa] p-2.5 rounded-md"><span className="flex items-center gap-1.5 text-xs font-black text-slate-500">{icon}{label}</span><input type="number" min="0" step={step} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full bg-transparent text-xl font-black outline-none disabled:text-slate-400" /></label>;
}

function DayGoalPicker({ day, goals, editable, onChange, onClose }) {
  const available = goals.filter((goal) => goal.active !== false && goal.createdDay <= day.day);
  const selected = visibleGoalsForDay(day, goals).map((goal) => goal.id);
  const toggle = (goal) => {
    if (!editable || goal.locked) return;
    onChange({ ...day, visibleGoalIds: selected.includes(goal.id) ? selected.filter((id) => id !== goal.id) : [...selected, goal.id] });
  };
  return <ModalShell title="Цели на этот день" onClose={onClose}><div className="grid gap-2">{available.map((goal) => <button key={goal.id} type="button" disabled={!editable || goal.locked} onClick={() => toggle(goal)} aria-pressed={selected.includes(goal.id)} className={`flex min-h-12 items-center gap-3 border p-3 text-left rounded-md ${selected.includes(goal.id) ? 'border-[#9bd9bb] bg-[#effaf3]' : 'border-[#dce6e9] bg-white'} disabled:cursor-default`}><span className={`grid h-5 w-5 shrink-0 place-items-center border rounded-sm ${selected.includes(goal.id) ? 'border-[#16a36a] bg-[#16a36a] text-white' : 'border-[#b9c9cf] bg-white'}`}>{selected.includes(goal.id) && <Check size={14} />}</span><span className="min-w-0 flex-1 truncate text-sm font-black">{goal.name}</span>{goal.locked && <Lock size={15} className="text-slate-400" />}</button>)}</div><button type="button" onClick={onClose} className="mt-4 min-h-11 w-full bg-[#102a43] font-black text-white rounded-md">Готово</button></ModalShell>;
}

function ActionLog({ goals, actions, disabled, onChange }) {
  const update = (id, patch) => onChange(actions.map((action) => action.id === id ? { ...action, ...patch } : action));
  return <Section title="Факты действий" eyebrow="Необязательно. Связываются с целью и попадают в её статистику" icon={<Zap />} action={!disabled && <button type="button" onClick={() => onChange([...actions, { id: createId('action'), goalId: goals[0]?.id || '', text: '', impact: 'step' }])} className="icon-command" title="Добавить факт"><Plus size={18} /></button>}><div className="grid gap-2">{actions.map((action) => <div key={action.id} className="grid gap-2 border border-[#dce6e9] bg-[#fbfcfc] p-3 rounded-md sm:grid-cols-[0.72fr_1.28fr_auto]"><select value={action.goalId} disabled={disabled} onChange={(event) => update(action.id, { goalId: event.target.value })} className="border border-[#d8e3e7] bg-white px-3 py-2 text-sm font-black outline-none rounded-md">{goals.map((goal) => <option key={goal.id} value={goal.id}>{goal.name}</option>)}</select><input value={action.text} disabled={disabled} onChange={(event) => update(action.id, { text: event.target.value })} placeholder="Что конкретно сделал?" className="border border-[#d8e3e7] bg-white px-3 py-2 text-sm font-semibold outline-none rounded-md" />{!disabled && <button type="button" onClick={() => onChange(actions.filter((item) => item.id !== action.id))} className="icon-command danger" title="Удалить"><Trash2 size={17} /></button>}</div>)}{!actions.length && <EmptyLine text="Сегодня фактов действий пока нет" />}</div></Section>;
}

function CourageLog({ moments, disabled, onChange }) {
  const update = (id, patch) => onChange(moments.map((moment) => moment.id === id ? { ...moment, ...patch } : moment));
  return <Section title="Ситуации смелости" eyebrow="Добавляй только когда тревога реально появилась" icon={<Brain />} action={!disabled && <button type="button" onClick={() => onChange([...moments, { id: createId('courage'), context: COURAGE_CONTEXTS[0], situation: '', before: '', after: '', action: '' }])} className="icon-command" title="Добавить ситуацию"><Plus size={18} /></button>}><div className="grid gap-3">{moments.map((moment) => <div key={moment.id} className="border border-[#dce6e9] bg-[#fbfcfc] p-3 rounded-md"><div className="grid gap-2 sm:grid-cols-[0.7fr_1.3fr_auto]"><select value={moment.context} disabled={disabled} onChange={(event) => update(moment.id, { context: event.target.value })} className="field-control">{COURAGE_CONTEXTS.map((context) => <option key={context}>{context}</option>)}</select><input value={moment.situation} disabled={disabled} onChange={(event) => update(moment.id, { situation: event.target.value })} placeholder="Что происходило?" className="field-control" />{!disabled && <button type="button" onClick={() => onChange(moments.filter((item) => item.id !== moment.id))} className="icon-command danger" title="Удалить"><Trash2 size={17} /></button>}</div><div className="mt-2 grid gap-2 sm:grid-cols-2"><ScaleInput label="Тревога до" value={moment.before} disabled={disabled} onChange={(before) => update(moment.id, { before })} /><ScaleInput label="Тревога после" value={moment.after} disabled={disabled} onChange={(after) => update(moment.id, { after })} /></div><textarea value={moment.action} disabled={disabled} onChange={(event) => update(moment.id, { action: event.target.value })} placeholder="Что сделал несмотря на тревогу?" className="mt-2 h-20 w-full resize-none field-control" /></div>)}{!moments.length && <EmptyLine text="Ситуаций не было — ничего не добавляй" />}</div></Section>;
}

function ScaleInput({ label, value, disabled, onChange }) {
  return <label className="border border-[#d8e3e7] bg-white p-2.5 rounded-md"><span className="flex items-center justify-between text-xs font-black text-slate-500">{label}<strong className="text-lg text-[#102a43]">{value === '' ? '—' : value}</strong></span><input type="range" min="0" max="100" step="5" value={value === '' ? 50 : value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full" /></label>;
}

function EmptyLine({ text }) {
  return <div className="border border-dashed border-[#cfdde2] bg-[#f7f9fa] p-3 text-center text-sm font-bold text-slate-400 rounded-md">{text}</div>;
}

function TaskPanel({ tasks, goals, disabled, onAdd, onToggle, onDelete }) {
  return <Section title="Задачи" eyebrow="Можно связать с любой целью" icon={<ClipboardCheck />} action={!disabled && <button type="button" onClick={onAdd} className="icon-command" title="Добавить задачу"><Plus size={18} /></button>}><div className="grid gap-2">{tasks.map((task) => <div key={task.id} className={`flex items-start gap-3 border p-3 rounded-md ${task.completedDay ? 'border-[#b8e0cb] bg-[#ecfbf3]' : 'border-[#dce6e9] bg-[#fbfcfc]'}`}><button type="button" disabled={disabled} onClick={() => onToggle(task.id)} className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center border rounded-sm ${task.completedDay ? 'border-[#16a36a] bg-[#16a36a] text-white' : 'border-[#b9c9cf] bg-white'}`}>{task.completedDay && <Check size={15} />}</button><div className="min-w-0 flex-1"><div className={`text-sm font-black ${task.completedDay ? 'text-slate-500 line-through' : ''}`}>{task.title}</div><div className="mt-1 text-xs font-bold text-slate-400">{goals.find((goal) => goal.id === task.goalId)?.name || 'Без цели'}{task.dueDay ? ` · до дня ${task.dueDay}` : ''}</div></div>{!disabled && <button type="button" onClick={() => onDelete(task.id)} className="text-slate-400 hover:text-rose-600" title="Удалить"><X size={17} /></button>}</div>)}{!tasks.length && <EmptyLine text="Добавь одну конкретную задачу, когда нужен фокус" />}</div></Section>;
}

function WeeklyReview({ review, required, disabled, onChange }) {
  return <Section title={`Неделя ${review.week}: итог`} eyebrow={required ? 'Обязательно перед закрытием дня' : 'Заполнено'} icon={<CalendarDays />} tone="coral"><div className="grid gap-2"><ReflectionInput label="Какие факты этой недели важны?" value={review.victories} disabled={disabled} onChange={(victories) => onChange({ victories })} /><ReflectionInput label="Какой паттерн я заметил?" value={review.pattern} disabled={disabled} onChange={(pattern) => onChange({ pattern })} /><ReflectionInput label="Какой выбор повторю на следующей неделе?" value={review.nextChoice} disabled={disabled} onChange={(nextChoice) => onChange({ nextChoice })} /></div></Section>;
}

function ReflectionInput({ label, value, disabled, onChange }) {
  return <label className="border border-[#eadfdc] bg-[#fffaf9] p-3 rounded-md"><span className="text-xs font-black text-slate-500">{label}</span><textarea value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="mt-2 h-20 w-full resize-none bg-transparent text-sm font-semibold leading-6 outline-none" /></label>;
}

function FinalReview({ review, totalDays, required, disabled, onChange }) {
  return <Section title={`День ${totalDays}: итог пути`} eyebrow={required ? 'Собери то, что теперь останется с тобой' : 'Финал собран'} icon={<Trophy />} tone="coral"><div className="grid gap-2"><ReflectionInput label="Что изменилось в теле и энергии?" value={review.body} disabled={disabled} onChange={(body) => onChange({ body })} /><ReflectionInput label="Что произошло с работой и професиональной ценностью?" value={review.career} disabled={disabled} onChange={(career) => onChange({ career })} /><ReflectionInput label="Какими действиями я доказал себе право быть собой?" value={review.identity} disabled={disabled} onChange={(identity) => onChange({ identity })} /><ReflectionInput label="Какой следующий путь я выбираю?" value={review.next} disabled={disabled} onChange={(next) => onChange({ next })} /></div></Section>;
}

function StatsDashboard({ user, state, stats, lifeState, lifeCommit, codexCommit, range, totalDays, onRange, onProfileChange, onScoringChange }) {
  const [section, setSection] = useState('metrics');
  const weightRemaining = stats.lastWeight ? Math.max(0, stats.lastWeight - number(state.profile.targetWeight)) : null;
  return (
    <div className="grid gap-4">
      <section className="border border-[#d8e3e7] bg-white p-4 rounded-lg"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-sm font-black text-[#0d8fb9]">Статистика</div><h1 className="mt-1 text-2xl font-black">Что меняется по фактам</h1></div>{section === 'metrics' && <RangeControl value={range} totalDays={totalDays} onChange={onRange} />}</div><div className="mt-4 grid grid-cols-3 gap-1 border border-[#d8e3e7] bg-[#f3f6f7] p-1 rounded-md">{[['metrics', 'Показатели'], ['events', 'События'], ['patterns', 'Паттерны']].map(([id, label]) => <button key={id} type="button" onClick={() => setSection(id)} className={`min-h-10 px-2 text-xs font-black rounded-sm ${section === id ? 'bg-[#102a43] text-white' : 'text-slate-500'}`}>{label}</button>)}</div></section>
      {section === 'events' && lifeState && <EventsPanel user={user} state={lifeState} commit={lifeCommit} />}
      {section === 'patterns' && <PatternsPanel marathon={state} />}
      {section === 'metrics' && <>
      <section className="grid grid-cols-2 gap-2 lg:grid-cols-5"><SummaryCard label="До 65 кг" value={weightRemaining === null ? 'Нужен вес' : `${weightRemaining.toFixed(1)} кг`} color="#16a36a" /><SummaryCard label="Энергобаланс" value={`${stats.avgBalance > 0 ? '+' : ''}${stats.avgBalance} ккал`} color="#f06c5f" /><SummaryCard label="Действия" value={stats.allActions.length} color="#0d8fb9" /><SummaryCard label="Рефлексия" value={`${stats.reflectionRate}%`} color="#d55784" /><SummaryCard label="Задачи" value={`${stats.tasksDone}/${stats.tasksDone + stats.tasksOpen}`} color="#7c63d6" /></section>

      <WeightProjection projection={stats.weightProjection} startDate={state.startDate} totalDays={totalDays} />

      <CodexStats stats={stats.codexStats} state={state} commit={codexCommit} />

      <section className="grid gap-4 lg:grid-cols-2"><MetricPanel title="Вес" subtitle={`${stats.firstWeight || '—'} → ${stats.lastWeight || '—'} кг`} icon={<Scale />}><LineGraph data={stats.weights} color="#16a36a" unit="кг" target={number(state.profile.targetWeight)} /></MetricPanel><MetricPanel title="Энергетический итог" subtitle={`${stats.totalBalance > 0 ? '+' : ''}${stats.totalBalance} ккал за период`} icon={<Gauge />}><BalanceGraph data={stats.balances} /></MetricPanel><MetricPanel title="Калории" subtitle={`среднее ${stats.avgCalories || '—'} ккал`} icon={<Utensils />}><LineGraph data={stats.calories} color="#f06c5f" unit="ккал" guides={[CALORIE_TARGET, CALORIE_LIMIT]} /></MetricPanel><MetricPanel title="Шаги" subtitle={`среднее ${stats.avgSteps.toLocaleString('ru-RU')}`} icon={<Footprints />}><LineGraph data={stats.steps} color="#0d8fb9" unit="шагов" guides={[8000]} /></MetricPanel></section>

      <CourageStats moments={stats.courage} />
      <ProfilePanel profile={state.profile} onChange={onProfileChange} />
      <ScoringPanel criteria={state.dayCriteria} thresholds={state.resultThresholds} onChange={onScoringChange} />
      </>}
    </div>
  );
}

function WeightProjection({ projection, startDate, totalDays }) {
  if (!projection) return <section className="border border-[#d8e3e7] bg-white p-4 rounded-lg"><div className="flex items-center gap-2 font-black"><Scale size={18} className="text-[#16a36a]" />Курс на 65 кг</div><p className="mt-2 text-sm font-semibold text-slate-500">Введи и сохрани первый вес — здесь появятся три сценария и фактический прогноз.</p></section>;
  const finishLabel = (finishDay) => finishDay <= totalDays ? `день ${finishDay} · ${formatShortDate(addDays(startDate, finishDay - 1))}` : `после марафона · день ${finishDay}`;
  const trend = projection.remaining === 0 ? 'Цель достигнута' : projection.trendFinishDay ? finishLabel(projection.trendFinishDay) : 'Нужно минимум две отметки веса';
  return <section className="border border-[#b8e0cb] bg-[#f4fcf8] p-4 rounded-lg"><div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><div className="flex items-center gap-2 text-sm font-black text-[#16865f]"><Scale size={18} />Курс на {projection.target} кг</div><h2 className="mt-1 text-xl font-black">По текущей динамике: {trend}</h2></div><div className="text-sm font-bold text-slate-500">Чтобы успеть за {totalDays} дней: <strong className="text-[#102a43]">≈ {projection.requiredDailyDeficit} ккал/день</strong></div></div><div className="mt-4 grid gap-2 sm:grid-cols-3">{projection.scenarios.map((scenario) => <div key={scenario.id} className="border border-white bg-white p-3 shadow-sm rounded-md"><div className="h-1 w-10 rounded-sm" style={{ backgroundColor: scenario.color }} /><div className="mt-2 flex items-baseline justify-between gap-2"><strong className="text-sm font-black">{scenario.title}</strong><span className="text-xs font-black" style={{ color: scenario.color }}>−{scenario.deficit}</span></div><div className="mt-2 text-lg font-black">{scenario.days} дней</div><div className={`mt-1 text-xs font-bold ${scenario.withinMarathon ? 'text-[#16865f]' : 'text-[#a7473e]'}`}>{finishLabel(scenario.finishDay)}</div></div>)}</div></section>;
}

function RangeControl({ value, totalDays, onChange }) {
  return <div className="grid grid-cols-3 gap-1 border border-[#d8e3e7] bg-[#f3f6f7] p-1 rounded-md">{[['7', '7 дней'], ['30', '30 дней'], ['all', `${totalDays} дней`]].map(([id, label]) => <button key={id} type="button" onClick={() => onChange(id)} className={`min-h-[38px] px-3 text-xs font-black rounded-sm ${value === id ? 'bg-[#102a43] text-white' : 'text-slate-500'}`}>{label}</button>)}</div>;
}

function SummaryCard({ label, value, color }) {
  return <div className="border border-[#d8e3e7] bg-white p-3 rounded-lg"><div className="h-1 w-10 rounded-sm" style={{ backgroundColor: color }} /><div className="mt-3 text-xs font-black text-slate-500">{label}</div><div className="mt-1 text-xl font-black">{value}</div></div>;
}

function MetricPanel({ title, subtitle, icon, children }) {
  return <section className="border border-[#d8e3e7] bg-white p-4 rounded-lg"><div className="mb-3 flex items-start gap-3"><span className="grid h-9 w-9 place-items-center bg-[#eef5f7] text-[#0d7ea5] rounded-md">{icon}</span><div><div className="text-xs font-black text-slate-500">{title}</div><h2 className="mt-1 text-lg font-black">{subtitle}</h2></div></div>{children}</section>;
}

function LineGraph({ data, color, unit, guides = [], target = null }) {
  if (!data.length) return <ChartEmpty />;
  const allValues = [...data.map((item) => item.value), ...guides, target].filter((value) => value !== null && value !== undefined && value !== 0);
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const pad = Math.max(1, (max - min) * 0.15);
  const width = 420; const height = 190; const left = 30; const right = 12; const top = 12; const bottom = 28;
  const firstDay = data[0].day; const lastDay = data.at(-1).day; const span = Math.max(1, lastDay - firstDay);
  const x = (day) => left + ((day - firstDay) / span) * (width - left - right);
  const y = (value) => top + ((max + pad - value) / (max - min + pad * 2)) * (height - top - bottom);
  const points = data.map((item) => `${x(item.day)},${y(item.value)}`).join(' ');
  return <svg viewBox={`0 0 ${width} ${height}`} className="h-[210px] w-full">{[0, 1, 2, 3].map((row) => <line key={row} x1={left} x2={width - right} y1={top + row * 48} y2={top + row * 48} stroke="#e1e9ec" />)}{guides.map((guide) => <line key={guide} x1={left} x2={width - right} y1={y(guide)} y2={y(guide)} stroke="#f3a52f" strokeDasharray="5 5" />)}{target && <line x1={left} x2={width - right} y1={y(target)} y2={y(target)} stroke="#16a36a" strokeDasharray="5 5" />}<polyline points={points} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />{data.map((item) => <circle key={`${item.day}-${item.value}`} cx={x(item.day)} cy={y(item.value)} r="4" fill="white" stroke={color} strokeWidth="3"><title>{`День ${item.day}: ${item.value} ${unit}`}</title></circle>)}</svg>;
}

function BalanceGraph({ data }) {
  if (!data.length) return <ChartEmpty />;
  const visible = data.slice(-30); const max = Math.max(1, ...visible.map((item) => Math.abs(item.value)));
  return <div className="relative flex h-[210px] items-center gap-1 border-y border-[#e1e9ec]"><div className="absolute inset-x-0 top-1/2 border-t border-dashed border-slate-400" />{visible.map((item) => <div key={item.day} className="relative h-full flex-1" title={`День ${item.day}: ${item.value} ккал`}><span className={`absolute inset-x-[12%] ${item.value <= 0 ? 'top-1/2 bg-[#16a36a]' : 'bottom-1/2 bg-[#f06c5f]'}`} style={{ height: `${Math.max(2, Math.abs(item.value) / max * 45)}%` }} /></div>)}</div>;
}

function ChartEmpty() {
  return <div className="grid h-[210px] place-items-center border border-dashed border-[#cfdde2] bg-[#f7f9fa] text-sm font-bold text-slate-400 rounded-md">Нужна первая отметка</div>;
}

function CourageStats({ moments }) {
  const avg = (key) => moments.length ? Math.round(moments.reduce((sum, moment) => sum + number(moment[key]), 0) / moments.length) : 0;
  return <section className="border border-[#d8e3e7] bg-white p-4 rounded-lg"><div className="flex items-center gap-2 text-sm font-black text-[#0d7ea5]"><Brain size={18} />Ситуации смелости</div><div className="mt-3 grid grid-cols-3 gap-2"><SummaryMini label="Ситуаций" value={moments.length} /><SummaryMini label="Тревога до" value={moments.length ? avg('before') : '—'} /><SummaryMini label="После" value={moments.length ? avg('after') : '—'} /></div>{moments.length > 0 && <div className="mt-3 grid gap-2 sm:grid-cols-2">{[...moments].reverse().slice(0, 8).map((moment) => <div key={`${moment.day}-${moment.id}`} className="border border-[#dce6e9] bg-[#fbfcfc] p-3 text-sm rounded-md"><div className="text-xs font-black text-[#0d7ea5]">День {moment.day} · {moment.context} · {moment.before} → {moment.after}</div><div className="mt-1 font-semibold leading-6">{moment.action}</div></div>)}</div>}</section>;
}

function SummaryMini({ label, value }) {
  return <div className="border border-[#dce6e9] bg-[#f7f9fa] p-3 text-center rounded-md"><div className="text-xs font-bold text-slate-500">{label}</div><div className="mt-1 text-xl font-black">{value}</div></div>;
}

function ProfilePanel({ profile, onChange }) {
  const [open, setOpen] = useState(false);
  return <section className="border border-[#d8e3e7] bg-white rounded-lg"><button type="button" onClick={() => setOpen((value) => !value)} className="flex min-h-[54px] w-full items-center justify-between px-4 text-left"><span className="flex items-center gap-2 font-black"><Settings2 size={18} className="text-[#0d7ea5]" />Параметры расчёта тела</span><ChevronDown size={18} className={`transition ${open ? 'rotate-180' : ''}`} /></button>{open && <div className="grid gap-2 border-t border-[#e1e9ec] p-4 sm:grid-cols-4"><MiniNumber label="Возраст" value={profile.age} onChange={(age) => onChange({ age })} /><MiniNumber label="Рост, см" value={profile.height} onChange={(height) => onChange({ height })} /><MiniNumber label="Цель, кг" value={profile.targetWeight} step="0.1" onChange={(targetWeight) => onChange({ targetWeight })} /><label className="field-box"><span>Пол</span><select value={profile.sex} onChange={(event) => onChange({ sex: event.target.value })} className="mt-2 w-full bg-transparent font-black outline-none"><option value="male">Мужской</option><option value="female">Женский</option></select></label></div>}</section>;
}

function ScoringPanel({ criteria, thresholds, onChange }) {
  const [open, setOpen] = useState(false);
  const updateCriterion = (id, patch) => onChange({ dayCriteria: criteria.map((item) => item.id === id ? { ...item, ...patch } : item) });
  return <section className="border border-[#d8e3e7] bg-white rounded-lg"><button type="button" onClick={() => setOpen((value) => !value)} className="flex min-h-[54px] w-full items-center justify-between px-4 text-left"><span className="flex items-center gap-2 font-black"><Settings2 size={18} className="text-[#0d7ea5]" />Оценка результа дня</span><ChevronDown size={18} className={`transition ${open ? 'rotate-180' : ''}`} /></button>{open && <div className="grid gap-3 border-t border-[#e1e9ec] p-4"><p className="text-sm font-semibold leading-6 text-slate-500">Обязательность определяет, нужно ли заполнить поле для закрытия. Вес определяет вклад в итоговый цвет.</p>{criteria.map((item) => <div key={item.id} className="grid gap-2 border border-[#dce6e9] bg-[#f8fbfb] p-3 rounded-md sm:grid-cols-[1fr_100px_90px_auto]"><label className="flex items-center gap-2 text-sm font-black"><input type="checkbox" checked={item.active !== false} onChange={(event) => updateCriterion(item.id, { active: event.target.checked })} className="h-5 w-5 accent-[#0d8fb9]" />{item.label}</label><label className="text-xs font-bold text-slate-500">Норма<input type="number" value={item.target} onChange={(event) => updateCriterion(item.id, { target: event.target.value })} className="field-control mt-1 min-h-10 py-1" /></label><label className="text-xs font-bold text-slate-500">Вес<input type="number" min="0" max="100" value={item.weight} onChange={(event) => updateCriterion(item.id, { weight: event.target.value })} className="field-control mt-1 min-h-10 py-1" /></label><label className="flex items-center gap-2 self-end pb-2 text-xs font-bold text-slate-500"><input type="checkbox" checked={item.required} onChange={(event) => updateCriterion(item.id, { required: event.target.checked })} />обяз.</label></div>)}<div className="grid grid-cols-3 gap-2"><MiniNumber label="Жёлтый от, %" value={thresholds.steady} onChange={(steady) => onChange({ resultThresholds: { ...thresholds, steady } })} /><MiniNumber label="Зелёный от, %" value={thresholds.strong} onChange={(strong) => onChange({ resultThresholds: { ...thresholds, strong } })} /><MiniNumber label="Прорыв от, %" value={thresholds.expansion} onChange={(expansion) => onChange({ resultThresholds: { ...thresholds, expansion } })} /></div></div>}</section>;
}

function MiniNumber({ label, value, onChange, step = '1' }) {
  return <label className="field-box"><span>{label}</span><input type="number" min="0" step={step} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full bg-transparent font-black outline-none" /></label>;
}

function GoalModal({ mode, goal, goals, onSave, onArchive, onClose }) {
  const blank = { name: '', description: '', type: 'count', cadence: 'weekly', target: 1, unit: 'раз', color: GOAL_COLORS[goals.length % GOAL_COLORS.length], locked: false };
  const [draft, setDraft] = useState(goal ? { ...goal } : blank);
  if (mode === 'list') return <ModalShell title="Цели марафона" onClose={onClose}><div className="grid gap-2">{goals.filter((item) => item.active !== false).map((item) => <button key={item.id} type="button" onClick={() => setDraft({ ...item })} className={`flex items-center gap-3 border p-3 text-left rounded-md ${draft.id === item.id ? 'border-[#0d8fb9] bg-[#edf9fd]' : 'border-[#dce6e9] bg-white'}`}><i className="h-8 w-1.5 rounded-sm" style={{ backgroundColor: item.color }} /><span className="min-w-0 flex-1"><strong className="block truncate">{item.name}</strong><small className="font-bold text-slate-500">{item.cadence === 'daily' ? 'каждый день' : item.cadence === 'weekly' ? `${item.target} ${item.unit} в неделю` : `${item.target} ${item.unit} за марафон`}</small></span><Edit3 size={16} /></button>)}</div><button type="button" onClick={() => setDraft(blank)} className="mt-4 flex min-h-[46px] w-full items-center justify-center gap-2 border border-[#b9dce8] bg-[#edf9fd] font-black text-[#0d6f91] rounded-md"><Plus size={17} />Новая цель</button>{draft.name && <GoalForm draft={draft} setDraft={setDraft} onSave={onSave} onArchive={onArchive} />}</ModalShell>;
  return <ModalShell title={mode === 'edit' ? 'Редактировать цель' : 'Новая цель'} onClose={onClose}><GoalForm draft={draft} setDraft={setDraft} onSave={onSave} onArchive={onArchive} /></ModalShell>;
}

function GoalForm({ draft, setDraft, onSave, onArchive }) {
  return <div className="mt-4 grid gap-3 border-t border-[#e1e9ec] pt-4"><label className="form-label">Название<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Например: две тренировки" className="field-control mt-2" /></label><label className="form-label">Зачем эта цель<textarea value={draft.description || ''} onChange={(event) => setDraft({ ...draft, description: event.target.value })} className="field-control mt-2 h-20 resize-none" /></label><div className="grid gap-3 sm:grid-cols-2"><label className="form-label">Тип<select value={draft.type} disabled={draft.locked} onChange={(event) => setDraft({ ...draft, type: event.target.value })} className="field-control mt-2">{GOAL_TYPES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label className="form-label">Период<select value={draft.cadence} disabled={draft.locked} onChange={(event) => setDraft({ ...draft, cadence: event.target.value })} className="field-control mt-2">{GOAL_CADENCES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label className="form-label">Цель<input type="number" min="1" value={draft.target} disabled={draft.locked} onChange={(event) => setDraft({ ...draft, target: event.target.value })} className="field-control mt-2" /></label><label className="form-label">Единица<input value={draft.unit} disabled={draft.locked} onChange={(event) => setDraft({ ...draft, unit: event.target.value })} className="field-control mt-2" /></label></div><div><div className="form-label">Цвет</div><div className="mt-2 flex flex-wrap gap-2">{GOAL_COLORS.map((color) => <button key={color} type="button" onClick={() => setDraft({ ...draft, color })} className={`h-9 w-9 rounded-md ${draft.color === color ? 'ring-2 ring-[#102a43] ring-offset-2' : ''}`} style={{ backgroundColor: color }} title={color} />)}</div></div><div className="flex gap-2"><button type="button" disabled={!draft.name.trim()} onClick={() => onSave(draft)} className="min-h-[48px] flex-1 bg-[#16a36a] font-black text-white disabled:bg-slate-300 rounded-md">Сохранить цель</button>{draft.id && !draft.locked && <button type="button" onClick={() => onArchive(draft.id)} className="icon-command danger" title="Убрать цель"><Trash2 /></button>}</div></div>;
}

function TaskModal({ goals, currentDay, totalDays, onSave, onClose }) {
  const [draft, setDraft] = useState({ title: '', goalId: goals.find((goal) => goal.active !== false)?.id || '', dueDay: currentDay });
  return <ModalShell title="Новая задача" onClose={onClose}><div className="grid gap-3"><label className="form-label">Что сделать<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} className="field-control mt-2" autoFocus /></label><label className="form-label">Связать с целью<select value={draft.goalId} onChange={(event) => setDraft({ ...draft, goalId: event.target.value })} className="field-control mt-2"><option value="">Без цели</option>{goals.filter((goal) => goal.active !== false).map((goal) => <option key={goal.id} value={goal.id}>{goal.name}</option>)}</select></label><label className="form-label">День выполнения<input type="number" min={currentDay} max={totalDays} value={draft.dueDay} onChange={(event) => setDraft({ ...draft, dueDay: number(event.target.value) })} className="field-control mt-2" /></label><button type="button" disabled={!draft.title.trim()} onClick={() => onSave(draft)} className="min-h-[48px] bg-[#16a36a] font-black text-white disabled:bg-slate-300 rounded-md">Добавить задачу</button></div></ModalShell>;
}

function ModalShell({ title, children, onClose }) {
  return <motion.div role="dialog" aria-modal="true" aria-label={title} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#102a43]/45 p-3 backdrop-blur-sm"><motion.section initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10 }} className="my-6 w-full max-w-xl border border-[#d8e3e7] bg-white p-4 shadow-2xl rounded-lg"><div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-2xl font-black">{title}</h2><button type="button" onClick={onClose} className="icon-command" title="Закрыть"><X size={20} /></button></div>{children}</motion.section></motion.div>;
}

function ConfirmCareer({ choice, onConfirm, onClose }) {
  const passed = choice === 'passed';
  return <SimpleConfirm title={passed ? 'Испытательный срок пройден?' : 'Испытательный срок не пройден?'} text={passed ? 'После подтверждения курс изменится на закрепление и рост внутри Контура.' : 'Это не обнулит марафон. Приложение автоматически добавит недельную цель возвращения к 1С.'} confirm="Зафиксировать" onConfirm={onConfirm} onClose={onClose} />;
}

function ConfirmClose({ evaluation, weeklyRequired, finalRequired, onConfirm, onClose }) {
  const missing = weeklyRequired ? 'Недельный итог ещё не заполнен.' : finalRequired ? 'Финальный итог пути ещё не заполнен.' : '';
  return <SimpleConfirm title="Закрыть день навсегда?" text={missing || `День получит результат «${evaluation.title}», ${evaluation.score}% и ${evaluation.xp} очков. После этого редактирование невозможно.`} confirm="Да, закрыть" disabled={weeklyRequired || finalRequired || !evaluation.canClose} onConfirm={onConfirm} onClose={onClose} />;
}

function SimpleConfirm({ title, text, confirm, disabled = false, onConfirm, onClose }) {
  return <ModalShell title={title} onClose={onClose}><p className="font-semibold leading-7 text-slate-600">{text}</p><div className="mt-5 grid grid-cols-2 gap-2"><button type="button" onClick={onClose} className="min-h-[48px] border border-[#d8e3e7] bg-white font-black text-slate-600 rounded-md">Отмена</button><button type="button" disabled={disabled} onClick={onConfirm} className="min-h-[48px] bg-[#16a36a] font-black text-white disabled:bg-slate-300 rounded-md">{confirm}</button></div></ModalShell>;
}

function ExportModal({ data, totalDays, onClose }) {
  const [mode, setMode] = useState('markdown');
  const [copied, setCopied] = useState(false);
  const value = mode === 'markdown' ? data.markdown : data.json;
  const copy = async () => { await navigator.clipboard.writeText(value); setCopied(true); window.setTimeout(() => setCopied(false), 1400); };
  const download = () => { const blob = new Blob([value], { type: mode === 'markdown' ? 'text/markdown;charset=utf-8' : 'application/json;charset=utf-8' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = mode === 'markdown' ? `marathon-${totalDays}.md` : `marathon-${totalDays}.json`; link.click(); URL.revokeObjectURL(url); };
  return <ModalShell title="Экспорт пути" onClose={onClose}><div className="mb-3 flex flex-wrap gap-2"><button type="button" onClick={() => setMode('markdown')} className={`px-3 py-2 text-sm font-black rounded-md ${mode === 'markdown' ? 'bg-[#102a43] text-white' : 'border border-[#d8e3e7]'}`}>Текст</button><button type="button" onClick={() => setMode('json')} className={`px-3 py-2 text-sm font-black rounded-md ${mode === 'json' ? 'bg-[#102a43] text-white' : 'border border-[#d8e3e7]'}`}>Данные</button><button type="button" onClick={copy} className="px-3 py-2 text-sm font-black text-[#0d7ea5]">{copied ? 'Скопировано' : 'Скопировать'}</button><button type="button" onClick={download} className="px-3 py-2 text-sm font-black text-[#16865f]">Скачать</button></div><textarea readOnly value={value} className="h-[55vh] w-full resize-none border border-[#d8e3e7] bg-[#f7f9fa] p-3 font-mono text-xs leading-5 outline-none rounded-md" /></ModalShell>;
}

function Celebration({ result }) {
  const particles = useMemo(() => Array.from({ length: 18 }, (_, index) => ({ id: index, x: (index % 6) * 18 - 45, delay: (index % 5) * 0.05, color: ['#16a36a', '#0d8fb9', '#f06c5f', '#f3a52f'][index % 4] })), []);
  return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-none fixed inset-0 z-[70] grid place-items-center bg-white/20 backdrop-blur-[2px]"><motion.div initial={{ scale: 0.65, y: 20 }} animate={{ scale: 1, y: 0 }} className="relative border border-white bg-white px-8 py-6 text-center shadow-2xl rounded-lg"><Trophy size={42} className="mx-auto" style={{ color: result.color }} /><div className="mt-3 text-2xl font-black">{result.title}</div><div className="mt-1 font-black" style={{ color: result.color }}>+{result.xp} очков</div>{particles.map((particle) => <motion.i key={particle.id} className="absolute left-1/2 top-1/2 h-2 w-2 rounded-sm" style={{ backgroundColor: particle.color }} initial={{ x: 0, y: 0, opacity: 1 }} animate={{ x: particle.x * 2.5, y: -90 + (particle.id % 4) * 55, rotate: 180, opacity: 0 }} transition={{ duration: 1.2, delay: particle.delay }} />)}</motion.div></motion.div>;
}

export default App;
