import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { User } from "firebase/auth";
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from "firebase/auth";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  Check,
  ChevronRight,
  CircleHelp,
  Coins,
  Download,
  Edit3,
  Heart,
  Home,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  Upload,
  Wallet,
  X,
} from "lucide-react";
import { auth, googleProvider } from "../firebase";
import {
  clearDemo,
  initializeUser,
  removeItem,
  resolveWish,
  saveItem,
  saveProfile,
  seedDemo,
  uid,
  uploadImage,
  useData,
} from "./store";
import {
  accountBalance,
  categorySum,
  clamp,
  debtBalance,
  debtClosedDate,
  debtGoalScenario,
  effectiveTransactions,
  forecast,
  goalSaved,
  lifeMinimum,
  localDay,
  milestoneDate,
  monthKey,
  monthlyTotals,
  monthSeries,
  netWorth,
  percent,
  projectedDebt,
  rub,
  recurringAmount,
  recurringForMonth,
  reportMonth,
  reviseRecurring,
  savingsPace,
  shiftMonthKey,
  today,
  totals,
  txTax,
  wealthSeries,
} from "./finance";
import type { Data, Goal, Recurring, Transaction, TxType, Wish } from "./types";
import dreamHouse from "./dream-house.webp";

type Page =
  | "dashboard"
  | "transactions"
  | "monthly"
  | "goals"
  | "analytics"
  | "debts"
  | "wishes"
  | "settings";
type EditorKind =
  | "transaction"
  | "goal"
  | "debt"
  | "wish"
  | "account"
  | "category"
  | "recurring"
  | "asset"
  | "accelerator";
type Editor = {
  kind: EditorKind;
  item?: any;
  preset?: Record<string, unknown>;
};
const nav: { id: Page; label: string; icon: typeof Home }[] = [
  { id: "dashboard", label: "Штаб", icon: LayoutDashboard },
  { id: "transactions", label: "Операции", icon: ArrowDownLeft },
  { id: "monthly", label: "Месячный план", icon: RefreshCw },
  { id: "goals", label: "Цели", icon: Target },
  { id: "analytics", label: "Аналитика", icon: BarChart3 },
  { id: "debts", label: "Долги", icon: Landmark },
  { id: "wishes", label: "Хочу купить", icon: Heart },
  { id: "settings", label: "Настройки", icon: Settings2 },
];
const txNames: Record<TxType, string> = {
  income: "Доход",
  expense: "Расход",
  transfer: "Перевод",
  tax: "Налог",
  saving: "В цель",
  debt_payment: "Платёж по долгу",
};
const txIcons: Record<TxType, typeof Home> = {
  income: ArrowDownLeft,
  expense: ArrowUpRight,
  transfer: RefreshCw,
  tax: Coins,
  saving: Target,
  debt_payment: Landmark,
};
const fmtDate = (v?: string) =>
  v
    ? new Date(v + "T12:00:00").toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "—";
const fmtMonth = (v: Date) =>
  v.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
const num = (v: string | number) => Math.max(0, Number(v) || 0);
const shiftMonth = (key: string, offset: number) => {
  const [year, month] = key.split("-").map(Number);
  return localDay(new Date(year, month - 1 + offset, 1)).slice(0, 7);
};
const monthLabel = (key: string) =>
  new Date(key + "-01T12:00:00")
    .toLocaleDateString("ru-RU", {
      month: "long",
      year: "numeric",
    })
    .replace(/\s*г\.$/, "");

function Button({
  children,
  onClick,
  variant = "solid",
  icon: Icon,
  type = "button",
  disabled,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "solid" | "soft" | "ghost" | "danger";
  icon?: typeof Home;
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`button button-${variant} ${className}`}
    >
      {Icon && <Icon size={17} strokeWidth={2} />}
      {children}
    </button>
  );
}
function IconButton({
  icon: Icon,
  onClick,
  label,
  danger = false,
}: {
  icon: typeof Home;
  onClick: () => void;
  label: string;
  danger?: boolean;
}) {
  return (
    <button
      className={`icon-button ${danger ? "danger" : ""}`}
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      <Icon size={17} />
    </button>
  );
}
function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`card ${className}`}>{children}</div>;
}
function Stat({
  label,
  value,
  sub,
  icon: Icon,
  tone = "",
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: typeof Home;
  tone?: string;
}) {
  return (
    <Card className={`stat-card ${tone}`}>
      <div className="stat-label">
        {Icon && <Icon size={17} />}
        {label}
      </div>
      <strong>{value}</strong>
      {sub && <small>{sub}</small>}
    </Card>
  );
}
function Empty({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-mark">
        <Sparkles size={24} />
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
function SectionTitle({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-title">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  );
}
function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`input ${props.className || ""}`} />;
}
function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={`input ${props.className || ""}`}>
      {props.children}
    </select>
  );
}
function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`input ${props.className || ""}`} />;
}
function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`modal ${wide ? "modal-wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <IconButton icon={X} label="Закрыть" onClick={onClose} />
        </div>
        {children}
      </div>
    </div>
  );
}

function Login({ onError }: { onError: (s: string) => void }) {
  const login = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e: any) {
      if (
        [
          "auth/popup-blocked",
          "auth/operation-not-supported-in-this-environment",
        ].includes(e.code)
      )
        await signInWithRedirect(auth, googleProvider);
      else onError(e.message || "Не удалось войти");
    }
  };
  return (
    <div className="login-screen">
      <div className="login-shell">
        <div className="brand large">
          <div className="brand-logo">
            K<span>•</span>
          </div>
          <div>
            КАПИТАЛ<small>личный финансовый штаб</small>
          </div>
        </div>
        <span className="eyebrow">ОТ ПЛАНА К РЕАЛЬНОСТИ</span>
        <h1>
          Большая цель
          <br />
          <em>начинается здесь.</em>
        </h1>
        <p>
          Доходы, накопления и решения — в одном спокойном пространстве.
          Смотрите, как каждый шаг приближает то, ради чего вы работаете.
        </p>
        <Button onClick={login} icon={ArrowRight}>
          Войти через Google
        </Button>
        <div className="login-trust">
          <ShieldCheck size={16} /> Ваши данные доступны только вашему аккаунту
        </div>
      </div>
      <div className="login-visual">
        <div className="login-visual-image" />
        <div className="login-visual-caption">
          <span>МОЯ ЦЕЛЬ</span>
          <strong>Дом, в который хочется возвращаться.</strong>
          <p>Каждый рубль делает его ближе.</p>
        </div>
      </div>
    </div>
  );
}

function Onboarding({
  user,
  onError,
}: {
  user: User;
  onError: (s: string) => void;
}) {
  const [cash, setCash] = useState(0),
    [goal, setGoal] = useState("Дом"),
    [target, setTarget] = useState(5000000),
    [income, setIncome] = useState(0),
    [expenses, setExpenses] = useState(0),
    [hasTax, setHasTax] = useState(false),
    [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await initializeUser(user, {
        cash,
        goal,
        target,
        income,
        expenses,
        hasTax,
      });
    } catch (err: any) {
      onError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="onboarding">
      <div className="onboarding-card">
        <div className="brand">
          <div className="brand-logo">
            K<span>•</span>
          </div>
          <div>
            КАПИТАЛ<small>начнём с главного</small>
          </div>
        </div>
        <span className="eyebrow">ПЕРВЫЙ ШАГ · МЕНЬШЕ МИНУТЫ</span>
        <h1>Настроим ваш маршрут.</h1>
        <p>
          Это стартовые ориентиры. Все суммы и цели можно менять в любой момент.
        </p>
        <form onSubmit={submit} className="form-grid">
          <Field label="Сколько денег у вас сейчас?">
            <TextInput
              type="number"
              min="0"
              value={cash}
              onChange={(e) => setCash(num(e.target.value))}
            />
          </Field>
          <Field label="Главная цель">
            <TextInput
              value={goal}
              required
              onChange={(e) => setGoal(e.target.value)}
            />
          </Field>
          <Field label="Стоимость цели">
            <TextInput
              type="number"
              min="1"
              required
              value={target}
              onChange={(e) => setTarget(num(e.target.value))}
            />
          </Field>
          <Field label="Средний доход в месяц">
            <TextInput
              type="number"
              min="0"
              value={income}
              onChange={(e) => setIncome(num(e.target.value))}
            />
          </Field>
          <Field label="Обязательные расходы в месяц">
            <TextInput
              type="number"
              min="0"
              value={expenses}
              onChange={(e) => setExpenses(num(e.target.value))}
            />
          </Field>
          <Field label="Есть доходы с налогом самозанятого?">
            <Select
              value={hasTax ? "yes" : "no"}
              onChange={(e) => setHasTax(e.target.value === "yes")}
            >
              <option value="no">Нет или пока не знаю</option>
              <option value="yes">Да, ставка по умолчанию 4%</option>
            </Select>
          </Field>
          <Button
            type="submit"
            disabled={busy}
            icon={ArrowRight}
            className="form-full"
          >
            {busy ? "Сохраняем…" : "Открыть мой штаб"}
          </Button>
        </form>
      </div>
    </div>
  );
}

function DreamHero({
  data,
  goal,
  onOpen,
  onSimulate,
  compact = false,
}: {
  data: Data;
  goal: Goal;
  onOpen: () => void;
  onSimulate: () => void;
  compact?: boolean;
}) {
  const saved = goalSaved(goal, data.transactions),
    progress = clamp(saved / goal.target),
    pace = savingsPace(data),
    predicted = forecast(goal, saved, pace);
  const next = goal.milestones
    .slice()
    .sort((a, b) => a.amount - b.amount)
    .find((m) => m.amount > saved);
  return (
    <div
      className={`dream-hero ${compact ? "dream-hero-compact" : ""}`}
      style={
        {
          "--dream-progress": progress,
          backgroundImage: `linear-gradient(90deg, rgba(10,20,17,.90) 0%, rgba(10,20,17,.54) 48%, rgba(10,20,17,.1) 100%), url("${goal.imageUrl || dreamHouse}")`,
        } as React.CSSProperties
      }
    >
      <div className="dream-wash" />
      <div className="dream-inner">
        <span className="hero-label">
          <Sparkles size={14} /> ВИТРИНА МЕЧТЫ · ГЛАВНАЯ ЦЕЛЬ
        </span>
        <h1>{goal.name}</h1>
        <p>Вы уже в пути. Каждый шаг имеет значение.</p>
        <div className="dream-number">
          <strong>{rub(saved)}</strong>
          <span>из {rub(goal.target)}</span>
        </div>
        <div className="dream-progress-track">
          <div style={{ width: `${progress * 100}%` }} />
        </div>
        <div className="dream-meta">
          <strong>{percent(progress * 100)} пути</strong>
          <span>Осталось {rub(Math.max(0, goal.target - saved))}</span>
        </div>
        <div className="dream-next">
          <div className="next-icon">
            <Target size={18} />
          </div>
          <div>
            <small>СЛЕДУЮЩАЯ ТОЧКА</small>
            <strong>{next ? rub(next.amount) : "Цель достигнута"}</strong>
            <span>
              {next
                ? `Осталось ${rub(next.amount - saved)}${pace > 0 ? ` · примерно ${Math.ceil(((next.amount - saved) / pace) * 30)} дней` : ""}`
                : "Вы прошли весь путь"}
            </span>
          </div>
        </div>
        <div className="dream-actions">
          <Button onClick={onOpen} variant="soft" icon={Heart}>
            Открыть цель
          </Button>
          <button className="text-button light" onClick={onSimulate}>
            Как быстрее? <ArrowRight size={16} />
          </button>
        </div>
      </div>
      <div className="dream-date">
        {predicted ? (
          <>
            Ориентир · <strong>{fmtMonth(predicted.date)}</strong>
          </>
        ) : pace > 0 ? (
          "При текущем темпе — более 30 лет"
        ) : (
          "Добавьте накопления для прогноза"
        )}
      </div>
    </div>
  );
}

function GoalRoute({
  data,
  goal,
  user,
  notify,
  fail,
}: {
  data: Data;
  goal: Goal;
  user: User;
  notify: (s: string) => void;
  fail: (s: string) => void;
}) {
  const date = new Date(today() + "T12:00:00");
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  const week = localDay(date);
  const steps = goal.weeklySteps || [];
  const currentStep = steps.find((s) => s.week === week);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const saved = goalSaved(goal, data.transactions);
  const next = goal.milestones
    .slice()
    .sort((a, b) => a.amount - b.amount)
    .find((m) => m.amount > saved);
  const thisWeek = data.transactions
    .filter(
      (t) => t.type === "saving" && t.goalId === goal.id && t.date >= week,
    )
    .reduce((sum, t) => sum + t.amount, 0);
  const history = steps
    .filter((s) => s.doneAt)
    .sort((a, b) => (b.doneAt || "").localeCompare(a.doneAt || ""))
    .slice(0, 3);
  const reached = goal.milestones
    .filter((m) => m.amount <= saved)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3);
  const saveStep = async () => {
    const title = draft.trim();
    if (!title) return;
    setBusy(true);
    try {
      await saveItem(user, "goals", {
        ...goal,
        weeklySteps: currentStep
          ? steps.map((s) => (s.id === currentStep.id ? { ...s, title } : s))
          : [...steps, { id: uid(), title, week }],
      });
      setEditing(false);
      setDraft("");
      notify("Шаг на неделю сохранён");
    } catch (e: any) {
      fail(e.message || "Не удалось сохранить шаг");
    } finally {
      setBusy(false);
    }
  };
  const toggleStep = async () => {
    if (!currentStep) return;
    setBusy(true);
    try {
      await saveItem(user, "goals", {
        ...goal,
        weeklySteps: steps.map((s) =>
          s.id === currentStep.id
            ? { ...s, doneAt: s.doneAt ? "" : new Date().toISOString() }
            : s,
        ),
      });
      notify(
        currentStep.doneAt
          ? "Шаг снова в работе"
          : "Шаг выполнен. Вы ближе к цели!",
      );
    } catch (e: any) {
      fail(e.message || "Не удалось обновить шаг");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className="goal-route">
      <SectionTitle eyebrow="МАРШРУТ К МЕЧТЕ" title="Один шаг на этой неделе" />
      <div className="route-metrics">
        <div>
          <small>Уже выделено</small>
          <strong>{rub(saved)}</strong>
        </div>
        <div>
          <small>Ближайший этап</small>
          <strong>
            {next ? rub(next.amount - saved) + " осталось" : "Достигнут"}
          </strong>
        </div>
        <div>
          <small>На этой неделе</small>
          <strong>+{rub(thisWeek)}</strong>
        </div>
      </div>
      <div className="route-step">
        {currentStep && !editing ? (
          <>
            <span className={currentStep.doneAt ? "route-done" : ""}>
              <strong>{currentStep.title}</strong>
              <small>
                {currentStep.doneAt
                  ? "Сделано — отличная работа"
                  : "Ваш выбранный шаг"}
              </small>
            </span>
            <div className="route-actions">
              <Button
                variant="soft"
                onClick={toggleStep}
                disabled={busy}
                icon={Check}
              >
                {currentStep.doneAt ? "Вернуть" : "Сделано"}
              </Button>
              {!currentStep.doneAt && (
                <IconButton
                  icon={Edit3}
                  label="Изменить шаг"
                  onClick={() => {
                    setDraft(currentStep.title);
                    setEditing(true);
                  }}
                />
              )}
            </div>
          </>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void saveStep();
            }}
          >
            <TextInput
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={120}
              placeholder="Например, сверить расходы и отложить 2 000 ₽"
              aria-label="Ваш шаг на неделю"
            />
            <Button type="submit" disabled={busy || !draft.trim()} icon={Plus}>
              Сохранить шаг
            </Button>
          </form>
        )}
      </div>
      {history.length > 0 && (
        <div className="route-history">
          <small>Уже получилось</small>
          {history.map((s) => (
            <span key={s.id}>
              <Check size={14} /> {s.title}
            </span>
          ))}
        </div>
      )}
      {reached.length > 0 && (
        <div className="route-history">
          <small>Достигнутые этапы</small>
          {reached.map((m) => (
            <span key={m.id}>
              <Target size={14} /> {rub(m.amount)} ·{" "}
              {fmtDate(
                milestoneDate(goal, m.amount, data.transactions) || undefined,
              )}
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}

function Dashboard({
  data,
  user,
  notify,
  fail,
  setPage,
  open,
  setFullGoal,
}: {
  data: Data;
  user: User;
  notify: (s: string) => void;
  fail: (s: string) => void;
  setPage: (p: Page) => void;
  open: (e: Editor) => void;
  setFullGoal: (g: Goal) => void;
}) {
  const [onlyActual, setOnlyActual] = useState(false);
  const shownTransactions = onlyActual
    ? data.transactions.filter((t) => !t.planned)
    : data.transactions;
  const main = data.goals.find((g) => g.primary) || data.goals[0],
    current = monthlyTotals(shownTransactions, monthKey(today())),
    previous = monthlyTotals(
      shownTransactions,
      localDay(
        new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1),
      ).slice(0, 7),
    ),
    wealth = netWorth(data);
  const pending = data.debts
    .filter((d) => debtBalance(d, data.transactions) > 0 && d.nextPaymentDate)
    .sort((a, b) =>
      (a.nextPaymentDate || "").localeCompare(b.nextPaymentDate || ""),
    )
    .slice(0, 2);
  const largest = categorySum(
    shownTransactions.filter((t) => monthKey(t.date) === monthKey(today())),
    "expense",
  )[0];
  const thisMonthTx = shownTransactions.filter(
    (t) => monthKey(t.date) === monthKey(today()),
  );
  const extraIncome = thisMonthTx
    .filter(
      (t) =>
        t.type === "income" &&
        data.categories.find((c) => c.id === t.categoryId)?.name !== "Зарплата",
    )
    .reduce((sum, t) => sum + t.amount, 0);
  const monthlyChange = (a: number, b: number) =>
    b > 0 ? `${a >= b ? "+" : ""}${Math.round(((a - b) / b) * 100)}%` : "—";
  return (
    <div className="page-content">
      <div className="welcome">
        <div>
          <span className="eyebrow">ВАШ ФИНАНСОВЫЙ ШТАБ</span>
          <h1>
            Добрый день,{" "}
            {data.profile.onboarded ? "двигаемся к цели" : "начнём путь"}
            <span className="accent-dot">.</span>
          </h1>
          <p>
            Сегодня хороший день, чтобы стать немного ближе к своему будущему.
          </p>
        </div>
        <Button
          onClick={() =>
            open({
              kind: "transaction",
              preset: { type: "saving", goalId: main?.id },
            })
          }
          icon={Plus}
        >
          Пополнить цель
        </Button>
      </div>
      {main && (
        <DreamHero
          data={data}
          goal={main}
          onOpen={() => setFullGoal(main)}
          onSimulate={() => setPage("analytics")}
        />
      )}
      {main && (
        <GoalRoute
          data={data}
          goal={main}
          user={user}
          notify={notify}
          fail={fail}
        />
      )}
      <div className="view-tabs compact dashboard-switches">
        <button
          className={!onlyActual ? "active" : ""}
          onClick={() => setOnlyActual(false)}
        >
          План + факт
        </button>
        <button
          className={onlyActual ? "active" : ""}
          onClick={() => setOnlyActual(true)}
        >
          Только факт
        </button>
        <span>
          {onlyActual
            ? "Только записанные движения денег"
            : "Незаписанный план и фактические платежи без повторного счёта"}
        </span>
      </div>
      <div className="stats-grid">
        <Stat
          label="На счетах"
          value={rub(wealth.cash)}
          sub="Доступные денежные активы"
          icon={Wallet}
        />
        <Stat
          label="Доход за месяц"
          value={rub(current.income)}
          sub={`${monthlyChange(current.income, previous.income)} к прошлому месяцу`}
          icon={ArrowDownLeft}
          tone="positive"
        />
        <Stat
          label="Расход за месяц"
          value={rub(current.expense)}
          sub={`${monthlyChange(current.expense, previous.expense)} к прошлому месяцу`}
          icon={ArrowUpRight}
        />
        <Stat
          label="Свободный поток"
          value={rub(current.freeCash)}
          sub={`Доля дохода в капитал: ${percent(current.savingsRate)}`}
          icon={TrendingUp}
          tone="positive"
        />
      </div>
      <div className="mini-metrics">
        <span>
          Выделено в цели <strong>{rub(current.allocated)}</strong>
        </span>
        <span>
          Средний расход в день{" "}
          <strong>{rub(current.expense / new Date().getDate())}</strong>
        </span>
        <span>
          Доп. доход <strong>{rub(extraIncome)}</strong>
        </span>
        <span>
          Ожидаемый налог <strong>{rub(current.taxAccrued)}</strong>
        </span>
      </div>
      <div className="dashboard-grid">
        <Card className="dashboard-panel">
          <SectionTitle
            eyebrow="КАРТИНА МЕСЯЦА"
            title="Деньги в движении"
            action={
              <button
                className="text-button"
                onClick={() => setPage("analytics")}
              >
                Аналитика <ArrowRight size={16} />
              </button>
            }
          />
          <div className="simple-bars">
            <div>
              <span>Доход</span>
              <div>
                <i style={{ width: "100%" }} className="bar-income" />
              </div>
              <b>{rub(current.income)}</b>
            </div>
            <div>
              <span>Расходы</span>
              <div>
                <i
                  style={{
                    width: `${clamp(current.expense / Math.max(1, current.income)) * 100}%`,
                  }}
                  className="bar-expense"
                />
              </div>
              <b>{rub(current.expense)}</b>
            </div>
            <div>
              <span>Налоги</span>
              <div>
                <i
                  style={{
                    width: `${clamp(current.taxes / Math.max(1, current.income)) * 100}%`,
                  }}
                  className="bar-tax"
                />
              </div>
              <b>{rub(current.taxes)}</b>
            </div>
            <div>
              <span>Долги</span>
              <div>
                <i
                  style={{
                    width: `${clamp(current.debtPaid / Math.max(1, current.income)) * 100}%`,
                  }}
                  className="bar-debt"
                />
              </div>
              <b>{rub(current.debtPaid)}</b>
            </div>
          </div>
          <div className="insight">
            <Sparkles size={18} />
            <span>
              {largest
                ? `Самая заметная статья расходов сейчас — ${data.categories.find((c) => c.id === largest.id)?.name || "прочее"} (${rub(largest.value)}). Посмотрите, что можно направить в цель.`
                : "Добавьте несколько операций — здесь появятся полезные наблюдения."}
            </span>
          </div>
        </Card>
        <Card className="dashboard-panel">
          <SectionTitle eyebrow="РЯДОМ С ЦЕЛЬЮ" title="Следующие шаги" />
          <div className="action-list">
            <button
              onClick={() =>
                open({ kind: "transaction", preset: { type: "income" } })
              }
            >
              <span className="action-icon green">
                <ArrowDownLeft size={19} />
              </span>
              <span>
                <strong>Добавить доход</strong>
                <small>Зафиксировать заработанное</small>
              </span>
              <ChevronRight size={18} />
            </button>
            <button
              onClick={() =>
                open({ kind: "transaction", preset: { type: "expense" } })
              }
            >
              <span className="action-icon peach">
                <ArrowUpRight size={19} />
              </span>
              <span>
                <strong>Записать расход</strong>
                <small>Быстро, без лишних полей</small>
              </span>
              <ChevronRight size={18} />
            </button>
            <button onClick={() => setPage("monthly")}>
              <span className="action-icon green">
                <RefreshCw size={19} />
              </span>
              <span>
                <strong>Месячный план</strong>
                <small>Подписки, аренда и постоянный доход</small>
              </span>
              <ChevronRight size={18} />
            </button>
            <button onClick={() => setPage("wishes")}>
              <span className="action-icon lavender">
                <Heart size={19} />
              </span>
              <span>
                <strong>Покупка на паузе</strong>
                <small>Посмотреть цену решения</small>
              </span>
              <ChevronRight size={18} />
            </button>
          </div>
          {pending.length > 0 && (
            <div className="upcoming">
              <span className="eyebrow">БЛИЖАЙШИЕ ПЛАТЕЖИ</span>
              {pending.map((d) => (
                <div key={d.id}>
                  <span>
                    {d.name}
                    <small>{fmtDate(d.nextPaymentDate)}</small>
                  </span>
                  <strong>{rub(d.minimumPayment)}</strong>
                </div>
              ))}
            </div>
          )}
          <div className="minimum-line">
            <span>Минимум жизни, включая долги</span>
            <strong>{rub(lifeMinimum(data))} / мес</strong>
          </div>
        </Card>
      </div>
      <div className="dashboard-grid bottom-grid">
        <Card className="dashboard-panel">
          <SectionTitle
            eyebrow="ПОСЛЕДНИЕ ДЕЙСТВИЯ"
            title="Операции"
            action={
              <button
                className="text-button"
                onClick={() => setPage("transactions")}
              >
                Все операции <ArrowRight size={16} />
              </button>
            }
          />
          {data.transactions.some((t) => !t.planned) ? (
            <TransactionList
              data={data}
              transactions={data.transactions
                .filter((t) => !t.planned)
                .slice()
                .sort((a, b) => b.date.localeCompare(a.date))
                .slice(0, 5)}
              onEdit={(t) =>
                t.planned
                  ? setPage("monthly")
                  : open({ kind: "transaction", item: t })
              }
            />
          ) : (
            <Empty
              title="Пока нет операций"
              text="Начните с первого дохода или расхода — и цифры оживут."
              action={
                <Button
                  variant="soft"
                  icon={Plus}
                  onClick={() => open({ kind: "transaction" })}
                >
                  Добавить операцию
                </Button>
              }
            />
          )}
        </Card>
        <Card className="dashboard-panel">
          <SectionTitle eyebrow="ВАШ КАПИТАЛ" title="Общая картина" />
          <div className="wealth-stack">
            <div>
              <span>Деньги на счетах</span>
              <b>{rub(wealth.cash)}</b>
            </div>
            <div>
              <span>Другие активы</span>
              <b>{rub(wealth.assets)}</b>
            </div>
            <div>
              <span>Обязательства</span>
              <b>−{rub(wealth.debt)}</b>
            </div>
            <div className="wealth-total">
              <span>Чистый капитал</span>
              <strong>{rub(wealth.total)}</strong>
            </div>
          </div>
          <button className="text-button" onClick={() => setPage("debts")}>
            Управлять обязательствами <ArrowRight size={16} />
          </button>
        </Card>
      </div>
    </div>
  );
}

function TransactionList({
  data,
  transactions,
  onEdit,
  onDelete,
  onRepeat,
}: {
  data: Data;
  transactions: Transaction[];
  onEdit: (t: Transaction) => void;
  onDelete?: (t: Transaction) => void;
  onRepeat?: (t: Transaction) => void;
}) {
  return (
    <div className="transaction-list">
      {transactions.map((t) => {
        const Icon = txIcons[t.type];
        const name =
          data.categories.find((c) => c.id === t.categoryId)?.name ||
          (t.type === "debt_payment"
            ? data.debts.find((d) => d.id === t.debtId)?.name
            : txNames[t.type]);
        return (
          <div className="transaction-row" key={t.id}>
            <div className={`transaction-icon type-${t.type}`}>
              <Icon size={18} />
            </div>
            <div className="transaction-title">
              <strong>{name}</strong>
              <small>
                {fmtDate(t.date)}
                {t.source ? ` · ${t.source}` : ""}
                {t.note ? ` · ${t.note}` : ""}
                {t.planned
                  ? " · план"
                  : t.recurringId
                    ? " · факт по плану"
                    : ""}
                {t.type === "income" &&
                t.earnedMonth &&
                t.earnedMonth !== monthKey(t.date)
                  ? ` · за ${monthLabel(t.earnedMonth)}`
                  : ""}
              </small>
            </div>
            <div className="transaction-amount">
              <strong className={t.type === "income" ? "amount-income" : ""}>
                {t.type === "income"
                  ? "+"
                  : ["expense", "tax", "debt_payment"].includes(t.type)
                    ? "−"
                    : ""}
                {rub(t.amount)}
              </strong>
              {t.type === "income" && t.taxEnabled && (
                <small>налог {rub(txTax(t))}</small>
              )}
            </div>
            <div className="row-actions">
              <IconButton
                icon={Edit3}
                label={t.planned ? "Открыть месячный план" : "Изменить"}
                onClick={() => onEdit(t)}
              />
              {onRepeat && !t.planned && (
                <IconButton
                  icon={RefreshCw}
                  label="Повторить"
                  onClick={() => onRepeat(t)}
                />
              )}
              {onDelete && !t.planned && (
                <IconButton
                  icon={Trash2}
                  label="Удалить"
                  danger
                  onClick={() => onDelete(t)}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TransactionsPage({
  data,
  open,
  remove,
  onPlanMonth,
}: {
  data: Data;
  open: (e: Editor) => void;
  remove: (name: EditorKind, id: string) => void;
  onPlanMonth: (month: string) => void;
}) {
  const [type, setType] = useState("all"),
    [query, setQuery] = useState(""),
    [period, setPeriod] = useState("all");
  const list = data.transactions
    .filter(
      (t) =>
        (type === "all" || t.type === type) &&
        (period === "all" || monthKey(t.date) === period) &&
        (!query ||
          `${data.categories.find((c) => c.id === t.categoryId)?.name || ""} ${t.source || ""} ${t.note || ""}`
            .toLowerCase()
            .includes(query.toLowerCase())),
    )
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0),
    );
  const sum = totals(list);
  return (
    <div className="page-content">
      <div className="page-head planner-head">
        <div>
          <span className="eyebrow">ДЕНЬГИ В ДВИЖЕНИИ</span>
          <h1>
            Операции<span className="accent-dot">.</span>
          </h1>
          <p>
            Все решения в одном месте. Переводы и выделение в цель не искажают
            доходы и расходы.
          </p>
        </div>
        <div className="page-head-actions">
          <Button
            variant="soft"
            icon={RefreshCw}
            onClick={() => onPlanMonth(monthKey(today()))}
          >
            Месячный план
          </Button>
          <Button icon={Plus} onClick={() => open({ kind: "transaction" })}>
            Добавить
          </Button>
        </div>
      </div>
      <div className="stats-grid three">
        <Stat
          label="Доход"
          value={rub(sum.income)}
          icon={ArrowDownLeft}
          tone="positive"
        />
        <Stat label="Расход" value={rub(sum.expense)} icon={ArrowUpRight} />
        <Stat
          label="Выделено в цели"
          value={rub(sum.allocated)}
          icon={Target}
        />
      </div>
      <Card className="list-panel">
        <div className="filters">
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="all">Все типы</option>
            {Object.entries(txNames).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
          <Select value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option value="all">Всё время</option>
            {Array.from(new Set(data.transactions.map((t) => monthKey(t.date))))
              .sort()
              .reverse()
              .map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
          </Select>
          <TextInput
            placeholder="Поиск по операциям"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {list.length ? (
          <TransactionList
            data={data}
            transactions={list}
            onEdit={(t) =>
              t.planned
                ? onPlanMonth(monthKey(t.date))
                : open({ kind: "transaction", item: t })
            }
            onDelete={(t) => remove("transaction", t.id)}
            onRepeat={(t) =>
              open({
                kind: "transaction",
                preset: {
                  ...t,
                  id: uid(),
                  date: today(),
                  createdAt: Date.now(),
                  recurringId: "",
                  planMonth: "",
                  earnedMonth: "",
                },
              })
            }
          />
        ) : (
          <Empty
            title="Операций пока нет"
            text="Добавьте доход, расход или перевод, чтобы видеть реальную картину."
            action={
              <Button
                variant="soft"
                icon={Plus}
                onClick={() => open({ kind: "transaction" })}
              >
                Добавить операцию
              </Button>
            }
          />
        )}
      </Card>
    </div>
  );
}

function MonthlyPlanPage({
  data,
  user,
  open,
  notify,
  fail,
  initialMonth,
}: {
  data: Data;
  user: User;
  open: (e: Editor) => void;
  notify: (s: string) => void;
  fail: (s: string) => void;
  initialMonth?: string;
}) {
  const [month, setMonth] = useState(initialMonth || monthKey(today()));
  const rows = recurringForMonth(data, month);
  const plannedIncome = rows
    .filter((r) => r.kind === "income")
    .reduce((n, r) => n + recurringAmount(r, month), 0);
  const plannedExpense = rows
    .filter((r) => r.kind === "expense")
    .reduce((n, r) => n + recurringAmount(r, month), 0);
  const actualTransactions = data.transactions.filter(
    (t) => monthKey(t.date) === month,
  );
  const actual = totals(actualTransactions);
  const combined = totals(
    effectiveTransactions(data, month).filter(
      (t) => monthKey(t.date) === month,
    ),
  );
  const recordedPlan = totals(actualTransactions.filter((t) => t.recurringId));
  const create = (kind: "income" | "expense") =>
    open({
      kind: "recurring",
      preset: { kind, startMonth: month, booked: true, frequency: "monthly" },
    });
  const stop = async (r: Recurring) => {
    if (
      !window.confirm(
        `Остановить «${r.name}» с ${monthLabel(month)}? Прошлые месяцы останутся в истории.`,
      )
    )
      return;
    try {
      if ((r.startMonth || month) === month)
        await removeItem(user, "recurring", r.id);
      else
        await saveItem(user, "recurring", {
          ...r,
          active: false,
          endMonth: shiftMonth(month, -1),
        });
      notify("План остановлен с выбранного месяца");
    } catch (e: any) {
      fail(e.message);
    }
  };
  return (
    <div className="page-content">
      <div className="page-head planner-head">
        <div>
          <span className="eyebrow">ПОСТОЯННАЯ ЧАСТЬ БЮДЖЕТА</span>
          <h1>
            Месячный план<span className="accent-dot">.</span>
          </h1>
          <p>
            Задайте неизменные доходы и расходы один раз. Они войдут в месячные
            сводки автоматически. Записанный факт заменит плановую строку и
            изменит остаток на счёте.
          </p>
        </div>
        <div className="page-head-actions">
          <Button variant="soft" icon={Plus} onClick={() => create("income")}>
            Доход
          </Button>
          <Button icon={Plus} onClick={() => create("expense")}>
            Расход
          </Button>
        </div>
      </div>
      <div className="month-picker">
        <button
          onClick={() => setMonth(shiftMonth(month, -1))}
          aria-label="Предыдущий месяц"
        >
          ‹
        </button>
        <label>
          <strong>{monthLabel(month)}</strong>
          <input
            aria-label="Выбрать месяц"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value || month)}
          />
        </label>
        <button
          onClick={() => setMonth(shiftMonth(month, 1))}
          aria-label="Следующий месяц"
        >
          ›
        </button>
      </div>
      <div className="stats-grid three">
        <Stat
          label="Плановый доход"
          value={rub(plannedIncome)}
          icon={ArrowDownLeft}
          tone="positive"
        />
        <Stat
          label="Плановый расход"
          value={rub(plannedExpense)}
          icon={ArrowUpRight}
        />
        <Stat
          label="Итог · план + факт"
          value={rub(combined.freeCash)}
          icon={TrendingUp}
          sub={`Записано по плану: +${rub(recordedPlan.income)} / −${rub(recordedPlan.expense)} · весь факт: +${rub(actual.income)} / −${rub(actual.expense)}`}
        />
      </div>
      {(["income", "expense"] as const).map((kind) => (
        <Card className="plan-card" key={kind}>
          <SectionTitle
            eyebrow={
              kind === "income" ? "ПОСТУПЛЕНИЯ" : "ОБЯЗАТЕЛЬНЫЕ И ПОВТОРЯЮЩИЕСЯ"
            }
            title={kind === "income" ? "Месячные доходы" : "Месячные расходы"}
            action={
              <Button variant="soft" icon={Plus} onClick={() => create(kind)}>
                Добавить
              </Button>
            }
          />
          {rows
            .filter((r) => r.kind === kind)
            .map((r) => (
              <PlanRow
                key={`${r.id}:${month}`}
                rule={r}
                month={month}
                data={data}
                user={user}
                notify={notify}
                fail={fail}
                edit={() =>
                  open({
                    kind: "recurring",
                    item: r,
                    preset: {
                      amount: recurringAmount(r, month),
                      effectiveMonth: month,
                    },
                  })
                }
                stop={() => stop(r)}
                record={() =>
                  open({
                    kind: "transaction",
                    preset: {
                      type: r.kind,
                      amount: recurringAmount(r, month),
                      date:
                        month === monthKey(today())
                          ? today()
                          : `${month}-${String(Math.min(r.dayOfMonth || 1, new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate())).padStart(2, "0")}`,
                      categoryId: r.categoryId || "",
                      source: r.kind === "income" ? r.name : "",
                      recurringId: r.id,
                      planMonth: month,
                      ...(r.kind === "income"
                        ? {
                            earnedMonth:
                              r.earnedMonthOffset === -1
                                ? shiftMonthKey(month, -1)
                                : month,
                            taxEnabled: Boolean(r.taxEnabled),
                            taxRate: r.taxRate || 0,
                          }
                        : {}),
                    },
                  })
                }
              />
            ))}
          {!rows.some((r) => r.kind === kind) && (
            <p className="muted">
              Пока нет постоянных {kind === "income" ? "доходов" : "расходов"}.
              Добавьте, например,{" "}
              {kind === "income" ? "оклад" : "аренду, подписки или спортзал"}.
            </p>
          )}
        </Card>
      ))}
      <Card className="plan-note">
        <Sparkles size={20} />
        <span>
          Разовые покупки и недельные траты продолжайте записывать в
          «Операциях». Если сумма изменилась, укажите новую здесь: по умолчанию
          она действует с выбранного месяца и далее. Можно выбрать только один
          месяц. Кнопка «Записать факт» свяжет платёж с планом: отчёт учтёт
          фактическую сумму вместо плановой. Ранее внесённую операцию можно
          связать с планом при редактировании.
        </span>
      </Card>
      <Button
        variant="ghost"
        icon={Plus}
        onClick={() => open({ kind: "category" })}
      >
        Добавить свою категорию
      </Button>
    </div>
  );
}

function PlanRow({
  rule,
  month,
  data,
  user,
  notify,
  fail,
  edit,
  stop,
  record,
}: {
  rule: Recurring;
  month: string;
  data: Data;
  user: User;
  notify: (s: string) => void;
  fail: (s: string) => void;
  edit: () => void;
  stop: () => void;
  record: () => void;
}) {
  const effective = recurringAmount(rule, month);
  const recorded = data.transactions.filter(
    (t) =>
      t.recurringId === rule.id &&
      (t.planMonth || monthKey(t.date)) === month &&
      t.type === rule.kind,
  );
  const recordedAmount = recorded.reduce((sum, t) => sum + t.amount, 0);
  const [amount, setAmount] = useState(effective);
  const [scope, setScope] = useState<"forward" | "month">("forward");
  const [busy, setBusy] = useState(false);
  const forwardValue = recurringAmount({ ...rule, overrides: {} }, month);
  const changed =
    scope === "month"
      ? amount !== effective
      : amount !== forwardValue ||
        Boolean(rule.overrides && Object.hasOwn(rule.overrides, month)) ||
        Object.keys(rule.amountChanges || {}).some((key) => key > month);
  const save = async () => {
    setBusy(true);
    try {
      const change = reviseRecurring(rule, month, amount, scope);
      await saveItem(user, "recurring", change);
      notify(
        scope === "month"
          ? "Сумма изменена только для этого месяца"
          : "Сумма обновлена с выбранного месяца",
      );
    } catch (e: any) {
      fail(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="plan-row">
      <div className={`plan-row-icon ${rule.kind}`}>
        <>
          {rule.kind === "income" ? (
            <ArrowDownLeft size={20} />
          ) : (
            <ArrowUpRight size={20} />
          )}
        </>
      </div>
      <div className="plan-row-title">
        <strong>{rule.name}</strong>
        <small>
          {data.categories.find((c) => c.id === rule.categoryId)?.name ||
            "Без категории"}
          {` · ${rule.dayOfMonth || 1}-е число`}
          {rule.overrides?.[month] !== undefined
            ? " · сумма только для месяца"
            : ""}
        </small>
        <small className={recorded.length ? "plan-recorded" : ""}>
          {recorded.length
            ? `Факт: ${rub(recordedAmount)} · ${recorded.length} ${recorded.length === 1 ? "операция" : "операции"}`
            : "Пока план · факт не записан"}
        </small>
      </div>
      <div className="plan-edit">
        <input
          aria-label={`Сумма ${rule.name}`}
          type="number"
          min="0"
          value={amount}
          onChange={(e) => setAmount(num(e.target.value))}
        />
        <select
          aria-label={`Период изменения ${rule.name}`}
          value={scope}
          onChange={(e) => setScope(e.target.value as "forward" | "month")}
        >
          <option value="forward">С этого месяца и дальше</option>
          <option value="month">Только этот месяц</option>
        </select>
        <button
          className="plan-save"
          disabled={busy || !changed}
          onClick={save}
        >
          {busy ? "…" : "Сохранить"}
        </button>
      </div>
      <div className="plan-actions">
        <Button variant="soft" onClick={record} icon={Plus}>
          Записать факт
        </Button>
        <IconButton icon={Edit3} label="Детали" onClick={edit} />
        <IconButton icon={X} label="Остановить с месяца" onClick={stop} />
      </div>
    </div>
  );
}

function GoalsPage({
  data,
  open,
  remove,
  setFullGoal,
}: {
  data: Data;
  open: (e: Editor) => void;
  remove: (name: EditorKind, id: string) => void;
  setFullGoal: (g: Goal) => void;
}) {
  const primary = data.goals.find((g) => g.primary) || data.goals[0];
  return (
    <div className="page-content">
      <div className="page-head">
        <div>
          <span className="eyebrow">РАДИ ЧЕГО ВСЁ ЭТО</span>
          <h1>
            Цели<span className="accent-dot">.</span>
          </h1>
          <p>Ваша мечта становится ближе с каждым осознанным решением.</p>
        </div>
        <Button icon={Plus} onClick={() => open({ kind: "goal" })}>
          Новая цель
        </Button>
      </div>
      {primary && (
        <DreamHero
          data={data}
          goal={primary}
          onOpen={() => setFullGoal(primary)}
          onSimulate={() =>
            document
              .getElementById("goal-scenarios")
              ?.scrollIntoView({ behavior: "smooth" })
          }
        />
      )}
      <div className="goals-grid">
        {data.goals.map((g) => {
          const saved = goalSaved(g, data.transactions),
            next = g.milestones
              .slice()
              .sort((a, b) => a.amount - b.amount)
              .find((m) => m.amount > saved);
          return (
            <Card key={g.id} className="goal-card">
              <div className="goal-card-head">
                <span className="tag">
                  {g.primary ? "ГЛАВНАЯ ЦЕЛЬ" : "ЦЕЛЬ"}
                </span>
                <div>
                  <IconButton
                    icon={Edit3}
                    label="Изменить"
                    onClick={() => open({ kind: "goal", item: g })}
                  />
                  <IconButton
                    icon={Trash2}
                    label="Удалить"
                    danger
                    onClick={() => remove("goal", g.id)}
                  />
                </div>
              </div>
              <h3>{g.name}</h3>
              <p>
                {rub(saved)} <span>из {rub(g.target)}</span>
              </p>
              <div className="progress-track">
                <div style={{ width: `${clamp(saved / g.target) * 100}%` }} />
              </div>
              <small>
                {next
                  ? `Следующий этап: ${rub(next.amount)} · осталось ${rub(next.amount - saved)}`
                  : "Цель достигнута"}
              </small>
              <div className="goal-card-actions">
                <Button
                  variant="soft"
                  icon={Plus}
                  onClick={() =>
                    open({
                      kind: "transaction",
                      preset: { type: "saving", goalId: g.id },
                    })
                  }
                >
                  Выделить сумму
                </Button>
                <button className="text-button" onClick={() => setFullGoal(g)}>
                  Подробнее <ArrowRight size={15} />
                </button>
              </div>
            </Card>
          );
        })}
      </div>
      {primary && (
        <div id="goal-scenarios">
          <ScenarioPanel data={data} goal={primary} />
        </div>
      )}
      {!data.goals.length && (
        <Empty
          title="Ваша первая цель ждёт"
          text="Создайте цель и отметьте первый шаг к ней."
          action={
            <Button onClick={() => open({ kind: "goal" })} icon={Plus}>
              Создать цель
            </Button>
          }
        />
      )}
    </div>
  );
}

function FullGoal({
  data,
  goal,
  onClose,
  open,
}: {
  data: Data;
  goal: Goal;
  onClose: () => void;
  open: (e: Editor) => void;
}) {
  const saved = goalSaved(goal, data.transactions),
    pace = savingsPace(data),
    prediction = forecast(goal, saved, pace);
  return (
    <div className="full-goal">
      <button className="full-close" onClick={onClose}>
        <X size={22} />
      </button>
      <div
        className="full-goal-image"
        style={{
          backgroundImage: `linear-gradient(0deg, rgba(8,18,15,.9), rgba(8,18,15,.05)), url("${goal.imageUrl || dreamHouse}")`,
        }}
      />
      <div className="full-goal-content">
        <span className="eyebrow">ВАШ ПУТЬ К БОЛЬШОМУ</span>
        <h1>{goal.name}</h1>
        <strong className="full-goal-value">
          {rub(saved)} <small>/ {rub(goal.target)}</small>
        </strong>
        <div className="progress-track">
          <div style={{ width: `${clamp(saved / goal.target) * 100}%` }} />
        </div>
        <div className="full-goal-meta">
          <span>{percent((saved / goal.target) * 100)} пути</span>
          <span>
            {prediction
              ? `Ориентир · ${fmtMonth(prediction.date)}`
              : pace > 0
                ? "При текущем темпе — более 30 лет"
                : "Прогноз появится с накоплениями"}
          </span>
        </div>
        <div className="timeline">
          <h3>История пути</h3>
          <div className="timeline-item achieved">
            <i />
            <div>
              <b>Старт · {fmtDate(goal.createdAt)}</b>
              <span>{rub(goal.openingSaved)} уже были с вами</span>
            </div>
          </div>
          {goal.milestones
            .slice()
            .sort((a, b) => a.amount - b.amount)
            .map((m) => {
              const date = milestoneDate(goal, m.amount, data.transactions);
              return (
                <div
                  className={`timeline-item ${date ? "achieved" : ""}`}
                  key={m.id}
                >
                  <i />
                  <div>
                    <b>{rub(m.amount)}</b>
                    <span>
                      {date
                        ? `Достигнуто ${fmtDate(date)}`
                        : `Осталось ${rub(Math.max(0, m.amount - saved))}`}
                    </span>
                  </div>
                </div>
              );
            })}
        </div>
        <Button
          icon={Plus}
          onClick={() => {
            onClose();
            open({
              kind: "transaction",
              preset: { type: "saving", goalId: goal.id },
            });
          }}
        >
          Приблизить цель
        </Button>
      </div>
    </div>
  );
}

function ScenarioPanel({ data, goal }: { data: Data; goal: Goal }) {
  const [extraIncome, setExtraIncome] = useState(20000),
    [lessExpenses, setLessExpenses] = useState(10000),
    [extraOrders, setExtraOrders] = useState(0),
    [orderPrice, setOrderPrice] = useState(5000),
    [oneTime, setOneTime] = useState(0),
    [taxRate, setTaxRate] = useState(4);
  const saved = goalSaved(goal, data.transactions),
    basePace = savingsPace(data);
  const extraGross = extraIncome + extraOrders * orderPrice * 4.33;
  const tax = (extraGross * taxRate) / 100;
  const newPace = Math.max(0, basePace + extraGross - tax + lessExpenses);
  const base = forecast(goal, saved, basePace),
    future = forecast(goal, saved + oneTime, newPace);
  const gained =
    base && future
      ? Math.max(0, Math.round(base.months - future.months))
      : null;
  return (
    <Card className="scenario-panel">
      <div>
        <span className="eyebrow">ПРИМЕРИТЬ БУДУЩЕЕ</span>
        <h2>Что поможет прийти быстрее?</h2>
        <p>Подвигайте сценарии. Это прогноз, реальные операции не изменятся.</p>
        <div className="scenario-controls">
          <Slider
            label="Дополнительный доход в месяц"
            value={extraIncome}
            max={100000}
            step={5000}
            onChange={setExtraIncome}
          />
          <Slider
            label="Меньше расходов в месяц"
            value={lessExpenses}
            max={50000}
            step={5000}
            onChange={setLessExpenses}
          />
          <Slider
            label="Заказов в неделю"
            value={extraOrders}
            max={10}
            step={1}
            onChange={setExtraOrders}
            suffix="шт."
          />
          <Slider
            label="Цена заказа"
            value={orderPrice}
            max={30000}
            step={1000}
            onChange={setOrderPrice}
          />
          <Slider
            label="Разово направить в цель"
            value={oneTime}
            max={300000}
            step={10000}
            onChange={setOneTime}
          />
          <Field label="Налог на дополнительный доход">
            <Select
              value={taxRate}
              onChange={(e) => setTaxRate(num(e.target.value))}
            >
              <option value={0}>Без налога</option>
              <option value={4}>4%</option>
              <option value={6}>6%</option>
            </Select>
          </Field>
        </div>
      </div>
      <div className="scenario-result">
        <span>ВАШ НОВЫЙ МАРШРУТ</span>
        <div className="scenario-big">
          {future ? fmtMonth(future.date) : "Пока нет темпа"}
        </div>
        <p>
          {gained !== null
            ? `${gained} мес. раньше текущего сценария`
            : "Добавьте планируемые накопления"}
        </p>
        <div className="scenario-line">
          <span>Текущий темп</span>
          <strong>{rub(basePace)} / мес</strong>
        </div>
        <div className="scenario-line">
          <span>Новый темп</span>
          <strong>{rub(newPace)} / мес</strong>
        </div>
        <div className="scenario-line">
          <span>Доп. налог</span>
          <strong>{rub(tax)} / мес</strong>
        </div>
        <div className="scenario-line">
          <span>Разовый шаг</span>
          <strong>{rub(oneTime)}</strong>
        </div>
        <div className="scenario-note">
          <Sparkles size={18} />{" "}
          {newPace > basePace
            ? "Вот так рост дохода и спокойные решения превращаются в время для жизни."
            : "Небольшие изменения тоже приближают цель."}
        </div>
      </div>
    </Card>
  );
}
function Slider({
  label,
  value,
  max,
  step,
  onChange,
  suffix,
}: {
  label: string;
  value: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <label className="slider-control">
      <span>
        {label}
        <strong>{suffix ? `${value} ${suffix}` : rub(value)}</strong>
      </span>
      <input
        type="range"
        min="0"
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

function AnalyticsPage({
  data,
  open,
}: {
  data: Data;
  open: (e: Editor) => void;
}) {
  const [period, setPeriod] = useState("month"),
    [from, setFrom] = useState(today().slice(0, 8) + "01"),
    [to, setTo] = useState(today());
  const [view, setView] = useState<"overview" | "visual">("overview");
  const start = new Date();
  if (period === "day") start.setHours(0, 0, 0, 0);
  if (period === "week") start.setDate(start.getDate() - 6);
  if (period === "month") start.setDate(1);
  if (period === "quarter")
    start.setMonth(Math.floor(start.getMonth() / 3) * 3, 1);
  if (period === "year") start.setMonth(0, 1);
  const startKey =
    period === "all"
      ? "0000-01-01"
      : period === "custom"
        ? from
        : localDay(start);
  const endKey = period === "custom" ? to : today();
  const list = data.transactions.filter(
    (t) => t.date >= startKey && t.date <= endKey,
  );
  const t = totals(list),
    series = monthSeries(data.transactions, 6),
    wealthHistory = wealthSeries(data, 6),
    worth = netWorth(data);
  const expenseCategories = categorySum(list, "expense"),
    incomeCategories = categorySum(list, "income");
  const main = data.goals.find((g) => g.primary) || data.goals[0];
  const weeklyNow = totals(
    data.transactions.filter(
      (x) =>
        x.date >= localDay(new Date(Date.now() - 7 * 86400000)) &&
        x.date <= today(),
    ),
  );
  const weeklyPrev = totals(
    data.transactions.filter(
      (x) =>
        x.date >= localDay(new Date(Date.now() - 14 * 86400000)) &&
        x.date < localDay(new Date(Date.now() - 7 * 86400000)),
    ),
  );
  const colors = [
    "#b9da8f",
    "#d3ae89",
    "#89b9ac",
    "#a8a5d5",
    "#e6c8a8",
    "#c9ded2",
  ];
  if (view === "visual")
    return (
      <div className="page-content">
        <div className="page-head">
          <div>
            <span className="eyebrow">ГОД В ОДНОМ ВЗГЛЯДЕ</span>
            <h1>
              Аналитика<span className="accent-dot">.</span>
            </h1>
            <p>Месяцы, недели и дни — с постоянными и разовыми строками.</p>
          </div>
        </div>
        <div className="view-tabs">
          <button onClick={() => setView("overview")}>Обзор</button>
          <button className="active" onClick={() => setView("visual")}>
            Визуальное
          </button>
        </div>
        <VisualAnalytics data={data} open={open} />
      </div>
    );
  return (
    <div className="page-content">
      <div className="page-head">
        <div>
          <span className="eyebrow">ЦИФРЫ С РЕАЛЬНЫМ СМЫСЛОМ</span>
          <h1>
            Аналитика<span className="accent-dot">.</span>
          </h1>
          <p>Не просто отчёт, а понимание того, что ускоряет ваш путь.</p>
        </div>
      </div>
      <div className="view-tabs">
        <button className="active" onClick={() => setView("overview")}>
          Обзор
        </button>
        <button onClick={() => setView("visual")}>Визуальное</button>
      </div>
      <div className="period-tabs">
        {[
          ["day", "День"],
          ["week", "Неделя"],
          ["month", "Месяц"],
          ["quarter", "Квартал"],
          ["year", "Год"],
          ["all", "Всё время"],
          ["custom", "Свой период"],
        ].map(([key, label]) => (
          <button
            className={period === key ? "active" : ""}
            key={key}
            onClick={() => setPeriod(key)}
          >
            {label}
          </button>
        ))}
      </div>
      {period === "custom" && (
        <div className="date-filter">
          <TextInput
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <span>—</span>
          <TextInput
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
      )}
      <div className="stats-grid">
        <Stat
          label="Доход"
          value={rub(t.income)}
          icon={ArrowDownLeft}
          tone="positive"
        />
        <Stat label="Расходы" value={rub(t.expense)} icon={ArrowUpRight} />
        <Stat
          label="Налоги + долги"
          value={rub(t.taxes + t.debtPaid)}
          sub={`Налоги: ${rub(t.taxes)}`}
          icon={Landmark}
        />
        <Stat
          label="Доля в капитал"
          value={percent(t.savingsRate)}
          sub={`Свободный поток: ${rub(t.freeCash)}`}
          icon={TrendingUp}
          tone="positive"
        />
      </div>
      <div className="analytics-grid">
        <Card className="chart-card">
          <SectionTitle eyebrow="ПОСЛЕДНИЕ 6 МЕСЯЦЕВ" title="Доход и расход" />
          <div className="chart-area">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series} barGap={5}>
                <CartesianGrid vertical={false} stroke="#e7ebe3" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#89948b", fontSize: 12 }}
                />
                <YAxis
                  tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#89948b", fontSize: 12 }}
                />
                <Tooltip formatter={(v) => rub(Number(v))} />
                <Bar
                  dataKey="income"
                  name="Доход"
                  fill="#a5c986"
                  radius={[5, 5, 0, 0]}
                />
                <Bar
                  dataKey="expense"
                  name="Расход"
                  fill="#d6b09a"
                  radius={[5, 5, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="chart-card">
          <SectionTitle eyebrow="ПОСЛЕДНИЕ 6 МЕСЯЦЕВ" title="Свободный поток" />
          <div className="chart-area">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series}>
                <defs>
                  <linearGradient id="flow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#b3d490" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#b3d490" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#e7ebe3" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#89948b", fontSize: 12 }}
                />
                <YAxis
                  tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#89948b", fontSize: 12 }}
                />
                <Tooltip formatter={(v) => rub(Number(v))} />
                <Area
                  type="monotone"
                  dataKey="freeCash"
                  name="Свободный поток"
                  stroke="#85a967"
                  strokeWidth={3}
                  fill="url(#flow)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
      <div className="analytics-grid">
        <Card className="chart-card">
          <SectionTitle
            eyebrow="ОЦЕНКА · БЕЗ ПЕРЕОЦЕНКИ ИМУЩЕСТВА"
            title="Чистый капитал"
          />
          <div className="chart-area">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={wealthHistory}>
                <CartesianGrid vertical={false} stroke="#e7ebe3" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#89948b", fontSize: 12 }}
                />
                <YAxis
                  tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#89948b", fontSize: 12 }}
                />
                <Tooltip formatter={(v) => rub(Number(v))} />
                <Area
                  type="monotone"
                  dataKey="worth"
                  name="Чистый капитал"
                  stroke="#557f5d"
                  strokeWidth={3}
                  fill="#e4f0db"
                  connectNulls={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="chart-card">
          <SectionTitle
            eyebrow="ПОСЛЕДНИЕ 6 МЕСЯЦЕВ"
            title="Доля дохода в капитал"
          />
          <div className="chart-area">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series}>
                <CartesianGrid vertical={false} stroke="#e7ebe3" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#89948b", fontSize: 12 }}
                />
                <YAxis
                  tickFormatter={(v) => `${Math.round(v)}%`}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#89948b", fontSize: 12 }}
                />
                <Tooltip formatter={(v) => percent(Number(v))} />
                <Bar
                  dataKey="savingsRate"
                  name="Доля"
                  fill="#a5c986"
                  radius={[5, 5, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
      <div className="analytics-grid">
        <Card className="chart-card">
          <SectionTitle
            eyebrow="КУДА УХОДЯТ ДЕНЬГИ"
            title="Расходы по категориям"
          />
          {expenseCategories.length ? (
            <div className="category-layout">
              <div className="pie-area">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expenseCategories}
                      dataKey="value"
                      nameKey="id"
                      innerRadius={60}
                      outerRadius={88}
                      paddingAngle={3}
                    >
                      {expenseCategories.map((c, i) => (
                        <Cell key={c.id} fill={colors[i % colors.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => rub(Number(v))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="category-list">
                {expenseCategories.slice(0, 7).map((c, i) => (
                  <div key={c.id}>
                    <i style={{ background: colors[i % colors.length] }} />
                    <span>
                      {data.categories.find((x) => x.id === c.id)?.name ||
                        "Другое"}
                    </span>
                    <strong>{rub(c.value)}</strong>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <Empty
              title="Нет расходов"
              text="Категории появятся после первых операций."
            />
          )}
        </Card>
        <Card className="chart-card">
          <SectionTitle eyebrow="ЧТО ПРИНОСИТ ДОХОД" title="Источники дохода" />
          {incomeCategories.length ? (
            <div className="source-list">
              {incomeCategories.map((c, i) => (
                <div key={c.id}>
                  <div>
                    <strong>
                      {data.categories.find((x) => x.id === c.id)?.name ||
                        "Другое"}
                    </strong>
                    <span>
                      {percent((c.value / Math.max(1, t.income)) * 100)}
                    </span>
                  </div>
                  <div className="progress-track">
                    <div
                      style={{
                        width: `${(c.value / Math.max(1, t.income)) * 100}%`,
                        background: colors[i % colors.length],
                      }}
                    />
                  </div>
                  <b>{rub(c.value)}</b>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              title="Нет доходов"
              text="Здесь будут видны самые сильные источники."
            />
          )}
        </Card>
      </div>
      <div className="analytics-grid">
        <Card className="dashboard-panel">
          <SectionTitle eyebrow="ЕЖЕНЕДЕЛЬНЫЙ РАЗБОР" title="Что изменилось" />
          <div className="report-grid">
            <div>
              <small>Доход недели</small>
              <strong>{rub(weeklyNow.income)}</strong>
              <span>
                {weeklyPrev.income
                  ? `${Math.round((weeklyNow.income / weeklyPrev.income - 1) * 100)}% к прошлой неделе`
                  : "Первый ориентир"}
              </span>
            </div>
            <div>
              <small>Расход недели</small>
              <strong>{rub(weeklyNow.expense)}</strong>
              <span>
                {weeklyPrev.expense
                  ? `${Math.round((weeklyNow.expense / weeklyPrev.expense - 1) * 100)}% к прошлой неделе`
                  : "Первый ориентир"}
              </span>
            </div>
            <div>
              <small>Налоги и долг</small>
              <strong>{rub(weeklyNow.taxes + weeklyNow.debtPaid)}</strong>
            </div>
            <div>
              <small>Свободный поток</small>
              <strong>{rub(weeklyNow.freeCash)}</strong>
            </div>
          </div>
          <div className="insight">
            <Sparkles size={18} />
            <span>
              {weeklyPrev.expense > 0 &&
              weeklyNow.expense > weeklyPrev.expense * 1.2
                ? `Расходы недели выросли на ${rub(weeklyNow.expense - weeklyPrev.expense)}. Если это разовый расход, план цели можно оставить прежним; если новый ритм — проверьте сценарий.`
                : weeklyNow.freeCash > 0
                  ? `${rub(weeklyNow.freeCash)} осталось после текущих трат, налогов и долгов. Часть можно направить в главную цель.`
                  : "Добавляйте фактические операции — обзор покажет изменения без оценок и упрёков."}
            </span>
          </div>
        </Card>
        <Card className="dashboard-panel">
          <SectionTitle
            eyebrow="АКТИВЫ И ОБЯЗАТЕЛЬСТВА"
            title="Чистый капитал"
          />
          <div className="wealth-stack">
            <div>
              <span>Деньги</span>
              <b>{rub(worth.cash)}</b>
            </div>
            <div>
              <span>Другие активы</span>
              <b>{rub(worth.assets)}</b>
            </div>
            <div>
              <span>Остаток долгов</span>
              <b>−{rub(worth.debt)}</b>
            </div>
            <div className="wealth-total">
              <span>Чистый капитал</span>
              <strong>{rub(worth.total)}</strong>
            </div>
          </div>
          <div className="source-list">
            <div>
              <div>
                <strong>Платежи по долгам / доход</strong>
                <b>{percent(t.income ? (t.debtPaid / t.income) * 100 : 0)}</b>
              </div>
            </div>
            <div>
              <div>
                <strong>Проценты по долгам</strong>
                <b>{rub(t.interest)}</b>
              </div>
            </div>
          </div>
        </Card>
      </div>
      {main && <ScenarioPanel data={data} goal={main} />}
      <Card className="dashboard-panel">
        <SectionTitle
          eyebrow="УСКОРИТЕЛИ ДОХОДА"
          title="Ваши направления"
          action={
            <Button
              variant="soft"
              icon={Plus}
              onClick={() => open({ kind: "accelerator" })}
            >
              Добавить
            </Button>
          }
        />
        {data.accelerators.length ? (
          <div className="accelerator-list">
            {data.accelerators.map((a) => {
              const actual = data.transactions
                .filter(
                  (x) => x.type === "income" && x.categoryId === a.categoryId,
                )
                .reduce((s, x) => s + x.amount, 0);
              return (
                <div key={a.id}>
                  <div>
                    <strong>{a.name}</strong>
                    <span>
                      {rub(actual)} / {rub(a.target)}
                    </span>
                  </div>
                  <div className="progress-track">
                    <div
                      style={{ width: `${clamp(actual / a.target) * 100}%` }}
                    />
                  </div>
                  <small>
                    Этапы:{" "}
                    {a.milestones
                      .map((m) => `${actual >= m ? "✓ " : ""}${rub(m)}`)
                      .join(" · ")}
                  </small>
                  <IconButton
                    icon={Edit3}
                    label="Изменить"
                    onClick={() => open({ kind: "accelerator", item: a })}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <Empty
            title="Направление роста"
            text="Создайте ускоритель: его прогресс будет считаться по реальным доходам выбранной категории."
            action={
              <Button
                variant="soft"
                onClick={() => open({ kind: "accelerator" })}
                icon={Plus}
              >
                Создать ускоритель
              </Button>
            }
          />
        )}
      </Card>
    </div>
  );
}

function VisualAnalytics({
  data,
  open,
}: {
  data: Data;
  open: (e: Editor) => void;
}) {
  const nowYear = new Date().getFullYear();
  const [year, setYear] = useState(nowYear);
  const [selectedMonth, setSelectedMonth] = useState(monthKey(today()));
  const [basis, setBasis] = useState<"cash" | "earned">("cash");
  const [includePlan, setIncludePlan] = useState(true);
  const [level, setLevel] = useState<"month" | "week" | "day">("month");
  const [selectedWeek, setSelectedWeek] = useState("");
  const [selectedDay, setSelectedDay] = useState(today());
  const earliest = Math.min(
    nowYear,
    ...data.transactions.map((t) => Number(t.date.slice(0, 4))),
    ...data.transactions
      .filter((t) => t.earnedMonth)
      .map((t) => Number(t.earnedMonth!.slice(0, 4))),
    ...data.recurring
      .filter((r) => r.startMonth)
      .map((r) =>
        Number(
          (r.kind === "income" && r.earnedMonthOffset === -1
            ? shiftMonthKey(r.startMonth!, -1)
            : r.startMonth!)!.slice(0, 4),
        ),
      ),
    Number(data.profile.createdAt?.slice(0, 4) || nowYear),
  );
  const years = Array.from(
    { length: Math.min(30, nowYear + 2 - earliest) },
    (_, i) => nowYear + 1 - i,
  );
  const entries = (
    includePlan
      ? effectiveTransactions(data, shiftMonthKey(`${year}-12`, 1))
      : data.transactions.filter((t) => !t.planned)
  ).filter((t) => reportMonth(t, basis).startsWith(String(year)));
  const months = Array.from({ length: 12 }, (_, i) => {
    const key = `${year}-${String(i + 1).padStart(2, "0")}`;
    const txs = entries.filter((t) => reportMonth(t, basis) === key);
    return { key, txs, ...totals(txs) };
  });
  const annual = totals(
    year > nowYear
      ? entries
      : entries.filter((t) => reportMonth(t, basis) <= monthKey(today())),
  );
  const futurePlan = totals(
    entries.filter((t) => reportMonth(t, basis) > monthKey(today())),
  );
  const max = Math.max(1, ...months.map((m) => Math.max(m.income, m.expense)));
  const monthly = months.find((m) => m.key === selectedMonth) || months[0];
  const monday = (date: Date) => {
    const d = new Date(date);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return localDay(d);
  };
  const first = new Date(selectedMonth + "-01T12:00:00");
  const weeks: string[] = [];
  if (selectedMonth.startsWith(String(year))) {
    const d = new Date(monday(first) + "T12:00:00");
    while (d <= new Date(first.getFullYear(), first.getMonth() + 1, 0)) {
      weeks.push(localDay(d));
      d.setDate(d.getDate() + 7);
      if (weeks.length >= 6) break;
    }
  }
  const days = Array.from(
    {
      length: new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate(),
    },
    (_, i) => `${selectedMonth}-${String(i + 1).padStart(2, "0")}`,
  );
  const visible =
    level === "month"
      ? monthly.txs
      : level === "day"
        ? monthly.txs.filter((t) => t.date === selectedDay)
        : monthly.txs.filter(
            (t) =>
              monday(new Date(t.date + "T12:00:00")) ===
              (selectedWeek || weeks[0]),
          );
  const detail = totals(visible);
  const largest = (txs: Transaction[], type: "income" | "expense") => {
    const t = txs
      .filter((x) => x.type === type)
      .sort((a, b) => b.amount - a.amount)[0];
    return t
      ? `${data.categories.find((c) => c.id === t.categoryId)?.name || t.source || "Без категории"} · ${rub(t.amount)}`
      : "—";
  };
  const exportAnalysis = (format: "json" | "csv") => {
    const rows = entries
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((t) => ({
        date: t.date,
        earnedMonth: t.earnedMonth || "",
        planMonth: t.planMonth || "",
        recurringId: t.recurringId || "",
        type: t.type,
        amount: t.amount,
        category:
          data.categories.find((c) => c.id === t.categoryId)?.name || "",
        source: t.source || "",
        note: t.note || "",
        planned: Boolean(t.planned),
        tax: txTax(t),
        interest: t.interestAmount || 0,
      }));
    if (format === "json") {
      const payload = {
        format: "kapital-analysis-v1",
        year,
        basis,
        includePlan,
        generatedAt: new Date().toISOString(),
        explanation:
          "planned=true — ещё не записанная постоянная строка; связанный факт заменяет её. basis=earned группирует доходы по earnedMonth, расходы — по дате платежа",
        annual,
        futurePlan,
        months: months.map(
          ({
            key,
            income,
            expense,
            taxes,
            debtPaid,
            allocated,
            freeCash,
            savingsRate,
          }) => ({
            month: key,
            income,
            expense,
            taxes,
            debtPaid,
            allocated,
            freeCash,
            savingsRate,
          }),
        ),
        entries: rows,
      };
      download(
        new Blob([JSON.stringify(payload, null, 2)], {
          type: "application/json",
        }),
        `kapital-analysis-${year}.json`,
      );
    } else {
      const columns = [
        "date",
        "earnedMonth",
        "planMonth",
        "recurringId",
        "type",
        "amount",
        "category",
        "source",
        "note",
        "planned",
        "tax",
        "interest",
      ] as const;
      const csv =
        "\uFEFF" +
        [columns, ...rows.map((row) => columns.map((key) => row[key]))]
          .map((row) =>
            row.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(";"),
          )
          .join("\r\n");
      download(
        new Blob([csv], { type: "text/csv;charset=utf-8" }),
        `kapital-analysis-${year}.csv`,
      );
    }
  };
  const selectMonth = (key: string) => {
    setSelectedMonth(key);
    setLevel("month");
    setSelectedDay(key + "-01");
    setSelectedWeek("");
  };
  return (
    <>
      <div className="visual-toolbar">
        <div className="visual-year">
          <span>ГОД</span>
          <Select
            value={year}
            onChange={(e) => {
              const y = Number(e.target.value);
              setYear(y);
              selectMonth(`${y}-01`);
            }}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        </div>
        <div className="page-head-actions">
          <Button
            variant="soft"
            icon={Download}
            onClick={() => exportAnalysis("json")}
          >
            Для анализа · JSON
          </Button>
          <Button
            variant="ghost"
            icon={Download}
            onClick={() => exportAnalysis("csv")}
          >
            CSV
          </Button>
        </div>
      </div>
      <div className="view-tabs compact report-switches">
        <button
          className={basis === "cash" ? "active" : ""}
          onClick={() => setBasis("cash")}
        >
          По поступлению
        </button>
        <button
          className={basis === "earned" ? "active" : ""}
          onClick={() => {
            setBasis("earned");
            setLevel("month");
          }}
        >
          За какой месяц
        </button>
        <button
          className={includePlan ? "active" : ""}
          onClick={() => setIncludePlan(true)}
        >
          План + факт
        </button>
        <button
          className={!includePlan ? "active" : ""}
          onClick={() => setIncludePlan(false)}
        >
          Только факт
        </button>
      </div>
      <p className="visual-caption">
        {basis === "earned"
          ? "Доход относится к указанному месяцу начисления; расходы остаются в месяце оплаты. Остаток счёта всегда считается по дате поступления."
          : "Все суммы показаны по дате движения денег."}
        {includePlan
          ? " Незаписанный постоянный план включён в прогноз."
          : " Показаны только записанные операции."}
      </p>
      {year >= nowYear && (
        <p className="visual-caption">
          {year === nowYear
            ? "Будущие месяцы показаны как план. Сводка сверху учитывает месяцы до текущего включительно."
            : "Это план на будущий год; фактические операции появятся по мере их записи."}
        </p>
      )}
      <div className="stats-grid three">
        <Stat
          label={
            year === nowYear
              ? "Доход с начала года"
              : year > nowYear
                ? "План дохода за год"
                : "Доход за год"
          }
          value={rub(annual.income)}
          icon={ArrowDownLeft}
          tone="positive"
        />
        <Stat
          label={
            year === nowYear
              ? "Расход с начала года"
              : year > nowYear
                ? "План расхода за год"
                : "Расход за год"
          }
          value={rub(annual.expense)}
          icon={ArrowUpRight}
        />
        <Stat
          label={basis === "earned" ? "Доход − платежи" : "Свободный поток"}
          value={rub(annual.freeCash)}
          icon={TrendingUp}
        />
      </div>
      <div className="visual-grid">
        {months.map((m) => (
          <button
            key={m.key}
            className={`visual-month ${selectedMonth === m.key ? "active" : ""}`}
            onClick={() => selectMonth(m.key)}
          >
            <span className="visual-month-head">
              <strong>{monthLabel(m.key).split(" ")[0]}</strong>
              <small>
                {m.key > monthKey(today())
                  ? "план"
                  : m.txs.length
                    ? `${m.txs.length} строк`
                    : "нет записей"}
              </small>
            </span>
            <span className="visual-bars">
              <i
                className="income"
                style={{ width: `${(m.income / max) * 100}%` }}
              />
              <i
                className="expense"
                style={{ width: `${(m.expense / max) * 100}%` }}
              />
            </span>
            <span className="visual-values">
              <span>
                Доход <b>{rub(m.income)}</b>
              </span>
              <span>
                Расход <b>{rub(m.expense)}</b>
              </span>
            </span>
            <span className="visual-tops">
              ↗ {largest(m.txs, "income")}
              <br />↘ {largest(m.txs, "expense")}
            </span>
          </button>
        ))}
      </div>
      <Card className="visual-detail">
        <div className="visual-detail-top">
          <div>
            <span className="eyebrow">ПОДРОБНОСТИ</span>
            <h2>{monthLabel(selectedMonth)}</h2>
          </div>
          <div className="view-tabs compact">
            {(basis === "earned" ? ["month"] : ["month", "week", "day"]).map(
              (v) => (
                <button
                  key={v}
                  className={level === v ? "active" : ""}
                  onClick={() => setLevel(v as "month" | "week" | "day")}
                >
                  {v === "month" ? "Месяц" : v === "week" ? "Неделя" : "День"}
                </button>
              ),
            )}
          </div>
        </div>
        {level === "week" && (
          <div className="visual-pills">
            {weeks.map((w) => (
              <button
                key={w}
                className={(selectedWeek || weeks[0]) === w ? "active" : ""}
                onClick={() => setSelectedWeek(w)}
              >
                {new Date(w + "T12:00:00").toLocaleDateString("ru-RU", {
                  day: "numeric",
                  month: "short",
                })}{" "}
                —{" "}
                {new Date(
                  new Date(w + "T12:00:00").getTime() + 6 * 86400000,
                ).toLocaleDateString("ru-RU", {
                  day: "numeric",
                  month: "short",
                })}
              </button>
            ))}
          </div>
        )}
        {level === "day" && (
          <div className="visual-pills">
            {days.map((d) => (
              <button
                key={d}
                className={selectedDay === d ? "active" : ""}
                onClick={() => setSelectedDay(d)}
              >
                {Number(d.slice(8))}
              </button>
            ))}
          </div>
        )}
        <div className="visual-detail-stats">
          <span>
            Доход <strong>{rub(detail.income)}</strong>
          </span>
          <span>
            Расход <strong>{rub(detail.expense)}</strong>
          </span>
          <span>
            Крупнейший доход <strong>{largest(visible, "income")}</strong>
          </span>
          <span>
            Крупнейший расход <strong>{largest(visible, "expense")}</strong>
          </span>
        </div>
        <div className="visual-entries">
          {visible
            .slice()
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((t) => (
              <div key={t.id}>
                <span>
                  <strong>
                    {data.categories.find((c) => c.id === t.categoryId)?.name ||
                      t.source ||
                      txNames[t.type]}
                  </strong>
                  <small>
                    {fmtDate(t.date)} ·{" "}
                    {t.planned ? "постоянная строка" : txNames[t.type]}
                    {t.source ? ` · ${t.source}` : ""}
                    {t.type === "income" &&
                    t.earnedMonth &&
                    t.earnedMonth !== monthKey(t.date)
                      ? ` · за ${monthLabel(t.earnedMonth)}`
                      : ""}
                  </small>
                </span>
                <b className={t.type === "income" ? "amount-income" : ""}>
                  {t.type === "income" ? "+" : "−"}
                  {rub(t.amount)}
                </b>
                {!t.planned && (
                  <IconButton
                    icon={Edit3}
                    label="Изменить"
                    onClick={() => open({ kind: "transaction", item: t })}
                  />
                )}
              </div>
            ))}
          {!visible.length && (
            <p className="muted">За выбранный период записей пока нет.</p>
          )}
        </div>
      </Card>
    </>
  );
}

function DebtsPage({
  data,
  open,
  remove,
}: {
  data: Data;
  open: (e: Editor) => void;
  remove: (name: EditorKind, id: string) => void;
}) {
  const [extra, setExtra] = useState(5000);
  const active = data.debts.filter(
      (d) => debtBalance(d, data.transactions) > 0 && !d.closed,
    ),
    debtTotal = active.reduce(
      (s, d) => s + debtBalance(d, data.transactions),
      0,
    ),
    minimum = active.reduce((s, d) => s + d.minimumPayment, 0);
  const monthPayments = data.transactions.filter(
    (t) => t.type === "debt_payment" && monthKey(t.date) === monthKey(today()),
  );
  const paid = monthPayments.reduce((s, t) => s + t.amount, 0),
    interest = monthPayments.reduce((s, t) => s + (t.interestAmount || 0), 0);
  const main = data.goals.find((g) => g.primary) || data.goals[0],
    pace = savingsPace(data);
  const debtScenarios = main
    ? [
        {
          label: "Минимум по долгам",
          result: debtGoalScenario(data, main, extra, 0),
        },
        {
          label: "Сначала долги",
          result: debtGoalScenario(data, main, extra, 1),
        },
        {
          label: "Пополнить оба",
          result: debtGoalScenario(data, main, extra, 0.5),
        },
      ]
    : [];
  return (
    <div className="page-content">
      <div className="page-head">
        <div>
          <span className="eyebrow">УПРАВЛЯЕМАЯ ЧАСТЬ ПЛАНА</span>
          <h1>
            Долги и обязательства<span className="accent-dot">.</span>
          </h1>
          <p>Остаток, платёж и момент, когда деньги снова станут свободными.</p>
        </div>
        <Button icon={Plus} onClick={() => open({ kind: "debt" })}>
          Добавить долг
        </Button>
      </div>
      <div className="stats-grid">
        <Stat label="Остаток долгов" value={rub(debtTotal)} icon={Landmark} />
        <Stat
          label="Минимум в месяц"
          value={rub(minimum)}
          sub="Учитывается в минимуме жизни"
          icon={Wallet}
        />
        <Stat
          label="Оплачено за месяц"
          value={rub(paid)}
          icon={Check}
          tone="positive"
        />
        <Stat label="Проценты за месяц" value={rub(interest)} icon={Coins} />
      </div>
      {data.debts.length ? (
        <div className="debt-grid">
          {data.debts.map((d) => {
            const balance = debtBalance(d, data.transactions),
              progress =
                d.originalAmount > 0
                  ? clamp(1 - balance / d.originalAmount)
                  : 0;
            const base = projectedDebt(d, balance, d.minimumPayment),
              plan = projectedDebt(
                d,
                balance,
                Math.max(d.minimumPayment, d.plannedPayment),
              ),
              accelerated = projectedDebt(
                d,
                balance,
                Math.max(d.minimumPayment, d.plannedPayment) + extra,
              );
            return (
              <Card key={d.id} className="debt-card">
                <div className="goal-card-head">
                  <span
                    className={`tag ${d.annualRate >= 20 ? "tag-warm" : ""}`}
                  >
                    {balance <= 0 ? "ЗАКРЫТ" : d.kind}
                    {d.annualRate >= 20 ? " · ВЫСОКАЯ СТАВКА" : ""}
                  </span>
                  <div>
                    <IconButton
                      icon={Edit3}
                      label="Изменить"
                      onClick={() => open({ kind: "debt", item: d })}
                    />
                    <IconButton
                      icon={Trash2}
                      label="Удалить"
                      danger
                      onClick={() => remove("debt", d.id)}
                    />
                  </div>
                </div>
                <h3>{d.name}</h3>
                <div className="debt-figure">
                  <strong>{rub(balance)}</strong>
                  <span>остаток</span>
                </div>
                <div className="progress-track">
                  <div style={{ width: `${progress * 100}%` }} />
                </div>
                <small>
                  Погашено {percent(progress * 100)} · исходная сумма{" "}
                  {rub(d.originalAmount)}
                </small>
                <div className="debt-details">
                  <div>
                    <span>Мин. платёж</span>
                    <strong>{rub(d.minimumPayment)} / мес</strong>
                  </div>
                  <div>
                    <span>Ставка</span>
                    <strong>{percent(d.annualRate)} годовых</strong>
                  </div>
                  <div>
                    <span>Следующий платёж</span>
                    <strong>{fmtDate(d.nextPaymentDate)}</strong>
                  </div>
                  <div>
                    <span>При минимальном</span>
                    <strong>
                      {base
                        ? `${base.months} мес.`
                        : "Платёж не покрывает проценты"}
                    </strong>
                  </div>
                  <div>
                    <span>При плановом</span>
                    <strong>{plan ? `${plan.months} мес.` : "—"}</strong>
                  </div>
                  <div>
                    <span>Если +{rub(extra)}</span>
                    <strong>
                      {accelerated ? `${accelerated.months} мес.` : "—"}
                    </strong>
                  </div>
                </div>
                {d.annualRate > 0 && (
                  <div className="debt-note">
                    При текущем остатке проценты — около{" "}
                    {rub((balance * d.annualRate) / 1200)} в месяц.
                  </div>
                )}
                <div className="goal-card-actions">
                  {balance > 0 ? (
                    <Button
                      variant="soft"
                      icon={Plus}
                      onClick={() =>
                        open({
                          kind: "transaction",
                          preset: { type: "debt_payment", debtId: d.id },
                        })
                      }
                    >
                      Записать платёж
                    </Button>
                  ) : (
                    <span className="debt-note">
                      Обязательство закрыто
                      {debtClosedDate(d, data.transactions)
                        ? ` ${fmtDate(debtClosedDate(d, data.transactions)!)}`
                        : ""}
                      . {rub(d.minimumPayment)} в месяц можно перенаправить в
                      цель.
                      {main &&
                        forecast(
                          main,
                          goalSaved(main, data.transactions),
                          pace + d.minimumPayment,
                        ) && (
                          <>
                            {" "}
                            При таком пополнении ориентир для {main.name} —{" "}
                            {fmtMonth(
                              forecast(
                                main,
                                goalSaved(main, data.transactions),
                                pace + d.minimumPayment,
                              )!.date,
                            )}
                            .
                          </>
                        )}
                    </span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Empty
          title="Нет обязательств"
          text="Если у вас есть кредит или долг, добавьте его — прогноз цели учтёт обязательный платёж."
          action={
            <Button icon={Plus} onClick={() => open({ kind: "debt" })}>
              Добавить долг
            </Button>
          }
        />
      )}
      <Card className="scenario-panel debt-simulator">
        <div>
          <span className="eyebrow">ДОСРОЧНОЕ ПОГАШЕНИЕ</span>
          <h2>Когда освободится денежный поток?</h2>
          <p>
            Дополнительный платёж сокращает срок долга. После закрытия минимум
            можно направлять в цель.
          </p>
          <Slider
            label="Свободная сумма сверх текущего плана"
            value={extra}
            max={30000}
            step={1000}
            onChange={setExtra}
          />
        </div>
        <div className="scenario-result">
          <span>РЕЗУЛЬТАТ СЦЕНАРИЯ</span>
          <div className="scenario-big">
            {rub(minimum)} <small>/ мес</small>
          </div>
          <p>потенциально освободится после закрытия всех долгов</p>
          {main && (
            <div className="scenario-line">
              <span>Ориентир цели с текущим темпом</span>
              <strong>
                {forecast(main, goalSaved(main, data.transactions), pace)
                  ? fmtMonth(
                      forecast(main, goalSaved(main, data.transactions), pace)!
                        .date,
                    )
                  : "—"}
              </strong>
            </div>
          )}
          {debtScenarios.map(({ label, result }) => (
            <div className="debt-scenario" key={label}>
              <strong>{label}</strong>
              <span>
                Долги:{" "}
                {result.debtDate ? fmtMonth(result.debtDate) : "нет срока"}
              </span>
              <span>
                Цель:{" "}
                {result.goalDate ? fmtMonth(result.goalDate) : "нет срока"}
              </span>
              <span>Проценты: {rub(result.interest)}</span>
              <span>
                Капитал к цели:{" "}
                {result.worthAtGoal === null ? "—" : rub(result.worthAtGoal)}
              </span>
            </div>
          ))}
          <div className="scenario-note">
            <Sparkles size={18} /> Это сценарий, а не совет направлять весь
            свободный остаток в долги.
          </div>
        </div>
      </Card>
    </div>
  );
}

function WishesPage({
  data,
  user,
  open,
  remove,
  notify,
  fail,
}: {
  data: Data;
  user: User;
  open: (e: Editor) => void;
  remove: (kind: EditorKind, id: string) => void;
  notify: (s: string) => void;
  fail: (s: string) => void;
}) {
  const main = data.goals.find((g) => g.primary) || data.goals[0],
    pace = savingsPace(data),
    declined = data.wishes
      .filter((w) => ["declined", "saved"].includes(w.status))
      .reduce((s, w) => s + w.price, 0);
  const act = async (w: Wish, status: Wish["status"]) => {
    try {
      if (status === "saved" && !main)
        throw new Error("Сначала создайте финансовую цель");
      await resolveWish(user, w, status, main);
      notify(
        status === "saved" && main
          ? `${rub(w.price)} остались работать на ${main.name}`
          : "Решение сохранено",
      );
    } catch (e: any) {
      fail(e.message || "Не удалось сохранить решение");
    }
  };
  return (
    <div className="page-content">
      <div className="page-head">
        <div>
          <span className="eyebrow">ПАУЗА ПЕРЕД РЕШЕНИЕМ</span>
          <h1>
            Хочу купить<span className="accent-dot">.</span>
          </h1>
          <p>
            Покупать можно. Здесь видно, сколько это стоит относительно большой
            цели.
          </p>
        </div>
        <Button icon={Plus} onClick={() => open({ kind: "wish" })}>
          Новая покупка
        </Button>
      </div>
      <div className="stats-grid three">
        <Stat
          label="На паузе"
          value={String(
            data.wishes.filter((w) => w.status === "waiting").length,
          )}
          sub="решений ожидают"
          icon={Bell}
        />
        <Stat
          label="Сохранено отказом"
          value={rub(declined)}
          sub="Не потрачено на импульсивные покупки"
          icon={Heart}
          tone="positive"
        />
        <Stat
          label="Темп к цели"
          value={rub(pace)}
          sub="в месяц"
          icon={Target}
        />
      </div>
      {data.wishes.length ? (
        <div className="wish-grid">
          {data.wishes
            .slice()
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .map((w) => {
              const readyAt = new Date(
                new Date(w.createdAt).getTime() + w.coolingHours * 3600000,
              );
              const ready = Date.now() >= readyAt.getTime();
              const days =
                pace > 0 ? Math.round((w.price / pace) * 30.44) : null;
              return (
                <Card key={w.id} className="wish-card">
                  {w.imageUrl && (
                    <div
                      className="wish-image"
                      style={{ backgroundImage: `url("${w.imageUrl}")` }}
                    />
                  )}
                  <div className="goal-card-head">
                    <span
                      className={`tag ${w.status === "waiting" ? "tag-warm" : ""}`}
                    >
                      {w.status === "waiting"
                        ? ready
                          ? "МОЖНО РЕШИТЬ"
                          : "НА ПАУЗЕ"
                        : w.status === "declined"
                          ? "ОТКАЗАЛИСЬ"
                          : w.status === "saved"
                            ? "В ЦЕЛИ"
                            : w.status === "bought"
                              ? "КУПЛЕНО"
                              : "ОТЛОЖЕНО"}
                    </span>
                    <div>
                      <IconButton
                        icon={Edit3}
                        label="Изменить"
                        onClick={() => open({ kind: "wish", item: w })}
                      />
                      <IconButton
                        icon={Trash2}
                        label="Удалить"
                        danger
                        onClick={() => remove("wish", w.id)}
                      />
                    </div>
                  </div>
                  <h3>{w.name}</h3>
                  <strong className="wish-price">{rub(w.price)}</strong>
                  {w.reason && <p>{w.reason}</p>}
                  {w.url && /^https?:\/\//i.test(w.url) && (
                    <a
                      className="text-button"
                      href={w.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Открыть ссылку <ArrowRight size={15} />
                    </a>
                  )}
                  {main && (
                    <div className="wish-impact">
                      <Target size={18} />
                      <span>
                        Это {percent((w.price / main.target) * 100)} цели «
                        {main.name}».{" "}
                        {days !== null
                          ? `При текущем темпе — примерно ${days} дней пути.`
                          : "Когда появятся накопления, покажем влияние на срок."}
                      </span>
                    </div>
                  )}
                  {w.status === "waiting" && !ready && (
                    <div className="cooling-note">
                      Пауза до{" "}
                      {readyAt.toLocaleString("ru-RU", {
                        day: "numeric",
                        month: "long",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  )}
                  {["waiting", "deferred"].includes(w.status) && (
                    <div className="wish-actions">
                      <Button variant="soft" onClick={() => act(w, "declined")}>
                        Отказаться
                      </Button>
                      <Button variant="soft" onClick={() => act(w, "saved")}>
                        В цель
                      </Button>
                      <button
                        className="text-button"
                        onClick={() => act(w, "deferred")}
                      >
                        Отложить
                      </button>
                      {(ready || w.status === "deferred") && (
                        <button
                          className="text-button"
                          onClick={() => act(w, "bought")}
                        >
                          Купил
                        </button>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
        </div>
      ) : (
        <Empty
          title="Здесь начинается осознанная пауза"
          text="Добавьте желанную покупку, чтобы увидеть её цену в днях пути к мечте."
          action={
            <Button icon={Plus} onClick={() => open({ kind: "wish" })}>
              Добавить покупку
            </Button>
          }
        />
      )}
    </div>
  );
}

function SettingsPage({
  data,
  user,
  open,
  remove,
  notify,
  fail,
}: {
  data: Data;
  user: User;
  open: (e: Editor) => void;
  remove: (name: EditorKind, id: string) => void;
  notify: (s: string) => void;
  fail: (s: string) => void;
}) {
  const [profile, setProfile] = useState(data.profile);
  useEffect(() => setProfile(data.profile), [data.profile]);
  const exportJson = () => {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            format: "kapital-backup-v1",
            exportedAt: new Date().toISOString(),
            data,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    download(blob, `kapital-backup-${today()}.json`);
  };
  const exportCsv = () => {
    const header = [
      "date",
      "type",
      "amount",
      "category",
      "source",
      "account",
      "note",
      "taxRate",
      "interest",
    ];
    const rows = data.transactions.map((t) => [
      t.date,
      t.type,
      t.amount,
      data.categories.find((c) => c.id === t.categoryId)?.name || "",
      t.source || "",
      data.accounts.find((a) => a.id === t.accountId)?.name || "",
      t.note || "",
      t.taxEnabled ? t.taxRate || 0 : "",
      t.interestAmount || "",
    ]);
    const csv =
      "\uFEFF" +
      [header, ...rows]
        .map((row) =>
          row.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(";"),
        )
        .join("\r\n");
    download(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
      `kapital-operations-${today()}.csv`,
    );
  };
  const importJson = async (file: File) => {
    try {
      const raw = JSON.parse(await file.text());
      if (raw.format !== "kapital-backup-v1" || !raw.data)
        throw new Error("Неподдерживаемый формат");
      for (const name of [
        "accounts",
        "categories",
        "transactions",
        "goals",
        "debts",
        "recurring",
        "wishes",
        "assets",
        "accelerators",
      ] as const) {
        for (const item of raw.data[name] || []) {
          if (!item.id) continue;
          await saveItem(user, name, item);
        }
      }
      await saveProfile(user, raw.data.profile || {});
      notify("Резервная копия восстановлена");
    } catch (e: any) {
      fail(e.message || "Не удалось импортировать файл");
    }
  };
  const profileSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await saveProfile(user, profile);
      notify("Настройки сохранены");
    } catch (e: any) {
      fail(e.message);
    }
  };
  return (
    <div className="page-content">
      <div className="page-head">
        <div>
          <span className="eyebrow">ПОД ВАШ РИТМ</span>
          <h1>
            Настройки<span className="accent-dot">.</span>
          </h1>
          <p>Меняйте ориентиры, счета и категории по мере изменения жизни.</p>
        </div>
      </div>
      <div className="settings-grid">
        <Card className="settings-card">
          <SectionTitle eyebrow="ВАШИ ОРИЕНТИРЫ" title="Бюджет и правила" />
          <form className="form-grid" onSubmit={profileSubmit}>
            <Field label="Плановый доход в месяц">
              <TextInput
                type="number"
                min="0"
                value={profile.expectedIncome || 0}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    expectedIncome: num(e.target.value),
                  })
                }
              />
            </Field>
            <Field label="Минимальный бюджет">
              <TextInput
                type="number"
                min="0"
                value={profile.budgetMinimum || 0}
                onChange={(e) =>
                  setProfile({ ...profile, budgetMinimum: num(e.target.value) })
                }
              />
            </Field>
            <Field label="Комфортный бюджет">
              <TextInput
                type="number"
                min="0"
                value={profile.budgetComfort || 0}
                onChange={(e) =>
                  setProfile({ ...profile, budgetComfort: num(e.target.value) })
                }
              />
            </Field>
            <Field label="Верхний ориентир">
              <TextInput
                type="number"
                min="0"
                value={profile.budgetMaximum || 0}
                onChange={(e) =>
                  setProfile({ ...profile, budgetMaximum: num(e.target.value) })
                }
              />
            </Field>
            <Field label="Налог по умолчанию, %">
              <TextInput
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={profile.defaultTaxRate || 0}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    defaultTaxRate: num(e.target.value),
                  })
                }
              />
            </Field>
            <Field label="Пауза покупки, часов">
              <TextInput
                type="number"
                min="0"
                value={profile.defaultCoolingHours || 72}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    defaultCoolingHours: num(e.target.value),
                  })
                }
              />
            </Field>
            <div className="form-full">
              <Button type="submit" icon={Check}>
                Сохранить настройки
              </Button>
            </div>
          </form>
        </Card>
        <Card className="settings-card">
          <SectionTitle eyebrow="ДАННЫЕ" title="Резервная копия" />
          <p>
            Экспортируйте все записи или только операции. Восстановление
            объединяет записи по ID.
          </p>
          <div className="settings-actions">
            <Button variant="soft" icon={Download} onClick={exportJson}>
              Все данные · JSON
            </Button>
            <Button variant="soft" icon={Download} onClick={exportCsv}>
              Операции · CSV
            </Button>
            <label className="button button-ghost file-button">
              <Upload size={17} /> Восстановить JSON
              <input
                type="file"
                accept="application/json,.json"
                onChange={(e) =>
                  e.target.files?.[0] && importJson(e.target.files[0])
                }
              />
            </label>
          </div>
          <div className="divider" />
          <h3>Демонстрационные данные</h3>
          <p>
            Примеры операций и покупок помечены отдельно. Очистка затронет
            только их.
          </p>
          <div className="settings-actions">
            <Button
              variant="soft"
              onClick={async () => {
                try {
                  await seedDemo(user);
                  notify("Демо-данные загружены");
                } catch (e: any) {
                  fail(e.message);
                }
              }}
            >
              Загрузить демо-данные
            </Button>
            <Button
              variant="ghost"
              onClick={async () => {
                try {
                  await clearDemo(user);
                  notify("Демо-данные удалены");
                } catch (e: any) {
                  fail(e.message);
                }
              }}
            >
              Очистить демо-данные
            </Button>
          </div>
        </Card>
      </div>
      <div className="settings-grid">
        <SettingsCollection
          title="Счета"
          subtitle="Баланс и переводы"
          items={data.accounts}
          add={() => open({ kind: "account" })}
          edit={(x) => open({ kind: "account", item: x })}
          remove={(x) => remove("account", x.id)}
          render={(x) => `${rub(accountBalance(x, data.transactions))}`}
        />
        <SettingsCollection
          title="Категории"
          subtitle="Доходы и расходы"
          items={data.categories}
          add={() => open({ kind: "category" })}
          edit={(x) => open({ kind: "category", item: x })}
          remove={(x) => remove("category", x.id)}
          render={(x) =>
            x.kind === "income"
              ? `Доход${x.defaultTaxRate ? ` · налог ${x.defaultTaxRate}%` : ""}`
              : "Расход"
          }
        />
        <SettingsCollection
          title="Постоянные строки"
          subtitle={`Минимум жизни: ${rub(lifeMinimum(data))}`}
          items={data.recurring}
          add={() => open({ kind: "recurring" })}
          edit={(x) => open({ kind: "recurring", item: x })}
          remove={(x) => remove("recurring", x.id)}
          render={(x) =>
            `${rub(recurringAmount(x, monthKey(today())))} · ${x.frequency === "monthly" ? "ежемесячно" : x.frequency === "weekly" ? "еженедельно" : "ежегодно"}${x.booked ? " · в отчётах" : " · ориентир"}${x.endMonth ? ` · до ${x.endMonth}` : x.active ? "" : " · выключено"}`
          }
        />
        <SettingsCollection
          title="Другие активы"
          subtitle="Рыночная стоимость сегодня"
          items={data.assets}
          add={() => open({ kind: "asset" })}
          edit={(x) => open({ kind: "asset", item: x })}
          remove={(x) => remove("asset", x.id)}
          render={(x) => rub(x.value)}
        />
      </div>
      <div className="account-footer">
        <span>
          Вход выполнен как <strong>{user.email}</strong>
        </span>
        <Button variant="ghost" icon={LogOut} onClick={() => signOut(auth)}>
          Выйти
        </Button>
      </div>
    </div>
  );
}
function SettingsCollection<T extends { id: string; name: string }>({
  title,
  subtitle,
  items,
  add,
  edit,
  remove,
  render,
}: {
  title: string;
  subtitle: string;
  items: T[];
  add: () => void;
  edit: (x: T) => void;
  remove: (x: T) => void;
  render: (x: T) => string;
}) {
  return (
    <Card className="settings-card">
      <SectionTitle
        eyebrow={subtitle}
        title={title}
        action={<IconButton icon={Plus} label="Добавить" onClick={add} />}
      />
      <div className="settings-list">
        {items.map((x) => (
          <div key={x.id}>
            <span>
              <strong>{x.name}</strong>
              <small>{render(x)}</small>
            </span>
            <IconButton icon={Edit3} label="Изменить" onClick={() => edit(x)} />
            <IconButton
              icon={Trash2}
              label="Удалить"
              danger
              onClick={() => remove(x)}
            />
          </div>
        ))}
      </div>
      {!items.length && <p className="muted">Пока ничего нет.</p>}
      <button className="text-button" onClick={add}>
        <Plus size={16} /> Добавить
      </button>
    </Card>
  );
}
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function EditorForm({
  editor,
  data,
  user,
  onClose,
  onSaved,
  onError,
}: {
  editor: Editor;
  data: Data;
  user: User;
  onClose: () => void;
  onSaved: (kind: EditorKind, item: any) => Promise<void>;
  onError: (s: string) => void;
}) {
  const defaults: Record<EditorKind, any> = {
    transaction: {
      id: uid(),
      type: "expense",
      amount: 0,
      date: today(),
      accountId: data.accounts[0]?.id,
      createdAt: Date.now(),
    },
    goal: {
      id: uid(),
      name: "",
      target: 5000000,
      openingSaved: 0,
      createdAt: today(),
      priority: 2,
      primary: !data.goals.length,
      milestones: [],
    },
    debt: {
      id: uid(),
      name: "",
      kind: "Кредит",
      originalAmount: 0,
      openingBalance: 0,
      annualRate: 0,
      minimumPayment: 0,
      plannedPayment: 0,
      createdAt: today(),
    },
    wish: {
      id: uid(),
      name: "",
      price: 0,
      createdAt: new Date().toISOString(),
      necessity: 2,
      coolingHours: data.profile.defaultCoolingHours || 72,
      status: "waiting",
    },
    account: { id: uid(), name: "", openingBalance: 0 },
    category: { id: uid(), name: "", kind: "expense", defaultTaxRate: 0 },
    recurring: {
      id: uid(),
      name: "",
      kind: "expense",
      amount: 0,
      frequency: "monthly",
      mandatory: true,
      active: true,
      booked: true,
      startMonth: monthKey(today()),
      dayOfMonth: 1,
      taxEnabled: false,
      taxRate: 0,
    },
    asset: { id: uid(), name: "", kind: "Имущество", value: 0 },
    accelerator: {
      id: uid(),
      name: "",
      categoryId: "",
      target: 100000,
      milestones: [3000, 10000, 30000, 50000, 100000],
    },
  };
  const [v, setV] = useState<any>({
    ...defaults[editor.kind],
    ...(editor.item || {}),
    ...(editor.preset || {}),
  });
  const [file, setFile] = useState<File | null>(null),
    [busy, setBusy] = useState(false);
  const set = (key: string, value: any) =>
    setV((p: any) => ({ ...p, [key]: value }));
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      let item = { ...v };
      if (file && ["goal", "wish"].includes(editor.kind)) {
        if (!file.type.startsWith("image/"))
          throw new Error("Выберите изображение");
        if (file.size > 5 * 1024 * 1024)
          throw new Error("Максимальный размер изображения — 5 МБ");
        if (import.meta.env.VITE_ENABLE_STORAGE === "true") {
          try {
            item.imageUrl = await uploadImage(
              user,
              `${editor.kind}s/${v.id}`,
              file,
            );
          } catch {
            item.imageUrl = await compressImage(file);
          }
        } else item.imageUrl = await compressImage(file);
      }
      if (editor.kind === "transaction") {
        if (item.type === "income") {
          item.taxEnabled = Boolean(item.taxEnabled);
          if (
            item.earnedMonth &&
            !/^\d{4}-(0[1-9]|1[0-2])$/.test(item.earnedMonth)
          )
            throw new Error("Укажите корректный месяц начисления");
        } else {
          item.taxEnabled = false;
          item.taxRate = 0;
          delete item.earnedMonth;
        }
        if (item.recurringId && ["income", "expense"].includes(item.type)) {
          item.planMonth ||= monthKey(item.date);
          const linked = recurringForMonth(data, item.planMonth).find(
            (r) => r.id === item.recurringId && r.kind === item.type,
          );
          if (!linked)
            throw new Error(
              "Постоянная строка не действует в выбранном месяце плана",
            );
        } else {
          delete item.recurringId;
          delete item.planMonth;
        }
        if (item.type === "debt_payment" && item.interestAmount > item.amount)
          throw new Error("Проценты не могут превышать платёж");
        if (item.type === "debt_payment") {
          const debt = data.debts.find((d) => d.id === item.debtId);
          const old = data.transactions.find((t) => t.id === item.id);
          if (debt) {
            const available =
              debtBalance(debt, data.transactions) +
              (old?.type === "debt_payment" && old.debtId === debt.id
                ? old.amount - (old.interestAmount || 0)
                : 0);
            if (item.amount - (item.interestAmount || 0) > available + 0.01)
              throw new Error(
                `Основной платёж больше остатка долга (${rub(available)})`,
              );
          }
        }
        if (item.type === "transfer" && item.accountId === item.toAccountId)
          throw new Error("Выберите другой счёт для перевода");
      }
      if (editor.kind === "wish" && item.url && !/^https?:\/\//i.test(item.url))
        throw new Error("Ссылка должна начинаться с https:// или http://");
      if (editor.kind === "debt") {
        item.originalAmount = Math.max(
          item.originalAmount,
          item.openingBalance,
        );
      }
      if (editor.kind === "recurring") {
        const old = editor.item as Recurring | undefined;
        if (old?.booked && !item.booked)
          throw new Error(
            "Остановите постоянную строку в месячном плане, чтобы сохранить прошлые месяцы",
          );
        if (old?.booked && item.frequency !== "monthly")
          throw new Error(
            "Месячную строку можно остановить в плане и создать новую с другой периодичностью",
          );
        item.booked = item.frequency === "monthly" && Boolean(item.booked);
        if (item.kind !== "income") {
          item.taxEnabled = false;
          item.taxRate = 0;
        }
        item.startMonth ||= monthKey(today());
        item.dayOfMonth = Math.min(
          31,
          Math.max(1, Number(item.dayOfMonth) || 1),
        );
        const effectiveMonth = item.effectiveMonth || monthKey(today());
        delete item.effectiveMonth;
        if (
          old?.booked &&
          item.booked &&
          Number(item.amount) !== recurringAmount(old, effectiveMonth)
        ) {
          const revised = reviseRecurring(
            old,
            effectiveMonth,
            Number(item.amount),
            "forward",
          );
          item.amountChanges = revised.amountChanges;
          item.overrides = revised.overrides;
          item.amount = old.amount;
        }
        if (
          old?.booked &&
          item.booked &&
          Number(item.amount) === recurringAmount(old, effectiveMonth)
        )
          item.amount = old.amount;
      }
      if (editor.kind === "goal") {
        item.milestones = (
          typeof item.milestonesText === "string"
            ? item.milestonesText
                .split(/[,;\n]+/)
                .map((x: string) => num(x.trim()))
                .filter((x: number) => x > 0)
            : item.milestones.map((m: any) => m.amount)
        )
          .sort((a: number, b: number) => a - b)
          .map((amount: number) => ({ id: uid(), amount }));
        delete item.milestonesText;
        if (item.primary)
          for (const g of data.goals.filter(
            (g) => g.id !== item.id && g.primary,
          ))
            await onSaved("goal", { ...g, primary: false });
      }
      if (editor.kind === "accelerator") {
        item.milestones =
          typeof item.milestonesText === "string"
            ? item.milestonesText
                .split(/[,;\n]+/)
                .map((x: string) => num(x.trim()))
                .filter((x: number) => x > 0)
            : item.milestones;
        delete item.milestonesText;
      }
      await onSaved(editor.kind, item);
      onClose();
    } catch (err: any) {
      onError(err.message || "Не удалось сохранить");
    } finally {
      setBusy(false);
    }
  };
  const titles: Record<EditorKind, string> = {
    transaction: editor.item ? "Изменить операцию" : "Новая операция",
    goal: editor.item ? "Изменить цель" : "Новая цель",
    debt: editor.item ? "Изменить долг" : "Новое обязательство",
    wish: editor.item ? "Изменить покупку" : "Хочу купить",
    account: editor.item ? "Изменить счёт" : "Новый счёт",
    category: editor.item ? "Изменить категорию" : "Новая категория",
    recurring: editor.item
      ? "Изменить постоянную строку"
      : "Постоянный доход или расход",
    asset: editor.item ? "Изменить актив" : "Новый актив",
    accelerator: editor.item ? "Изменить ускоритель" : "Новый ускоритель",
  };
  const categories = data.categories.filter(
    (c) => c.kind === (v.type === "income" ? "income" : "expense"),
  );
  return (
    <Modal title={titles[editor.kind]} onClose={onClose}>
      <form onSubmit={submit} className="editor-form">
        {editor.kind === "transaction" && (
          <>
            <Field label="Тип операции">
              <Select
                value={v.type}
                onChange={(e) =>
                  setV((p: any) => ({
                    ...p,
                    type: e.target.value,
                    recurringId: "",
                    planMonth: "",
                    earnedMonth:
                      e.target.value === "income" ? p.earnedMonth : "",
                  }))
                }
              >
                {Object.entries(txNames).map(([k, n]) => (
                  <option key={k} value={k}>
                    {n}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="form-grid">
              <Field label="Сумма, ₽">
                <TextInput
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={v.amount}
                  onChange={(e) => set("amount", num(e.target.value))}
                />
              </Field>
              <Field label="Дата">
                <TextInput
                  type="date"
                  required
                  value={v.date}
                  onChange={(e) => set("date", e.target.value)}
                />
              </Field>
            </div>
            {(["income", "expense"] as string[]).includes(v.type) &&
              (Boolean(v.recurringId) ||
                recurringForMonth(data, v.planMonth || monthKey(v.date)).some(
                  (r) => r.kind === v.type,
                )) && (
                <div className="form-grid">
                  <Field label="Месяц плана для этого платежа">
                    <TextInput
                      type="month"
                      value={v.planMonth || monthKey(v.date)}
                      onChange={(e) => set("planMonth", e.target.value)}
                    />
                  </Field>
                  <Field label="Связать с постоянной строкой">
                    <Select
                      value={v.recurringId || ""}
                      onChange={(e) => {
                        const id = e.target.value;
                        const planMonth = v.planMonth || monthKey(v.date);
                        const rule = recurringForMonth(data, planMonth).find(
                          (r) => r.id === id,
                        );
                        setV((p: any) => ({
                          ...p,
                          recurringId: id,
                          planMonth: id ? planMonth : "",
                          ...(rule?.kind === "income" && !p.earnedMonth
                            ? {
                                earnedMonth:
                                  rule.earnedMonthOffset === -1
                                    ? shiftMonthKey(planMonth, -1)
                                    : planMonth,
                              }
                            : {}),
                        }));
                      }}
                    >
                      <option value="">Разовая операция · вне плана</option>
                      {recurringForMonth(data, v.planMonth || monthKey(v.date))
                        .filter((r) => r.kind === v.type)
                        .map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name} ·{" "}
                            {rub(
                              recurringAmount(
                                r,
                                v.planMonth || monthKey(v.date),
                              ),
                            )}
                          </option>
                        ))}
                    </Select>
                  </Field>
                </div>
              )}
            {["income", "expense", "tax"].includes(v.type) && (
              <Field label="Категория">
                <Select
                  value={v.categoryId || ""}
                  onChange={(e) => {
                    const c = data.categories.find(
                      (x) => x.id === e.target.value,
                    );
                    setV((p: any) => ({
                      ...p,
                      categoryId: e.target.value,
                      taxEnabled:
                        p.type === "income" && Boolean(c?.defaultTaxRate),
                      taxRate: c?.defaultTaxRate || p.taxRate || 0,
                    }));
                  }}
                >
                  <option value="">Без категории</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            {v.type === "income" && (
              <>
                <Field label="За какой месяц начислен доход">
                  <TextInput
                    type="month"
                    value={v.earnedMonth || monthKey(v.date)}
                    onChange={(e) => set("earnedMonth", e.target.value)}
                  />
                  <small>
                    Дата выше показывает, когда деньги пришли на счёт. Этот
                    месяц используется в отчёте «По начислению».
                  </small>
                </Field>
                <Field label="Источник / заказчик">
                  <TextInput
                    placeholder="Например, фотосессия"
                    value={v.source || ""}
                    onChange={(e) => set("source", e.target.value)}
                  />
                </Field>
                <label className="check-field">
                  <input
                    type="checkbox"
                    checked={Boolean(v.taxEnabled)}
                    onChange={(e) => set("taxEnabled", e.target.checked)}
                  />{" "}
                  Учитывать налог для этого дохода
                </label>
                {v.taxEnabled && (
                  <div className="form-grid">
                    <Field label="Ставка налога, %">
                      <TextInput
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={v.taxRate ?? data.profile.defaultTaxRate ?? 4}
                        onChange={(e) => set("taxRate", num(e.target.value))}
                      />
                    </Field>
                    <div className="tax-preview">
                      Ожидаемый налог{" "}
                      <strong>
                        {rub(
                          (num(v.amount) *
                            num(
                              v.taxRate ?? data.profile.defaultTaxRate ?? 4,
                            )) /
                            100,
                        )}
                      </strong>
                      <small>
                        Чистый доход:{" "}
                        {rub(
                          num(v.amount) *
                            (1 -
                              num(
                                v.taxRate ?? data.profile.defaultTaxRate ?? 4,
                              ) /
                                100),
                        )}
                      </small>
                    </div>
                  </div>
                )}
              </>
            )}
            {v.type === "saving" && (
              <Field label="Цель">
                <Select
                  value={v.goalId || ""}
                  required
                  onChange={(e) => set("goalId", e.target.value)}
                >
                  <option value="">Выберите цель</option>
                  {data.goals.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </Select>
                <small>
                  Это выделение суммы внутри капитала. Баланс счёта не меняется.
                </small>
              </Field>
            )}
            {v.type === "transfer" && (
              <div className="form-grid">
                <Field label="Со счёта">
                  <Select
                    value={v.accountId || ""}
                    required
                    onChange={(e) => set("accountId", e.target.value)}
                  >
                    <option value="">Выберите счёт</option>
                    {data.accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="На счёт">
                  <Select
                    value={v.toAccountId || ""}
                    required
                    onChange={(e) => set("toAccountId", e.target.value)}
                  >
                    <option value="">Выберите счёт</option>
                    {data.accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            )}
            {v.type === "debt_payment" && (
              <>
                <Field label="Обязательство">
                  <Select
                    value={v.debtId || ""}
                    required
                    onChange={(e) => set("debtId", e.target.value)}
                  >
                    <option value="">Выберите долг</option>
                    {data.debts.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} · остаток{" "}
                        {rub(debtBalance(d, data.transactions))}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Из платежа проценты, ₽">
                  <TextInput
                    type="number"
                    min="0"
                    step="0.01"
                    value={v.interestAmount || 0}
                    onChange={(e) => set("interestAmount", num(e.target.value))}
                  />
                  <small>
                    Остальная часть уменьшит тело долга. Если разбивка
                    неизвестна — оставьте 0.
                  </small>
                </Field>
              </>
            )}
            {!["transfer", "saving"].includes(v.type) && (
              <Field label="Счёт">
                <Select
                  value={v.accountId || ""}
                  onChange={(e) => set("accountId", e.target.value)}
                >
                  <option value="">Без счёта</option>
                  {data.accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <Field label="Комментарий">
              <TextArea
                rows={2}
                value={v.note || ""}
                onChange={(e) => set("note", e.target.value)}
                placeholder="По желанию"
              />
            </Field>
          </>
        )}
        {editor.kind === "goal" && (
          <>
            <Field label="Название цели">
              <TextInput
                required
                value={v.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Например, Дом"
              />
            </Field>
            <div className="form-grid">
              <Field label="Стоимость, ₽">
                <TextInput
                  type="number"
                  min="1"
                  required
                  value={v.target}
                  onChange={(e) => set("target", num(e.target.value))}
                />
              </Field>
              <Field label="Уже накоплено, ₽">
                <TextInput
                  type="number"
                  min="0"
                  value={v.openingSaved}
                  onChange={(e) => set("openingSaved", num(e.target.value))}
                />
              </Field>
              <Field label="Желаемый срок">
                <TextInput
                  type="date"
                  value={v.desiredDate || ""}
                  onChange={(e) => set("desiredDate", e.target.value)}
                />
              </Field>
              <Field label="Приоритет">
                <TextInput
                  type="number"
                  min="1"
                  value={v.priority || 1}
                  onChange={(e) => set("priority", num(e.target.value))}
                />
              </Field>
            </div>
            <Field label="Фото мечты">
              <TextInput
                type="file"
                accept="image/*"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              <small>Личное изображение до 5 МБ. Можно изменить позже.</small>
            </Field>
            <Field label="Контрольные точки, ₽">
              <TextArea
                rows={3}
                value={
                  v.milestonesText ??
                  (v.milestones || []).map((m: any) => m.amount).join(", ")
                }
                onChange={(e) => set("milestonesText", e.target.value)}
                placeholder="200000, 300000, 500000"
              />
            </Field>
            <Field label="Заметка">
              <TextArea
                rows={2}
                value={v.note || ""}
                onChange={(e) => set("note", e.target.value)}
              />
            </Field>
            <label className="check-field">
              <input
                type="checkbox"
                checked={Boolean(v.primary)}
                onChange={(e) => set("primary", e.target.checked)}
              />{" "}
              Главная цель — показывать на первом экране
            </label>
          </>
        )}
        {editor.kind === "debt" && (
          <>
            <Field label="Название">
              <TextInput
                required
                value={v.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Кредитная карта"
              />
            </Field>
            <Field label="Вид обязательства">
              <Select
                value={v.kind}
                onChange={(e) => set("kind", e.target.value)}
              >
                {[
                  "Кредит",
                  "Кредитная карта",
                  "Рассрочка",
                  "Ипотека",
                  "Займ",
                  "Долг человеку",
                  "Налоговая задолженность",
                  "Другое",
                ].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </Select>
            </Field>
            <div className="form-grid">
              <Field label="Исходная сумма">
                <TextInput
                  type="number"
                  min="0"
                  value={v.originalAmount}
                  onChange={(e) => set("originalAmount", num(e.target.value))}
                />
              </Field>
              <Field label="Текущий остаток до записанных платежей">
                <TextInput
                  type="number"
                  min="0"
                  required
                  value={v.openingBalance}
                  onChange={(e) => set("openingBalance", num(e.target.value))}
                />
              </Field>
              <Field label="Ставка годовых, %">
                <TextInput
                  type="number"
                  min="0"
                  step="0.1"
                  value={v.annualRate}
                  onChange={(e) => set("annualRate", num(e.target.value))}
                />
              </Field>
              <Field label="Минимум в месяц">
                <TextInput
                  type="number"
                  min="0"
                  value={v.minimumPayment}
                  onChange={(e) => set("minimumPayment", num(e.target.value))}
                />
              </Field>
              <Field label="Плановый платёж">
                <TextInput
                  type="number"
                  min="0"
                  value={v.plannedPayment}
                  onChange={(e) => set("plannedPayment", num(e.target.value))}
                />
              </Field>
              <Field label="Следующий платёж">
                <TextInput
                  type="date"
                  value={v.nextPaymentDate || ""}
                  onChange={(e) => set("nextPaymentDate", e.target.value)}
                />
              </Field>
              <Field label="Плановая дата окончания">
                <TextInput
                  type="date"
                  value={v.endDate || ""}
                  onChange={(e) => set("endDate", e.target.value)}
                />
              </Field>
              <Field label="Кредитор">
                <TextInput
                  value={v.creditor || ""}
                  onChange={(e) => set("creditor", e.target.value)}
                />
              </Field>
            </div>
            <Field label="Комментарий">
              <TextArea
                rows={2}
                value={v.note || ""}
                onChange={(e) => set("note", e.target.value)}
              />
            </Field>
          </>
        )}
        {editor.kind === "wish" && (
          <>
            <Field label="Что хочется купить">
              <TextInput
                required
                value={v.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Новый объектив"
              />
            </Field>
            <div className="form-grid">
              <Field label="Цена, ₽">
                <TextInput
                  type="number"
                  min="1"
                  required
                  value={v.price}
                  onChange={(e) => set("price", num(e.target.value))}
                />
              </Field>
              <Field label="Пауза, часов">
                <Select
                  value={v.coolingHours}
                  onChange={(e) => set("coolingHours", num(e.target.value))}
                >
                  <option value={24}>24 часа</option>
                  <option value={72}>72 часа</option>
                  <option value={168}>7 дней</option>
                  <option value={0}>Без паузы</option>
                </Select>
              </Field>
              <Field label="Насколько нужно">
                <Select
                  value={v.necessity}
                  onChange={(e) => set("necessity", num(e.target.value))}
                >
                  <option value={1}>Скорее желание</option>
                  <option value={2}>Можно подождать</option>
                  <option value={3}>Очень нужно</option>
                </Select>
              </Field>
              <Field label="Ссылка">
                <TextInput
                  type="url"
                  value={v.url || ""}
                  onChange={(e) => set("url", e.target.value)}
                  placeholder="https://"
                />
              </Field>
            </div>
            <Field label="Почему хочется">
              <TextArea
                rows={2}
                value={v.reason || ""}
                onChange={(e) => set("reason", e.target.value)}
              />
            </Field>
            <Field label="Фото">
              <TextInput
                type="file"
                accept="image/*"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </Field>
          </>
        )}
        {editor.kind === "account" && (
          <>
            <Field label="Название счёта">
              <TextInput
                required
                value={v.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Карта, наличные, резерв…"
              />
            </Field>
            <Field label="Стартовый баланс">
              <TextInput
                type="number"
                value={v.openingBalance}
                onChange={(e) =>
                  set("openingBalance", Number(e.target.value) || 0)
                }
              />
            </Field>
          </>
        )}
        {editor.kind === "category" && (
          <>
            <Field label="Название">
              <TextInput
                required
                value={v.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </Field>
            <Field label="Тип">
              <Select
                value={v.kind}
                onChange={(e) => set("kind", e.target.value)}
              >
                <option value="expense">Расход</option>
                <option value="income">Доход</option>
              </Select>
            </Field>
            {v.kind === "income" && (
              <Field label="Налог по умолчанию, %">
                <TextInput
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={v.defaultTaxRate || 0}
                  onChange={(e) => set("defaultTaxRate", num(e.target.value))}
                />
              </Field>
            )}
          </>
        )}
        {editor.kind === "recurring" && (
          <>
            <Field label="Название">
              <TextInput
                required
                value={v.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </Field>
            <div className="form-grid">
              <Field label="Тип">
                <Select
                  value={v.kind}
                  disabled={Boolean(editor.item?.booked)}
                  onChange={(e) => set("kind", e.target.value)}
                >
                  <option value="expense">Расход</option>
                  <option value="income">Доход</option>
                </Select>
              </Field>
              <Field label="Сумма">
                <TextInput
                  type="number"
                  min="0"
                  required
                  value={v.amount}
                  onChange={(e) => set("amount", num(e.target.value))}
                />
              </Field>
              <Field label="Периодичность">
                <Select
                  value={v.frequency}
                  disabled={Boolean(editor.item?.booked)}
                  onChange={(e) => set("frequency", e.target.value)}
                >
                  <option value="weekly">Еженедельно</option>
                  <option value="monthly">Ежемесячно</option>
                  <option value="yearly">Ежегодно</option>
                </Select>
              </Field>
              {v.frequency === "monthly" && (
                <>
                  <Field label="Начиная с месяца">
                    <TextInput
                      type="month"
                      value={v.startMonth || monthKey(today())}
                      disabled={Boolean(editor.item?.booked)}
                      onChange={(e) => set("startMonth", e.target.value)}
                    />
                  </Field>
                  <Field label="День месяца">
                    <TextInput
                      type="number"
                      min="1"
                      max="31"
                      value={v.dayOfMonth || 1}
                      onChange={(e) => set("dayOfMonth", num(e.target.value))}
                    />
                  </Field>
                </>
              )}
              <Field label="Категория">
                <Select
                  value={v.categoryId || ""}
                  onChange={(e) => set("categoryId", e.target.value)}
                >
                  <option value="">Без категории</option>
                  {data.categories
                    .filter((c) => c.kind === v.kind)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </Select>
              </Field>
              {v.kind === "income" && (
                <Field label="Налог, %">
                  <TextInput
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={v.taxRate || 0}
                    onChange={(e) => set("taxRate", num(e.target.value))}
                  />
                </Field>
              )}
              {v.kind === "income" && v.frequency === "monthly" && (
                <Field label="За какой месяц этот доход">
                  <Select
                    value={v.earnedMonthOffset || 0}
                    onChange={(e) =>
                      set("earnedMonthOffset", Number(e.target.value))
                    }
                  >
                    <option value={0}>За месяц поступления</option>
                    <option value={-1}>За предыдущий месяц</option>
                  </Select>
                </Field>
              )}
            </div>
            {v.kind === "income" && (
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={Boolean(v.taxEnabled)}
                  onChange={(e) => set("taxEnabled", e.target.checked)}
                />{" "}
                Учитывать налог для этого дохода
              </label>
            )}
            {v.frequency === "monthly" && (
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={Boolean(v.booked)}
                  disabled={Boolean(editor.item?.booked)}
                  onChange={(e) => set("booked", e.target.checked)}
                />{" "}
                Включать автоматически в месячные доходы и расходы
              </label>
            )}
            <label className="check-field">
              <input
                type="checkbox"
                checked={Boolean(v.mandatory)}
                onChange={(e) => set("mandatory", e.target.checked)}
              />{" "}
              Обязательный платёж
            </label>
            {!v.booked && (
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={Boolean(v.active)}
                  onChange={(e) => set("active", e.target.checked)}
                />{" "}
                Активен
              </label>
            )}
            {v.booked && (
              <p className="muted">
                Это плановая строка: в отчёте она появится автоматически.
                Фактический остаток на счёте меняют только отдельные операции.
              </p>
            )}
          </>
        )}
        {editor.kind === "asset" && (
          <>
            <Field label="Название">
              <TextInput
                required
                value={v.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </Field>
            <Field label="Вид актива">
              <Select
                value={v.kind}
                onChange={(e) => set("kind", e.target.value)}
              >
                {["Имущество", "Инвестиции", "Техника", "Другое"].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </Select>
            </Field>
            <Field label="Реалистичная цена продажи сейчас">
              <TextInput
                type="number"
                min="0"
                required
                value={v.value}
                onChange={(e) => set("value", num(e.target.value))}
              />
            </Field>
          </>
        )}
        {editor.kind === "accelerator" && (
          <>
            <Field label="Название направления">
              <TextInput
                required
                value={v.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Фотосессии"
              />
            </Field>
            <Field label="Категория реального дохода">
              <Select
                required
                value={v.categoryId}
                onChange={(e) => set("categoryId", e.target.value)}
              >
                <option value="">Выберите категорию</option>
                {data.categories
                  .filter((c) => c.kind === "income")
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label="Цель, ₽">
              <TextInput
                type="number"
                min="1"
                required
                value={v.target}
                onChange={(e) => set("target", num(e.target.value))}
              />
            </Field>
            <Field label="Этапы через запятую">
              <TextArea
                rows={2}
                value={v.milestonesText ?? (v.milestones || []).join(", ")}
                onChange={(e) => set("milestonesText", e.target.value)}
              />
            </Field>
          </>
        )}
        <div className="form-actions">
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" disabled={busy} icon={Check}>
            {busy ? "Сохраняем…" : "Сохранить"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image(),
      url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, 1000 / Math.max(img.width, img.height)),
        canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas
        .getContext("2d")
        ?.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      let output = canvas.toDataURL("image/jpeg", 0.7);
      for (const quality of [0.6, 0.5, 0.4]) {
        if (output.length < 700_000) break;
        output = canvas.toDataURL("image/jpeg", quality);
      }
      if (output.length >= 700_000)
        reject(new Error("Фото слишком большое даже после сжатия"));
      else resolve(output);
    };
    img.onerror = () => reject(new Error("Не удалось обработать изображение"));
    img.src = url;
  });
}

type CapitalAppProps = {
  embeddedUser?: User | null;
  onExit?: () => void;
  onCapitalChange?: (value: number) => void;
};

export default function CapitalApp({
  embeddedUser = null,
  onExit,
  onCapitalChange,
}: CapitalAppProps) {
  const [sessionUser, setSessionUser] = useState<User | null>(null),
    [authReady, setAuthReady] = useState(false),
    [page, setPage] = useState<Page>("dashboard"),
    [monthlyMonth, setMonthlyMonth] = useState(monthKey(today())),
    [editor, setEditor] = useState<Editor | null>(null),
    [fullGoal, setFullGoal] = useState<Goal | null>(null),
    [mobileMore, setMobileMore] = useState(false),
    [quick, setQuick] = useState(false),
    [toast, setToast] = useState(""),
    [error, setError] = useState("");
  const user = embeddedUser || sessionUser;
  useEffect(() => {
    if (embeddedUser) {
      setAuthReady(true);
      return;
    }
    return onAuthStateChanged(auth, (nextUser) => {
      setSessionUser(nextUser);
      setAuthReady(true);
    });
  }, [embeddedUser]);
  const { data, loading, error: dataError } = useData(user);
  const reportData = useMemo<Data>(
    () => ({
      ...data,
      transactions: effectiveTransactions(data),
    }),
    [data],
  );
  useEffect(() => {
    if (dataError) setError(dataError);
  }, [dataError]);
  const currentCapital = useMemo(() => netWorth(reportData).total, [reportData]);
  useEffect(() => {
    if (!loading && data.profile.onboarded && onCapitalChange) {
      onCapitalChange(currentCapital);
    }
  }, [currentCapital, data.profile.onboarded, loading, onCapitalChange]);
  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timeout);
  }, [toast]);
  useEffect(() => {
    if (!error) return;
    const timeout = setTimeout(() => setError(""), 8000);
    return () => clearTimeout(timeout);
  }, [error]);
  const save = async (kind: EditorKind, item: any) => {
    if (!user) return;
    const map: Record<EditorKind, any> = {
      transaction: "transactions",
      goal: "goals",
      debt: "debts",
      wish: "wishes",
      account: "accounts",
      category: "categories",
      recurring: "recurring",
      asset: "assets",
      accelerator: "accelerators",
    };
    await saveItem(user, map[kind], item);
    if (kind === "transaction" && item.type === "saving") {
      const goal = data.goals.find((g) => g.id === item.goalId);
      const old = data.transactions.find((t) => t.id === item.id);
      if (goal) {
        const previous =
          goalSaved(goal, data.transactions) -
          (old?.type === "saving" && old.goalId === goal.id ? old.amount : 0);
        const reached = goal.milestones
          .filter(
            (m) => m.amount > previous && m.amount <= previous + item.amount,
          )
          .sort((a, b) => b.amount - a.amount)[0];
        setToast(
          reached
            ? `Новая контрольная точка: ${rub(reached.amount)} к «${goal.name}»`
            : `+${rub(item.amount)} к «${goal.name}»`,
        );
      } else setToast("Сохранено");
    } else if (kind === "transaction" && item.type === "debt_payment") {
      const debt = data.debts.find((d) => d.id === item.debtId);
      const old = data.transactions.find((t) => t.id === item.id);
      if (debt) {
        const previous =
          debtBalance(debt, data.transactions) +
          (old?.type === "debt_payment" && old.debtId === debt.id
            ? old.amount - (old.interestAmount || 0)
            : 0);
        setToast(
          previous > 0 &&
            previous - (item.amount - (item.interestAmount || 0)) <= 0
            ? `${debt.name} закрыт. ${rub(debt.minimumPayment)} в месяц освободились.`
            : "Платёж записан",
        );
      } else setToast("Платёж записан");
    } else setToast("Сохранено");
  };
  const remove = async (kind: EditorKind, id: string) => {
    if (!user) return;
    const inUse =
      kind === "goal"
        ? data.transactions.some((t) => t.goalId === id)
        : kind === "debt"
          ? data.transactions.some((t) => t.debtId === id)
          : kind === "account"
            ? data.transactions.some(
                (t) => t.accountId === id || t.toAccountId === id,
              )
            : kind === "category"
              ? data.transactions.some((t) => t.categoryId === id) ||
                data.accelerators.some((a) => a.categoryId === id) ||
                data.recurring.some((r) => r.categoryId === id)
              : false;
    if (inUse) {
      setError(
        "Запись используется в операциях. Сначала измените связанные записи.",
      );
      return;
    }
    if (!window.confirm("Удалить запись? Это действие нельзя отменить."))
      return;
    try {
      if (kind === "recurring") {
        const rule = data.recurring.find((r) => r.id === id);
        if (
          rule?.booked &&
          (rule.startMonth || monthKey(today())) < monthKey(today())
        ) {
          await saveItem(user, "recurring", {
            ...rule,
            active: false,
            endMonth: shiftMonth(monthKey(today()), -1),
          });
          setToast("План остановлен с текущего месяца; история сохранена");
          return;
        }
      }
      const map: Record<EditorKind, any> = {
        transaction: "transactions",
        goal: "goals",
        debt: "debts",
        wish: "wishes",
        account: "accounts",
        category: "categories",
        recurring: "recurring",
        asset: "assets",
        accelerator: "accelerators",
      };
      await removeItem(user, map[kind], id);
      setToast("Запись удалена");
    } catch (e: any) {
      setError(e.message);
    }
  };
  const currentTitle = nav.find((n) => n.id === page)?.label || "Штаб";
  const openPlanMonth = (month: string) => {
    setMonthlyMonth(month);
    setPage("monthly");
  };
  if (!authReady)
    return (
      <div className="loading-screen">
        <div className="brand-logo">
          K<span>•</span>
        </div>
        <p>Загружаем ваш штаб…</p>
      </div>
    );
  if (!user)
    return (
      <>
        <Login onError={setError} />
        {error && <div className="toast toast-error">{error}</div>}
      </>
    );
  if (loading)
    return (
      <div className="loading-screen">
        <div className="brand-logo">
          K<span>•</span>
        </div>
        <p>Готовим ваши данные…</p>
      </div>
    );
  if (!data.profile.onboarded)
    return (
      <>
        <Onboarding user={user} onError={setError} />
        {error && <div className="toast toast-error">{error}</div>}
      </>
    );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">
            K<span>•</span>
          </div>
          <div>
            КАПИТАЛ<small>финансовый штаб</small>
          </div>
        </div>
        <div className="side-divider" />
        <span className="side-caption">РАБОЧЕЕ ПРОСТРАНСТВО</span>
        <nav>
          {nav.map((n) => {
            const Icon = n.icon;
            return (
              <button
                key={n.id}
                className={page === n.id ? "active" : ""}
                onClick={() => setPage(n.id)}
              >
                <Icon size={19} strokeWidth={1.9} />
                {n.label}
                {page === n.id && <span className="active-dot" />}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-quote">
            <Sparkles size={18} />
            <p>
              Не ограничение. <strong>Приближение.</strong>
            </p>
          </div>
          <button className="user-chip" onClick={() => setPage("settings")}>
            <div className="avatar">
              {user.photoURL ? (
                <img src={user.photoURL} alt="" />
              ) : (
                (user.displayName || "K").slice(0, 1)
              )}
            </div>
            <span>
              <strong>{user.displayName || "Мой профиль"}</strong>
              <small>{user.email}</small>
            </span>
            <MoreHorizontal size={18} />
          </button>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          {onExit && (
            <button className="capital-exit" type="button" onClick={onExit}>
              <ArrowLeft size={17} />
              120 дней
            </button>
          )}
          <div className="mobile-brand">
            <div className="brand-logo">
              K<span>•</span>
            </div>
            <strong>КАПИТАЛ</strong>
          </div>
          <div className="topbar-crumb">
            МОЙ ШТАБ <ChevronRight size={14} /> <span>{currentTitle}</span>
          </div>
          <div className="topbar-right">
            <span className="today-pill">
              {new Date().toLocaleDateString("ru-RU", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
            <button className="top-avatar" onClick={() => setPage("settings")}>
              {user.photoURL ? (
                <img src={user.photoURL} alt="" />
              ) : (
                (user.displayName || "K").slice(0, 1)
              )}
            </button>
          </div>
        </header>
        {page === "dashboard" && (
          <Dashboard
            data={reportData}
            user={user}
            notify={setToast}
            fail={setError}
            setPage={setPage}
            open={setEditor}
            setFullGoal={setFullGoal}
          />
        )}
        {page === "transactions" && (
          <TransactionsPage
            data={reportData}
            open={setEditor}
            remove={remove}
            onPlanMonth={openPlanMonth}
          />
        )}
        {page === "monthly" && (
          <MonthlyPlanPage
            data={data}
            user={user}
            open={setEditor}
            notify={setToast}
            fail={setError}
            initialMonth={monthlyMonth}
          />
        )}
        {page === "goals" && (
          <GoalsPage
            data={reportData}
            open={setEditor}
            remove={remove}
            setFullGoal={setFullGoal}
          />
        )}
        {page === "analytics" && (
          <AnalyticsPage data={reportData} open={setEditor} />
        )}
        {page === "debts" && (
          <DebtsPage data={reportData} open={setEditor} remove={remove} />
        )}
        {page === "wishes" && (
          <WishesPage
            data={reportData}
            user={user}
            open={setEditor}
            remove={remove}
            notify={setToast}
            fail={setError}
          />
        )}
        {page === "settings" && (
          <SettingsPage
            data={data}
            user={user}
            open={setEditor}
            remove={remove}
            notify={setToast}
            fail={setError}
          />
        )}
      </main>
      <button
        className="floating-add"
        aria-label="Быстро добавить"
        onClick={() => setQuick(true)}
      >
        <Plus size={26} />
      </button>
      <nav className="mobile-nav">
        {nav
          .filter((n) =>
            ["dashboard", "transactions", "analytics", "monthly"].includes(
              n.id,
            ),
          )
          .map((n) => {
            const Icon = n.icon;
            return (
              <button
                key={n.id}
                className={page === n.id ? "active" : ""}
                onClick={() => {
                  setPage(n.id);
                  setMobileMore(false);
                }}
              >
                <Icon size={21} />
                <span>{n.label}</span>
              </button>
            );
          })}
        <button
          className={
            ["goals", "debts", "wishes", "settings"].includes(page)
              ? "active"
              : ""
          }
          onClick={() => setMobileMore(true)}
        >
          <Menu size={21} />
          <span>Ещё</span>
        </button>
      </nav>
      {mobileMore && (
        <div className="more-backdrop" onClick={() => setMobileMore(false)}>
          <div className="more-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            {nav
              .filter((n) =>
                ["goals", "debts", "wishes", "settings"].includes(n.id),
              )
              .map((n) => {
                const Icon = n.icon;
                return (
                  <button
                    key={n.id}
                    onClick={() => {
                      setPage(n.id);
                      setMobileMore(false);
                    }}
                  >
                    <Icon size={20} />
                    {n.label}
                    <ChevronRight size={18} />
                  </button>
                );
              })}
          </div>
        </div>
      )}
      {quick && (
        <div className="more-backdrop" onClick={() => setQuick(false)}>
          <div
            className="more-sheet quick-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sheet-handle" />
            <h3>Что добавим?</h3>
            {[
              ["income", "Доход", ArrowDownLeft],
              ["expense", "Расход", ArrowUpRight],
              ["transfer", "Перевод", RefreshCw],
              ["saving", "В цель", Target],
              ["debt_payment", "Платёж по долгу", Landmark],
            ].map(([type, label, Icon]: any) => (
              <button
                key={type}
                onClick={() => {
                  setQuick(false);
                  setEditor({ kind: "transaction", preset: { type } });
                }}
              >
                <Icon size={20} />
                {label}
                <ChevronRight size={18} />
              </button>
            ))}
            <button
              onClick={() => {
                setQuick(false);
                setEditor({ kind: "wish" });
              }}
            >
              <Heart size={20} />
              Хочу купить
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}
      {editor && (
        <EditorForm
          key={
            editor.kind + "-" + (editor.item?.id || editor.preset?.id || "new")
          }
          editor={editor}
          data={data}
          user={user}
          onClose={() => setEditor(null)}
          onSaved={save}
          onError={setError}
        />
      )}
      {fullGoal && (
        <FullGoal
          data={data}
          goal={fullGoal}
          onClose={() => setFullGoal(null)}
          open={setEditor}
        />
      )}
      {toast && (
        <div className="toast">
          <Check size={17} />
          {toast}
        </div>
      )}
      {error && (
        <div className="toast toast-error">
          <CircleHelp size={17} />
          {error}
        </div>
      )}
    </div>
  );
}
