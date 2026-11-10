import type { HostVNode } from "../types.js";
import { createDom } from "../dom.js";
import { diffChildren, isUnchanged } from "../diff.js";
import { patchChildren } from "../patch.js";
import { toHostTree } from "../expand.js";
import { domChildrenToVNodes } from "../domToVNode.js";
import { serializeHtml } from "../serializeHtml.js";
import { describePatch, type Change, type ChangeKind } from "../describePatch.js";
import { StateHistory } from "../history.js";

interface Snapshot {
  label: string;
  vdom: HostVNode[];
}

const CHANGE_LABELS: Record<ChangeKind, string> = {
  ADD: "추가",
  REMOVE: "삭제",
  REPLACE: "교체",
  TEXT: "텍스트",
  ATTR: "속성",
  MOVE: "이동",
};

const OBSERVE_ALL: MutationObserverInit = {
  childList: true,
  subtree: true,
  attributes: true,
  characterData: true,
};

const real = byId<HTMLDivElement>("real-area");
const testArea = byId<HTMLDivElement>("test-area");
const source = byId<HTMLTextAreaElement>("source");
const patchButton = byId<HTMLButtonElement>("patch-btn");
const backButton = byId<HTMLButtonElement>("back-btn");
const forwardButton = byId<HTMLButtonElement>("forward-btn");
const status = byId<HTMLSpanElement>("status");
const metric = byId<HTMLParagraphElement>("metric");
const changeLog = byId<HTMLOListElement>("change-log");
const historyList = byId<HTMLOListElement>("history-list");
const vdomView = byId<HTMLPreElement>("vdom-view");

// patch가 실제로 일으킨 DOM 변경을 세기 위한 감시자. 기록은 patch 직후 takeRecords로 바로 읽는다
const realObserver = new MutationObserver(() => {});
realObserver.observe(real, OBSERVE_ALL);

// 테스트 영역을 직접 편집하면 HTML 코드 입력창에 반영한다
const testObserver = new MutationObserver(() => {
  syncSource();
  showStatus("적용되지 않은 변경이 있습니다");
});

// HTML 코드에 오류가 있으면 테스트 영역에 반영되지 않으므로, 그 내용은 입력창에만 남아 있다
let sourceHasError = false;

const history = new StateHistory<Snapshot>({
  label: "초기 상태",
  vdom: toHostTree(domChildrenToVNodes(real)),
});

showTestArea(history.current.vdom);
syncSource();
refresh();
showStatus("테스트 영역을 수정한 뒤 Patch를 누르세요");
document.body.dataset.ready = "true";

patchButton.addEventListener("click", applyPatch);
backButton.addEventListener("click", () => moveTo(history.position - 1));
forwardButton.addEventListener("click", () => moveTo(history.position + 1));

source.addEventListener("input", () => {
  // <template> 안에서 파싱하면 이미지 로드와 onerror 같은 핸들러가 실행되지 않는다
  const template = document.createElement("template");
  template.innerHTML = source.value;
  try {
    showTestArea(toHostTree(domChildrenToVNodes(template.content)));
    sourceHasError = false;
    showStatus("적용되지 않은 변경이 있습니다");
  } catch (error) {
    sourceHasError = true;
    showStatus(errorMessage(error), true);
  }
});

// 폼 입력은 DOM 구조를 바꾸지 않아 MutationObserver에 잡히지 않는다
testArea.addEventListener("input", () => {
  syncSource();
  showStatus("적용되지 않은 변경이 있습니다");
});

// 편집 중에 링크나 폼이 페이지를 떠나지 않게 막는다
testArea.addEventListener("click", event => {
  if (event.target instanceof Element && event.target.closest("a")) event.preventDefault();
});
testArea.addEventListener("submit", event => event.preventDefault());

document.querySelector(".scenarios")?.addEventListener("click", event => {
  const name = event.target instanceof HTMLElement ? event.target.dataset.scenario : undefined;
  if (name !== undefined) runScenario(name);
});

function readTestArea(): HostVNode[] {
  // 편집기가 나눠 놓은 인접 텍스트 노드를 합쳐서 같은 내용이면 같은 트리가 되게 한다
  testArea.normalize();
  return toHostTree(domChildrenToVNodes(testArea));
}

function hasUnappliedEdits(): boolean {
  if (sourceHasError) return true;
  try {
    return !isUnchanged(diffChildren(history.current.vdom, readTestArea()));
  } catch {
    return true;   // 변환할 수 없는 편집도 잃어버리면 안 되는 내용이다
  }
}

function applyPatch(): void {
  let next: HostVNode[];
  try {
    next = readTestArea();
  } catch (error) {
    showStatus(errorMessage(error), true);
    return;
  }

  const prev = history.current.vdom;
  const patch = diffChildren(prev, next);
  if (isUnchanged(patch)) {
    showStatus("이전 Virtual DOM과 같아서 바꿀 것이 없습니다");
    return;
  }

  const changes = describePatch(prev, patch);
  commit(() => patchChildren(real, patch), changes);
  history.push({ label: `변경 ${changes.length}건`, vdom: next });
  refresh();
  showStatus("바뀐 부분을 실제 영역에 반영했습니다");
}

function moveTo(index: number): void {
  if (hasUnappliedEdits() && !confirm("적용하지 않은 변경이 있습니다. 버리고 이동할까요?")) return;

  const prev = history.current.vdom;
  const target = history.go(index).vdom;
  const patch = diffChildren(prev, target);

  commit(() => patchChildren(real, patch), describePatch(prev, patch));
  showTestArea(target);
  syncSource();
  refresh();
  showStatus(`기록 #${index}(으)로 이동했습니다`);
}

function commit(apply: () => void, changes: Change[]): void {
  apply();
  const records = realObserver.takeRecords();
  flash(records);
  renderChangeLog(changes, records.length);
}

function showTestArea(vdom: HostVNode[]): void {
  testObserver.disconnect();   // 프로그램이 바꾼 내용은 사용자 편집으로 취급하지 않는다
  testArea.replaceChildren(...vdom.map(vnode => createDom(vnode, testArea)));
  testObserver.observe(testArea, OBSERVE_ALL);
}

function syncSource(): void {
  source.value = serializeHtml(testArea);
  sourceHasError = false;
}

function runScenario(name: string): void {
  const list = testArea.querySelector("ul");
  const items = list === null ? [] : Array.from(list.children);

  switch (name) {
    case "text": {
      const heading = testArea.querySelector("h3");
      if (heading !== null) heading.textContent = `수정한 제목 ${history.all().length}`;
      break;
    }
    case "attr": {
      const article = testArea.querySelector("article");
      if (article !== null) article.style.borderLeftColor = article.style.borderLeftColor === "tomato" ? "#2f6f6d" : "tomato";
      break;
    }
    case "add": {
      if (list === null) break;
      const item = document.createElement("li");
      const key = `new-${Date.now()}`;
      item.dataset.key = key;
      item.textContent = "새로 추가한 항목";
      list.append(item);
      break;
    }
    case "remove":
      items.at(-1)?.remove();
      break;
    case "replace": {
      const paragraph = testArea.querySelector("p");
      if (paragraph === null) break;
      const quote = document.createElement("blockquote");
      quote.append(...Array.from(paragraph.childNodes));
      paragraph.replaceWith(quote);
      break;
    }
    case "move":
      if (list !== null && items.length > 1) list.append(items[0]);
      break;
  }
}

function refresh(): void {
  backButton.disabled = !history.canBack;
  forwardButton.disabled = !history.canForward;
  vdomView.textContent = JSON.stringify(history.current.vdom, null, 2);

  historyList.replaceChildren(...history.all().map((snapshot, i) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `#${i} ${snapshot.label}`;
    button.setAttribute("aria-current", String(i === history.position));
    button.addEventListener("click", () => {
      if (i !== history.position) moveTo(i);
    });
    const item = document.createElement("li");
    item.append(button);
    return item;
  }));
}

function renderChangeLog(changes: Change[], mutationCount: number): void {
  metric.textContent = `실제 DOM 변경 ${mutationCount}건 / 전체 DOM 노드 ${countNodes(real)}개`;
  changeLog.replaceChildren(...changes.map(change => {
    const kind = document.createElement("span");
    kind.className = "change-kind";
    kind.textContent = CHANGE_LABELS[change.kind];

    const path = document.createElement("span");
    path.className = "change-path";
    path.textContent = change.path;

    const detail = document.createElement("span");
    detail.append(change.detail, path);

    const item = document.createElement("li");
    item.dataset.kind = change.kind;
    item.append(kind, detail);
    return item;
  }));
}

// 속성을 건드리면 Virtual DOM과 어긋나므로 Web Animations로만 강조한다
function flash(records: MutationRecord[]): void {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const targets = new Set<Element>();
  for (const record of records) {
    const added = Array.from(record.addedNodes).filter(node => node instanceof Element);
    if (added.length > 0) added.forEach(node => targets.add(node as Element));
    else if (record.target instanceof Element) targets.add(record.target);
    else if (record.target.parentElement !== null) targets.add(record.target.parentElement);
  }

  const color = getComputedStyle(document.documentElement).getPropertyValue("--flash");
  for (const target of targets) {
    target.animate({ backgroundColor: [color, "transparent"] }, 800);
  }
}

function countNodes(node: Node): number {
  let count = 0;
  node.childNodes.forEach(child => {
    count += 1 + countNodes(child);
  });
  return count;
}

function showStatus(message: string, isError = false): void {
  status.textContent = message;
  status.classList.toggle("error", isError);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (el === null) throw new Error(`#${id}를 찾을 수 없습니다`);
  return el as T;
}
