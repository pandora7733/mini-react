import { h } from "../../createElement.js";
import { Link } from "../../router.js";
import type { VNodeChild } from "../../types.js";
import { EXPENSE_CATEGORIES, INCOME, formatWon, parseAmount, type Category } from "./store.js";

// 여기 있는 컴포넌트는 모두 상태 없이 props만 받는 순수 함수다

export function BudgetLayout({ current, children }: { current: "month" | "stats" | "new" | null; children?: VNodeChild }) {
  const item = (name: typeof current, to: string, label: string) => (
    <Link to={to} aria-current={current === name ? "page" : undefined}>{label}</Link>
  );
  return (
    <main className="page narrow">
      <Link className="back-link" to="/">mini-react</Link>
      <nav className="budget-nav" aria-label="가계부 메뉴">
        {item("month", "/budget", "월별 내역")}
        {item("stats", "/budget/stats", "통계")}
        {item("new", "/budget/new", "항목 추가")}
      </nav>
      {children}
    </main>
  );
}

export function Summary({ income, expense }: { income: number; expense: number }) {
  return (
    <dl className="stats budget-stats">
      <div><dt>수입</dt><dd id="sum-income">{formatWon(income)}</dd></div>
      <div><dt>지출</dt><dd id="sum-expense">{formatWon(expense)}</dd></div>
      <div><dt>잔액</dt><dd id="sum-balance">{formatWon(income - expense)}</dd></div>
    </dl>
  );
}

export interface BarRow {
  key: string;
  label: string;
  amount: number;
  to?: string;
}

export function BarChart({ title, rows }: { title: string; rows: BarRow[] }) {
  if (rows.length === 0) return null;

  const max = Math.max(...rows.map(row => row.amount), 1);   // 전부 0원이어도 0으로 나누지 않는다
  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  return (
    <section className="budget-chart" aria-label={title}>
      <h2>{title}</h2>
      <ul>
        {rows.map(row => (
          <li key={row.key} data-row={row.key}>
            {row.to === undefined ? <span>{row.label}</span> : <Link to={row.to}>{row.label}</Link>}
            <svg width="100%" height="10" aria-hidden="true">
              <title>{`${row.label} ${formatWon(row.amount)} (${Math.round(row.amount / Math.max(total, 1) * 100)}%)`}</title>
              <rect width={`${row.amount / max * 100}%`} height="10" rx="4" fill="var(--accent)" />
            </svg>
            <span className="budget-amount">{formatWon(row.amount)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export interface EntryDraft {
  title: string;
  amount: string;
  category: Category;
  date: string;
  memo: string;
}

export function isValidDraft(draft: EntryDraft): boolean {
  return draft.title.trim() !== "" && parseAmount(draft.amount) !== null && draft.date !== "";
}

export function EntryForm({ draft, submitLabel, cancelTo, onChange, onSubmit }: {
  draft: EntryDraft;
  submitLabel: string;
  cancelTo: string;
  onChange: (change: Partial<EntryDraft>) => void;
  onSubmit: () => void;
}) {
  return (
    <form
      className="budget-form"
      onSubmit={event => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <label htmlFor="entry-title">내용</label>
      <input
        id="entry-title"
        value={draft.title}
        onInput={event => onChange({ title: (event.target as HTMLInputElement).value })}
      />
      <label htmlFor="entry-amount">금액</label>
      <input
        id="entry-amount"
        type="number"
        min="1"
        value={draft.amount}
        onInput={event => onChange({ amount: (event.target as HTMLInputElement).value })}
      />
      <label htmlFor="entry-category">분류</label>
      <select
        id="entry-category"
        value={draft.category}
        onChange={event => onChange({ category: (event.target as HTMLSelectElement).value as Category })}
      >
        {EXPENSE_CATEGORIES.map(name => <option key={name} value={name}>{name}</option>)}
        <option value={INCOME}>{INCOME}</option>
      </select>
      <label htmlFor="entry-date">날짜</label>
      <input
        id="entry-date"
        type="date"
        value={draft.date}
        onInput={event => onChange({ date: (event.target as HTMLInputElement).value })}
      />
      <label htmlFor="entry-memo">메모</label>
      <textarea
        id="entry-memo"
        rows="3"
        value={draft.memo}
        onInput={event => onChange({ memo: (event.target as HTMLTextAreaElement).value })}
      />
      <div className="budget-actions">
        <button id="entry-submit" className="primary" type="submit" disabled={!isValidDraft(draft)}>{submitLabel}</button>
        <Link id="entry-cancel" className="budget-button" to={cancelTo}>취소</Link>
      </div>
    </form>
  );
}
