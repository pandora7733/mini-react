import { Fragment, h } from "../createElement.js";
import { useEffect, useMemo, useState } from "../hooks.js";
import { Link, useNavigate, useParams } from "../router.js";

const EXPENSE_CATEGORIES = ["식비", "교통", "여가", "생활"] as const;
const INCOME = "수입";

type Category = typeof EXPENSE_CATEGORIES[number] | typeof INCOME;

interface Entry {
  id: number;
  date: string;   // YYYY-MM-DD
  title: string;
  amount: number;
  category: Category;
}

const STORAGE_KEY = `mini-react:budget:${new URLSearchParams(location.search).get("board") ?? "default"}`;

// --- 날짜와 금액 ---

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function monthOf(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function today(): string {
  const now = new Date();
  return `${monthOf(now)}-${pad(now.getDate())}`;
}

function shiftMonth(month: string, offset: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return monthOf(new Date(year, monthNumber - 1 + offset, 1));
}

function formatMonth(month: string): string {
  const [year, monthNumber] = month.split("-");
  return `${year}년 ${Number(monthNumber)}월`;
}

function formatWon(amount: number): string {
  return `${amount.toLocaleString("ko-KR")}원`;
}

function parseAmount(text: string): number | null {
  const amount = Number(text);
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

// --- 저장소 ---

function sampleEntries(): Entry[] {
  const month = monthOf(new Date());
  const previous = shiftMonth(month, -1);
  return [
    { id: 1, date: `${month}-01`, title: "월급", amount: 2500000, category: "수입" },
    { id: 2, date: `${month}-02`, title: "장보기", amount: 68000, category: "식비" },
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
    && (entry.category === INCOME || (EXPENSE_CATEGORIES as readonly unknown[]).includes(entry.category));
}

// id는 key로 쓰이므로 겹치면 렌더가 실패한다
function isEntryList(value: unknown): value is Entry[] {
  if (!Array.isArray(value) || !value.every(isEntry)) return false;
  return new Set(value.map(entry => entry.id)).size === value.length;
}

// 커스텀 훅: 일반 함수 안에서 기존 훅을 호출해 "저장되는 상태"를 재사용한다
function useStoredState<T>(key: string, createInitial: () => T, isValid: (value: unknown) => value is T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(key);
      const parsed: unknown = saved === null ? null : JSON.parse(saved);
      return isValid(parsed) ? parsed : createInitial();
    } catch {
      return createInitial();   // 저장소를 쓸 수 없거나 내용이 깨졌으면 처음부터 시작한다
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // 저장에 실패해도 화면 동작에는 영향이 없다
    }
  }, [key, value]);

  return [value, setValue] as const;
}

// --- 상태 없는 컴포넌트 ---

function Summary({ income, expense }: { income: number; expense: number }) {
  return (
    <dl className="stats budget-stats">
      <div><dt>수입</dt><dd id="sum-income">{formatWon(income)}</dd></div>
      <div><dt>지출</dt><dd id="sum-expense">{formatWon(expense)}</dd></div>
      <div><dt>잔액</dt><dd id="sum-balance">{formatWon(income - expense)}</dd></div>
    </dl>
  );
}

function SpendingChart({ entries }: { entries: Entry[] }) {
  const rows = useMemo(() => {
    const totals = new Map<Category, number>();
    for (const entry of entries) {
      if (entry.category !== INCOME) totals.set(entry.category, (totals.get(entry.category) ?? 0) + entry.amount);
    }
    return Array.from(totals).sort((a, b) => b[1] - a[1]);
  }, [entries]);

  if (rows.length === 0) return null;

  const max = rows[0][1];
  const total = rows.reduce((sum, [, amount]) => sum + amount, 0);
  return (
    <section className="budget-chart" aria-label="분류별 지출">
      <h2>분류별 지출</h2>
      <ul>
        {rows.map(([category, amount]) => (
          <li key={category} data-category={category}>
            <span>{category}</span>
            <svg width="100%" height="10" aria-hidden="true">
              <title>{`${category} ${formatWon(amount)} (${Math.round(amount / total * 100)}%)`}</title>
              <rect width={`${amount / max * 100}%`} height="10" rx="4" fill="var(--accent)" />
            </svg>
            <span className="budget-amount">{formatWon(amount)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// --- 자체 상태를 가진 자식 컴포넌트: 입력 중인 값은 이 컴포넌트만 알면 된다 ---

function EntryForm({ onAdd }: { onAdd: (entry: Omit<Entry, "id">) => void }) {
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<Category>("식비");
  const [date, setDate] = useState(today);

  const parsedAmount = parseAmount(amount);
  const canAdd = title.trim() !== "" && parsedAmount !== null && date !== "";

  return (
    <form
      className="task-form"
      onSubmit={event => {
        event.preventDefault();
        if (!canAdd) return;
        onAdd({ date, title: title.trim(), amount: parsedAmount, category });
        setTitle("");
        setAmount("");
      }}
    >
      <input
        id="entry-title"
        aria-label="내용"
        placeholder="내용"
        value={title}
        onInput={event => setTitle((event.target as HTMLInputElement).value)}
      />
      <input
        id="entry-amount"
        className="budget-number"
        type="number"
        min="1"
        aria-label="금액"
        placeholder="금액"
        value={amount}
        onInput={event => setAmount((event.target as HTMLInputElement).value)}
      />
      <select
        id="entry-category"
        aria-label="분류"
        value={category}
        onChange={event => setCategory((event.target as HTMLSelectElement).value as Category)}
      >
        {EXPENSE_CATEGORIES.map(name => <option key={name} value={name}>{name}</option>)}
        <option value={INCOME}>{INCOME}</option>
      </select>
      <input
        id="entry-date"
        className="budget-date"
        type="date"
        aria-label="날짜"
        value={date}
        onInput={event => setDate((event.target as HTMLInputElement).value)}
      />
      <button id="entry-add" className="primary" type="submit" disabled={!canAdd}>추가</button>
    </form>
  );
}

function EntryRow({ entry, onSave, onRemove }: {
  entry: Entry;
  onSave: (id: number, title: string, amount: number) => void;
  onRemove: (id: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(entry.title);
  const [amount, setAmount] = useState(String(entry.amount));

  const parsedAmount = parseAmount(amount);
  const canSave = title.trim() !== "" && parsedAmount !== null;

  const startEditing = () => {
    setTitle(entry.title);
    setAmount(String(entry.amount));
    setEditing(true);
  };

  const cancelOnEscape = (event: KeyboardEvent) => {
    if (event.key === "Escape") setEditing(false);
  };

  const income = entry.category === INCOME;

  return (
    <li className="task" data-entry-id={entry.id}>
      {editing
        ? (
          <>
            <input
              className="budget-edit"
              aria-label="내용 수정"
              value={title}
              onInput={event => setTitle((event.target as HTMLInputElement).value)}
              onKeydown={cancelOnEscape}
            />
            <input
              className="budget-edit budget-number"
              type="number"
              min="1"
              aria-label="금액 수정"
              value={amount}
              onInput={event => setAmount((event.target as HTMLInputElement).value)}
              onKeydown={cancelOnEscape}
            />
            <div className="task-actions">
              <button
                type="button"
                data-action="save"
                disabled={!canSave}
                onClick={() => {
                  if (!canSave) return;
                  onSave(entry.id, title.trim(), parsedAmount);
                  setEditing(false);
                }}
              >
                저장
              </button>
              <button type="button" data-action="cancel" onClick={() => setEditing(false)}>취소</button>
            </div>
          </>
        )
        : (
          <>
            <span className="budget-day">{entry.date.slice(5).replace("-", ".")}</span>
            <span className="task-title">{entry.title}</span>
            <span className="budget-category">{entry.category}</span>
            <span className={income ? "budget-amount income" : "budget-amount"}>
              {`${income ? "+" : "-"}${formatWon(entry.amount)}`}
            </span>
            <div className="task-actions">
              <button type="button" data-action="edit" aria-label={`${entry.title} 수정`} onClick={startEditing}>수정</button>
              <button type="button" data-action="remove" aria-label={`${entry.title} 삭제`} onClick={() => onRemove(entry.id)}>삭제</button>
            </div>
          </>
        )}
    </li>
  );
}

// --- 페이지: 여러 컴포넌트가 함께 쓰는 내역만 상태로 둔다. 선택한 달은 주소에 있다 ---

export function Budget() {
  const [entries, setEntries] = useStoredState<Entry[]>(STORAGE_KEY, sampleEntries, isEntryList);
  const params = useParams();
  const navigate = useNavigate();

  // 주소는 사용자가 직접 고칠 수 있으므로 형식이 틀리면 이번 달을 보여 준다
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(params.month ?? "") ? params.month : monthOf(new Date());
  const showMonth = (next: string) => navigate(`/budget/${next}`);

  const monthEntries = useMemo(
    () => entries
      .filter(entry => entry.date.startsWith(month))
      .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id),
    [entries, month],
  );

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const entry of monthEntries) {
      if (entry.category === INCOME) income += entry.amount;
      else expense += entry.amount;
    }
    return { income, expense };
  }, [monthEntries]);

  useEffect(() => {
    document.title = `${formatMonth(month)} 가계부`;
  }, [month]);

  const addEntry = (entry: Omit<Entry, "id">) => {
    setEntries(prev => [...prev, { ...entry, id: prev.reduce((max, e) => Math.max(max, e.id), 0) + 1 }]);
    const entryMonth = entry.date.slice(0, 7);
    if (entryMonth !== month) showMonth(entryMonth);   // 다른 달의 내역을 추가하면 추가한 항목이 보이는 달로 옮긴다
  };

  const saveEntry = (id: number, title: string, amount: number) =>
    setEntries(prev => prev.map(entry => (entry.id === id ? { ...entry, title, amount } : entry)));

  const removeEntry = (id: number) => setEntries(prev => prev.filter(entry => entry.id !== id));

  return (
    <main className="page narrow">
      <Link className="back-link" to="/">mini-react</Link>
      <header className="board-header">
        <div>
          <h1>가계부</h1>
          <p>mini-react의 컴포넌트, Hooks, 커스텀 훅, 라우터, SVG로 만든 예시 앱입니다.</p>
        </div>
        <nav className="budget-month" aria-label="달 선택">
          <button id="month-prev" type="button" aria-label="이전 달" onClick={() => showMonth(shiftMonth(month, -1))}>←</button>
          <strong id="month-label">{formatMonth(month)}</strong>
          <button id="month-next" type="button" aria-label="다음 달" onClick={() => showMonth(shiftMonth(month, 1))}>→</button>
        </nav>
      </header>
      <Summary income={totals.income} expense={totals.expense} />
      <SpendingChart entries={monthEntries} />
      <EntryForm onAdd={addEntry} />
      {monthEntries.length === 0
        ? <p id="empty-state" className="empty-state">이 달의 내역이 없습니다.</p>
        : (
          <ul id="entry-list" className="task-list">
            {monthEntries.map(entry => (
              <EntryRow key={entry.id} entry={entry} onSave={saveEntry} onRemove={removeEntry} />
            ))}
          </ul>
        )}
    </main>
  );
}
