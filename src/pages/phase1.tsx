import type { HostVNode } from "../types.js";
import { h } from "../createElement.js";
import { createDom } from "../dom.js";
import { diffChildren, isUnchanged } from "../diff.js";
import { patchChildren } from "../patch.js";
import { toHostTree } from "../expand.js";
import { domChildrenToVNodes } from "../domToVNode.js";
import { serializeHtml } from "../serializeHtml.js";
import { describePatch, type Change, type ChangeKind } from "../describePatch.js";
import { StateHistory } from "../history.js";
import { useEffect } from "../hooks.js";
import { Link } from "../router.js";

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

// 공백 텍스트도 노드로 변환된다. 공백에는 key가 없어 인덱스로 비교되므로 li 사이는 붙여 둔다
const SAMPLE_HTML = `
            <article class="note" style="border-left: 4px solid #2f6f6d; padding-left: 12px">
              <h3>오늘의 할 일</h3>
              <p>Virtual DOM은 <strong>실제 DOM의 가벼운 복사본</strong>입니다.</p>
              <ul><li data-key="a">Diff 알고리즘 구현</li><li data-key="b">Patch 구현</li><li data-key="c">State History 구현</li></ul>
              <label><input type="checkbox" checked /> 완료 표시</label>
              <p><input type="text" value="입력값도 비교합니다" /></p>
            </article>
          `;

// JSX는 페이지의 틀만 그린다. 두 영역의 내용은 이 함수가 DOM API로 직접 다루며,
// 틀의 vnode에는 그 자식이 없으므로 틀이 다시 렌더되어도 diff가 건드리지 않는다
function mountPhase1(): () => void {
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

  real.innerHTML = SAMPLE_HTML;

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

  return () => {
    realObserver.disconnect();
    testObserver.disconnect();
  };

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

  function showStatus(message: string, isError = false): void {
    status.textContent = message;
    status.classList.toggle("error", isError);
  }
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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (el === null) throw new Error(`#${id}를 찾을 수 없습니다`);
  return el as T;
}

export function Phase1Page() {
  useEffect(() => {
    document.title = "Diff 검증 페이지";
    return mountPhase1();
  }, []);

  return (
    <main className="page">
      <header className="page-header">
        <Link className="back-link" to="/">mini-react</Link>
        <h1>Diff 검증 페이지</h1>
        <p>테스트 영역을 고치고 Patch를 누르면, 이전 Virtual DOM과 비교해 바뀐 부분만 실제 영역에 반영합니다.</p>
      </header>

      <div className="toolbar">
        <button id="patch-btn" className="primary" type="button">Patch</button>
        <button id="back-btn" type="button">뒤로가기</button>
        <button id="forward-btn" type="button">앞으로가기</button>
        <span id="status" className="status" role="status"></span>
      </div>

      <div className="columns">
        <section className="panel">
          <h2>실제 영역</h2>
          <div id="real-area" className="area" inert={true}></div>
        </section>

        <section className="panel">
          <h2>테스트 영역</h2>
          <div id="test-area" className="area editable" contenteditable="true" spellcheck="false"></div>
          <label className="field-label" htmlFor="source">HTML 코드</label>
          <textarea id="source" className="source" rows="12" spellcheck="false"></textarea>
          <div className="scenarios">
            <span className="field-label">변경 예시</span>
            <button type="button" data-scenario="text">텍스트</button>
            <button type="button" data-scenario="attr">속성</button>
            <button type="button" data-scenario="add">추가</button>
            <button type="button" data-scenario="remove">삭제</button>
            <button type="button" data-scenario="replace">교체</button>
            <button type="button" data-scenario="move">key 이동</button>
          </div>
        </section>
      </div>

      <div className="columns">
        <section className="panel">
          <h2>마지막 변경 내역</h2>
          <p id="metric" className="metric"></p>
          <ol id="change-log" className="change-log"></ol>
        </section>

        <section className="panel">
          <h2>State History</h2>
          <ol id="history-list" className="history-list"></ol>
          <details className="vdom-details">
            <summary>현재 Virtual DOM 보기</summary>
            <pre id="vdom-view" className="vdom-view"></pre>
          </details>
        </section>
      </div>
    </main>
  );
}
