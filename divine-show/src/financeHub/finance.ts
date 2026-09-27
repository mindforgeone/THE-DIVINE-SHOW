import type {
  Account,
  Data,
  Debt,
  Goal,
  Recurring,
  Transaction,
} from "./types";

export const rub = (value: number, compact = false) =>
  new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 0,
    notation: compact ? "compact" : "standard",
  }).format(Number.isFinite(value) ? value : 0) + " ₽";
export const percent = (value: number) =>
  `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(Number.isFinite(value) ? value : 0)}%`;
export const localDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const today = () => localDay(new Date());
export const monthKey = (date: string) => date.slice(0, 7);
export const shiftMonthKey = (key: string, offset: number) => {
  const [year, month] = key.split("-").map(Number);
  return localDay(new Date(year, month - 1 + offset, 1)).slice(0, 7);
};
export const reportMonth = (t: Transaction, basis: "cash" | "earned") =>
  basis === "earned" && t.type === "income" && t.earnedMonth
    ? t.earnedMonth
    : monthKey(t.date);
export const monthStart = (offset = 0) => {
  const d = new Date();
  const month = new Date(d.getFullYear(), d.getMonth() + offset, 1);
  return localDay(month).slice(0, 7);
};
export function recurringAmount(r: Recurring, month: string) {
  if (r.overrides && Object.hasOwn(r.overrides, month))
    return Math.max(0, r.overrides[month]);
  const latest = Object.keys(r.amountChanges || {})
    .filter((key) => key <= month)
    .sort()
    .at(-1);
  return Math.max(0, latest ? r.amountChanges![latest] : r.amount);
}
export function reviseRecurring(
  r: Recurring,
  month: string,
  amount: number,
  scope: "month" | "forward",
): Recurring {
  if (scope === "month")
    return { ...r, overrides: { ...r.overrides, [month]: amount } };
  const overrides = { ...r.overrides };
  delete overrides[month];
  return {
    ...r,
    amountChanges: {
      ...Object.fromEntries(
        Object.entries(r.amountChanges || {}).filter(([key]) => key < month),
      ),
      [month]: amount,
    },
    overrides,
  };
}
export function recurringForMonth(data: Data, month: string) {
  return data.recurring.filter(
    (r) =>
      r.booked &&
      r.frequency === "monthly" &&
      (r.startMonth || data.profile.createdAt?.slice(0, 7) || month) <= month &&
      (!r.endMonth || r.endMonth >= month) &&
      (r.active || Boolean(r.endMonth)),
  );
}
export function plannedTransactions(data: Data, throughMonth = monthStart()) {
  const start =
    [
      data.profile.createdAt?.slice(0, 7),
      ...data.recurring.filter((r) => r.booked).map((r) => r.startMonth),
    ]
      .filter((v): v is string => Boolean(v))
      .sort()[0] || throughMonth;
  let first = new Date(start + "-01T12:00:00");
  const last = new Date(throughMonth + "-01T12:00:00");
  const distance =
    (last.getFullYear() - first.getFullYear()) * 12 +
    last.getMonth() -
    first.getMonth() +
    1;
  if (distance > 240)
    first = new Date(last.getFullYear(), last.getMonth() - 239, 1);
  const months = Math.min(240, Math.max(0, distance));
  const result: Transaction[] = [];
  for (let i = 0; i < months; i++) {
    const year = first.getFullYear(),
      monthNumber = first.getMonth() + i;
    const d = new Date(year, monthNumber, 1);
    const key = localDay(d).slice(0, 7);
    for (const r of recurringForMonth(data, key)) {
      const amount = recurringAmount(r, key);
      if (amount <= 0) continue;
      const day = Math.min(
        Math.max(1, r.dayOfMonth || 1),
        new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(),
      );
      result.push({
        id: `plan:${r.id}:${key}`,
        type: r.kind,
        amount,
        date: `${key}-${String(day).padStart(2, "0")}`,
        ...(r.kind === "income" && r.earnedMonthOffset === -1
          ? { earnedMonth: shiftMonthKey(key, -1) }
          : {}),
        categoryId: r.categoryId,
        source: r.name,
        note: "Месячный план",
        taxEnabled: r.kind === "income" && Boolean(r.taxEnabled),
        taxRate: r.taxRate || 0,
        recurringId: r.id,
        planned: true,
      });
    }
  }
  return result;
}
export function effectiveTransactions(data: Data, throughMonth = monthStart()) {
  const actual = data.transactions.filter((t) => !t.planned);
  const recorded = new Set(
    actual
      .filter(
        (t) => t.recurringId && (t.type === "income" || t.type === "expense"),
      )
      .map((t) => `${t.recurringId}:${t.planMonth || monthKey(t.date)}`),
  );
  const remainingPlan = plannedTransactions(data, throughMonth).filter(
    (t) => !recorded.has(`${t.recurringId}:${monthKey(t.date)}`),
  );
  return [...actual, ...remainingPlan];
}
export const clamp = (n: number, lo = 0, hi = 1) =>
  Math.min(hi, Math.max(lo, n));

export function txTax(t: Transaction) {
  return t.type === "income" && t.taxEnabled
    ? Math.round((t.amount * (t.taxRate || 0)) / 100)
    : 0;
}
export function debtBalance(debt: Debt, txs: Transaction[]) {
  const principal = txs
    .filter((t) => t.type === "debt_payment" && t.debtId === debt.id)
    .reduce((s, t) => s + Math.max(0, t.amount - (t.interestAmount || 0)), 0);
  return Math.max(0, debt.openingBalance - principal);
}
export function debtClosedDate(debt: Debt, txs: Transaction[]) {
  if (debt.openingBalance <= 0) return debt.createdAt;
  let balance = debt.openingBalance;
  for (const payment of txs
    .filter((t) => t.type === "debt_payment" && t.debtId === debt.id)
    .sort((a, b) => a.date.localeCompare(b.date))) {
    balance -= Math.max(0, payment.amount - (payment.interestAmount || 0));
    if (balance <= 0) return payment.date;
  }
  return null;
}
export function accountBalance(account: Account, txs: Transaction[]) {
  return (
    account.openingBalance +
    txs.reduce((sum, t) => {
      if (t.type === "income" && t.accountId === account.id)
        return sum + t.amount;
      if (
        ["expense", "tax", "debt_payment"].includes(t.type) &&
        t.accountId === account.id
      )
        return sum - t.amount;
      if (t.type === "transfer")
        return (
          sum -
          (t.accountId === account.id ? t.amount : 0) +
          (t.toAccountId === account.id ? t.amount : 0)
        );
      return sum;
    }, 0)
  );
}
export function goalSaved(goal: Goal, txs: Transaction[]) {
  return (
    goal.openingSaved +
    txs
      .filter((t) => t.type === "saving" && t.goalId === goal.id)
      .reduce((s, t) => s + t.amount, 0)
  );
}
export function totals(txs: Transaction[]) {
  const income = txs
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + t.amount, 0);
  const expense = txs
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + t.amount, 0);
  const taxAccrued = txs.reduce((s, t) => s + txTax(t), 0);
  const taxPaid = txs
    .filter((t) => t.type === "tax")
    .reduce((s, t) => s + t.amount, 0);
  const taxes = Math.max(taxAccrued, taxPaid);
  const debtPaid = txs
    .filter((t) => t.type === "debt_payment")
    .reduce((s, t) => s + t.amount, 0);
  const interest = txs
    .filter((t) => t.type === "debt_payment")
    .reduce((s, t) => s + (t.interestAmount || 0), 0);
  const allocated = txs
    .filter((t) => t.type === "saving")
    .reduce((s, t) => s + t.amount, 0);
  const freeCash = income - expense - taxes - debtPaid;
  return {
    income,
    expense,
    taxes,
    taxAccrued,
    taxPaid,
    debtPaid,
    interest,
    allocated,
    freeCash,
    savingsRate: income > 0 ? (100 * freeCash) / income : 0,
  };
}
export function monthlyTotals(txs: Transaction[], key: string) {
  return totals(txs.filter((t) => monthKey(t.date) === key));
}
export function monthSeries(txs: Transaction[], count = 6) {
  return Array.from({ length: count }, (_, i) => {
    const key = monthStart(i - count + 1);
    return {
      key,
      label: new Date(key + "-01").toLocaleDateString("ru-RU", {
        month: "short",
      }),
      ...monthlyTotals(txs, key),
    };
  });
}
export function wealthSeries(data: Data, count = 6) {
  return Array.from({ length: count }, (_, i) => {
    const key = monthStart(i - count + 1);
    const end = localDay(
      new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)), 0),
    );
    const wealth = netWorth({
      ...data,
      transactions: data.transactions.filter((t) => t.date <= end),
      debts: data.debts.filter((d) => d.createdAt <= end),
    });
    return {
      key,
      label: new Date(key + "-01T12:00:00").toLocaleDateString("ru-RU", {
        month: "short",
      }),
      worth:
        data.profile.createdAt && end < data.profile.createdAt
          ? null
          : wealth.total,
      debt:
        data.profile.createdAt && end < data.profile.createdAt
          ? null
          : wealth.debt,
    };
  });
}
export function lifeMinimum(data: Data) {
  const month = monthStart();
  const recurring = data.recurring
    .filter(
      (r) =>
        r.kind === "expense" &&
        r.mandatory &&
        (r.booked
          ? recurringForMonth(data, month).some((x) => x.id === r.id)
          : r.active),
    )
    .reduce(
      (s, r) =>
        s +
        recurringAmount(r, month) *
          (r.frequency === "weekly"
            ? 52 / 12
            : r.frequency === "yearly"
              ? 1 / 12
              : 1),
      0,
    );
  const debts = data.debts
    .filter((d) => !d.closed && debtBalance(d, data.transactions) > 0)
    .reduce((s, d) => s + d.minimumPayment, 0);
  return Math.max(data.profile.budgetMinimum || 0, recurring + debts);
}
export function savingsPace(data: Data) {
  const recentKeys = [monthStart(0), monthStart(-1), monthStart(-2)];
  const savings = data.transactions.filter(
    (t) => t.type === "saving" && recentKeys.includes(monthKey(t.date)),
  );
  if (savings.length) {
    const opened = data.profile.createdAt
      ? new Date(data.profile.createdAt + "T12:00:00")
      : new Date();
    const now = new Date();
    const observed = Math.min(
      3,
      Math.max(
        1,
        (now.getFullYear() - opened.getFullYear()) * 12 +
          now.getMonth() -
          opened.getMonth() +
          1,
      ),
    );
    return savings.reduce((s, t) => s + t.amount, 0) / observed;
  }
  const recurringIncome = data.recurring
    .filter(
      (r) =>
        r.kind === "income" &&
        (r.booked
          ? recurringForMonth(data, monthStart()).some((x) => x.id === r.id)
          : r.active),
    )
    .reduce(
      (sum, r) =>
        sum +
        recurringAmount(r, monthStart()) *
          (r.frequency === "weekly"
            ? 52 / 12
            : r.frequency === "yearly"
              ? 1 / 12
              : 1),
      0,
    );
  const plan =
    (data.recurring.some((r) => r.booked && r.kind === "income")
      ? recurringIncome
      : data.profile.expectedIncome || recurringIncome) -
    Math.max(data.profile.budgetComfort || 0, lifeMinimum(data));
  return Math.max(0, plan);
}
export function forecast(goal: Goal, saved: number, monthly: number) {
  const remaining = Math.max(0, goal.target - saved);
  if (remaining <= 0) return { months: 0, date: new Date() };
  if (monthly <= 0) return null;
  const months = remaining / monthly;
  if (months > 360) return null;
  const date = new Date();
  date.setDate(date.getDate() + Math.ceil(months * 30.44));
  return { months, date };
}
export function projectedDebt(debt: Debt, balance: number, payment: number) {
  if (balance <= 0) return { months: 0, interest: 0 };
  if (payment <= 0) return null;
  const monthlyRate = debt.annualRate / 1200;
  let principal = balance,
    interest = 0,
    months = 0;
  while (principal > 0.01 && months < 600) {
    const monthlyInterest = principal * monthlyRate;
    if (payment <= monthlyInterest) return null;
    interest += monthlyInterest;
    principal = Math.max(0, principal + monthlyInterest - payment);
    months++;
  }
  return principal > 0 ? null : { months, interest };
}
export function debtGoalScenario(
  data: Data,
  goal: Goal,
  extraMonthly: number,
  debtShare: number,
) {
  const debts = data.debts
    .filter((d) => !d.closed && debtBalance(d, data.transactions) > 0)
    .map((d) => ({ ...d, balance: debtBalance(d, data.transactions) }))
    .sort((a, b) => b.annualRate - a.annualRate);
  const initialMinimum = debts.reduce((sum, d) => sum + d.minimumPayment, 0);
  const pace = savingsPace(data);
  let saved = goalSaved(goal, data.transactions);
  let debtMonths: number | null = debts.length ? null : 0;
  let goalMonths: number | null = saved >= goal.target ? 0 : null;
  let interestTotal = 0;
  let estimatedWorth = netWorth(data).total;
  let worthAtGoal = goalMonths === 0 ? estimatedWorth : null;
  for (
    let month = 1;
    month <= 600 && (goalMonths === null || debtMonths === null);
    month++
  ) {
    let interestThisMonth = 0;
    let releasedMinimum = 0;
    for (const d of debts) {
      if (d.balance <= 0) releasedMinimum += d.minimumPayment;
      else {
        const interest = (d.balance * d.annualRate) / 1200;
        d.balance += interest;
        interestThisMonth += interest;
        d.balance = Math.max(0, d.balance - d.minimumPayment);
      }
    }
    let extraDebt = extraMonthly * clamp(debtShare);
    for (const d of debts) {
      if (d.balance <= 0) continue;
      const payment = Math.min(extraDebt, d.balance);
      d.balance -= payment;
      extraDebt -= payment;
    }
    if (debtMonths === null && debts.every((d) => d.balance <= 0))
      debtMonths = month;
    interestTotal += interestThisMonth;
    estimatedWorth += pace + initialMinimum + extraMonthly - interestThisMonth;
    saved += Math.max(
      0,
      pace +
        releasedMinimum +
        extraMonthly * (1 - clamp(debtShare)) +
        extraDebt,
    );
    if (goalMonths === null && saved >= goal.target) {
      goalMonths = month;
      worthAtGoal = estimatedWorth;
    }
  }
  const dateAfter = (months: number | null) => {
    if (months === null) return null;
    const date = new Date();
    date.setMonth(date.getMonth() + months);
    return date;
  };
  return {
    goalMonths,
    debtMonths,
    goalDate: dateAfter(goalMonths),
    debtDate: dateAfter(debtMonths),
    interest: interestTotal,
    worthAtGoal,
  };
}
export function netWorth(data: Data) {
  const cash = data.accounts.reduce(
    (s, a) => s + accountBalance(a, data.transactions),
    0,
  );
  const assets = data.assets.reduce((s, a) => s + a.value, 0);
  const debt = data.debts.reduce(
    (s, d) => s + debtBalance(d, data.transactions),
    0,
  );
  return { cash, assets, debt, total: cash + assets - debt };
}
export function milestoneDate(goal: Goal, amount: number, txs: Transaction[]) {
  if (goal.openingSaved >= amount) return goal.createdAt;
  let sum = goal.openingSaved;
  for (const t of txs
    .filter((t) => t.type === "saving" && t.goalId === goal.id)
    .sort((a, b) => a.date.localeCompare(b.date))) {
    sum += t.amount;
    if (sum >= amount) return t.date;
  }
  return null;
}
export function categorySum(txs: Transaction[], type: Transaction["type"]) {
  const m = new Map<string, number>();
  txs
    .filter((t) => t.type === type)
    .forEach((t) =>
      m.set(
        t.categoryId || "other",
        (m.get(t.categoryId || "other") || 0) + t.amount,
      ),
    );
  return Array.from(m.entries())
    .map(([id, value]) => ({ id, value }))
    .sort((a, b) => b.value - a.value);
}
