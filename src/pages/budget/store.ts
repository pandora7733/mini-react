import { useEffect, useState } from "../../hooks.js";

export const EXPENSE_CATEGORIES = ["식비", "교통", "여가", "생활"] as const;
export const INCOME = "수입";

export type Category = typeof EXPENSE_CATEGORIES[number] | typeof INCOME;

export interface Entry {
  id: number;
  date: string;   // YYYY-MM-DD
  title: string;
  amount: number;
  category: Category;
  memo?: string;
}

// --- 날짜와 금액 ---

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function monthOf(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

export function today(): string {
  const now = new Date();
  return `${monthOf(now)}-${pad(now.getDate())}`;
}

export function shiftMonth(month: string, offset: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return monthOf(new Date(year, monthNumber - 1 + offset, 1));
}

export function formatMonth(month: string): string {
  const [year, monthNumber] = month.split("-");
  return `${year}년 ${Number(monthNumber)}월`;
}

export function formatWon(amount: number): string {
  return `${amount.toLocaleString("ko-KR")}원`;
}

export function parseAmount(text: string): number | null {
  const amount = Number(text);
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

// 주소는 사용자가 직접 고칠 수 있으므로 형식이 틀리면 이번 달로 처리한다
export function monthFromParam(param: string | undefined): string {
  return param !== undefined && /^\d{4}-(0[1-9]|1[0-2])$/.test(param) ? param : monthOf(new Date());
}

export function isIncome(entry: Entry): boolean {
  return entry.category === INCOME;
}

// --- 저장소 ---

// 라우트가 바뀌면 이전 페이지의 루트와 상태가 사라진다. 페이지끼리 공유하는 내역은 저장소에 두고 페이지마다 다시 읽는다
const STORAGE_KEY = `mini-react:budget:${new URLSearchParams(location.search).get("board") ?? "default"}`;

// localStorage를 쓸 수 없어도 페이지를 옮기는 동안은 내역이 유지되도록 메모리에도 둔다
let memory: Entry[] | null = null;

function sampleEntries(): Entry[] {
  const month = monthOf(new Date());
  const previous = shiftMonth(month, -1);
  return [
    { id: 1, date: `${month}-01`, title: "월급", amount: 2500000, category: "수입" },
    { id: 2, date: `${month}-02`, title: "장보기", amount: 68000, category: "식비", memo: "일주일 치 식재료" },
    { id: 3, date: `${month}-03`, title: "교통카드 충전", amount: 50000, category: "교통" },
    { id: 4, date: `${month}-05`, title: "영화", amount: 15000, category: "여가" },
    { id: 5, date: `${month}-06`, title: "점심", amount: 12000, category: "식비" },
    { id: 6, date: `${previous}-01`, title: "월급", amount: 2500000, category: "수입" },
    { id: 7, date: `${previous}-12`, title: "전기 요금", amount: 42000, category: "생활" },
  ];
}

function isEntry(value: unknown): value is Entry {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.id === "number"
    && typeof entry.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(entry.date)
    && typeof entry.title === "string"
    && typeof entry.amount === "number"
    && (entry.category === INCOME || (EXPENSE_CATEGORIES as readonly unknown[]).includes(entry.category))
    && (entry.memo === undefined || typeof entry.memo === "string");
}

// id는 key로 쓰이므로 겹치면 렌더가 실패한다
function isEntryList(value: unknown): value is Entry[] {
  if (!Array.isArray(value) || !value.every(isEntry)) return false;
  return new Set(value.map(entry => entry.id)).size === value.length;
}

function loadEntries(): Entry[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = saved === null ? null : JSON.parse(saved);
    if (isEntryList(parsed)) return parsed;
  } catch {
    // 저장소를 쓸 수 없거나 내용이 깨졌으면 아래의 값으로 시작한다
  }
  memory ??= sampleEntries();
  return memory;
}

function saveEntries(entries: Entry[]): void {
  memory = entries;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // 저장에 실패해도 메모리의 값으로 계속 동작한다
  }
}

// 커스텀 훅: 일반 함수 안에서 기존 훅을 호출한다. 페이지(루트)에서 호출하므로 제약에 맞다
export function useEntries() {
  const [entries, setEntries] = useState(loadEntries);

  // 저장한 뒤 바로 다른 라우트로 이동해도 잃어버리지 않도록 effect를 기다리지 않고 저장한다
  const updateEntries = (change: (prev: Entry[]) => Entry[]) => {
    const next = change(entries);
    saveEntries(next);
    setEntries(next);
  };

  // 다른 탭에서 바꾼 내역을 반영한다
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setEntries(loadEntries());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return [entries, updateEntries] as const;
}
