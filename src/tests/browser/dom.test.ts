import { h } from "../../createElement.js";
import { createDom } from "../../dom.js";
import { diffChildren } from "../../diff.js";
import { domChildrenToVNodes, domToVNode } from "../../domToVNode.js";
import { toHostTree } from "../../expand.js";
import { patchChildren } from "../../patch.js";
import { serializeHtml } from "../../serializeHtml.js";
import type { ElementVNode, VNode } from "../../types.js";
import { assert, test, wait } from "./harness.js";

function parse(html: string): HTMLElement {
  const host = document.createElement("div");
  host.innerHTML = html;
  return host;
}

// old 트리를 그린 컨테이너를 만들고, next 트리로 패치하는 함수를 돌려준다
function patched(old: VNode[], next: VNode[]): { container: HTMLElement; run: () => void } {
  const oldHost = toHostTree(old);
  const container = document.createElement("div");
  document.getElementById("sandbox")!.append(container);
  container.append(...oldHost.map(v => createDom(v, container)));
  return {
    container,
    run: () => patchChildren(container, diffChildren(oldHost, toHostTree(next))),
  };
}

function apply(old: VNode, next: VNode): Element {
  const { container, run } = patched([old], [next]);
  run();
  return container.firstElementChild!;
}

function created(vnode: VNode): Element {
  return createDom(toHostTree([vnode])[0]) as Element;
}

// --- DOM → Virtual DOM ---

test("변환: 태그, 속성, 자식을 읽는다", () => {
  const vnode = domToVNode(parse(`<a href="/x" class="c">글<b>굵게</b></a>`).firstChild!) as ElementVNode;
  assert.equal(vnode.type, "a");
  assert.equal(vnode.props.href, "/x");
  assert.equal(vnode.props.class, "c");
  assert.equal(vnode.children.length, 2);
  assert.equal(vnode.children[0].kind, "text");
});

test("변환: 공백 텍스트와 주석도 노드 하나당 vnode 하나로 대응한다", () => {
  const host = parse(`<p>a</p>\n  <!-- 주석 --><p>b</p>`);
  const kinds = domChildrenToVNodes(host).map(v => v.kind);
  assert.equal(kinds.join(), "element,text,empty,element");
  assert.equal(kinds.length, host.childNodes.length);
});

test("변환: data-key를 key로 읽고 속성에도 남긴다", () => {
  const vnode = domToVNode(parse(`<li data-key="a"></li>`).firstChild!) as ElementVNode;
  assert.equal(vnode.key, "a");
  assert.equal(vnode.props["data-key"], "a");
});

test("변환: script와 인라인 핸들러는 옮기지 않는다", () => {
  // <template> 안에서 파싱해야 테스트 중에 핸들러가 실제로 실행되지 않는다
  const template = document.createElement("template");
  template.innerHTML = `<img src="x" onerror="alert(1)"><script>alert(1)</script>`;
  const [img, script] = domChildrenToVNodes(template.content);
  assert.equal((img as ElementVNode).props.onerror, undefined);
  assert.equal(script.kind, "empty");
});

test("변환: 입력한 값과 체크 상태를 읽는다", () => {
  const host = parse(`<input value="a"><input type="checkbox"><textarea>t</textarea><select><option>x</option><option selected>y</option></select>`);
  const [text, box, area] = Array.from(host.children) as [HTMLInputElement, HTMLInputElement, HTMLTextAreaElement];
  text.value = "입력";
  box.checked = true;
  area.value = "수정";
  const [v1, v2, v3, v4] = domChildrenToVNodes(host) as ElementVNode[];
  assert.equal(v1.props.value, "입력");
  assert.equal(v2.props.checked, true);
  assert.equal(v3.props.value, "수정");
  assert.equal(v4.props.value, "y");
});

test("변환 후 다시 그리면 같은 HTML이 된다", () => {
  const host = parse(`<div class="a" style="color: red"><p>글 <b>굵게</b></p>\n<ul><li>1</li></ul></div>`);
  const again = document.createElement("div");
  again.append(...toHostTree(domChildrenToVNodes(host)).map(v => createDom(v, again)));
  assert.equal(again.innerHTML, host.innerHTML);
});

test("변환: 대소문자가 중요한 SVG 태그를 유지한다", () => {
  const vnode = domToVNode(parse(`<svg><linearGradient></linearGradient></svg>`).firstChild!) as ElementVNode;
  assert.equal((vnode.children[0] as ElementVNode).type, "linearGradient");
});

// --- HTML 직렬화 ---

function reparse(html: string): HTMLTemplateElement {
  const template = document.createElement("template");
  template.innerHTML = html;
  return template;
}

test("직렬화: 입력값이 없으면 innerHTML과 같다", () => {
  const host = parse(`<p class="a">글</p><!-- 주석 --><input value="a"><input type="checkbox" checked=""><textarea>t</textarea><select><option>x</option><option selected="">y</option></select>`);
  assert.equal(serializeHtml(host), host.innerHTML);
});

test("직렬화: 처음 option이 기본 선택이면 selected 속성을 만들지 않는다", () => {
  const host = parse(`<select><option>x</option><option>y</option></select>`);
  assert.equal(serializeHtml(host), host.innerHTML);
});

test("직렬화: 입력한 값을 다시 파싱해도 같은 값이다", () => {
  const host = parse(`<input value="a"><input><input type="checkbox" checked=""><input type="radio"><textarea>t</textarea><select><option>x</option><option selected="">y</option></select>`);
  const [text, empty, box, radio, area, select] = Array.from(host.children) as [HTMLInputElement, HTMLInputElement, HTMLInputElement, HTMLInputElement, HTMLTextAreaElement, HTMLSelectElement];
  text.value = "";
  empty.value = `"따옴표" <태그>`;
  box.checked = false;
  radio.checked = true;
  area.value = "</textarea><b>글</b>";
  select.selectedIndex = 0;

  const out = reparse(serializeHtml(host)).content;
  const [text2, empty2, box2, radio2, area2, select2] = Array.from(out.children) as [HTMLInputElement, HTMLInputElement, HTMLInputElement, HTMLInputElement, HTMLTextAreaElement, HTMLSelectElement];
  assert.equal(text2.value, "");
  assert.equal(empty2.value, `"따옴표" <태그>`);
  assert.equal(box2.checked, false);
  assert.equal(radio2.checked, true);
  assert.equal(area2.value, "</textarea><b>글</b>");
  assert.equal(select2.value, "x");
});

test("직렬화: textarea 맨 앞의 줄바꿈을 유지한다", () => {
  const host = parse(`<textarea></textarea>`);
  (host.firstChild as HTMLTextAreaElement).value = "\n둘째 줄";
  const area = reparse(serializeHtml(host)).content.firstChild as HTMLTextAreaElement;
  assert.equal(area.value, "\n둘째 줄");
});

test("직렬화: 원본 DOM을 바꾸지 않는다", () => {
  const host = parse(`<input value="a"><textarea>t</textarea>`);
  const [input, area] = Array.from(host.children) as [HTMLInputElement, HTMLTextAreaElement];
  input.value = "입력";
  area.value = "수정";
  const before = host.innerHTML;
  serializeHtml(host);
  assert.equal(host.innerHTML, before);
  assert.equal(input.value, "입력");
  assert.equal(area.value, "수정");
});

test("직렬화: 복사할 때 인라인 핸들러를 실행하지 않는다", async () => {
  const win = window as unknown as { imageErrors?: number };
  // 원본 이미지도 문서에 들어오면 한 번 실패하므로, 그 뒤로 횟수가 늘지 않는지 본다
  const host = parse(`<img src="missing.png" onerror="window.imageErrors = (window.imageErrors ?? 0) + 1">`);
  await wait(100);
  assert.equal(win.imageErrors, 1);
  serializeHtml(host);
  await wait(100);
  assert.equal(win.imageErrors, 1);
});

// --- 속성 ---

test("속성: 문자열 style을 지우면 style 속성이 사라진다", () => {
  const el = apply(h("p", { style: "color: red" }), h("p", null));
  assert.equal(el.getAttribute("style"), null);
});

test("속성: 문자열 style을 객체로 바꾸면 이전 값이 남지 않는다", () => {
  const el = apply(h("p", { style: "color: red" }), h("p", { style: { fontSize: "10px" } })) as HTMLElement;
  assert.equal(el.style.color, "");
  assert.equal(el.style.fontSize, "10px");
});

test("속성: style 객체에서 빠진 키만 지운다", () => {
  const el = apply(h("p", { style: { color: "red", fontSize: "10px" } }), h("p", { style: { fontSize: "10px" } })) as HTMLElement;
  assert.equal(el.style.color, "");
  assert.equal(el.style.fontSize, "10px");
});

test("속성: 객체 style을 지우면 style 속성이 사라진다", () => {
  const el = apply(h("p", { style: { color: "red" } }), h("p", null));
  assert.equal(el.getAttribute("style"), null);
});

test("속성: 문자열 style은 쓴 그대로 남아 다시 읽어도 같다", () => {
  const el = created(h("p", { style: "color: red" }));
  assert.equal(el.getAttribute("style"), "color: red");
});

test("속성: 객체 style을 문자열로 바꾼다", () => {
  const el = apply(h("p", { style: { color: "red" } }), h("p", { style: "font-size: 10px" })) as HTMLElement;
  assert.equal(el.style.color, "");
  assert.equal(el.style.fontSize, "10px");
});

test("속성: className을 지우면 class 속성이 사라진다", () => {
  const el = apply(h("p", { className: "a" }), h("p", null));
  assert.equal(el.getAttribute("class"), null);
});

test("속성: htmlFor는 for 속성이 된다", () => {
  assert.equal(created(h("label", { htmlFor: "x" })).getAttribute("for"), "x");
});

test("속성: input value는 사용자가 입력한 뒤에도 바뀐다", () => {
  const { container, run } = patched([h("input", { value: "a" })], [h("input", { value: "b" })]);
  const input = container.firstChild as HTMLInputElement;
  input.value = "입력";
  run();
  assert.equal(input.value, "b");
});

test("속성: input의 value와 checked는 속성에도 반영된다", () => {
  const text = created(h("input", { value: "a" }));
  const box = created(h("input", { type: "checkbox", checked: true }));
  assert.equal(text.getAttribute("value"), "a");
  assert.equal(box.hasAttribute("checked"), true);
});

test("속성: textarea value가 바뀐다", () => {
  const el = apply(h("textarea", { value: "a" }), h("textarea", { value: "b" })) as HTMLTextAreaElement;
  assert.equal(el.value, "b");
});

test("속성: select value는 처음 렌더에서 적용된다", () => {
  const select = created(h("select", { value: "b" }, h("option", { value: "a" }), h("option", { value: "b" }))) as HTMLSelectElement;
  assert.equal(select.value, "b");
});

test("속성: select value를 새 option과 함께 바꿀 수 있다", () => {
  const el = apply(
    h("select", { value: "a" }, h("option", { value: "a" })),
    h("select", { value: "b" }, h("option", { value: "a" }), h("option", { value: "b" })),
  ) as HTMLSelectElement;
  assert.equal(el.value, "b");
});

test("속성: range input의 value는 max 속성 뒤에 적용된다", () => {
  const input = created(h("input", { value: "150", type: "range", max: "200" })) as HTMLInputElement;
  assert.equal(input.value, "150");
});

test("속성: 체크박스 상태가 바뀐다", () => {
  const el = apply(h("input", { type: "checkbox", checked: false }), h("input", { type: "checkbox", checked: true })) as HTMLInputElement;
  assert.equal(el.checked, true);
});

test("속성: true는 빈 속성, false는 제거다", () => {
  const el = apply(h("button", { disabled: true, hidden: false }), h("button", { disabled: false, hidden: true }));
  assert.equal(el.hasAttribute("disabled"), false);
  assert.equal(el.getAttribute("hidden"), "");
});

test("속성: 이벤트 핸들러를 교체한다", () => {
  const log: string[] = [];
  const { container, run } = patched(
    [h("button", { onClick: () => log.push("first") })],
    [h("button", { onClick: () => log.push("second") })],
  );
  const button = container.firstChild as HTMLButtonElement;
  button.click();
  run();
  button.click();
  assert.equal(log.join(), "first,second");
});

test("SVG: 네임스페이스로 만들고 class를 바꿀 수 있다", () => {
  const svg = apply(
    h("svg", { className: "a" }, h("circle", { r: "1" })),
    h("svg", { className: "b" }, h("circle", { r: "2" }), h("rect", null)),
  );
  assert.equal(svg.namespaceURI, "http://www.w3.org/2000/svg");
  assert.equal(svg.getAttribute("class"), "b");
  assert.equal(svg.children[0].getAttribute("r"), "2");
  assert.equal(svg.children[1].namespaceURI, "http://www.w3.org/2000/svg");
});

// --- Patch ---

test("Patch: 바뀌지 않은 노드는 같은 DOM 객체를 유지한다", () => {
  const { container, run } = patched(
    [h("div", null, h("p", null, "유지"), h("p", null, "a"))],
    [h("div", null, h("p", null, "유지"), h("p", null, "b"))],
  );
  const [keep, changed] = Array.from(container.firstElementChild!.children);
  const keepText = keep.firstChild;
  run();
  const [keepAfter, changedAfter] = Array.from(container.firstElementChild!.children);
  assert.equal(keepAfter, keep);
  assert.equal(keepAfter.firstChild, keepText);
  assert.equal(changedAfter, changed);
  assert.equal(changedAfter.textContent, "b");
});

test("Patch: 태그가 다르면 노드를 교체한다", () => {
  const { container, run } = patched([h("p", null, "a")], [h("div", null, "a")]);
  run();
  assert.equal(container.innerHTML, "<div>a</div>");
});

test("Patch: key 재정렬은 DOM 노드를 옮기고 입력값을 유지한다", () => {
  const li = (key: string) => h("li", { key }, h("input", null));
  const { container, run } = patched(
    [h("ul", null, li("a"), li("b"), li("c"))],
    [h("ul", null, li("c"), li("a"), li("b"))],
  );
  const ul = container.firstElementChild!;
  const [a, b, c] = Array.from(ul.children);
  (a.firstChild as HTMLInputElement).value = "A값";
  run();
  const after = Array.from(ul.children);
  assert.equal(after[0], c);
  assert.equal(after[1], a);
  assert.equal(after[2], b);
  assert.equal((after[1].firstChild as HTMLInputElement).value, "A값");
});

test("Patch: key 추가와 삭제와 이동을 함께 처리한다", () => {
  const li = (key: string) => h("li", { key }, key);
  const { container, run } = patched(
    [h("ul", null, li("a"), li("b"), li("c"), li("d"))],
    [h("ul", null, li("d"), li("x"), li("b"), li("y"))],
  );
  run();
  assert.equal(container.firstElementChild!.textContent, "dxby");
});

function mutationCount(container: HTMLElement, run: () => void): number {
  const observer = new MutationObserver(() => {});
  observer.observe(container, { childList: true, subtree: true, attributes: true, characterData: true });
  run();
  const count = observer.takeRecords().length;
  observer.disconnect();
  return count;
}

test("Patch: 변경이 없으면 DOM을 건드리지 않는다", () => {
  const tree = () => [h("div", { id: "a" }, h("p", null, "x"))];
  const { container, run } = patched(tree(), tree());
  assert.equal(mutationCount(container, run), 0);
});

test("Patch: 텍스트 한 곳이 바뀌면 DOM 변경은 한 건이다", () => {
  const tree = (text: string) => [h("div", null, h("p", null, "유지"), h("ul", null, h("li", null, text)))];
  const { container, run } = patched(tree("a"), tree("b"));
  assert.equal(mutationCount(container, run), 1);
});
