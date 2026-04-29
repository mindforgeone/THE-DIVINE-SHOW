import React, { useState, useEffect, useMemo, useReducer, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Trophy, Flame, AlertCircle, CheckCircle2, XCircle, 
  RotateCcw, Zap, ShieldCheck, BarChart3, Ghost, 
  Skull, History, Clock, ZapOff, Bomb, AlertTriangle, Scale, Target, Play, TrendingDown, Activity, Swords, BrainCircuit, Droplets
} from 'lucide-react';

// ==========================================
// [1. CONFIGURATION & DOMAIN DATA]
// ==========================================
const APP_CONFIG = {
  TOTAL_DAYS: 120,
  CHECKPOINT_DAY: 66,
  SUCCESS_THRESHOLD: 85,
  STORAGE_KEY: "divine-progress-v13-sustainable",
  START_DATE: '2026-05-04T00:00:00Z', 
  MAX_CRITICAL_FAILS: 20,
  WEIGHT_TARGET: 65,
  WEIGHT_START: 80,
};

const DOMAIN_DATA = {
  CHALLENGES: [
    "Разбери типовую конфигурацию 1С (БП, ЗУП, УТ) – найди 3 интересных места.",
    "Напиши обработку для заполнения табличной части.",
    "Изучи конструкции языка запросов 1С (объединения, временные таблицы).",
    "Рефакторинг 30 строк своего старого кода 1С.",
    "Проведи анализ производительности отчёта (замерь, оптимизируй).",
    "Посвяти 2 часа чистому 1С без единого отвлечения (таймер включи).",
    "Создай внешний отчёт с параметрами и схемой компоновки данных."
  ],
  MICRO_WINS: [
    "Выпей стакан чистой воды прямо сейчас.",
    "Сделай 5 глубоких вдохов-выдохов (по 4 секунды).",
    "Удали 1 ненужное/отвлекающее приложение с телефона.",
    "Встань и потянись. Поправь осанку на ближайшие 10 минут.",
    "Убери 1 лишнюю вещь со своего рабочего стола.",
    "Закрой глаза и посиди в тишине ровно 60 секунд."
  ],
  DIAGNOSTIC_CATEGORIES: [
    "Сон / Нехватка энергии",
    "Фокус / Выгорание ЦНС",
    "Токсичная среда / Отвлечения",
    "Стресс / Эмоциональный сбой",
    "Плохое планирование / Хаос"
  ],
  STATUS_TIPS: {
    "ХАОС": "Ты в руинах. Открой 1С хоть на 5 минут. Просто сегодня не сдайся.",
    "БОРЬБА": "Искра есть. Удержи её. Завтра будет легче, если не сдашься сегодня.",
    "КОНТРОЛЬ": "Система работает. Ты начинаешь управлять реальностью. Не сбавляй темп.",
    "ДОМИНИРОВАНИЕ": "Ты — бог 1С. Но бог не расслабляется. Удвой норму: напиши сложный запрос."
  },
  PAIN_TRIGGERS: [
    "Если ты не сделаешь это сегодня – завтра будешь тем же ничтожеством, что и вчера.",
    "Твой оффер на 500к ждёт только того, кто не жалеет себя.",
    "65 кг – это не цель, это приговор твоему прошлому телу.",
    "Боль дисциплины весит граммы. Боль сожаления — тонны.",
    "Никто не придёт тебя спасать. Ты один в этой комнате."
  ],
  RANKS: [
    { level: 1, title: "МЯСО", color: "text-zinc-500", glow: "", bg: "#0a0a0a" },
    { level: 2, title: "ТЕНЬ", color: "text-red-800", glow: "shadow-[0_0_15px_#450a0a]", bg: "#1a0505" },
    { level: 3, title: "ИСКРА", color: "text-orange-600", glow: "shadow-[0_0_20px_#7c2d12]", bg: "#1f0d00" },
    { level: 4, title: "СТАЛЬ", color: "text-yellow-500", glow: "shadow-[0_0_20px_#854d0e]", bg: "#1a1600" },
    { level: 5, title: "ХИЩНИК", color: "text-emerald-600", glow: "shadow-[0_0_25px_#064e3b]", bg: "#021c0e" },
    { level: 6, title: "АВТОНОМИЯ", color: "text-emerald-400", glow: "shadow-[0_0_25px_#047857]", bg: "#002414" },
    { level: 7, title: "АРХИТЕКТОР", color: "text-cyan-600", glow: "shadow-[0_0_30px_#164e63]", bg: "#001a24" },
    { level: 8, title: "СИСТЕМА", color: "text-cyan-400", glow: "shadow-[0_0_30px_#0891b2]", bg: "#002633" },
    { level: 9, title: "ВЛАСТЬ", color: "text-violet-500", glow: "shadow-[0_0_40px_#4c1d95]", bg: "#170033" },
    { level: 10, title: "БОЖЕСТВО", color: "text-white", glow: "shadow-[0_0_50px_#ffffff]", bg: "#050505" },
  ]
};

const ACHIEVEMENTS_LIST = [
  { id: 'first_blood', title: 'ПЕРВАЯ КРОВЬ', desc: 'Зафиксирован первый идеальный день' },
  { id: 'streak_7', title: 'НЕДЕЛЯ КОНТРОЛЯ', desc: 'Стрик 7 дней подряд' },
  { id: 'streak_30', title: 'ЖЕЛЕЗНАЯ ВОЛЯ', desc: 'Стрик 30 дней подряд' },
  { id: 'weight_5', title: '-5 КГ СБРОШЕНО', desc: 'Тело начинает подчиняться' },
  { id: 'checkpoint_66', title: 'ЧЕКПОЙНТ 66', desc: 'Прошёл Рубикон' },
  { id: 'divine_120', title: 'БОЖЕСТВО', desc: '120 дней завершены успешно' }
];

const getDayDateString = (dayNum, startDateStr) => {
  if (!startDateStr) return '';
  const d = new Date(new Date(startDateStr).getTime() + (dayNum - 1) * 24 * 60 * 60 * 1000);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '');
};

// ==========================================
// [2. INFRASTRUCTURE & SERVICES] (Side Effects)
// ==========================================
const StorageService = {
  load: () => {
    try {
      const data = localStorage.getItem(APP_CONFIG.STORAGE_KEY);
      return data ? JSON.parse(data) : null;
    } catch (e) { return null; }
  },
  save: (state) => {
    try { localStorage.setItem(APP_CONFIG.STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
  }
};

const DeviceService = {
  vibrate: (pattern) => { if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(pattern); },
  playSound: (type) => { try { new Audio(`/${type}.mp3`).play().catch(() => {}); } catch (e) {} }
};

// ==========================================
// [3. CORE BUSINESS LOGIC] (Pure Functions)
// ==========================================
const CoreEngine = {
  generateInitialDays: () => Array.from({ length: APP_CONFIG.TOTAL_DAYS }, (_, i) => ({
    day: i + 1,
    contractSigned: false, 
    identityFocus: "", 
    status: null, 
    quality: null, 
    isMissed: false,
    permanentFail: false, 
    nutrition: false,
    study: false,
    penaltyCount: 0, 
    extraTask1: false,
    extraTask2: false,
    winText: "",
    diagnosticCategory: "", 
    microFix: "", 
    weight: "",
    offerAction: "",
    late: false,
    closedAt: null
  })),

  calculateCurrentDayIndex: (startDateISO, currentTimestamp) => {
    const start = new Date(startDateISO).getTime();
    const diffDays = Math.floor((currentTimestamp - start) / (1000 * 60 * 60 * 24));
    return diffDays < 0 ? 0 : Math.max(0, Math.min(APP_CONFIG.TOTAL_DAYS - 1, diffDays));
  },

  calculateStats: (daysArray) => {
    let currentStreak = 0, maxStreak = 0, successCount = 0, passedDaysCount = 0;
    let criticalFails = 0, nutritionFails = 0, studyFails = 0, lastWeight = 0;
    let consecutiveFails = 0; 

    daysArray.forEach(d => {
      if (d.status === null) return; 
      
      passedDaysCount++;
      if (d.weight) lastWeight = parseFloat(d.weight);

      if (d.status === 'success') {
        currentStreak++;
        successCount++;
        consecutiveFails = 0;
      } else {
        maxStreak = Math.max(maxStreak, currentStreak);
        currentStreak = 0; 
        consecutiveFails++;
        if (d.status === 'fail') criticalFails++;
      }

      if (d.status === 'weakness' || d.status === 'fail') {
        if (!d.nutrition) nutritionFails++;
        if (!d.study) studyFails++;
      }
    });
    
    maxStreak = Math.max(maxStreak, currentStreak);
    const winRate = passedDaysCount === 0 ? 0 : Math.round((successCount / passedDaysCount) * 100);
    const survivalMode = consecutiveFails >= 3;

    return {
      streak: currentStreak, maxStreak, percent: winRate, criticalFails,
      nutritionFails, studyFails, passedDays: passedDaysCount, completed: successCount, 
      currentWeight: lastWeight, consecutiveFails, survivalMode
    };
  },

  checkCheckpointEligibility: (daysArray) => {
    const historySlice = daysArray.slice(0, APP_CONFIG.CHECKPOINT_DAY - 1);
    const historyStats = CoreEngine.calculateStats(historySlice);
    return historyStats.percent >= 75 && historyStats.streak >= 5;
  },

  evaluateDayRules: (formData, isLate, isDebtUnpaid, survivalMode) => {
    const currentPenalty = survivalMode ? 2 : formData.penaltyCount;
    const minWinLength = currentPenalty > 0 ? 20 : 10;
    const isRestDay = formData.day % 7 === 0;
    
    const hasCore = formData.nutrition && 
                    formData.study && 
                    Boolean(formData.weight) && 
                    (formData.offerAction || "").length >= 10 && 
                    (formData.winText || "").length >= minWinLength;
                    
    const clearedPenalties = currentPenalty === 0 || 
                            (currentPenalty === 1 ? formData.extraTask1 : (formData.extraTask1 && formData.extraTask2));

    let status = 'fail';
    let quality = null;
    let nextPenalty = currentPenalty;

    if (hasCore && clearedPenalties && !isDebtUnpaid) {
      status = 'success';
      quality = (currentPenalty === 0 && formData.winText.length >= 50 && !isLate) ? 'perfect' : (isLate || currentPenalty > 0 ? 'barely' : 'ok');
      nextPenalty = 0; 
    } else if (formData.nutrition || formData.study || (hasCore && !clearedPenalties && !isDebtUnpaid)) {
      status = 'weakness'; 
      quality = 'barely';
      nextPenalty = Math.min(2, currentPenalty + 1); 
    } else {
      status = 'fail';
      nextPenalty = Math.min(2, currentPenalty + 1); 
    }

    const isValidForSuccess = status === 'success';
    const isValidForFail = Boolean(formData.diagnosticCategory) && (formData.microFix || "").length >= 5;

    return { status, quality, nextPenalty, isValidForSuccess, isValidForFail, isLate, isRestDay };
  },

  syncTimeState: (state, currentTimestamp) => {
    const startObj = new Date(state.startDate).getTime();
    const diffDays = Math.floor((currentTimestamp - startObj) / (1000 * 60 * 60 * 24));
    const currentIdx = diffDays < 0 ? 0 : Math.max(0, Math.min(APP_CONFIG.TOTAL_DAYS - 1, diffDays));
    
    let newDays = [...state.days];
    let isUpdated = false;

    if (state.lastOpenTimestamp && currentTimestamp < state.lastOpenTimestamp) {
      if (currentIdx >= 0 && newDays[currentIdx].status === null) {
        newDays[currentIdx] = { 
          ...newDays[currentIdx], status: 'fail', contractSigned: true, 
          diagnosticCategory: "Плохое планирование / Хаос", microFix: "Сбой системного времени." 
        };
        if (currentIdx + 1 < APP_CONFIG.TOTAL_DAYS && newDays[currentIdx + 1].status === null) {
          newDays[currentIdx + 1].penaltyCount = Math.min(2, (newDays[currentIdx + 1].penaltyCount || 0) + 1);
        }
        isUpdated = true;
      }
    }

    for (let i = 0; i < diffDays && i < APP_CONFIG.TOTAL_DAYS; i++) {
      if (newDays[i].status === null) {
        newDays[i] = { 
          ...newDays[i], isMissed: true, status: 'fail', contractSigned: true, quality: null, 
          diagnosticCategory: "Сон / Нехватка энергии", microFix: "AUTO-FAIL: ПРОПУЩЕННЫЙ ДЕНЬ" 
        };
        if (i + 1 < APP_CONFIG.TOTAL_DAYS && newDays[i+1].status === null) {
          newDays[i + 1].penaltyCount = Math.min(2, (newDays[i + 1].penaltyCount || 0) + 1);
        }
        if (i > 0 && newDays[i-1].isMissed) {
          newDays[i].permanentFail = true;
          if (i + 1 < APP_CONFIG.TOTAL_DAYS && newDays[i+1].status === null) newDays[i + 1].penaltyCount = 2; 
        }
        isUpdated = true;
      }
    }

    return { 
      syncedDays: newDays, 
      isUpdated,
      systemDestroyed: CoreEngine.calculateStats(newDays).criticalFails >= APP_CONFIG.MAX_CRITICAL_FAILS
    };
  },
  
  getEgoRank: (streak) => {
    const level = Math.min(10, Math.floor(streak / 7) + 1);
    return DOMAIN_DATA.RANKS[level - 1];
  }
};


// ==========================================
// [4. STATE MANAGEMENT] (Reducer)
// ==========================================
const initialState = {
  isLoaded: false,
  data: null, 
};

function appReducer(state, action) {
  switch (action.type) {
    case 'INIT_LOAD': {
      const { savedData, currentTimestamp } = action.payload;
      let initData = savedData || {
        startDate: APP_CONFIG.START_DATE,
        days: CoreEngine.generateInitialDays(),
        lastOpenTimestamp: currentTimestamp,
        achievements: [],
        systemDestroyed: false,
      };
      
      initData.days = initData.days.map(d => ({ ...d, diagnosticCategory: d.diagnosticCategory || "", microFix: d.microFix || d.failReason || "", identityFocus: d.identityFocus || "" }));
      
      const { syncedDays, systemDestroyed } = CoreEngine.syncTimeState(initData, currentTimestamp);
      return { 
        ...state, 
        isLoaded: true, 
        data: { ...initData, days: syncedDays, systemDestroyed, lastOpenTimestamp: currentTimestamp } 
      };
    }

    case 'TICK_SYNC': {
      if (!state.data || state.data.systemDestroyed) return state;
      const { currentTimestamp } = action.payload;
      const { syncedDays, isUpdated, systemDestroyed } = CoreEngine.syncTimeState(state.data, currentTimestamp);
      if (!isUpdated) return state;
      return { ...state, data: { ...state.data, days: syncedDays, systemDestroyed, lastOpenTimestamp: currentTimestamp } };
    }

    case 'SIGN_CONTRACT': {
      const { dayIndex, identityFocus, status, microFix } = action.payload;
      const newDays = [...state.data.days];
      newDays[dayIndex] = { ...newDays[dayIndex], contractSigned: true, identityFocus };
      
      if (status === 'fail') {
        newDays[dayIndex] = { 
          ...newDays[dayIndex], status: 'fail', 
          diagnosticCategory: "Стресс / Эмоциональный сбой", microFix, 
          closedAt: new Date().toISOString() 
        };
        if (dayIndex + 1 < APP_CONFIG.TOTAL_DAYS && newDays[dayIndex+1].status === null) {
          newDays[dayIndex+1].penaltyCount = Math.min(2, (newDays[dayIndex+1].penaltyCount || 0) + 1);
        }
      }
      return { ...state, data: { ...state.data, days: newDays, lastOpenTimestamp: Date.now() } };
    }

    case 'CLOSE_DAY': {
      const { formData, finalStatus, quality, isLate, nextPenalty, newAchievements, debtUpdate, closedAtISO } = action.payload;
      const newDays = [...state.data.days];
      const index = newDays.findIndex(d => d.day === formData.day);

      newDays[index] = { ...formData, status: finalStatus, quality, late: isLate, closedAt: closedAtISO };
      
      if (debtUpdate && debtUpdate.index >= 0) {
        newDays[debtUpdate.index] = { 
          ...newDays[debtUpdate.index], 
          diagnosticCategory: debtUpdate.category,
          microFix: debtUpdate.microFix 
        };
      }
      
      if (finalStatus === 'fail' || finalStatus === 'weakness') {
        const nextIdx = index + 1;
        if (nextIdx < APP_CONFIG.TOTAL_DAYS && newDays[nextIdx].status === null) {
          newDays[nextIdx] = { ...newDays[nextIdx], penaltyCount: nextPenalty };
        }
      }

      const nextStats = CoreEngine.calculateStats(newDays);
      return {
        ...state,
        data: {
          ...state.data,
          days: newDays,
          achievements: [...(state.data.achievements||[]), ...newAchievements],
          lastOpenTimestamp: Date.now(),
          systemDestroyed: nextStats.criticalFails >= APP_CONFIG.MAX_CRITICAL_FAILS
        }
      };
    }

    case 'DEATH_RESET': {
      return {
        ...state,
        data: {
          startDate: new Date().toISOString(), 
          days: CoreEngine.generateInitialDays(),
          achievements: [], 
          lastOpenTimestamp: Date.now(),
          systemDestroyed: false,
        }
      };
    }
    default: return state;
  }
}

// ==========================================
// [5. PRESENTATION LAYER]
// ==========================================
export default function App() {
  const [state, dispatch] = useReducer(appReducer, initialState);
  
  const [selectedDay, setSelectedDay] = useState(null);
  const [modalForm, setModalForm] = useState(null);
  const [modalDebtCategory, setModalDebtCategory] = useState(""); 
  const [modalDebtFix, setModalDebtFix] = useState(""); 
  const [contractIdentity, setContractIdentity] = useState("");
  
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [checkpointAlert, setCheckpointAlert] = useState(null); 
  const [streakBroken, setStreakBroken] = useState(false);
  const [shake, setShake] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [unlockedAchievement, setUnlockedAchievement] = useState(null);

  const dispatchWithEffects = useCallback((action) => {
    if (action.type === 'CLOSE_DAY' || action.type === 'SIGN_CONTRACT') {
      const statusToCheck = action.payload.finalStatus || action.payload.status;
      const q = action.payload.quality;
      
      if (statusToCheck === 'success' && q === 'perfect') {
        setShowConfetti(true); setTimeout(() => setShowConfetti(false), 3000); DeviceService.playSound('success');
      } else if (statusToCheck === 'fail' || statusToCheck === 'weakness') {
        setShake(true); DeviceService.vibrate([200, 100, 200]); setTimeout(() => setShake(false), 500); DeviceService.playSound('glass');
      }

      if (action.payload.newAchievements && action.payload.newAchievements.length > 0) {
         const aObj = ACHIEVEMENTS_LIST.find(a => a.id === action.payload.newAchievements[0]);
         if (aObj) setUnlockedAchievement(aObj);
      }
    }
    dispatch(action);
  }, []);

  useEffect(() => {
    const saved = StorageService.load();
    dispatch({ type: 'INIT_LOAD', payload: { savedData: saved, currentTimestamp: Date.now() } });
    const interval = setInterval(() => dispatch({ type: 'TICK_SYNC', payload: { currentTimestamp: Date.now() } }), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (state.isLoaded && state.data) StorageService.save(state.data);
  }, [state.data, state.isLoaded]);

  const data = state.data;
  const stats = useMemo(() => data ? CoreEngine.calculateStats(data.days) : CoreEngine.calculateStats([]), [data]);
  const currentDayIndex = useMemo(() => data ? CoreEngine.calculateCurrentDayIndex(data.startDate, Date.now()) : 0, [data]);
  const egoRank = useMemo(() => CoreEngine.getEgoRank(stats.streak), [stats.streak]);
  const isSurvivalMode = stats.survivalMode;

  const last7Days = useMemo(() => {
    if (!data) return [];
    const start = Math.max(0, currentDayIndex - 6);
    return data.days.slice(start, Math.max(1, currentDayIndex + 1)).reverse();
  }, [data, currentDayIndex]);

  const isPreStart = new Date() < new Date(APP_CONFIG.START_DATE);

  // Deterministic random triggers
  const randomPainTrigger = useMemo(() => {
    const triggers = DOMAIN_DATA.PAIN_TRIGGERS;
    return triggers[Math.floor(Math.random() * triggers.length)];
  }, [selectedDay]);

  // --- Handlers ---
  const handleDayClick = (dayObj) => {
    if (dayObj.day - 1 > currentDayIndex) return; 
    setSelectedDay(dayObj);
    setModalForm({ ...dayObj });
    setModalDebtCategory("");
    setModalDebtFix("");
  };

  const handleContractSign = (decision) => {
    if (decision === 'accept') {
      if (contractIdentity.length < 5) {
        alert("Заполни идентичность (минимум 5 символов)");
        return;
      }
      dispatchWithEffects({ type: 'SIGN_CONTRACT', payload: { dayIndex: currentDayIndex, identityFocus: contractIdentity } });
    } else {
      dispatchWithEffects({ 
        type: 'SIGN_CONTRACT', 
        payload: { dayIndex: currentDayIndex, status: 'fail', microFix: "Сдался до старта." } 
      });
    }
  };

  const executeDayClosure = (intent) => {
    if (!modalForm) return;

    const currentHour = new Date().getHours();
    const prevDayIdx = modalForm.day - 2;
    const prevDayObj = prevDayIdx >= 0 ? data.days[prevDayIdx] : null;
    const isDebtUnpaid = prevDayObj ? (prevDayObj.isMissed && (!prevDayObj.diagnosticCategory || !prevDayObj.microFix) && (modalDebtFix.length < 5 || !modalDebtCategory)) : false;

    const rules = CoreEngine.evaluateDayRules(modalForm, currentHour >= 23, isDebtUnpaid, isSurvivalMode);
    const isEligibleForCP66 = CoreEngine.checkCheckpointEligibility(data.days);
    const isCP66Blocked = modalForm.day === APP_CONFIG.CHECKPOINT_DAY && !isEligibleForCP66;

    let finalStatus = rules.status;

    if (intent === 'success') {
      if (!rules.isValidForSuccess || isCP66Blocked || isDebtUnpaid) return; 
    } else {
      if (!rules.isValidForFail) return; 
      finalStatus = rules.status === 'success' ? 'weakness' : rules.status; 
    }

    if (modalForm.day === APP_CONFIG.CHECKPOINT_DAY && isCP66Blocked) finalStatus = 'fail';

    let newUnlocked = [];
    const currAch = data.achievements || [];
    const nextTempStreak = finalStatus === 'success' ? stats.streak + 1 : 0;

    if (finalStatus === 'success' && rules.quality === 'perfect' && !currAch.includes('first_blood')) newUnlocked.push('first_blood');
    if (nextTempStreak >= 7 && !currAch.includes('streak_7')) newUnlocked.push('streak_7');
    if (nextTempStreak >= 30 && !currAch.includes('streak_30')) newUnlocked.push('streak_30');
    if (modalForm.weight && APP_CONFIG.WEIGHT_START - parseFloat(modalForm.weight) >= 5 && !currAch.includes('weight_5')) newUnlocked.push('weight_5');
    
    if (modalForm.day === APP_CONFIG.CHECKPOINT_DAY) {
      if (isCP66Blocked || finalStatus === 'fail') setCheckpointAlert('guilty');
      else if (finalStatus === 'success') {
        if (!currAch.includes('checkpoint_66')) newUnlocked.push('checkpoint_66');
        setCheckpointAlert('success');
      }
    }

    if (modalForm.day === APP_CONFIG.TOTAL_DAYS) {
      const finalPassed = stats.passedDays + 1; 
      const finalCompleted = finalStatus === 'success' ? stats.completed + 1 : stats.completed;
      const finalPercent = Math.round((finalCompleted / finalPassed) * 100);
      const finalWeight = parseFloat(modalForm.weight || stats.currentWeight);
      
      if (finalPercent < APP_CONFIG.SUCCESS_THRESHOLD || finalWeight > APP_CONFIG.WEIGHT_TARGET) setCheckpointAlert('failFinal');
      else {
        if (!currAch.includes('divine_120')) newUnlocked.push('divine_120');
        setCheckpointAlert('successFinal');
      }
    }

    if (finalStatus !== 'success' && stats.streak > 0) {
      setStreakBroken(true);
      DeviceService.vibrate([400]);
      setTimeout(() => setStreakBroken(false), 3000);
    }

    dispatchWithEffects({
      type: 'CLOSE_DAY',
      payload: {
        formData: modalForm, finalStatus, quality: rules.quality, isLate: rules.isLate,
        nextPenalty: rules.nextPenalty, newAchievements: newUnlocked,
        debtUpdate: prevDayObj?.isMissed && (!prevDayObj.diagnosticCategory || !prevDayObj.microFix) ? { index: prevDayIdx, category: modalDebtCategory, microFix: modalDebtFix } : null,
        closedAtISO: new Date().toISOString()
      }
    });

    setSelectedDay(null);
  };

  // --- Render Guards ---
  if (!state.isLoaded || !data) return <div className="min-h-screen bg-black flex items-center justify-center text-red-600 font-mono italic tracking-widest animate-pulse">РАЗВЕРТЫВАНИЕ ПРОТОКОЛА V13...</div>;

  // The Daily Contract UI
  const todayObj = data.days[currentDayIndex];
  if (!isPreStart && todayObj && !todayObj.contractSigned && todayObj.status === null) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-8 text-center bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImEiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTTAgNDBoNDBWMEgweiIgZmlsbD0iI2ZmZiIgZmlsbC1vcGFjaXR5PSIuMDUiLz48cGF0aCBkPSJNMCAwdjQwaDQwVjBIMHptMjAgMjB2MjBoMjBWMEgyMHYyMHoiIGZpbGw9IiMwMDAiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjYSkiLz48L3N2Zz4=')]">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="max-w-2xl w-full bg-zinc-950 border-2 border-emerald-900/50 p-10 md:p-12 rounded-[3rem] shadow-[0_0_50px_rgba(16,185,129,0.1)] relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-emerald-600 animate-pulse" />
          <BrainCircuit size={60} className="text-emerald-500 mx-auto mb-6" />
          <h1 className="text-4xl md:text-5xl font-black text-white uppercase italic mb-2 tracking-tighter">ДЕНЬ {currentDayIndex + 1} НАЧАЛСЯ</h1>
          <p className="text-zinc-500 font-mono text-sm uppercase tracking-[0.3em] mb-8">ИДЕНТИФИКАЦИЯ ЛИЧНОСТИ</p>
          
          <div className="text-left mb-8">
            <label className="block text-[10px] font-black uppercase text-emerald-500 mb-3 tracking-widest">Кем ты становишься сегодня? (Например: "Я - Senior AQA, решающий проблемы бизнеса")</label>
            <textarea
              value={contractIdentity}
              onChange={e => setContractIdentity(e.target.value)}
              className="w-full bg-[#05100a] border border-emerald-900/50 rounded-2xl p-4 text-emerald-400 focus:border-emerald-500 outline-none transition-all resize-none shadow-inner h-24 text-sm"
              placeholder="Сформируй намерение..."
            />
          </div>

          <div className="space-y-4">
            <button onClick={() => handleContractSign('accept')} className="w-full py-5 bg-emerald-900/20 border-2 border-emerald-600/50 hover:bg-emerald-800 text-emerald-400 hover:text-white rounded-2xl font-black uppercase text-lg tracking-widest transition-all group relative overflow-hidden">
              <span className="relative z-10">ПРИНЯТЬ КОНТРАКТ</span>
              <div className="absolute inset-0 bg-emerald-500/20 w-0 group-hover:w-full transition-all duration-500" />
            </button>
            <button onClick={() => handleContractSign('reject')} className="w-full py-3 bg-zinc-900 border border-red-900/30 hover:bg-red-950 text-red-500 rounded-xl font-bold uppercase tracking-widest transition-all text-xs">
              Остаться слабым (Сдаться)
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (isPreStart) {
    const daysLeft = Math.ceil((new Date(APP_CONFIG.START_DATE) - new Date()) / (1000 * 60 * 60 * 24));
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-8 text-center">
        <Play size={80} className="text-emerald-600 mb-8 animate-pulse" />
        <h1 className="text-5xl md:text-7xl font-black text-white uppercase italic mb-4">THE DIVINE SHOW</h1>
        <p className="text-zinc-500 font-mono text-xl md:text-2xl uppercase tracking-[0.3em] mb-12">ПРОТОКОЛ АКТИВИРУЕТСЯ 4 МАЯ 2026</p>
        <div className="text-8xl font-black text-emerald-600 drop-shadow-[0_0_30px_emerald]">-{daysLeft}</div>
        <p className="mt-8 text-zinc-400 font-bold uppercase tracking-widest text-sm max-w-md">
          Готовься. Силы восстанавливаются. Ты сможешь протестировать День 1, закрыв это окно.
        </p>
        <button onClick={() => APP_CONFIG.START_DATE = new Date(Date.now() - 10000).toISOString()} className="mt-8 px-6 py-2 border border-zinc-800 text-zinc-600 text-xs rounded hover:bg-zinc-900">Force Start (Test)</button>
      </div>
    );
  }

  if (data.systemDestroyed) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-8 text-center">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <Bomb size={100} className="text-red-600 mx-auto mb-8 animate-bounce" />
          <h1 className="text-6xl font-black text-white uppercase italic mb-4">СИСТЕМА РАЗРУШЕНА</h1>
          <p className="text-red-500 font-mono text-xl max-w-lg mx-auto uppercase tracking-tighter mb-12">
            Твоя личность стерта. {APP_CONFIG.MAX_CRITICAL_FAILS} критических провалов.
          </p>
          <button onClick={() => setShowResetConfirm(true)} className="px-12 py-4 bg-red-600 text-white font-black uppercase rounded-full hover:bg-red-700 transition-all shadow-[0_0_30px_rgba(220,38,38,0.4)]">
            УМЕРЕТЬ И НАЧАТЬ ЗАНОВО
          </button>
        </motion.div>
        
        {showResetConfirm && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/95">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-[#050505] border-2 border-red-600 p-10 rounded-[3rem] max-w-sm text-center">
              <h3 className="text-3xl font-black text-white mb-6 italic uppercase tracking-tighter text-center">ПОСЛЕДНИЙ ШАГ</h3>
              <p className="text-red-400 mb-10 uppercase text-[10px] leading-relaxed tracking-[0.3em] font-bold">
                ВЕСЬ ПРОГРЕСС И АЧИВКИ БУДУТ УНИЧТОЖЕНЫ НАВСЕГДА. ТЫ СТАНЕШЬ НИКЕМ.
              </p>
              <div className="flex gap-4">
                <button onClick={() => setShowResetConfirm(false)} className="flex-1 py-4 bg-zinc-900 rounded-2xl font-bold uppercase text-[10px]">ОТМЕНА</button>
                <button onClick={() => { dispatchWithEffects({type:'DEATH_RESET'}); setShowResetConfirm(false); }} className="flex-1 py-4 bg-red-700 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg shadow-red-900/20">Я СОГЛАСЕН НА СМЕРТЬ</button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    );
  }

  const isEligibleForCP66 = CoreEngine.checkCheckpointEligibility(data.days);
  const isCP66Blocked = selectedDay?.day === APP_CONFIG.CHECKPOINT_DAY && !isEligibleForCP66;
  const prevDayIdx = selectedDay ? selectedDay.day - 2 : -1;
  const prevDayObj = prevDayIdx >= 0 ? data.days[prevDayIdx] : null;
  const isDebtUnpaid = prevDayObj ? (prevDayObj.isMissed && (!prevDayObj.diagnosticCategory || !prevDayObj.microFix) && (modalDebtFix.length < 5 || !modalDebtCategory)) : false;
  
  const evalLive = modalForm ? CoreEngine.evaluateDayRules(modalForm, new Date().getHours() >= 23, isDebtUnpaid, isSurvivalMode) : null;
  const isRestDay = selectedDay?.day % 7 === 0;

  const painText = isSurvivalMode 
    ? `РЕЖИМ ВЫЖИВАНИЯ. Откат оффера: ${stats.consecutiveFails * 3} дн. Возврат жира: +${stats.consecutiveFails * 200}г.`
    : `Слабость отдаляет оффер на 3 дня и возвращает жир.`;

  return (
    <div className={`min-h-screen text-gray-200 font-sans p-4 md:p-8 transition-colors duration-1000 ${egoRank.glow}`} style={{ backgroundColor: egoRank.bg }}>
      
      {showConfetti && <ConfettiOverlay />}
      {isSurvivalMode && <div className="fixed inset-0 pointer-events-none border-[10px] border-red-900/30 z-[900] animate-pulse" />}

      <header className="max-w-6xl mx-auto mb-8 relative z-10">
        {stats.streak > 14 && (
          <div className="w-full bg-violet-900/30 border border-violet-500/50 text-violet-300 text-[10px] uppercase font-black tracking-[0.3em] py-2 px-4 rounded-xl text-center mb-6 flex items-center justify-center gap-2">
            <BrainCircuit size={14} /> АУДИТ СИСТЕМЫ: АВТОПИЛОТ ОБНАРУЖЕН. ПОВЫСЬ ОСОЗНАННОСТЬ.
          </div>
        )}

        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/5 pb-6">
          <div>
            <h1 className="text-4xl font-black tracking-tighter text-white uppercase italic leading-none">
              120 Дней: <span className="text-emerald-500">The Divine Show</span>
            </h1>
            <div className="flex items-center gap-4 mt-3">
              <div className="flex items-center gap-2">
                <span className="text-zinc-500 font-mono text-xs uppercase tracking-widest">РАНГ ЭГО:</span>
                <span className={`font-black uppercase italic text-sm ${egoRank.color}`}>
                  {egoRank.title} (Ур.{egoRank.level})
                </span>
              </div>
              {isSurvivalMode && (
                <span className="bg-red-900 text-red-200 text-[10px] px-2 py-0.5 rounded uppercase font-black tracking-widest animate-pulse">
                  SURVIVAL MODE
                </span>
              )}
              {streakBroken && (
                <motion.span initial={{ x: -10, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="text-red-600 text-xs font-black uppercase animate-pulse">
                  СЛАБОСТЬ ЗАФИКСИРОВАНА
                </motion.span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full md:w-auto">
            <StatBox icon={<Flame size={16} className="text-emerald-500" />} label="СЕРИЯ УСПЕХОВ" value={stats.streak} />
            <StatBox icon={<Activity size={16} className="text-cyan-500" />} label="WIN RATE" value={`${stats.percent}%`} />
            <StatBox icon={<Ghost size={16} className="text-red-600" />} label="КРИТ. СБОИ" value={`${stats.criticalFails}/${APP_CONFIG.MAX_CRITICAL_FAILS}`} />
            <StatBox icon={<Scale size={16} className="text-orange-400" />} label="ТЕКУЩИЙ ВЕС" value={`${stats.currentWeight || '--'} кг`} />
          </div>
        </div>

        <div className="text-xs uppercase tracking-widest text-zinc-500 font-bold mb-6 italic border-l-2 border-emerald-900/50 pl-4">
          {DOMAIN_DATA.STATUS_TIPS[stats.streak < 3 ? "ХАОС" : stats.streak < 7 ? "БОРЬБА" : stats.streak < 20 ? "КОНТРОЛЬ" : "ДОМИНИРОВАНИЕ"]}
        </div>

        <div className="mt-6">
          <div className="flex flex-wrap gap-[2px] justify-between">
            {data.days.map((d, i) => {
              let bg = "bg-zinc-900";
              if (d.status === 'success') bg = d.quality === 'perfect' ? "bg-emerald-500" : d.quality === 'barely' ? "bg-emerald-800" : "bg-emerald-600";
              else if (d.status === 'weakness') bg = "bg-orange-600 shadow-[0_0_8px_rgba(234,88,12,0.4)]";
              else if (d.permanentFail) bg = "bg-red-950 border-2 border-red-600 shadow-[0_0_10px_red]";
              else if (d.status === 'fail') bg = "bg-zinc-950 border border-red-900/60";
              else if (i === currentDayIndex) bg = "bg-cyan-500 animate-pulse";
              
              return <div key={i} className={`h-2 flex-1 min-w-[4px] rounded-[1px] transition-all ${bg}`} title={`Day ${d.day} | ${d.status||'Empty'}`} />;
            })}
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-8 relative z-10">
        <aside className="lg:col-span-1 space-y-6">
          <div className="bg-zinc-950 border border-white/5 rounded-2xl p-5">
            <h3 className="flex items-center gap-2 text-xs font-black uppercase text-zinc-500 mb-2 tracking-widest">
              <TrendingDown size={14} /> ТРЕНД ВЕСА (7 ДН)
            </h3>
            <WeightChart days={data.days} />
          </div>

          <div className="bg-zinc-950 border border-white/5 rounded-2xl p-5">
            <h3 className="flex items-center gap-2 text-xs font-black uppercase text-zinc-500 mb-4 tracking-widest">
              <History size={14} /> История (7 дн)
            </h3>
            <div className="space-y-3 text-xs">
              {last7Days.map(d => (
                <div key={d.day} className="flex items-center justify-between border-b border-white/5 pb-2">
                  <div className="flex flex-col">
                    <span className="text-zinc-500 font-mono italic text-[10px]">ДЕНЬ {d.day}</span>
                    <span className="text-[8px] text-zinc-700 font-mono uppercase">{getDayDateString(d.day, data.startDate)}</span>
                  </div>
                  <div className="flex items-center gap-2 uppercase font-black">
                    <span className={
                      d.status === 'success' ? 'text-emerald-400' : 
                      d.status === 'weakness' ? 'text-orange-500' : 'text-red-900'
                    }>
                      {d.status === 'success' ? 'УСПЕХ' : d.status === 'weakness' ? 'СЛАБОСТЬ' : 'ПРОВАЛ'}
                    </span>
                  </div>
                </div>
              ))}
              {last7Days.length === 0 && <div className="text-zinc-600 text-[10px] uppercase">Пусто. Ожидание старта.</div>}
            </div>
          </div>

          <div className="bg-zinc-950 border border-white/5 rounded-2xl p-5">
            <h3 className="text-xs font-black uppercase text-zinc-500 mb-4 tracking-widest">Анализ Ошибок Поведения</h3>
            <div className="space-y-4">
              <ErrorTrack label="Срывы Питания" count={stats.nutritionFails} color="bg-red-600" />
              <ErrorTrack label="Срывы Обучения" count={stats.studyFails} color="bg-orange-600" />
            </div>
          </div>
        </aside>

        <main className="lg:col-span-3">
          <div className="grid grid-cols-5 md:grid-cols-10 gap-2">
            {data.days.map((day, idx) => {
              const isToday = idx === currentDayIndex;
              const isLocked = idx > currentDayIndex; 
              
              let colorClass = "bg-zinc-900 border-zinc-800 text-zinc-500"; 
              if (day.status === 'success') colorClass = day.quality === 'perfect' ? "bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]" : "bg-emerald-900/10 border-emerald-800 text-emerald-600";
              else if (day.status === 'weakness') colorClass = "bg-orange-950 border-orange-600 text-orange-500";
              else if (day.permanentFail) colorClass = "bg-black border-red-600 text-red-600 animate-pulse";
              else if (day.status === 'fail') colorClass = "bg-black border-red-900 text-red-900";
              else if (isToday) colorClass = "bg-cyan-900/20 border-cyan-500 text-cyan-400 border-dashed animate-pulse";
              else if (day.penaltyCount > 0) colorClass = "bg-yellow-950/20 border-yellow-700 text-yellow-600";

              return (
                <motion.button
                  key={day.day}
                  whileHover={!isLocked ? { scale: 1.05, y: -2, zIndex: 10 } : {}}
                  onClick={() => handleDayClick(day)}
                  disabled={isLocked}
                  className={`relative aspect-square flex flex-col items-center justify-center border-2 rounded-lg font-black transition-all ${colorClass} ${isLocked ? 'opacity-40 cursor-not-allowed bg-zinc-950' : 'cursor-pointer hover:border-zinc-500'}`}
                >
                  <span className="text-[12px] md:text-[14px] leading-none mb-1">{day.day}</span>
                  <span className="text-[8px] md:text-[9px] opacity-80 uppercase font-mono tracking-tighter">
                    {getDayDateString(day.day, data.startDate)}
                  </span>

                  {day.day % 7 === 0 && <span className="absolute bottom-1 w-2 h-0.5 bg-cyan-600 rounded-full" title="День Восстановления" />}
                  {day.late && <Clock size={10} className="absolute top-1 left-1 text-red-500" />}
                  {day.quality === 'perfect' && <Trophy size={10} className="absolute top-1 right-1 text-yellow-500" />}
                  {day.penaltyCount > 0 && !day.status && (
                    <div className="absolute top-1 right-1 flex gap-[2px]">
                      {Array.from({length: day.penaltyCount}).map((_, i) => <Zap key={i} size={8} className="text-yellow-500 fill-yellow-500" />)}
                    </div>
                  )}
                </motion.button>
              );
            })}
          </div>
        </main>
      </div>

      <footer className="max-w-6xl mx-auto mt-12 flex justify-end relative z-10">
        <button onClick={() => setShowResetConfirm(true)} className="text-[10px] uppercase font-mono text-zinc-800 hover:text-red-900 flex items-center gap-2 transition-all border border-transparent hover:border-red-900/50 px-3 py-1 rounded">
          <ZapOff size={12} /> УБИТЬ СЕБЯ (HARD RESET)
        </button>
      </footer>

      {/* Modal View */}
      <AnimatePresence>
        {selectedDay && modalForm && evalLive && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/95 backdrop-blur-xl" />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={shake ? { x: [-10, 10, -10, 10, 0], scale: 1, opacity: 1 } : { scale: 1, opacity: 1, x: 0 }} 
              exit={{ scale: 0.95, opacity: 0 }}
              className={`relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-[#0a0a0a] border-2 rounded-[2.5rem] p-8 md:p-10 shadow-2xl ${modalForm.penaltyCount > 0 && !selectedDay.status ? 'border-yellow-600/50 shadow-[0_0_30px_rgba(202,138,4,0.1)]' : 'border-white/5 shadow-white/5'} custom-scrollbar`}
            >
              <button onClick={() => setSelectedDay(null)} className="absolute top-6 right-6 text-zinc-600 hover:text-white transition-colors">
                <XCircle size={24} />
              </button>

              <div className="mb-8">
                <div className="flex items-center gap-4">
                  <h2 className="text-5xl font-black italic uppercase leading-none">ДЕНЬ {modalForm.day}</h2>
                  {evalLive.isLate && !selectedDay.status && <span className="bg-red-600 text-white text-[10px] px-2 py-1 rounded-full font-black animate-pulse">ПОЗДНО</span>}
                  {isRestDay && <span className="bg-cyan-900/50 border border-cyan-500 text-cyan-400 text-[10px] px-2 py-1 rounded-full font-black">ВОССТАНОВЛЕНИЕ</span>}
                </div>
                <div className="flex flex-col gap-2 mt-3">
                   <div className="flex items-center gap-2">
                     <div className="text-sm text-zinc-400 font-mono tracking-widest uppercase border border-white/10 px-2 py-0.5 rounded">
                       {getDayDateString(modalForm.day, data.startDate)}
                     </div>
                     <p className={`text-[10px] uppercase tracking-[0.3em] italic font-bold ${selectedDay.status ? 'text-zinc-500' : evalLive.status === 'success' ? 'text-emerald-500 animate-pulse' : evalLive.status === 'weakness' ? 'text-orange-500' : 'text-red-600'}`}>
                       {selectedDay.status 
                          ? `СТАТУС: ${selectedDay.status === 'success' ? 'ИДЕАЛ' : selectedDay.status === 'weakness' ? 'СЛАБОСТЬ' : 'ПРОВАЛ'}` 
                          : `ПРОГНОЗ: ${evalLive.status === 'success' ? 'УСПЕХ' : evalLive.status === 'weakness' ? 'СЛАБОСТЬ' : 'ПРОВАЛ'}`
                       }
                     </p>
                   </div>
                   {modalForm.identityFocus && (
                     <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest italic mt-2">
                       ФОКУС: {modalForm.identityFocus}
                     </div>
                   )}
                </div>
              </div>

              {isCP66Blocked && !selectedDay.status && (
                <div className="mb-6 p-4 bg-red-950/40 border border-red-600/50 rounded-2xl flex items-start gap-3 text-red-500">
                  <AlertTriangle className="shrink-0 mt-1" size={18} />
                  <div>
                    <div className="font-black text-xs uppercase tracking-widest">УСПЕХ ЗАБЛОКИРОВАН</div>
                    <div className="text-[10px] uppercase mt-1 opacity-80">Чекпойнт 66 требует исторический Win Rate ≥75% и исторический стрик ≥5. Система отклонит успех.</div>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {prevDayObj && prevDayObj.isMissed && (!prevDayObj.diagnosticCategory || !prevDayObj.microFix) && !selectedDay.status && (
                  <div className="p-5 bg-red-950/20 border border-red-900/50 rounded-2xl space-y-3">
                    <label className="block text-[10px] font-black uppercase text-red-500 tracking-widest">ДОЛГ ЗА ВЧЕРА (ДЕНЬ {prevDayObj.day}): ДИАГНОСТИКА СБОЯ</label>
                    <select 
                      value={modalDebtCategory} 
                      onChange={e => setModalDebtCategory(e.target.value)}
                      className="w-full bg-[#1a0000] border border-red-900/50 rounded-xl p-3 text-red-400 text-xs outline-none"
                    >
                      <option value="" disabled>Выбери причину сбоя ЦНС/системы...</option>
                      {DOMAIN_DATA.DIAGNOSTIC_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <textarea
                      value={modalDebtFix}
                      onChange={(e) => setModalDebtFix(e.target.value)}
                      className="w-full bg-[#1a0000] border border-red-900/50 rounded-xl p-3 text-sm text-red-200 outline-none h-16 resize-none"
                      placeholder="Микро-фикс на сегодня (Мин. 5 симв)..."
                    />
                  </div>
                )}

                {/* Легкая Добыча - Micro Wins */}
                {!selectedDay.status && (
                  <div className="flex items-center justify-between p-4 bg-emerald-950/10 border border-emerald-900/30 rounded-2xl">
                    <div>
                      <div className="font-black text-emerald-600 text-[10px] uppercase tracking-widest mb-1 flex items-center gap-1"><Droplets size={10}/> ЛЁГКАЯ ДОБЫЧА</div>
                      <div className="text-emerald-400 text-xs font-bold">{DOMAIN_DATA.MICRO_WINS[modalForm.day % DOMAIN_DATA.MICRO_WINS.length]}</div>
                    </div>
                  </div>
                )}

                {!selectedDay.status && !isRestDay && (
                  <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl text-xs">
                    <div className="font-black text-zinc-500 uppercase tracking-widest mb-2">Вызов на сегодня:</div>
                    <div className="text-cyan-400 font-bold">{DOMAIN_DATA.CHALLENGES[modalForm.day % DOMAIN_DATA.CHALLENGES.length]}</div>
                  </div>
                )}

                <WeightTracker weight={modalForm.weight} setWeight={(v) => setModalForm(p => ({...p, weight: v}))} disabled={!!selectedDay.status} />

                <TaskItem label="ПИТАНИЕ (РЕЖИМ)" checked={modalForm.nutrition} disabled={!!selectedDay.status} onChange={(v) => setModalForm(p => ({...p, nutrition: v}))} />
                
                <TaskItem 
                  label={isRestDay ? "ПРОТОКОЛ ВОССТАНОВЛЕНИЯ (ПЛАН/ОТДЫХ)" : "ОБУЧЕНИЕ (1С / РАЗРАБОТКА)"} 
                  checked={modalForm.study} 
                  disabled={!!selectedDay.status} 
                  onChange={(v) => setModalForm(p => ({...p, study: v}))} 
                  isRest={isRestDay}
                />
                
                {modalForm.penaltyCount > 0 && (
                  <div className="p-4 border border-yellow-700/50 bg-yellow-950/10 rounded-xl space-y-3">
                    <div className="text-[10px] font-black text-yellow-500 uppercase tracking-widest flex items-center gap-2">
                       <AlertCircle size={14}/> ВНИМАНИЕ: АКТИВНЫЙ ДОЛГ ({modalForm.penaltyCount}) {isSurvivalMode && '- РЕЖИМ ВЫЖИВАНИЯ'}
                    </div>
                    {modalForm.penaltyCount >= 1 && <TaskItem label="ШТРАФНАЯ АКТИВНОСТЬ 01" checked={modalForm.extraTask1} disabled={!!selectedDay.status} onChange={(v) => setModalForm(p => ({...p, extraTask1: v}))} isExtra />}
                    {modalForm.penaltyCount >= 2 && <TaskItem label="ШТРАФНАЯ АКТИВНОСТЬ 02" checked={modalForm.extraTask2} disabled={!!selectedDay.status} onChange={(v) => setModalForm(p => ({...p, extraTask2: v}))} isExtra />}
                  </div>
                )}

                <div className="pt-2">
                  <label className="block text-[10px] font-black uppercase text-zinc-700 mb-2 tracking-widest flex items-center gap-2 italic">
                    <Target size={12} className="text-cyan-500" /> <span>ШАГ К ОФФЕРУ (МИН. 10 СИМВ.)</span>
                  </label>
                  <textarea
                    value={modalForm.offerAction || ""}
                    disabled={!!selectedDay.status}
                    onChange={(e) => setModalForm(p => ({...p, offerAction: e.target.value}))}
                    className="w-full bg-black border border-white/5 rounded-xl p-4 text-white focus:border-cyan-500 outline-none transition-all h-16 resize-none shadow-inner text-sm"
                    placeholder="Что ты сделал сегодня ради 500к/мес?"
                  />
                </div>

                <div className="pt-2">
                  <label className="block text-[10px] font-black uppercase text-zinc-700 mb-2 tracking-widest flex justify-between italic">
                    <span>ИТОГ ДНЯ (МИН. {modalForm.penaltyCount > 0 ? '20' : '10'} СИМВ.)</span>
                    <span className={(modalForm.winText||"").length >= (modalForm.penaltyCount > 0 ? 20 : 10) ? 'text-emerald-500' : 'text-zinc-600'}>{(modalForm.winText||"").length}</span>
                  </label>
                  <textarea
                    value={modalForm.winText}
                    disabled={!!selectedDay.status}
                    onChange={(e) => setModalForm(p => ({...p, winText: e.target.value}))}
                    className="w-full bg-black border border-white/5 rounded-xl p-4 text-white focus:border-emerald-600 outline-none transition-all h-24 resize-none shadow-inner text-sm"
                    placeholder={selectedDay.status ? modalForm.winText : "Что конкретно сделало тебя сильнее сегодня?"}
                  />
                </div>

                {!selectedDay.status && (evalLive.status === 'fail' || evalLive.status === 'weakness') && (
                   <div className="pt-4 border-t border-red-900/30 space-y-3">
                     <label className="block text-[10px] font-black uppercase text-red-500 tracking-widest italic">
                       ДИАГНОСТИКА СБОЯ ЗА СЕГОДНЯ
                     </label>
                     <select 
                       value={modalForm.diagnosticCategory || ""} 
                       onChange={e => setModalForm(p => ({...p, diagnosticCategory: e.target.value}))}
                       className="w-full bg-[#1a0000] border border-red-900/50 rounded-xl p-3 text-red-400 text-xs outline-none"
                     >
                       <option value="" disabled>Выбери причину системного сбоя...</option>
                       {DOMAIN_DATA.DIAGNOSTIC_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                     </select>
                     <textarea
                       value={modalForm.microFix || ""}
                       onChange={(e) => setModalForm(p => ({...p, microFix: e.target.value}))}
                       className="w-full bg-[#1a0000] border border-red-900/50 rounded-xl p-4 text-red-400 focus:border-red-600 outline-none transition-all h-16 resize-none shadow-inner text-sm"
                       placeholder="Микро-фикс на завтра (Мин. 5 симв)..."
                     />
                     <div className="text-[10px] text-red-600 mt-2 italic text-center font-bold">
                       {painText}
                     </div>
                   </div>
                )}

              </div>

              {!selectedDay.status && (
                <div className="mt-8">
                  {evalLive.status === 'success' && !isCP66Blocked && !isDebtUnpaid && (
                     <div className="mb-4 p-3 bg-red-950/20 border border-red-900/40 rounded-xl text-red-500 text-[10px] uppercase font-black tracking-widest text-center animate-pulse">
                       {randomPainTrigger}
                     </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => executeDayClosure('fail')}
                      disabled={!evalLive.isValidForFail || (isDebtUnpaid && (modalDebtFix.length < 5 || !modalDebtCategory))}
                      className={`py-4 rounded-xl font-black uppercase tracking-widest transition-all ${
                        evalLive.isValidForFail && (!isDebtUnpaid || (modalDebtFix.length >= 5 && modalDebtCategory))
                        ? 'bg-zinc-900 text-red-500 border border-red-900/30 hover:bg-red-950/40' 
                        : 'bg-black text-zinc-800 border border-white/5 cursor-not-allowed'
                      }`}
                    >
                      Провал
                    </button>

                    <button
                      onClick={() => executeDayClosure('success')}
                      disabled={isCP66Blocked || !evalLive.isValidForSuccess || isDebtUnpaid}
                      className={`py-4 rounded-xl font-black uppercase tracking-widest transition-all ${
                        (!isCP66Blocked && evalLive.isValidForSuccess && !isDebtUnpaid)
                        ? 'bg-emerald-700 text-white shadow-lg shadow-emerald-900/20 hover:bg-emerald-600' 
                        : 'bg-zinc-950 text-zinc-800 cursor-not-allowed'}
                      `}
                    >
                      Успех
                    </button>
                  </div>
                </div>
              )}

              {selectedDay.status && (
                <div className={`mt-8 p-4 border rounded-xl flex items-center justify-center gap-3 font-black uppercase italic text-xs tracking-widest ${
                  selectedDay.status === 'success' ? 'border-emerald-500/20 text-emerald-500 bg-emerald-500/5' : 
                  selectedDay.status === 'weakness' ? 'border-orange-500/20 text-orange-500 bg-orange-500/5' : 
                  'border-red-900/30 text-red-900 bg-red-950/5'
                }`}>
                  <ShieldCheck size={18} /> ДЕНЬ ЗАФИКСИРОВАН
                </div>
              )}
            </motion.div>
          </div>
        )}

        {/* Achievement Modal */}
        {unlockedAchievement && (
           <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setUnlockedAchievement(null)}>
              <motion.div initial={{ scale: 0.5, y: 50, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }} 
                className="bg-[#050505] border-2 border-emerald-500 p-8 rounded-[2rem] text-center shadow-[0_0_50px_rgba(16,185,129,0.2)] max-w-sm">
                 <Trophy size={80} className="text-emerald-500 mx-auto mb-6 drop-shadow-[0_0_20px_emerald]" />
                 <h3 className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em] mb-2">Достижение разблокировано</h3>
                 <h2 className="text-3xl font-black text-white italic uppercase mb-3">{unlockedAchievement.title}</h2>
                 <p className="text-zinc-400 text-xs uppercase tracking-widest leading-relaxed">{unlockedAchievement.desc}</p>
                 <button onClick={() => setUnlockedAchievement(null)} className="mt-8 px-8 py-3 bg-emerald-600 text-white font-black uppercase rounded-full text-xs hover:bg-emerald-500">
                   Продолжить путь
                 </button>
              </motion.div>
           </div>
        )}

        {/* Checkpoint Alert */}
        {checkpointAlert && (
           <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/98 backdrop-blur-3xl">
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center max-w-xl">
                  {checkpointAlert === 'guilty' ? <Skull size={100} className="text-red-600 mx-auto mb-8 drop-shadow-[0_0_30px_red]" /> : 
                   checkpointAlert.includes('fail') ? <XCircle size={100} className="text-red-600 mx-auto mb-8 drop-shadow-[0_0_30px_red]" /> : 
                   <Trophy size={100} className="text-emerald-500 mx-auto mb-8 drop-shadow-[0_0_30px_emerald]" />}
                  
                  <h2 className="text-6xl font-black text-white uppercase italic mb-6">
                    {checkpointAlert === 'guilty' ? 'ПРИГОВОР: ВИНОВЕН' : 
                     checkpointAlert === 'failFinal' ? 'КРАХ МИССИИ' : 
                     checkpointAlert === 'successFinal' ? 'БОЖЕСТВО' : 
                     checkpointAlert === 'fail' ? 'ЧЕКПОЙНТ ПРОВАЛЕН' : 'ЧЕКПОЙНТ ПРОЙДЕН'}
                  </h2>
                  <p className="text-zinc-500 font-mono text-lg mb-12 uppercase tracking-tighter">
                    {checkpointAlert === 'guilty' ? 'Ты не достоин успеха. Суд Божественного Шоу отклонил твою апелляцию. Страдай дальше.' :
                     checkpointAlert.includes('fail') ? 'Твои стандарты оказались недостаточно высоки (или вес > 65кг). Система отвергла твой прогресс.' : 
                     'Твоя дисциплина — это искусство. Ты достоин продолжать.'}
                  </p>
                  <button onClick={() => setCheckpointAlert(null)} className="px-12 py-4 bg-white text-black font-black uppercase rounded-full hover:bg-gray-200">
                    ПРИНЯТЬ РЕАЛЬНОСТЬ
                  </button>
              </motion.div>
           </div>
        )}

        {/* Подтверждение сброса */}
        {showResetConfirm && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/95">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-[#050505] border-2 border-red-900 p-10 rounded-[3rem] max-w-sm text-center shadow-[0_0_50px_rgba(220,38,38,0.2)]">
              <h3 className="text-3xl font-black text-red-600 mb-6 italic uppercase tracking-tighter text-center">СМЕРТЬ</h3>
              <p className="text-zinc-500 mb-10 uppercase text-[10px] leading-relaxed tracking-[0.2em] font-bold">
                Твой ранг, ачивки и прогресс будут стерты. Ты снова станешь никем. Начать заново с нуля?
              </p>
              <div className="flex gap-4">
                <button onClick={() => setShowResetConfirm(false)} className="flex-1 py-4 bg-zinc-900 rounded-2xl font-bold uppercase text-[10px]">ЖИТЬ</button>
                <button onClick={() => { dispatchWithEffects({type:'DEATH_RESET'}); setShowResetConfirm(false); }} className="flex-1 py-4 bg-red-900 text-white rounded-2xl font-black uppercase text-[10px] hover:bg-red-800 transition-colors">УМЕРЕТЬ</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
      `}} />
    </div>
  );
}

// ==========================================
// [6. UI HELPERS & COMPONENTS]
// ==========================================
function WeightChart({ days }) {
  const weightDays = days.filter(d => d.weight && d.status !== null).slice(-7);
  
  if (weightDays.length < 2) {
    return <div className="text-[10px] text-zinc-600 font-mono uppercase italic">Недостаточно данных для графика...</div>;
  }

  const weights = weightDays.map(d => parseFloat(d.weight));
  const minWeight = Math.min(...weights);
  const maxWeight = Math.max(...weights);
  
  return (
    <div className="flex items-end gap-2 h-16 mt-4">
      {weightDays.map(d => {
         const w = parseFloat(d.weight);
         const hPercent = maxWeight === minWeight ? 50 : ((w - minWeight) / (maxWeight - minWeight)) * 100;
         return (
           <div key={d.day} className="flex-1 bg-black rounded-t-sm flex flex-col justify-end group relative" title={`${w} кг`}>
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[8px] text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity font-black">{w}</div>
              <div className="bg-emerald-600 hover:bg-emerald-500 w-full rounded-t-sm transition-all" style={{ height: `${Math.max(10, hPercent)}%` }}></div>
              <div className="text-[7px] text-center mt-1 text-zinc-600 font-mono">{d.day}</div>
           </div>
         )
      })}
    </div>
  );
}

function WeightTracker({ weight, setWeight, disabled }) {
  const percent = Math.max(0, Math.min(100, (APP_CONFIG.WEIGHT_START - parseFloat(weight || APP_CONFIG.WEIGHT_START)) / (APP_CONFIG.WEIGHT_START - APP_CONFIG.WEIGHT_TARGET) * 100));
  
  return (
    <div className="bg-black p-4 rounded-xl border border-white/5">
      <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 mb-1 block">ВЕС (КГ) – ЦЕЛЬ {APP_CONFIG.WEIGHT_TARGET}</label>
      <input 
        type="number" step="0.1" 
        value={weight || ""} 
        onChange={e => setWeight(e.target.value)}
        disabled={disabled}
        placeholder="80.0"
        className="w-full bg-zinc-900 text-emerald-400 text-2xl font-black p-3 rounded-lg outline-none focus:border-emerald-500 border border-transparent transition-all" 
      />
      <div className="h-2 bg-zinc-900 mt-3 rounded-full overflow-hidden">
        <div className="bg-emerald-500 h-full transition-all duration-1000" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function StatBox({ icon, label, value }) {
  return (
    <div className="bg-zinc-950/40 border border-white/5 p-4 rounded-2xl flex flex-col items-center justify-center min-w-[80px]">
      <div className="mb-1 opacity-50">{icon}</div>
      <div className="text-xl font-black text-white italic leading-none">{value}</div>
      <div className="text-[7px] uppercase text-zinc-600 font-mono tracking-[0.2em] mt-1">{label}</div>
    </div>
  );
}

function ErrorTrack({ label, count, color }) {
  return (
    <div>
      <div className="flex justify-between text-[10px] uppercase mb-1 font-bold">
        <span>{label}</span>
        <span className="text-red-500">{count} СБОЕВ</span>
      </div>
      <div className="h-1 bg-zinc-900 rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all duration-1000`} style={{ width: `${Math.min(100, count * 10)}%` }} />
      </div>
    </div>
  );
}

function TaskItem({ label, checked, onChange, disabled, isExtra = false, isRest = false }) {
  return (
    <button
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all ${checked 
          ? (isExtra ? 'bg-yellow-950/10 border-yellow-700/50 text-yellow-500' : isRest ? 'bg-cyan-950/20 border-cyan-800/50 text-cyan-500' : 'bg-emerald-950/20 border-emerald-800/50 text-emerald-500') 
          : 'bg-black border-white/5 text-zinc-700 hover:border-white/10'} ${disabled ? 'cursor-default' : 'cursor-pointer'}`}
    >
      <span className="font-black text-xs uppercase italic tracking-widest">{label}</span>
      {checked ? <CheckCircle2 size={18} /> : <div className="w-5 h-5 rounded-full border-2 border-current opacity-10" />}
    </button>
  );
}

function ConfettiOverlay() {
  const particles = Array.from({ length: 50 });
  return (
    <div className="fixed inset-0 pointer-events-none z-[200] overflow-hidden">
      {particles.map((_, i) => (
        <motion.div
          key={i}
          initial={{ 
            x: '50vw', y: '100vh', 
            scale: 0, 
            opacity: 1, 
            backgroundColor: ['#10b981', '#fbbf24', '#06b6d4'][i % 3] 
          }}
          animate={{
            x: `${Math.random() * 100}vw`,
            y: `${Math.random() * 100}vh`,
            scale: Math.random() * 1.5 + 0.5,
            opacity: 0,
            rotate: Math.random() * 360
          }}
          transition={{ duration: 2 + Math.random(), ease: "easeOut" }}
          className="absolute w-3 h-3 rounded-sm"
        />
      ))}
    </div>
  );
}
