import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "../firebase";
import { localDay, today } from "./finance";
import { emptyData } from "./types";
import type {
  Account,
  Accelerator,
  Asset,
  Category,
  Data,
  Debt,
  Goal,
  Profile,
  Recurring,
  Transaction,
  Wish,
} from "./types";

type CollectionName =
  | "accounts"
  | "categories"
  | "transactions"
  | "goals"
  | "debts"
  | "recurring"
  | "wishes"
  | "assets"
  | "accelerators";
type Item =
  | Account
  | Category
  | Transaction
  | Goal
  | Debt
  | Recurring
  | Wish
  | Asset
  | Accelerator;
const names: CollectionName[] = [
  "accounts",
  "categories",
  "transactions",
  "goals",
  "debts",
  "recurring",
  "wishes",
  "assets",
  "accelerators",
];
export const uid = () => crypto.randomUUID();
const financeRoot = (user: User) => doc(db, "users", user.uid, "finance", "root");
const financeCollection = (user: User, name: CollectionName) =>
  collection(financeRoot(user), name);
const financeDocument = (user: User, name: CollectionName, id: string) =>
  doc(financeCollection(user, name), id);

export function useData(user: User | null) {
  const [data, setData] = useState<Data>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!user) {
      setData(emptyData);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ready = new Set<string>();
    const check = () => {
      if (ready.size === names.length + 1) setLoading(false);
    };
    const unsub = names.map((name) =>
      onSnapshot(
        financeCollection(user, name),
        (snap) => {
          setData((prev) => ({
            ...prev,
            [name]: snap.docs.map((d) => ({ ...d.data(), id: d.id })),
          }));
          ready.add(name);
          check();
        },
        (e) => {
          setError(e.message);
          setLoading(false);
        },
      ),
    );
    unsub.push(
      onSnapshot(
        financeRoot(user),
        (snap) => {
          setData((prev) => ({
            ...prev,
            profile: (snap.data() || {}) as Profile,
          }));
          ready.add("profile");
          check();
        },
        (e) => {
          setError(e.message);
          setLoading(false);
        },
      ),
    );
    return () => unsub.forEach((fn) => fn());
  }, [user?.uid]);
  return { data, loading, error };
}

export async function saveItem(user: User, name: CollectionName, item: Item) {
  const { id, ...value } = item;
  await setDoc(financeDocument(user, name, id), value);
}
export async function removeItem(user: User, name: CollectionName, id: string) {
  await deleteDoc(financeDocument(user, name, id));
}
export async function resolveWish(
  user: User,
  wish: Wish,
  status: Wish["status"],
  goal?: Goal,
) {
  const batch = writeBatch(db);
  batch.set(financeDocument(user, "wishes", wish.id), { ...wish, status });
  if (status === "saved" && goal) {
    batch.set(financeDocument(user, "transactions", uid()), {
      type: "saving",
      amount: wish.price,
      date: today(),
      goalId: goal.id,
      note: `Вместо покупки: ${wish.name}`,
      createdAt: Date.now(),
    });
  }
  await batch.commit();
}
export async function saveProfile(user: User, patch: Partial<Profile>) {
  await setDoc(financeRoot(user), patch, { merge: true });
}

async function compressImage(file: File) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Не удалось подготовить изображение");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.76);
}

export async function uploadImage(user: User, path: string, file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Выберите изображение");
  if (file.size > 5 * 1024 * 1024)
    throw new Error("Максимальный размер — 5 МБ");
  if (!storage || import.meta.env.VITE_ENABLE_STORAGE !== "true") {
    return compressImage(file);
  }
  try {
    const location = ref(
      storage,
      `users/${user.uid}/finance/${path}/${uid()}-${file.name.replace(/[^a-zA-Z0-9.]+/g, "-")}`,
    );
    await uploadBytes(location, file, { contentType: file.type });
    return getDownloadURL(location);
  } catch {
    return compressImage(file);
  }
}

export async function initializeUser(
  user: User,
  setup: {
    cash: number;
    goal: string;
    target: number;
    income: number;
    expenses: number;
    hasTax: boolean;
  },
) {
  const batch = writeBatch(db);
  const accountId = uid(),
    goalId = uid();
  batch.set(financeRoot(user), {
    onboarded: true,
    openingCapital: setup.cash,
    expectedIncome: setup.income,
    budgetMinimum: setup.expenses,
    budgetComfort: setup.expenses,
    budgetMaximum: setup.expenses * 1.3,
    defaultTaxRate: setup.hasTax ? 4 : 0,
    defaultCoolingHours: 72,
    currency: "RUB",
    theme: "dark",
    createdAt: today(),
  });
  batch.set(financeDocument(user, "accounts", accountId), {
    name: "Основной счёт",
    openingBalance: setup.cash,
    color: "#cde8a5",
  });
  const milestones = [
    200000,
    300000,
    500000,
    750000,
    1000000,
    1500000,
    2000000,
    3000000,
    4000000,
    setup.target,
  ]
    .filter((v, i, a) => v < setup.target && a.indexOf(v) === i)
    .map((amount) => ({ id: uid(), amount }));
  milestones.push({ id: uid(), amount: setup.target });
  batch.set(financeDocument(user, "goals", goalId), {
    name: setup.goal || "Дом",
    target: setup.target,
    openingSaved: Math.min(setup.cash, setup.target),
    createdAt: today(),
    priority: 1,
    primary: true,
    milestones,
  });
  for (const name of [
    "Зарплата",
    "Проекты 1С",
    "Фотосессии",
    "Ретушь",
    "Другой доход",
  ])
    batch.set(financeDocument(user, "categories", uid()), {
      name,
      kind: "income",
      defaultTaxRate: name === "Фотосессии" && setup.hasTax ? 4 : 0,
    });
  for (const name of [
    "Продукты",
    "Дом",
    "Транспорт",
    "Здоровье",
    "Дети",
    "Развлечения",
    "Подписки",
    "Другое",
  ])
    batch.set(financeDocument(user, "categories", uid()), {
      name,
      kind: "expense",
    });
  await batch.commit();
}

export async function seedDemo(user: User) {
  const existing = await getDocs(
    financeCollection(user, "transactions"),
  );
  if (existing.docs.some((d) => d.data().demo)) return;
  const batch = writeBatch(db);
  const categories = await getDocs(
    financeCollection(user, "categories"),
  );
  const accounts = await getDocs(financeCollection(user, "accounts"));
  const accountId = accounts.docs[0]?.id;
  const byName = (name: string) =>
    categories.docs.find((c) => c.data().name === name)?.id;
  const mk = (
    type: Transaction["type"],
    amount: number,
    days: number,
    categoryId?: string,
    source?: string,
  ) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    batch.set(financeDocument(user, "transactions", uid()), {
      type,
      amount,
      date: localDay(d),
      accountId,
      categoryId,
      source,
      demo: true,
      createdAt: Date.now(),
    });
  };
  mk("income", 125000, 4, byName("Зарплата"), "Основная работа");
  mk("income", 18000, 9, byName("Фотосессии"), "Фотосессии");
  mk("expense", 15200, 2, byName("Продукты"));
  mk("expense", 6200, 7, byName("Транспорт"));
  mk("income", 120000, 38, byName("Зарплата"), "Основная работа");
  mk("expense", 27000, 34, byName("Продукты"));
  batch.set(financeDocument(user, "recurring", uid()), {
    name: "Интернет",
    kind: "expense",
    amount: 1800,
    frequency: "monthly",
    mandatory: true,
    active: true,
    demo: true,
  });
  batch.set(financeDocument(user, "recurring", uid()), {
    name: "Продукты",
    kind: "expense",
    amount: 20000,
    frequency: "monthly",
    mandatory: true,
    active: true,
    demo: true,
  });
  batch.set(financeDocument(user, "wishes", uid()), {
    name: "Новый объектив",
    price: 60000,
    createdAt: new Date().toISOString(),
    necessity: 2,
    coolingHours: 72,
    status: "waiting",
    demo: true,
  });
  await batch.commit();
}
export async function clearDemo(user: User) {
  const batch = writeBatch(db);
  for (const name of names) {
    const docs = await getDocs(financeCollection(user, name));
    docs.docs.filter((d) => d.data().demo).forEach((d) => batch.delete(d.ref));
  }
  await batch.commit();
}
