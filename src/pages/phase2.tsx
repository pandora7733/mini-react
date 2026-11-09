import { h } from "../createElement.js";
import { useEffect, useMemo, useState } from "../hooks.js";
import { Link } from "../router.js";

interface Task {
  id: number;
  title: string;
  priority: "high" | "normal";
  done: boolean;
}

type Filter = "all" | "active" | "done";

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: "all", label: "전체" },
  { value: "active", label: "진행 중" },
  { value: "done", label: "완료" },
];

const FOCUS_SECONDS = 25 * 60;
const STORAGE_KEY = `mini-react:focus-board:${new URLSearchParams(location.search).get("board") ?? "default"}`;
const DEFAULT_TASKS: Task[] = [
  { id: 1, title: "Virtual DOM 구조 설명 정리", priority: "high", done: true },
  { id: 2, title: "Diff 5가지 케이스 발표 준비", priority: "high", done: false },
  { id: 3, title: "실제 React와의 차이 조사", priority: "normal", done: false },
];

function loadTasks(): Task[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === null) return DEFAULT_TASKS;
    const parsed: unknown = JSON.parse(saved);
    return isTaskList(parsed) ? parsed : DEFAULT_TASKS;
  } catch {
    return DEFAULT_TASKS;   // 저장소를 쓸 수 없거나 내용이 깨졌으면 기본값으로 시작한다
  }
}

// 저장소는 밖에서 고칠 수 있으므로 타입을 믿지 않는다. id는 key로 쓰이므로 겹치면 렌더가 실패한다
function isTaskList(value: unknown): value is Task[] {
  if (!Array.isArray(value) || !value.every(isTask)) return false;
  return new Set(value.map(task => task.id)).size === value.length;
}

function isTask(value: unknown): value is Task {
  if (typeof value !== "object" || value === null) return false;
  const task = value as Record<string, unknown>;
  return typeof task.id === "number"
    && typeof task.title === "string"
    && (task.priority === "high" || task.priority === "normal")
    && typeof task.done === "boolean";
}

function saveTasks(tasks: Task[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch {
    // 저장에 실패해도 화면 동작에는 영향이 없다
  }
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

// --- 자식 컴포넌트: 상태 없이 props만 받는 순수 함수 ---

function FocusTimer({ seconds, running, onToggle, onReset }: {
  seconds: number;
  running: boolean;
  onToggle: () => void;
  onReset: () => void;
}) {
  const percent = (1 - seconds / FOCUS_SECONDS) * 100;
  return (
    <section className="timer" aria-label="집중 타이머">
      <div id="timer-time" className="timer-time">{formatTime(seconds)}</div>
      <div className="timer-track"><div className="timer-fill" style={{ width: `${percent}%` }} /></div>
      <div className="timer-actions">
        <button id="timer-toggle" type="button" onClick={onToggle}>{running ? "일시정지" : "시작"}</button>
        <button id="timer-reset" type="button" onClick={onReset}>초기화</button>
      </div>
    </section>
  );
}

function Stats({ total, done, high }: { total: number; done: number; high: number }) {
  return (
    <dl className="stats">
      <div><dt>전체</dt><dd id="stat-total">{total}</dd></div>
      <div><dt>완료</dt><dd id="stat-done">{done}</dd></div>
      <div><dt>남은 중요 항목</dt><dd id="stat-high">{high}</dd></div>
    </dl>
  );
}

function TaskForm({ draft, priority, onDraft, onPriority, onAdd }: {
  draft: string;
  priority: Task["priority"];
  onDraft: (value: string) => void;
  onPriority: (value: Task["priority"]) => void;
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
        id="task-draft"
        aria-label="할 일 제목"
        placeholder="할 일을 입력하세요"
        value={draft}
        onInput={event => onDraft((event.target as HTMLInputElement).value)}
      />
      <select
        id="task-priority"
        aria-label="중요도"
        value={priority}
        onChange={event => onPriority((event.target as HTMLSelectElement).value as Task["priority"])}
      >
        <option value="normal">보통</option>
        <option value="high">중요</option>
      </select>
      <button id="task-add" className="primary" type="submit" disabled={draft.trim() === ""}>추가</button>
    </form>
  );
}

function FilterBar({ filter, query, onFilter, onQuery, onClearDone, canClear }: {
  filter: Filter;
  query: string;
  onFilter: (value: Filter) => void;
  onQuery: (value: string) => void;
  onClearDone: () => void;
  canClear: boolean;
}) {
  return (
    <div className="filter-bar">
      {FILTERS.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          data-filter={value}
          aria-pressed={String(filter === value)}
          onClick={() => onFilter(value)}
        >
          {label}
        </button>
      ))}
      <input
        id="task-search"
        className="search"
        aria-label="검색"
        placeholder="검색"
        value={query}
        onInput={event => onQuery((event.target as HTMLInputElement).value)}
      />
      <button id="clear-done" type="button" disabled={!canClear} onClick={onClearDone}>완료 항목 정리</button>
    </div>
  );
}

function TaskItem({ task, canMoveUp, canMoveDown, onToggle, onMove, onRemove }: {
  task: Task;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onToggle: (id: number) => void;
  onMove: (id: number, offset: number) => void;
  onRemove: (id: number) => void;
}) {
  return (
    <li className={task.done ? "task done" : "task"} data-task-id={task.id}>
      <input
        type="checkbox"
        aria-label={`${task.title} 완료`}
        checked={task.done}
        onChange={() => onToggle(task.id)}
      />
      <span className="task-title">{task.title}</span>
      {task.priority === "high" && <span className="task-priority">중요</span>}
      <div className="task-actions">
        <button type="button" data-action="up" aria-label="위로" disabled={!canMoveUp} onClick={() => onMove(task.id, -1)}>↑</button>
        <button type="button" data-action="down" aria-label="아래로" disabled={!canMoveDown} onClick={() => onMove(task.id, 1)}>↓</button>
        <button type="button" data-action="remove" aria-label="삭제" onClick={() => onRemove(task.id)}>×</button>
      </div>
    </li>
  );
}

// --- 루트 컴포넌트: 상태와 훅은 모두 여기에만 둔다 (Lifting State Up) ---

let renderCount = 0;
let memoCount = 0;

let domObserver: MutationObserver;

export function Phase2Page() {
  renderCount++;

  const [tasks, setTasks] = useState<Task[]>(loadTasks);
  const [draft, setDraft] = useState("");
  const [priority, setPriority] = useState<Task["priority"]>("normal");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [seconds, setSeconds] = useState(FOCUS_SECONDS);
  const [running, setRunning] = useState(false);

  // 타이머가 매초 다시 렌더해도 tasks, filter, query가 그대로면 다시 계산하지 않는다
  const visible = useMemo(() => {
    memoCount++;
    const keyword = query.trim().toLowerCase();
    return tasks.filter(task => {
      if (filter === "active" && task.done) return false;
      if (filter === "done" && !task.done) return false;
      return task.title.toLowerCase().includes(keyword);
    });
  }, [tasks, filter, query]);

  const stats = useMemo(() => ({
    total: tasks.length,
    done: tasks.filter(task => task.done).length,
    high: tasks.filter(task => task.priority === "high" && !task.done).length,
  }), [tasks]);

  useEffect(() => saveTasks(tasks), [tasks]);

  useEffect(() => {
    document.title = `(${tasks.length - stats.done}) Focus Board`;
  }, [tasks, stats]);

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setSeconds(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);   // 일시정지하거나 언마운트하면 타이머를 멈춘다
  }, [running]);

  useEffect(() => {
    if (seconds === 0) setRunning(false);
  }, [seconds]);

  useEffect(() => {
    domObserver = new MutationObserver(() => {});
    domObserver.observe(document.getElementById("focus-board")!, { childList: true, subtree: true, attributes: true, characterData: true });
    return () => {
      domObserver.disconnect();
      renderCount = 0;
      memoCount = 0;
    };
  }, []);

  // 지표는 DOM에 직접 쓴다. 상태로 만들면 갱신이 다시 갱신을 부른다
  useEffect(() => {
    setText("engine-renders", renderCount);
    setText("engine-memos", memoCount);
    setText("engine-mutations", domObserver.takeRecords().length);
    setText("engine-nodes", document.querySelectorAll("#focus-board *").length);
  });

  const addTask = () => {
    const title = draft.trim();
    if (title === "") return;
    // 한 이벤트의 setState 여러 번은 마이크로태스크에서 렌더 한 번으로 합쳐진다
    setTasks(prev => [...prev, { id: nextId(prev), title, priority, done: false }]);
    setDraft("");
    setPriority("normal");
  };

  const toggleTask = (id: number) =>
    setTasks(prev => prev.map(task => (task.id === id ? { ...task, done: !task.done } : task)));

  const removeTask = (id: number) => setTasks(prev => prev.filter(task => task.id !== id));

  const moveTask = (id: number, offset: number) =>
    setTasks(prev => {
      const from = prev.findIndex(task => task.id === id);
      const to = from + offset;
      if (from < 0 || to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      [next[from], next[to]] = [next[to], next[from]];
      return next;
    });

  return (
    <main className="page narrow">
      <Link className="back-link" to="/">mini-react</Link>
      <div id="focus-board">
        <header className="board-header">
          <div>
            <h1>Focus Board</h1>
            <p>상태는 모두 루트 컴포넌트에 있고, 자식은 props만 받습니다.</p>
          </div>
          <FocusTimer
            seconds={seconds}
            running={running}
            onToggle={() => setRunning(r => !r && seconds > 0)}
            onReset={() => {
              setRunning(false);
              setSeconds(FOCUS_SECONDS);
            }}
          />
        </header>
        <Stats total={stats.total} done={stats.done} high={stats.high} />
        <TaskForm
          draft={draft}
          priority={priority}
          onDraft={setDraft}
          onPriority={setPriority}
          onAdd={addTask}
        />
        <FilterBar
          filter={filter}
          query={query}
          onFilter={setFilter}
          onQuery={setQuery}
          onClearDone={() => setTasks(prev => prev.filter(task => !task.done))}
          canClear={stats.done > 0}
        />
        {visible.length === 0
          ? <p id="empty-state" className="empty-state">표시할 할 일이 없습니다.</p>
          : (
            <ul id="task-list" className="task-list">
              {visible.map(task => {
                const index = tasks.indexOf(task);
                return (
                  <TaskItem
                    key={task.id}
                    task={task}
                    canMoveUp={index > 0}
                    canMoveDown={index < tasks.length - 1}
                    onToggle={toggleTask}
                    onMove={moveTask}
                    onRemove={removeTask}
                  />
                );
              })}
            </ul>
          )}
      </div>
      {/* 여기 있는 값은 effect가 직접 채운다. vnode에 자식이 없으므로 diff가 건드리지 않는다 */}
      <aside className="engine" aria-label="엔진 동작 지표">
        <h2>엔진 동작</h2>
        <dl>
          <div><dt>루트 렌더</dt><dd id="engine-renders"></dd></div>
          <div><dt>useMemo 재계산</dt><dd id="engine-memos"></dd></div>
          <div><dt>마지막 갱신의 DOM 변경</dt><dd id="engine-mutations"></dd></div>
          <div><dt>전체 DOM 노드</dt><dd id="engine-nodes"></dd></div>
        </dl>
      </aside>
    </main>
  );
}

function nextId(tasks: Task[]): number {
  return tasks.reduce((max, task) => Math.max(max, task.id), 0) + 1;
}

function setText(id: string, value: number): void {
  document.getElementById(id)!.textContent = String(value);
}

