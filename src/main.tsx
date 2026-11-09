import { Fragment, h } from "./createElement.js";
import { render } from "./render.js";
import { useCallback, useEffect, useMemo, useState } from "./hooks.js";

// 홀수일 때 null을 반환: 화면에서는 사라지지만 인스턴스(상태, effect)는 유지된다
function EvenBadge({ count }: { count: number }) {
  useEffect(() => {
    console.log("effect EvenBadge: mount");
    return () => console.log("cleanup EvenBadge: unmount");
  }, []);
  return count % 2 === 0 ? <em>짝수</em> : null;
}

function Counter({ label }: { label: string }) {
  const [count, setCount] = useState(0);
  console.log(`render ${label}`);

  useEffect(() => {
    console.log(`effect ${label}: mount`);
    return () => console.log(`cleanup ${label}: unmount`);
  }, []);

  useEffect(() => {
    console.log(`effect ${label}: count=${count}`);
    return () => console.log(`cleanup ${label}: count=${count}`);
  }, [count]);

  const doubled = useMemo(() => {
    console.log(`memo ${label}: count * 2 계산`);
    return count * 2;
  }, [count]);

  const increment = useCallback(() => setCount(c => c + 1), []);

  return (
    <div>
      <span>{label}: {count} (x2 = {doubled})</span>
      <button onClick={increment}>+1</button>
      <button onClick={() => { setCount(c => c + 1); setCount(c => c + 1); }}>+2</button>
      {label === "A" && <EvenBadge count={count} />}
    </div>
  );
}

interface Item {
  id: number;
  text: string;
}

// 컴포넌트 상태(checked)와 DOM 상태(input 값)가 모두 key를 따라가는지 확인
function Row({ item }: { item: Item }) {
  const [checked, setChecked] = useState(false);
  return (
    <li>
      <button onClick={() => setChecked(c => !c)}>{checked ? "✔" : "○"}</button>
      {" "}{item.text}{" "}
      <input placeholder="메모" />
    </li>
  );
}

function List() {
  const [items, setItems] = useState<Item[]>([
    { id: 1, text: "사과" },
    { id: 2, text: "바나나" },
    { id: 3, text: "체리" },
  ]);
  const [nextId, setNextId] = useState(4);

  return (
    <section>
      <button onClick={() => { setItems(xs => [{ id: nextId, text: `새 항목 ${nextId}` }, ...xs]); setNextId(n => n + 1); }}>맨 앞에 추가</button>
      <button onClick={() => setItems(xs => [...xs].reverse())}>뒤집기</button>
      <button onClick={() => setItems(xs => xs.slice(1))}>첫 항목 삭제</button>
      <ul>
        {items.map(item => <Row key={item.id} item={item} />)}
      </ul>
    </section>
  );
}

// DOM 노드 없이 여러 개를 반환한다
function Tags({ count }: { count: number }) {
  return (
    <>
      <em>태그 {count}개:</em>
      {Array.from({ length: count }, (_, i) => <b key={i}>#{i}</b>)}
    </>
  );
}

// Tags의 길이가 바뀌어도 뒤에 있는 input은 그대로여야 한다
function FragmentDemo() {
  const [count, setCount] = useState(1);
  return (
    <section>
      <button onClick={() => setCount(c => c + 1)}>태그 추가</button>
      <button onClick={() => setCount(c => Math.max(0, c - 1))}>태그 삭제</button>
      <Tags count={count} />
      <input placeholder="태그 수가 바뀌어도 유지" />
    </section>
  );
}

function App() {
  const [showB, setShowB] = useState(true);
  console.log("render App");

  useEffect(() => {
    console.log("effect App: 매 렌더");
  });

  // B를 input 앞에 둔다: null 자리가 유지되므로 B가 사라져도 input은 그대로여야 한다
  return (
    <div>
      <Counter label="A" />
      {showB ? <Counter label="B" /> : null}
      <button onClick={() => setShowB(s => !s)}>B 토글</button>
      <input placeholder="입력값이 유지되는지 확인" />
      <List />
      <FragmentDemo />
    </div>
  );
}

render(<App />, document.getElementById("root")!);

// @ts-expect-error label은 string이어야 함
<Counter label={1} />;
// @ts-expect-error 필수 prop label이 없음
<Counter />;
