export type Id = { id: string };
export type TxType =
  "income" | "expense" | "transfer" | "tax" | "saving" | "debt_payment";
export type Transaction = Id & {
  type: TxType;
  amount: number;
  date: string;
  earnedMonth?: string;
  planMonth?: string;
  categoryId?: string;
  source?: string;
  accountId?: string;
  toAccountId?: string;
  goalId?: string;
  debtId?: string;
  note?: string;
  taxEnabled?: boolean;
  taxRate?: number;
  interestAmount?: number;
  demo?: boolean;
  createdAt?: number;
  recurringId?: string;
  planned?: boolean;
};
export type Account = Id & {
  name: string;
  openingBalance: number;
  color?: string;
  demo?: boolean;
};
export type Category = Id & {
  name: string;
  kind: "income" | "expense";
  defaultTaxRate?: number;
  demo?: boolean;
};
export type Milestone = { id: string; amount: number };
export type GoalStep = {
  id: string;
  title: string;
  week: string;
  doneAt?: string;
};
export type Goal = Id & {
  name: string;
  target: number;
  openingSaved: number;
  createdAt: string;
  desiredDate?: string;
  priority: number;
  note?: string;
  imageUrl?: string;
  primary: boolean;
  milestones: Milestone[];
  weeklySteps?: GoalStep[];
  demo?: boolean;
};
export type Debt = Id & {
  name: string;
  kind: string;
  originalAmount: number;
  openingBalance: number;
  annualRate: number;
  minimumPayment: number;
  plannedPayment: number;
  nextPaymentDate?: string;
  endDate?: string;
  creditor?: string;
  note?: string;
  categoryId?: string;
  createdAt: string;
  closed?: boolean;
  demo?: boolean;
};
export type Recurring = Id & {
  name: string;
  kind: "income" | "expense";
  amount: number;
  categoryId?: string;
  frequency: "weekly" | "monthly" | "yearly";
  mandatory: boolean;
  active: boolean;
  booked?: boolean;
  startMonth?: string;
  endMonth?: string;
  dayOfMonth?: number;
  earnedMonthOffset?: 0 | -1;
  taxEnabled?: boolean;
  taxRate?: number;
  amountChanges?: Record<string, number>;
  overrides?: Record<string, number>;
  demo?: boolean;
};
export type Wish = Id & {
  name: string;
  price: number;
  imageUrl?: string;
  url?: string;
  reason?: string;
  createdAt: string;
  categoryId?: string;
  necessity: number;
  coolingHours: number;
  status: "waiting" | "bought" | "declined" | "deferred" | "saved";
  goalId?: string;
  demo?: boolean;
};
export type Asset = Id & {
  name: string;
  kind: string;
  value: number;
  demo?: boolean;
};
export type Accelerator = Id & {
  name: string;
  categoryId: string;
  target: number;
  milestones: number[];
  demo?: boolean;
};
export type Profile = {
  onboarded?: boolean;
  openingCapital?: number;
  expectedIncome?: number;
  budgetMinimum?: number;
  budgetComfort?: number;
  budgetMaximum?: number;
  defaultTaxRate?: number;
  defaultCoolingHours?: number;
  currency?: string;
  theme?: "dark" | "light";
  createdAt?: string;
};
export type Data = {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  goals: Goal[];
  debts: Debt[];
  recurring: Recurring[];
  wishes: Wish[];
  assets: Asset[];
  accelerators: Accelerator[];
  profile: Profile;
};
export const emptyData: Data = {
  accounts: [],
  categories: [],
  transactions: [],
  goals: [],
  debts: [],
  recurring: [],
  wishes: [],
  assets: [],
  accelerators: [],
  profile: {},
};
