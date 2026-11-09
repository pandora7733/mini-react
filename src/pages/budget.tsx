import { Fragment, h } from "../createElement.js";
import { useEffect, useMemo, useState } from "../hooks.js";
import { Link, navigate, type Params } from "../router.js";

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

interface FormDraft {
  title: string;
  amount: string;
  category: Category;
  date: string;
}

// 수정 중인 항목의 입력값. 없으면 그 항목은 보기 모드다
interface EditDraft {
  title: string;
  amount: string;
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

function isFilled(draft: { title: string; amount: string }): boolean {
  return draft.title.trim() !== "" && parseAmount(draft.amount) !== null;
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

// 커스텀 훅: 일반 함수 안에서 기존 훅을 호출해 "저장되는 상태"를 재사용한다. 루트에서 호출하므로 제약에 맞다
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

// --- 자식 컴포넌트: 상태 없이 props만 받는 순수 함수 ---

function Summary({ income, expense }: { income: number; expense: number }) {
  return (
    <dl className="stats budget-stats">
      <div><dt>수입</dt><dd id="sum-income">{formatWon(income)}</dd></div>
      <div><dt>지출</dt><dd id="sum-expense">{formatWon(expense)}</dd></div>
      <div><dt>잔액</dt><dd id="sum-balance">{formatWon(income - expense)}</dd></div>
    </dl>
  );
}

function SpendingChart({ rows }: { rows: Array<[Category, number]> }) {
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

function EntryForm({ form, onChange, onAdd }: {
  form: FormDraft;
  onChange: (change: Partial<FormDraft>) => void;
  onAdd: () => void;
}) {
  return (
    <form
      className="task-form"
      onSubmit={event => {
        event.preventDefault();
        onAdd();
      }}
    >
      <input
        id="entry-title"
        aria-label="내용"
        placeholder="내용"
        value={form.title}
        onInput={event => onChange({ title: (event.target as HTMLInputElement).value })}
      />
      <input
        id="entry-amount"
        className="budget-number"
        type="number"
        min="1"
        aria-label="금액"
        placeholder="금액"
        value={form.amount}
        onInput={event => onChange({ amount: (event.target as HTMLInputElement).value })}
      />
      <select
        id="entry-category"
        aria-label="분류"
        value={form.category}
        onChange={event => onChange({ category: (event.target as HTMLSelectElement).value as Category })}
      >
        {EXPENSE_CATEGORIES.map(name => <option key={name} value={name}>{name}</option>)}
        <option value={INCOME}>{INCOME}</option>
      </select>
      <input
        id="entry-date"
        className="budget-date"
        type="date"
        aria-label="날짜"
        value={form.date}
        onInput={event => onChange({ date: (event.target as HTMLInputElement).value })}
      />
      <button id="entry-add" className="primary" type="submit" disabled={!isFilled(form) || form.date === ""}>추가</button>
    </form>
  );
}

function EntryRow({ entry, draft, onEdit, onDraft, onCancel, onSave, onRemove }: {
  entry: Entry;
  draft: EditDraft | undefined;
  onEdit: (entry: Entry) => void;
  onDraft: (id: number, change: Partial<EditDraft>) => void;
  onCancel: (id: number) => void;
  onSave: (id: number) => void;
  onRemove: (id: number) => void;
}) {
  const cancelOnEscape = (event: KeyboardEvent) => {
    if (event.key === "Escape") onCancel(entry.id);
  };

  const income = entry.category === INCOME;

  return (
    <li className="task" data-entry-id={entry.id}>
      {draft !== undefined
        ? (
          <>
            <input
              className="budget-edit"
              aria-label="내용 수정"
              value={draft.title}
              onInput={event => onDraft(entry.id, { title: (event.target as HTMLInputElement).value })}
              onKeydown={cancelOnEscape}
            />
            <input
              className="budget-edit budget-number"
              type="number"
              min="1"
              aria-label="금액 수정"
              value={draft.amount}
              onInput={event => onDraft(entry.id, { amount: (event.target as HTMLInputElement).value })}
              onKeydown={cancelOnEscape}
            />
            <div className="task-actions">
              <button type="button" data-action="save" disabled={!isFilled(draft)} onClick={() => onSave(entry.id)}>저장</button>
              <button type="button" data-action="cancel" onClick={() => onCancel(entry.id)}>취소</button>
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
              <button type="button" data-action="edit" aria-label={`${entry.title} 수정`} onClick={() => onEdit(entry)}>수정</button>
              <button type="button" data-action="remove" aria-label={`${entry.title} 삭제`} onClick={() => onRemove(entry.id)}>삭제</button>
            </div>
          </>
        )}
    </li>
  );
}

// --- 루트 컴포넌트: 상태와 훅은 모두 여기에만 둔다. 선택한 달은 주소에 있으므로 상태가 아니다 ---

export function Budget({ params = {} }: { params?: Params }) {
  const [entries, setEntries] = useStoredState<Entry[]>(STORAGE_KEY, sampleEntries, isEntryList);
  const [form, setForm] = useState<FormDraft>(() => ({ title: "", amount: "", category: "식비", date: today() }));
  const [edits, setEdits] = useState<Record<number, EditDraft>>({});

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

  const chartRows = useMemo(() => {
    const amounts = new Map<Category, number>();
    for (const entry of monthEntries) {
      if (entry.category !== INCOME) amounts.set(entry.category, (amounts.get(entry.category) ?? 0) + entry.amount);
    }
    return Array.from(amounts).sort((a, b) => b[1] - a[1]);
  }, [monthEntries]);

  useEffect(() => {
    document.title = `${formatMonth(month)} 가계부`;
  }, [month]);

  const addEntry = () => {
    const amount = parseAmount(form.amount);
    if (amount === null || form.title.trim() === "" || form.date === "") return;
    const { date, category } = form;
    const title = form.title.trim();
    setEntries(prev => [...prev, { id: prev.reduce((max, e) => Math.max(max, e.id), 0) + 1, date, title, amount, category }]);
    setForm(prev => ({ ...prev, title: "", amount: "" }));
    const entryMonth = date.slice(0, 7);
    if (entryMonth !== month) showMonth(entryMonth);   // 다른 달의 내역을 추가하면 추가한 항목이 보이는 달로 옮긴다
  };

  const startEdit = (entry: Entry) =>
    setEdits(prev => ({ ...prev, [entry.id]: { title: entry.title, amount: String(entry.amount) } }));

  const changeEdit = (id: number, change: Partial<EditDraft>) =>
    setEdits(prev => ({ ...prev, [id]: { ...prev[id], ...change } }));

  const closeEdit = (id: number) =>
    setEdits(prev => {
      const { [id]: _closed, ...rest } = prev;
      return rest;
    });

  const saveEdit = (id: number) => {
    const draft = edits[id];
    const amount = parseAmount(draft.amount);
    if (amount === null || draft.title.trim() === "") return;
    const title = draft.title.trim();
    setEntries(prev => prev.map(entry => (entry.id === id ? { ...entry, title, amount } : entry)));
    closeEdit(id);
  };

  const removeEntry = (id: number) => {
    setEntries(prev => prev.filter(entry => entry.id !== id));
    closeEdit(id);
  };

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
      <SpendingChart rows={chartRows} />
      <EntryForm form={form} onChange={change => setForm(prev => ({ ...prev, ...change }))} onAdd={addEntry} />
      {monthEntries.length === 0
        ? <p id="empty-state" className="empty-state">이 달의 내역이 없습니다.</p>
        : (
          <ul id="entry-list" className="task-list">
            {monthEntries.map(entry => (
              <EntryRow
                key={entry.id}
                entry={entry}
                draft={edits[entry.id]}
                onEdit={startEdit}
                onDraft={changeEdit}
                onCancel={closeEdit}
                onSave={saveEdit}
                onRemove={removeEntry}
              />
            ))}
          </ul>
        )}
    </main>
  );
}
