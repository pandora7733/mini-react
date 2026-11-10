import { h } from "../../createElement.js";
import { useEffect, useMemo, useState } from "../../hooks.js";
import { Link, navigate, setLeaveGuard, type Params } from "../../router.js";
import {
  EXPENSE_CATEGORIES,
  formatMonth,
  formatWon,
  isIncome,
  monthFromParam,
  monthOf,
  parseAmount,
  shiftMonth,
  today,
  useEntries,
  type Entry,
} from "./store.js";
import { BarChart, BudgetLayout, EntryForm, Summary, isValidDraft, type BarRow, type EntryDraft } from "./ui.js";

// 라우트마다 페이지가 곧 루트 컴포넌트다. 훅과 상태는 이 파일의 페이지에만 있다

interface PageProps {
  params?: Params;
}

function useTitle(title: string): void {
  useEffect(() => {
    document.title = `${title} - 가계부`;
  }, [title]);
}

// 작성 중인 내용이 있을 때만 다른 라우트로 떠나기 전에 묻는다
function useLeaveConfirm(dirty: boolean): void {
  useEffect(() => {
    if (!dirty) return;
    setLeaveGuard(() => confirm("저장하지 않은 내용이 있습니다. 버리고 이동할까요?"));
    return () => setLeaveGuard(null);
  }, [dirty]);
}

function expenseTotal(entries: Entry[]): number {
  return entries.reduce((sum, entry) => (isIncome(entry) ? sum : sum + entry.amount), 0);
}

function draftToFields(draft: EntryDraft): Omit<Entry, "id"> | null {
  const amount = parseAmount(draft.amount);
  if (amount === null || !isValidDraft(draft)) return null;
  return {
    title: draft.title.trim(),
    amount,
    category: draft.category,
    date: draft.date,
    memo: draft.memo.trim(),
  };
}

// --- /budget/:month? ---

export function MonthPage({ params = {} }: PageProps) {
  const [entries] = useEntries();
  const month = monthFromParam(params.month);
  useTitle(formatMonth(month));

  const monthEntries = useMemo(
    () => entries
      .filter(entry => entry.date.startsWith(month))
      .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id),
    [entries, month],
  );

  const income = useMemo(() => monthEntries.reduce((sum, e) => (isIncome(e) ? sum + e.amount : sum), 0), [monthEntries]);
  const expense = useMemo(() => expenseTotal(monthEntries), [monthEntries]);

  const chartRows = useMemo<BarRow[]>(() => {
    const amounts = new Map<string, number>();
    for (const entry of monthEntries) {
      if (!isIncome(entry)) amounts.set(entry.category, (amounts.get(entry.category) ?? 0) + entry.amount);
    }
    return Array.from(amounts, ([category, amount]) => ({ key: category, label: category, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [monthEntries]);

  return (
    <BudgetLayout current="month">
      <header className="board-header">
        <h1>월별 내역</h1>
        <nav className="budget-month" aria-label="달 선택">
          <Link id="month-prev" className="budget-button" aria-label="이전 달" to={`/budget/${shiftMonth(month, -1)}`}>←</Link>
          <strong id="month-label">{formatMonth(month)}</strong>
          <Link id="month-next" className="budget-button" aria-label="다음 달" to={`/budget/${shiftMonth(month, 1)}`}>→</Link>
        </nav>
      </header>
      <Summary income={income} expense={expense} />
      <BarChart title="분류별 지출" rows={chartRows} />
      <p className="budget-actions">
        <Link id="add-entry" className="budget-button" to={`/budget/new/${month}`}>이 달에 항목 추가</Link>
      </p>
      {monthEntries.length === 0
        ? <p id="empty-state" className="empty-state">이 달의 내역이 없습니다.</p>
        : (
          <ul id="entry-list" className="task-list">
            {monthEntries.map(entry => (
              <li key={entry.id} className="task" data-entry-id={entry.id}>
                <span className="budget-day">{entry.date.slice(5).replace("-", ".")}</span>
                <Link className="task-title" to={`/budget/entries/${entry.id}`}>{entry.title}</Link>
                <span className="budget-category">{entry.category}</span>
                <span className={isIncome(entry) ? "budget-amount income" : "budget-amount"}>
                  {`${isIncome(entry) ? "+" : "-"}${formatWon(entry.amount)}`}
                </span>
              </li>
            ))}
          </ul>
        )}
    </BudgetLayout>
  );
}

// --- /budget/new/:month? ---

export function NewEntryPage({ params = {} }: PageProps) {
  const [, updateEntries] = useEntries();
  const month = monthFromParam(params.month);
  useTitle("항목 추가");

  const [draft, setDraft] = useState<EntryDraft>(() => ({
    title: "",
    amount: "",
    category: "식비",
    date: month === monthOf(new Date()) ? today() : `${month}-01`,   // 보던 달에 추가하는 경우가 많다
    memo: "",
  }));
  useLeaveConfirm(draft.title !== "" || draft.amount !== "" || draft.memo !== "");

  const submit = () => {
    const fields = draftToFields(draft);
    if (fields === null) return;
    updateEntries(prev => [...prev, { ...fields, id: prev.reduce((max, e) => Math.max(max, e.id), 0) + 1 }]);
    setDraft(prev => ({ ...prev, title: "", amount: "", memo: "" }));   // 작성 중이 아니므로 떠나도 묻지 않는다
    navigate(`/budget/${fields.date.slice(0, 7)}`, { replace: true });   // 뒤로가기로 빈 양식에 돌아오지 않는다
  };

  return (
    <BudgetLayout current="new">
      <h1>항목 추가</h1>
      <EntryForm
        draft={draft}
        submitLabel="추가"
        cancelTo={`/budget/${month}`}
        onChange={change => setDraft(prev => ({ ...prev, ...change }))}
        onSubmit={submit}
      />
    </BudgetLayout>
  );
}

function EntryNotFound() {
  return (
    <BudgetLayout current={null}>
      <h1>항목을 찾을 수 없습니다</h1>
      <p id="entry-missing" className="empty-state">
        삭제되었거나 주소가 잘못되었습니다. <Link to="/budget">월별 내역으로 돌아가기</Link>
      </p>
    </BudgetLayout>
  );
}

// --- /budget/entries/:id ---

export function EntryPage({ params = {} }: PageProps) {
  const [entries, updateEntries] = useEntries();
  const entry = entries.find(item => String(item.id) === params.id);
  useTitle(entry?.title ?? "항목을 찾을 수 없음");

  if (entry === undefined) return <EntryNotFound />;

  const remove = () => {
    if (!confirm(`"${entry.title}" 항목을 삭제할까요?`)) return;
    updateEntries(prev => prev.filter(item => item.id !== entry.id));
    navigate(`/budget/${entry.date.slice(0, 7)}`, { replace: true });   // 뒤로가기로 지운 항목에 돌아오지 않는다
  };

  return (
    <BudgetLayout current={null}>
      <h1 id="entry-heading">{entry.title}</h1>
      <dl className="budget-detail">
        <div><dt>금액</dt><dd id="entry-detail-amount">{`${isIncome(entry) ? "+" : "-"}${formatWon(entry.amount)}`}</dd></div>
        <div><dt>분류</dt><dd>{entry.category}</dd></div>
        <div><dt>날짜</dt><dd>{entry.date}</dd></div>
        {entry.memo ? <div><dt>메모</dt><dd id="entry-detail-memo">{entry.memo}</dd></div> : null}
      </dl>
      <div className="budget-actions">
        <Link id="entry-edit" className="budget-button" to={`/budget/entries/${entry.id}/edit`}>수정</Link>
        <button id="entry-remove" type="button" onClick={remove}>삭제</button>
        <Link className="budget-button" to={`/budget/${entry.date.slice(0, 7)}`}>목록으로</Link>
      </div>
    </BudgetLayout>
  );
}

// --- /budget/entries/:id/edit ---

function toDraft(entry: Entry): EntryDraft {
  return {
    title: entry.title,
    amount: String(entry.amount),
    category: entry.category,
    date: entry.date,
    memo: entry.memo ?? "",
  };
}

export function EditEntryPage({ params = {} }: PageProps) {
  const [entries, updateEntries] = useEntries();
  const entry = entries.find(item => String(item.id) === params.id);

  // 파라미터만 바뀌면 같은 루트가 유지되므로, 다른 항목의 작성 내용을 이어서 쓰지 않도록 id와 함께 둔다
  const [edit, setEdit] = useState<{ id: string | undefined; draft: EntryDraft } | null>(null);
  const editing = edit !== null && edit.id === params.id ? edit.draft : null;
  useTitle(entry === undefined ? "항목을 찾을 수 없음" : `${entry.title} 수정`);
  useLeaveConfirm(entry !== undefined && editing !== null && JSON.stringify(editing) !== JSON.stringify(toDraft(entry)));

  if (entry === undefined) return <EntryNotFound />;

  const draft = editing ?? toDraft(entry);

  const submit = () => {
    const fields = draftToFields(draft);
    if (fields === null) return;
    updateEntries(prev => prev.map(item => (item.id === entry.id ? { ...fields, id: entry.id } : item)));
    setEdit(null);
    navigate(`/budget/entries/${entry.id}`, { replace: true });
  };

  return (
    <BudgetLayout current={null}>
      <h1>항목 수정</h1>
      <EntryForm
        draft={draft}
        submitLabel="저장"
        cancelTo={`/budget/entries/${entry.id}`}
        // 렌더 전에 입력이 연달아 들어와도 앞의 값을 덮어쓰지 않도록 이전 상태에서 만든다
        onChange={change => setEdit(prev => ({
          id: params.id,
          draft: { ...(prev !== null && prev.id === params.id ? prev.draft : toDraft(entry)), ...change },
        }))}
        onSubmit={submit}
      />
    </BudgetLayout>
  );
}

// --- /budget/stats ---

export function StatsPage() {
  const [entries] = useEntries();
  useTitle("통계");

  const monthRows = useMemo<BarRow[]>(() => {
    const current = monthOf(new Date());
    return [5, 4, 3, 2, 1, 0].map(offset => {
      const month = shiftMonth(current, -offset);
      return {
        key: month,
        label: `${Number(month.slice(5))}월`,
        amount: expenseTotal(entries.filter(entry => entry.date.startsWith(month))),
        to: `/budget/${month}`,
      };
    });
  }, [entries]);

  const categoryRows = useMemo<BarRow[]>(() => EXPENSE_CATEGORIES
    .map(category => ({
      key: category,
      label: category,
      amount: expenseTotal(entries.filter(entry => entry.category === category)),
    }))
    .filter(row => row.amount > 0)
    .sort((a, b) => b.amount - a.amount), [entries]);

  return (
    <BudgetLayout current="stats">
      <h1>통계</h1>
      <div id="stats-months"><BarChart title="최근 6개월 지출" rows={monthRows} /></div>
      <div id="stats-categories"><BarChart title="전체 기간 분류별 지출" rows={categoryRows} /></div>
    </BudgetLayout>
  );
}
