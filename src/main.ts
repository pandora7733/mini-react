import { h } from "./createElement.js";
import { render } from "./render.js";
import { useState } from "./hooks.js";

function Counter({ label }: { label: string }) {
  const [count, setCount] = useState(0);
  console.log(`render ${label}`);
  return h("div", null,
    h("span", null, label, ": ", count),
    h("button", { onClick: () => setCount(c => c + 1) }, "+1"),
    h("button", { onClick: () => { setCount(c => c + 1); setCount(c => c + 1); } }, "+2"),
  );
}

function App() {
  const [showB, setShowB] = useState(true);
  console.log("render App");
  return h("div", null,
    h("input", { placeholder: "입력값이 유지되는지 확인" }),
    h(Counter, { label: "A" }),
    h("button", { onClick: () => setShowB(s => !s) }, "B 토글"),
    showB ? h(Counter, { label: "B" }) : null,
  );
}

render(h(App, null), document.getElementById("root")!);

// @ts-expect-error label은 string이어야 함
h(Counter, { label: 1 });
// @ts-expect-error 필수 props가 있으면 null 불가
h(Counter, null);