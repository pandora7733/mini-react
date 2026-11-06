import { h } from "./createElement.js";
import { render } from "./render.js";

const root = document.getElementById("root")!;
let count = 0;

function App() {
  return h("div", null,
    h("h1", null, "count: ", count),
    h("button", { onClick: () => { count++; update(); } }, "+1"),
    h("input", { placeholder: "아무거나 입력해 보세요" }),
    count % 2 === 0 ? h("p", null, "짝수") : h("b", null, "홀수"),
    h("ul", null,
      Array.from({ length: count }, (_, i) => h("li", null, "item ", i)),
    ),
  );
}

function update() {
  render(App(), root);
}

update();

// 실제로 어떤 DOM 변경이 일어나는지 콘솔에 기록
new MutationObserver(records => {
  console.log(`DOM 변경 ${records.length}건`, records.map(r => r.type));
}).observe(root, { subtree: true, childList: true, attributes: true, characterData: true });