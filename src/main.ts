import { h } from "./createElement.js";
import { render } from "./render.js";
import { useCallback, useEffect, useMemo, useState } from "./hooks.js";

// 홀수일 때 null을 반환: 화면에서는 사라지지만 인스턴스(상태, effect)는 유지된다
function EvenBadge({ count }: { count: number }) {
  useEffect(() => {
    console.log("effect EvenBadge: mount");
    return () => console.log("cleanup EvenBadge: unmount");
  }, []);
  return count % 2 === 0 ? h("em", null, "짝수") : null;
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

  return h("div", null,
    h("span", null, label, ": ", count, " (x2 = ", doubled, ")"),
    h("button", { onClick: increment }, "+1"),
    h("button", { onClick: () => { setCount(c => c + 1); setCount(c => c + 1); } }, "+2"),
    label === "A" && h(EvenBadge, { count }),
  );
}

interface Item {
  id: number;
  text: string;
}

// 컴포넌트 상태(checked)와 DOM 상태(input 값)가 모두 key를 따라가는지 확인
function Row({ item }: { item: Item }) {
  const [checked, setChecked] = useState(false);
  return h("li", null,
    h("button", { onClick: () => setChecked(c => !c) }, checked ? "✔" : "○"),
    " ", item.text, " ",
    h("input", { placeholder: "메모" }),
  );
}

function List() {
  const [items, setItems] = useState<Item[]>([
    { id: 1, text: "사과" },
    { id: 2, text: "바나나" },
    { id: 3, text: "체리" },
  ]);
  const [nextId, setNextId] = useState(4);

  return h("section", null,
    h("button", { onClick: () => { setItems(xs => [{ id: nextId, text: `새 항목 ${nextId}` }, ...xs]); setNextId(n => n + 1); } }, "맨 앞에 추가"),
    h("button", { onClick: () => setItems(xs => [...xs].reverse()) }, "뒤집기"),
    h("button", { onClick: () => setItems(xs => xs.slice(1)) }, "첫 항목 삭제"),
    h("ul", null, items.map(item => h(Row, { key: item.id, item }))),
  );
}

function App() {
  const [showB, setShowB] = useState(true);
  console.log("render App");

  useEffect(() => {
    console.log("effect App: 매 렌더");
  });

  // B를 input 앞에 둔다: null 자리가 유지되므로 B가 사라져도 input은 그대로여야 한다
  return h("div", null,
    h(Counter, { label: "A" }),
    showB ? h(Counter, { label: "B" }) : null,
    h("button", { onClick: () => setShowB(s => !s) }, "B 토글"),
    h("input", { placeholder: "입력값이 유지되는지 확인" }),
    h(List, null),
  );
}

render(h(App, null), document.getElementById("root")!);

// @ts-expect-error label은 string이어야 함
h(Counter, { label: 1 });
// @ts-expect-error 필수 props가 있으면 null 불가
h(Counter, null);