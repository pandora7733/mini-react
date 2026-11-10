import { assert, test, wait } from "./harness.js";

// hashchange는 별도 태스크로 발생하므로 주소를 바꾼 뒤에는 조금 더 기다린다
const ROUTE_WAIT = 30;

// 실제 페이지를 iframe으로 열어 사용자처럼 조작하는 기능 테스트
async function openPage(url: string): Promise<{ doc: Document; win: Window & typeof globalThis; frame: HTMLIFrameElement }> {
  const frame = document.createElement("iframe");
  frame.style.cssText = "position: fixed; left: -2000px; width: 1000px; height: 800px";
  frame.src = url;
  document.body.append(frame);
  await waitForReady(frame);
  return {
    frame,
    doc: frame.contentDocument!,
    win: frame.contentWindow as Window & typeof globalThis,
  };
}

async function waitForReady(frame: HTMLIFrameElement): Promise<void> {
  for (let i = 0; i < 200; i++) {
    if (frame.contentDocument?.body?.dataset.ready === "true") return;
    await wait(10);
  }
  throw new Error(`페이지를 열지 못했습니다: ${frame.src}`);
}

function typeInto(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  el.value = value;
  el.dispatchEvent(new (el.ownerDocument.defaultView as Window & typeof globalThis).Event("input", { bubbles: true }));
}

function $<T extends HTMLElement>(doc: Document, selector: string): T {
  const el = doc.querySelector<T>(selector);
  if (el === null) throw new Error(`${selector}를 찾을 수 없습니다`);
  return el;
}

// --- Phase 1 ---

async function phase1() {
  const page = await openPage("./index.html#/phase1");
  const { doc } = page;
  const real = $(doc, "#real-area");
  const testArea = $(doc, "#test-area");
  const source = $<HTMLTextAreaElement>(doc, "#source");
  // 실제 대화상자는 테스트를 멈추므로 호출 횟수를 세고 답을 정해 둔다
  const dialog = { asked: 0, answer: false };
  page.win.confirm = () => {
    dialog.asked++;
    return dialog.answer;
  };
  return {
    ...page,
    real,
    testArea,
    source,
    dialog,
    patch: () => $(doc, "#patch-btn").click(),
    back: () => $(doc, "#back-btn").click(),
    forward: () => $(doc, "#forward-btn").click(),
    status: () => $(doc, "#status").textContent ?? "",
    metric: () => $(doc, "#metric").textContent ?? "",
    historyCount: () => doc.querySelectorAll("#history-list li").length,
    logKinds: () => Array.from(doc.querySelectorAll<HTMLElement>("#change-log li"), li => li.dataset.kind),
    scenario: async (name: string) => {
      $(doc, `[data-scenario="${name}"]`).click();
      await wait();
    },
    close: () => page.frame.remove(),
  };
}

test("Phase 1: 로드하면 실제 영역을 변환해 테스트 영역을 그린다", async () => {
  const p = await phase1();
  assert.equal(p.testArea.innerHTML, p.real.innerHTML);
  assert.equal(p.source.value, p.testArea.innerHTML);
  assert.equal(p.historyCount(), 1);
  assert.equal($<HTMLButtonElement>(p.doc, "#back-btn").disabled, true);
  assert.equal($<HTMLButtonElement>(p.doc, "#forward-btn").disabled, true);
  p.close();
});

test("Phase 1: 변경 없이 Patch하면 기록을 남기지 않는다", async () => {
  const p = await phase1();
  p.patch();
  assert.equal(p.historyCount(), 1);
  assert.ok(p.status().includes("바꿀 것이 없습니다"), p.status());
  p.close();
});

test("Phase 1: 텍스트 하나를 고치면 실제 DOM 변경도 한 건이고 다른 노드는 유지된다", async () => {
  const p = await phase1();
  const heading = $(p.real.ownerDocument, "#real-area h3");
  const list = $(p.real.ownerDocument, "#real-area ul");
  await p.scenario("text");
  p.patch();
  assert.equal(p.real.querySelector("h3"), heading);
  assert.equal(p.real.querySelector("ul"), list);
  assert.equal(heading.textContent, p.testArea.querySelector("h3")!.textContent);
  assert.ok(p.metric().startsWith("실제 DOM 변경 1건"), p.metric());
  assert.equal(p.logKinds().join(), "TEXT");
  assert.equal(p.historyCount(), 2);
  p.close();
});

test("Phase 1: 다섯 가지 변경과 이동을 찾아 실제 영역에 반영한다", async () => {
  const p = await phase1();
  const expected: Array<[string, string]> = [
    ["text", "TEXT"],
    ["attr", "ATTR"],
    ["add", "ADD"],
    ["remove", "REMOVE"],
    ["replace", "REPLACE"],
    ["move", "MOVE"],
  ];
  for (const [scenario, kind] of expected) {
    await p.scenario(scenario);
    p.patch();
    assert.equal(p.logKinds().join(), kind, `${scenario}:`);
    assert.equal(p.real.innerHTML, p.testArea.innerHTML, `${scenario}:`);
  }
  assert.equal(p.historyCount(), 7);
  p.close();
});

test("Phase 1: HTML 코드를 고쳐서 Patch할 수 있다", async () => {
  const p = await phase1();
  typeInto(p.source, `<section title="t"><h4>새 내용</h4></section>`);
  await wait();
  assert.equal(p.testArea.querySelector("h4")!.textContent, "새 내용");
  p.patch();
  assert.equal(p.real.innerHTML, `<section title="t"><h4>새 내용</h4></section>`);
  p.close();
});

test("Phase 1: 뒤로가기와 앞으로가기가 두 영역을 함께 바꾼다", async () => {
  const p = await phase1();
  const initial = p.real.innerHTML;
  const heading = p.real.querySelector("h3");

  await p.scenario("text");
  p.patch();
  const edited = p.real.innerHTML;
  assert.ok(edited !== initial);

  p.back();
  await wait();
  assert.equal(p.real.innerHTML, initial);
  assert.equal(p.testArea.innerHTML, initial);
  assert.equal(p.source.value, initial);
  assert.equal(p.real.querySelector("h3"), heading, "이동도 patch로 처리해야 합니다.");
  assert.equal($<HTMLButtonElement>(p.doc, "#back-btn").disabled, true);

  p.forward();
  await wait();
  assert.equal(p.real.innerHTML, edited);
  assert.equal(p.testArea.innerHTML, edited);
  assert.equal($<HTMLButtonElement>(p.doc, "#forward-btn").disabled, true);
  p.close();
});

test("Phase 1: 기록 목록에서 원하는 시점으로 바로 이동한다", async () => {
  const p = await phase1();
  const initial = p.real.innerHTML;
  await p.scenario("text");
  p.patch();
  await p.scenario("add");
  p.patch();
  p.doc.querySelector<HTMLButtonElement>("#history-list li:first-child button")!.click();
  await wait();
  assert.equal(p.real.innerHTML, initial);
  p.close();
});

test("Phase 1: 과거에서 새로 Patch하면 앞쪽 기록을 버린다", async () => {
  const p = await phase1();
  await p.scenario("text");
  p.patch();
  await p.scenario("add");
  p.patch();
  p.back();
  await wait();
  await p.scenario("remove");
  p.patch();
  assert.equal(p.historyCount(), 3);
  assert.equal($<HTMLButtonElement>(p.doc, "#forward-btn").disabled, true);
  p.close();
});

test("Phase 1: 입력창에 타이핑한 값과 체크 상태도 반영한다", async () => {
  const p = await phase1();
  p.testArea.querySelector<HTMLInputElement>("input[type=text]")!.value = "타이핑";
  p.testArea.querySelector<HTMLInputElement>("input[type=checkbox]")!.checked = false;
  p.patch();
  assert.equal(p.real.querySelector<HTMLInputElement>("input[type=text]")!.value, "타이핑");
  assert.equal(p.real.querySelector<HTMLInputElement>("input[type=checkbox]")!.checked, false);

  p.back();
  await wait();
  assert.equal(p.real.querySelector<HTMLInputElement>("input[type=text]")!.value, "입력값도 비교합니다");
  assert.equal(p.testArea.querySelector<HTMLInputElement>("input[type=checkbox]")!.checked, true);
  p.close();
});

test("Phase 1: key가 중복되면 에러를 보여 주고 실제 영역을 바꾸지 않는다", async () => {
  const p = await phase1();
  const before = p.real.innerHTML;
  typeInto(p.source, `<ul><li data-key="a"></li><li data-key="a"></li></ul>`);
  await wait();
  assert.ok(p.status().includes("중복"), p.status());
  p.patch();
  assert.equal(p.real.innerHTML, before);
  assert.equal(p.historyCount(), 1);
  p.close();
});

test("Phase 1: 입력한 HTML의 스크립트와 핸들러를 실행하지 않는다", async () => {
  const p = await phase1();
  const win = p.win as unknown as { pwned?: boolean };
  typeInto(p.source, `<img src="missing.png" onerror="window.pwned = true"><script>window.pwned = true</script>`);
  await wait();
  p.patch();
  await wait(100);
  assert.equal(win.pwned, undefined);
  p.close();
});

test("Phase 1: 다양한 태그를 비우고 다시 채울 수 있다", async () => {
  const p = await phase1();
  typeInto(p.source, "");
  await wait();
  p.patch();
  assert.equal(p.real.childNodes.length, 0);

  const html = `<table><tbody><tr><td>칸</td></tr></tbody></table><svg viewBox="0 0 10 10"><circle r="5"></circle></svg><select><option value="a">a</option></select><!---->`;
  typeInto(p.source, html);
  await wait();
  p.patch();
  assert.equal(p.real.innerHTML, html);
  assert.equal(p.real.querySelector("circle")!.namespaceURI, "http://www.w3.org/2000/svg");
  p.close();
});

const FORM_HTML = `<textarea>처음</textarea><select><option value="a">a</option><option value="b">b</option></select><input value="c"><input type="checkbox">`;

async function editForm(p: Awaited<ReturnType<typeof phase1>>): Promise<void> {
  typeInto(p.testArea.querySelector("textarea")!, "수정");
  typeInto(p.testArea.querySelector<HTMLInputElement>("input:not([type])")!, "타이핑");
  p.testArea.querySelector<HTMLInputElement>("input[type=checkbox]")!.click();
  const select = p.testArea.querySelector("select")!;
  select.value = "b";
  select.dispatchEvent(new (p.win as Window & typeof globalThis).Event("input", { bubbles: true }));
  await wait();
}

test("Phase 1: 테스트 영역의 폼 입력값이 HTML 코드에 나타난다", async () => {
  const p = await phase1();
  typeInto(p.source, FORM_HTML);
  await wait();
  await editForm(p);
  const parsed = new DOMParser().parseFromString(p.source.value, "text/html");
  assert.equal(parsed.querySelector("textarea")!.value, "수정");
  assert.equal(parsed.querySelector("select")!.value, "b");
  assert.equal(parsed.querySelector<HTMLInputElement>("input:not([type])")!.value, "타이핑");
  assert.equal(parsed.querySelector<HTMLInputElement>("input[type=checkbox]")!.checked, true);
  p.close();
});

test("Phase 1: HTML 코드를 이어서 고쳐도 폼 입력값이 사라지지 않는다", async () => {
  const p = await phase1();
  typeInto(p.source, FORM_HTML);
  await wait();
  await editForm(p);
  typeInto(p.source, `${p.source.value}<p>추가</p>`);
  await wait();
  p.patch();
  assert.equal(p.real.querySelector("textarea")!.value, "수정");
  assert.equal(p.real.querySelector("select")!.value, "b");
  assert.equal(p.real.querySelector<HTMLInputElement>("input:not([type])")!.value, "타이핑");
  assert.equal(p.real.querySelector<HTMLInputElement>("input[type=checkbox]")!.checked, true);
  assert.equal(p.real.querySelector("p")!.textContent, "추가");
  p.close();
});

test("Phase 1: 뒤로 가면 폼 입력값도 HTML 코드에 함께 돌아온다", async () => {
  const p = await phase1();
  typeInto(p.source, FORM_HTML);
  await wait();
  p.patch();
  await editForm(p);
  p.patch();
  const edited = p.source.value;
  p.back();
  await wait();
  p.forward();
  await wait();
  assert.equal(p.source.value, edited);
  assert.equal(p.dialog.asked, 0);
  p.close();
});

test("Phase 1: 적용하지 않은 편집이 없으면 묻지 않고 이동한다", async () => {
  const p = await phase1();
  await p.scenario("text");
  p.patch();
  p.back();
  await wait();
  p.forward();
  await wait();
  assert.equal(p.dialog.asked, 0);
  p.close();
});

test("Phase 1: 적용하지 않은 편집이 있으면 이동 전에 묻고, 취소하면 편집을 유지한다", async () => {
  const p = await phase1();
  await p.scenario("text");
  p.patch();
  const realBefore = p.real.innerHTML;
  await p.scenario("add");
  const draft = p.testArea.innerHTML;

  p.back();
  await wait();
  assert.equal(p.dialog.asked, 1);
  assert.equal(p.real.innerHTML, realBefore);
  assert.equal(p.testArea.innerHTML, draft);
  assert.equal($<HTMLButtonElement>(p.doc, "#forward-btn").disabled, true);

  p.doc.querySelector<HTMLButtonElement>("#history-list li:first-child button")!.click();
  await wait();
  assert.equal(p.dialog.asked, 2);
  assert.equal(p.testArea.innerHTML, draft);

  p.dialog.answer = true;
  p.back();
  await wait();
  assert.equal(p.dialog.asked, 3);
  assert.ok(p.real.innerHTML !== realBefore);
  assert.equal(p.testArea.innerHTML, p.real.innerHTML);
  p.close();
});

test("Phase 1: 편집을 되돌려 처음과 같아지면 묻지 않는다", async () => {
  const p = await phase1();
  await p.scenario("text");
  p.patch();
  const heading = p.testArea.querySelector("h3")!;
  const title = heading.textContent;
  heading.textContent = "잠시 고침";
  await wait();
  heading.textContent = title;
  await wait();
  p.back();
  await wait();
  assert.equal(p.dialog.asked, 0);
  p.close();
});

test("Phase 1: HTML 코드에 오류가 남아 있어도 이동 전에 묻는다", async () => {
  const p = await phase1();
  await p.scenario("text");
  p.patch();
  typeInto(p.source, `<ul><li data-key="a"></li><li data-key="a"></li></ul>`);
  await wait();
  p.back();
  await wait();
  assert.equal(p.dialog.asked, 1);
  assert.ok(p.source.value.includes("data-key"));
  p.close();
});

// --- Phase 2 ---

const E2E_STORAGE_KEY = "mini-react:focus-board:e2e";
const INVALID_STORAGE: Array<[string, string]> = [
  ["객체", "{}"],
  ["null", "null"],
  ["객체가 아닌 항목", "[1]"],
  ["필드가 빠진 항목", `[{"id":1}]`],
  ["잘못된 중요도", `[{"id":1,"title":"a","priority":"low","done":false}]`],
  ["중복 id", `[{"id":1,"title":"a","priority":"normal","done":false},{"id":1,"title":"b","priority":"normal","done":false}]`],
  ["깨진 JSON", "{"],
];

for (const [name, saved] of INVALID_STORAGE) {
  test(`Phase 2: 저장된 값이 잘못되면 기본 목록으로 시작한다 (${name})`, async () => {
    localStorage.setItem(E2E_STORAGE_KEY, saved);
    const page = await openPage("./index.html?board=e2e#/phase2");
    assert.equal(page.doc.querySelectorAll(".task-title").length, 3);
    page.frame.remove();
    localStorage.removeItem(E2E_STORAGE_KEY);
  });
}

test("Phase 2: 저장된 빈 목록은 그대로 빈 목록이다", async () => {
  localStorage.setItem(E2E_STORAGE_KEY, "[]");
  const page = await openPage("./index.html?board=e2e#/phase2");
  assert.equal(page.doc.querySelectorAll(".task-title").length, 0);
  assert.ok(page.doc.querySelector("#empty-state") !== null);
  page.frame.remove();
  localStorage.removeItem(E2E_STORAGE_KEY);
});

async function phase2() {
  localStorage.removeItem("mini-react:focus-board:e2e");
  const page = await openPage("./index.html?board=e2e#/phase2");
  const { doc } = page;
  return {
    ...page,
    draft: () => $<HTMLInputElement>(doc, "#task-draft"),
    number: (id: string) => Number($(doc, `#${id}`).textContent),
    titles: () => Array.from(doc.querySelectorAll(".task-title"), el => el.textContent),
    add: async (title: string) => {
      typeInto($<HTMLInputElement>(doc, "#task-draft"), title);
      await wait();
      $(doc, "#task-add").click();
      await wait();
    },
    close: () => {
      page.frame.remove();
      localStorage.removeItem("mini-react:focus-board:e2e");
    },
  };
}

test("Phase 2: 할 일을 추가하면 입력창이 비고 통계가 갱신된다", async () => {
  const p = await phase2();
  const input = p.draft();
  await p.add("새 할 일");
  assert.equal(p.titles().at(-1), "새 할 일");
  assert.equal(p.number("stat-total"), 4);
  assert.equal(p.draft(), input, "입력창은 같은 노드여야 합니다.");
  assert.equal(input.value, "");
  p.close();
});

test("Phase 2: 빈 제목은 추가할 수 없다", async () => {
  const p = await phase2();
  typeInto(p.draft(), "   ");
  await wait();
  assert.equal($<HTMLButtonElement>(p.doc, "#task-add").disabled, true);
  p.close();
});

test("Phase 2: 한 이벤트의 여러 setState는 렌더 한 번으로 합쳐진다", async () => {
  const p = await phase2();
  typeInto(p.draft(), "배치");
  await wait();
  const before = p.number("engine-renders");
  $(p.doc, "#task-add").click();
  await wait();
  assert.equal(p.number("engine-renders"), before + 1);
  p.close();
});

test("Phase 2: 체크하면 완료 상태와 통계가 바뀐다", async () => {
  const p = await phase2();
  const row = p.doc.querySelector<HTMLElement>('[data-task-id="2"]')!;
  row.querySelector<HTMLInputElement>("input")!.click();
  await wait();
  assert.equal(p.doc.querySelector('[data-task-id="2"]'), row);
  assert.ok(row.classList.contains("done"));
  assert.equal(p.number("stat-done"), 2);
  assert.equal(p.number("stat-high"), 0);
  p.close();
});

test("Phase 2: 순서를 바꾸면 key로 같은 DOM 노드를 옮긴다", async () => {
  const p = await phase2();
  const row = p.doc.querySelector<HTMLElement>('[data-task-id="1"]')!;
  row.querySelector<HTMLButtonElement>('[data-action="down"]')!.click();
  await wait();
  assert.equal(p.titles()[1], "Virtual DOM 구조 설명 정리");
  assert.equal(p.doc.querySelector('[data-task-id="1"]'), row);
  p.close();
});

test("Phase 2: 삭제와 완료 항목 정리", async () => {
  const p = await phase2();
  p.doc.querySelector<HTMLButtonElement>('[data-task-id="3"] [data-action="remove"]')!.click();
  await wait();
  assert.equal(p.number("stat-total"), 2);
  $(p.doc, "#clear-done").click();
  await wait();
  assert.equal(p.number("stat-total"), 1);
  assert.equal($<HTMLButtonElement>(p.doc, "#clear-done").disabled, true);
  p.close();
});

test("Phase 2: 필터와 검색, 결과가 없을 때의 안내", async () => {
  const p = await phase2();
  $(p.doc, '[data-filter="done"]').click();
  await wait();
  assert.equal(p.titles().length, 1);

  $(p.doc, '[data-filter="all"]').click();
  await wait();
  const search = $<HTMLInputElement>(p.doc, "#task-search");
  typeInto(search, "React");
  await wait();
  assert.equal(p.titles().length, 1);
  assert.equal($(p.doc, "#task-search"), search, "검색창은 같은 노드여야 합니다.");

  typeInto(search, "없는 검색어");
  await wait();
  assert.equal(p.titles().length, 0);
  assert.ok(p.doc.querySelector("#empty-state") !== null);
  p.close();
});

test("Phase 2: 중요도 select는 제어 컴포넌트로 동작하고 추가 후 초기화된다", async () => {
  const p = await phase2();
  const select = $<HTMLSelectElement>(p.doc, "#task-priority");
  select.value = "high";
  select.dispatchEvent(new (p.win as Window & typeof globalThis).Event("change", { bubbles: true }));
  await wait();
  await p.add("중요한 일");
  assert.equal(select.value, "normal");
  assert.equal(p.number("stat-high"), 2);
  p.close();
});

test("Phase 2: 타이머 틱은 다시 렌더하지만 useMemo는 다시 계산하지 않고 DOM 변경도 적다", async () => {
  const p = await phase2();
  const memos = p.number("engine-memos");
  const renders = p.number("engine-renders");
  $(p.doc, "#timer-toggle").click();
  await wait(1200);
  $(p.doc, "#timer-toggle").click();
  await wait();
  assert.equal($(p.doc, "#timer-time").textContent, "24:59");
  assert.ok(p.number("engine-renders") > renders);
  assert.equal(p.number("engine-memos"), memos);

  $(p.doc, "#timer-toggle").click();
  await wait();
  $(p.doc, "#timer-reset").click();
  await wait();
  assert.equal($(p.doc, "#timer-time").textContent, "25:00");
  assert.ok(p.number("engine-mutations") <= 4, `DOM 변경 ${p.number("engine-mutations")}건`);
  p.close();
});

// --- 라우터 ---

test("라우터: Link를 누르면 문서를 다시 불러오지 않고 화면만 바꾼다", async () => {
  const page = await openPage("./index.html?board=e2e");
  const win = page.win as unknown as { sameDocument?: boolean };
  win.sameDocument = true;
  assert.ok(page.doc.querySelector(".link-list") !== null);

  $(page.doc, 'a[href="#/budget"]').click();
  await wait(ROUTE_WAIT);
  assert.equal(page.win.location.hash, "#/budget");
  assert.ok(page.doc.querySelector("#sum-income") !== null);
  assert.equal(page.doc.querySelector(".link-list"), null, "이전 페이지가 사라져야 합니다.");
  assert.equal(win.sameDocument, true);
  page.frame.remove();
  localStorage.removeItem(BUDGET_STORAGE_KEY);
});

test("라우터: 브라우저 뒤로가기와 앞으로가기로 페이지를 오간다", async () => {
  const page = await openPage("./index.html?board=e2e");
  $(page.doc, 'a[href="#/phase1"]').click();
  await wait(ROUTE_WAIT);
  assert.ok(page.doc.querySelector("#real-area") !== null);

  page.win.history.back();
  await wait(ROUTE_WAIT);
  assert.ok(page.doc.querySelector(".link-list") !== null);
  assert.equal(page.doc.querySelector("#real-area"), null);

  page.win.history.forward();
  await wait(ROUTE_WAIT);
  assert.ok(page.doc.querySelector("#real-area") !== null);
  page.frame.remove();
});

test("라우터: 없는 경로는 안내 페이지를 보여 주고 돌아갈 수 있다", async () => {
  const page = await openPage("./index.html#/없는/경로");
  assert.ok(page.doc.querySelector("#not-found") !== null);
  $(page.doc, '.back-link[href="#/"]').click();
  await wait(ROUTE_WAIT);
  assert.ok(page.doc.querySelector(".link-list") !== null);
  page.frame.remove();
});

test("라우터: 주소로 바로 접속하면 파라미터를 읽는다", async () => {
  const page = await openPage("./index.html?board=e2e#/budget/2020-03");
  assert.equal($(page.doc, "#month-label").textContent, "2020년 3월");
  page.frame.remove();
  localStorage.removeItem(BUDGET_STORAGE_KEY);
});

test("라우터: 형식이 틀린 파라미터는 이번 달로 처리한다", async () => {
  const page = await openPage("./index.html?board=e2e#/budget/abc");
  const now = new Date();
  assert.equal($(page.doc, "#month-label").textContent, `${now.getFullYear()}년 ${now.getMonth() + 1}월`);
  page.frame.remove();
  localStorage.removeItem(BUDGET_STORAGE_KEY);
});

test("라우터: 파라미터만 바뀌면 같은 DOM을 고치고, 뒤로가기로 이전 달에 돌아온다", async () => {
  const p = await budget();
  const summary = $(p.doc, "#sum-income");
  const label = p.text("#month-label");

  $(p.doc, "#month-prev").click();
  await wait(ROUTE_WAIT);
  assert.ok(p.text("#month-label") !== label);
  assert.equal($(p.doc, "#sum-income"), summary, "같은 DOM 노드여야 합니다.");

  p.win.history.back();
  await wait(ROUTE_WAIT);
  assert.equal(p.text("#month-label"), label);
  p.close();
});

test("라우터: 페이지를 떠나면 Focus Board를 정리하고, 돌아오면 처음부터 시작한다", async () => {
  const page = await openPage("./index.html?board=e2e#/phase2");
  localStorage.removeItem(E2E_STORAGE_KEY);
  $(page.doc, "#timer-toggle").click();
  await wait(1100);
  assert.equal($(page.doc, "#timer-time").textContent, "24:59");

  page.win.location.hash = "/";
  await wait(ROUTE_WAIT);
  assert.equal(page.doc.querySelector("#timer-time"), null);

  page.win.location.hash = "/phase2";
  await wait(ROUTE_WAIT);
  assert.equal($(page.doc, "#timer-time").textContent, "25:00");
  assert.equal(page.doc.querySelectorAll("#timer-time").length, 1);
  assert.equal($(page.doc, "#engine-renders").textContent, "1");
  page.frame.remove();
  localStorage.removeItem(E2E_STORAGE_KEY);
});

test("라우터: Phase 1에 적용하지 않은 편집이 있으면 떠나기 전에 묻고, 취소하면 머문다", async () => {
  const p = await phase1();
  await p.scenario("text");
  const draft = p.testArea.innerHTML;

  $(p.doc, 'a.back-link[href="#/"]').click();
  await wait(ROUTE_WAIT);
  assert.equal(p.dialog.asked, 1);
  assert.equal(p.win.location.hash, "#/phase1");
  assert.equal(p.testArea.innerHTML, draft);
  assert.equal(p.doc.querySelector(".link-list"), null);

  p.dialog.answer = true;
  $(p.doc, 'a.back-link[href="#/"]').click();
  await wait(ROUTE_WAIT);
  assert.equal(p.dialog.asked, 2);
  assert.ok(p.doc.querySelector(".link-list") !== null);
  p.close();
});

test("라우터: Phase 1에 편집이 없으면 묻지 않고 떠나며, 다른 페이지에서는 묻지 않는다", async () => {
  const p = await phase1();
  $(p.doc, 'a.back-link[href="#/"]').click();
  await wait(ROUTE_WAIT);
  assert.equal(p.dialog.asked, 0);
  assert.ok(p.doc.querySelector(".link-list") !== null);

  $(p.doc, 'a[href="#/phase2"]').click();
  await wait(ROUTE_WAIT);
  $(p.doc, 'a.back-link[href="#/"]').click();
  await wait(ROUTE_WAIT);
  assert.equal(p.dialog.asked, 0);
  p.close();
  localStorage.removeItem("mini-react:focus-board:default");
});

test("라우터: Phase 1을 떠났다 돌아와도 다시 동작한다", async () => {
  const page = await openPage("./index.html#/phase1");
  page.win.location.hash = "/";
  await wait(ROUTE_WAIT);
  page.win.location.hash = "/phase1";
  await wait(ROUTE_WAIT);

  const real = $(page.doc, "#real-area");
  const testArea = $(page.doc, "#test-area");
  assert.equal(testArea.innerHTML, real.innerHTML);
  $(page.doc, '[data-scenario="text"]').click();
  await wait();
  $(page.doc, "#patch-btn").click();
  assert.ok($(page.doc, "#metric").textContent!.startsWith("실제 DOM 변경 1건"));
  page.frame.remove();
});

// --- 예시 앱: 가계부 ---

const BUDGET_STORAGE_KEY = "mini-react:budget:e2e";

async function budget() {
  localStorage.removeItem(BUDGET_STORAGE_KEY);
  const page = await openPage("./index.html?board=e2e#/budget");
  const { doc } = page;
  const dialog = { asked: 0, answer: false };
  page.win.confirm = () => {
    dialog.asked++;
    return dialog.answer;
  };
  const go = async (path: string) => {
    page.win.location.hash = path;
    await wait(ROUTE_WAIT);
  };
  return {
    ...page,
    dialog,
    go,
    text: (selector: string) => $(doc, selector).textContent,
    titles: () => Array.from(doc.querySelectorAll(".task-title"), el => el.textContent),
    click: async (selector: string) => {
      $(doc, selector).click();
      await wait(ROUTE_WAIT);
    },
    fill: async (title: string, amount: string) => {
      typeInto($<HTMLInputElement>(doc, "#entry-title"), title);
      typeInto($<HTMLInputElement>(doc, "#entry-amount"), amount);
      await wait();
    },
    close: () => {
      page.frame.remove();
      localStorage.removeItem(BUDGET_STORAGE_KEY);
    },
  };
}

test("가계부: 월별 내역에 합계와 분류별 지출을 보여 준다", async () => {
  const p = await budget();
  assert.equal(p.text("#sum-income"), "2,500,000원");
  assert.equal(p.text("#sum-expense"), "145,000원");
  assert.equal(p.text("#sum-balance"), "2,355,000원");
  const rows = Array.from(p.doc.querySelectorAll<HTMLElement>(".budget-chart li"), li => li.dataset.row);
  assert.equal(rows.join(), "식비,교통,여가");
  assert.equal(p.doc.querySelector(".budget-chart rect")!.getAttribute("width"), "100%");
  assert.equal(p.doc.querySelector(".budget-chart rect")!.namespaceURI, "http://www.w3.org/2000/svg");
  assert.equal($(p.doc, '.budget-nav a[aria-current="page"]').textContent, "월별 내역");
  p.close();
});

test("가계부: 달을 옮기면 내역이 바뀌고, 내역이 없으면 안내한다", async () => {
  const p = await budget();
  await p.click("#month-prev");
  assert.equal(p.titles().join(), "전기 요금,월급");
  assert.equal(p.text("#sum-expense"), "42,000원");

  await p.click("#month-prev");
  assert.equal(p.titles().length, 0);
  assert.ok(p.doc.querySelector("#empty-state") !== null);
  assert.equal(p.doc.querySelector(".budget-chart"), null);
  p.close();
});

test("가계부: 추가 페이지에서 저장하면 월별 내역으로 돌아와 반영되고, 뒤로가기로 양식에 돌아가지 않는다", async () => {
  const p = await budget();
  await p.click("#add-entry");
  const submit = $<HTMLButtonElement>(p.doc, "#entry-submit");
  assert.equal(p.win.location.hash.startsWith("#/budget/new"), true);
  assert.equal(submit.disabled, true);

  await p.fill("커피", "-5");
  assert.equal(submit.disabled, true);

  await p.fill("커피", "5000");
  assert.equal(submit.disabled, false);
  await p.click("#entry-submit");
  assert.equal(p.dialog.asked, 0, "저장한 뒤에는 묻지 않아야 합니다.");
  assert.equal(p.text("#sum-expense"), "150,000원");
  assert.ok(p.titles().includes("커피"));

  p.win.history.back();
  await wait(ROUTE_WAIT);
  assert.equal(p.doc.querySelector("#entry-title"), null);
  p.close();
});

test("가계부: 다른 달을 보다가 추가하면 그 달이 기본 날짜이고, 다른 날짜로 저장하면 그 달로 간다", async () => {
  const p = await budget();
  await p.go("/budget/new/2020-03");
  assert.equal($<HTMLInputElement>(p.doc, "#entry-date").value, "2020-03-01");

  typeInto($<HTMLInputElement>(p.doc, "#entry-date"), "2021-07-15");
  await p.fill("과거 지출", "1000");
  await p.click("#entry-submit");
  assert.equal(p.win.location.hash, "#/budget/2021-07");
  assert.equal(p.text("#month-label"), "2021년 7월");
  assert.equal(p.titles().join(), "과거 지출");
  p.close();
});

test("가계부: 작성 중에 떠나면 묻고, 취소하면 내용을 유지한다", async () => {
  const p = await budget();
  await p.go("/budget/new");
  await p.fill("작성 중", "");
  const input = $<HTMLInputElement>(p.doc, "#entry-title");

  await p.click('.budget-nav a[href="#/budget/stats"]');
  assert.equal(p.dialog.asked, 1);
  assert.equal($(p.doc, "#entry-title"), input);
  assert.equal(input.value, "작성 중");

  p.dialog.answer = true;
  await p.click('.budget-nav a[href="#/budget/stats"]');
  assert.equal(p.dialog.asked, 2);
  assert.ok(p.doc.querySelector("#stats-months") !== null);

  await p.go("/budget");
  assert.equal(p.dialog.asked, 2, "다른 페이지에서는 묻지 않아야 합니다.");
  p.close();
});

test("가계부: 목록의 항목을 누르면 상세로 가고 메모를 보여 준다", async () => {
  const p = await budget();
  await p.click('[data-entry-id="2"] a');
  assert.equal(p.win.location.hash, "#/budget/entries/2");
  assert.equal(p.text("#entry-heading"), "장보기");
  assert.equal(p.text("#entry-detail-amount"), "-68,000원");
  assert.equal(p.text("#entry-detail-memo"), "일주일 치 식재료");
  p.close();
});

test("가계부: 없는 항목은 상세와 수정 모두 안내를 보여 준다", async () => {
  const p = await budget();
  await p.go("/budget/entries/999");
  assert.ok(p.doc.querySelector("#entry-missing") !== null);
  await p.go("/budget/entries/999/edit");
  assert.ok(p.doc.querySelector("#entry-missing") !== null);
  assert.equal(p.doc.querySelector("#entry-title"), null);
  p.close();
});

test("가계부: 수정을 저장하면 상세와 합계에 반영되고, 취소하면 그대로다", async () => {
  const p = await budget();
  await p.go("/budget/entries/4");
  await p.click("#entry-edit");
  assert.equal($<HTMLInputElement>(p.doc, "#entry-title").value, "영화");

  await p.click("#entry-cancel");
  assert.equal(p.dialog.asked, 0, "고치지 않았으면 묻지 않아야 합니다.");
  assert.equal(p.win.location.hash, "#/budget/entries/4");

  await p.click("#entry-edit");
  await p.fill("영화 관람", "25000");
  await p.click("#entry-submit");
  assert.equal(p.dialog.asked, 0);
  assert.equal(p.win.location.hash, "#/budget/entries/4");
  assert.equal(p.text("#entry-heading"), "영화 관람");
  assert.equal(p.text("#entry-detail-amount"), "-25,000원");

  await p.go("/budget");
  assert.equal(p.text("#sum-expense"), "155,000원");
  p.close();
});

test("가계부: 수정 중 주소의 id만 바뀌면 그 항목의 값을 보여 준다", async () => {
  const p = await budget();
  await p.go("/budget/entries/4/edit");
  await p.fill("고치던 값", "1");
  p.dialog.answer = true;
  await p.go("/budget/entries/5/edit");
  assert.equal($<HTMLInputElement>(p.doc, "#entry-title").value, "점심");
  assert.equal($<HTMLInputElement>(p.doc, "#entry-amount").value, "12000");
  p.close();
});

test("가계부: 삭제는 확인을 거치고, 삭제 후 뒤로가기로 지운 항목에 돌아가지 않는다", async () => {
  const p = await budget();
  await p.click('[data-entry-id="5"] a');
  await p.click("#entry-remove");
  assert.equal(p.dialog.asked, 1);
  assert.equal(p.text("#entry-heading"), "점심");

  p.dialog.answer = true;
  await p.click("#entry-remove");
  assert.ok(!p.titles().includes("점심"));
  assert.equal(p.text("#sum-expense"), "133,000원");

  p.win.history.back();
  await wait(ROUTE_WAIT);
  assert.equal(p.doc.querySelector("#entry-heading"), null);
  p.close();
});

test("가계부: 통계는 최근 6개월과 전체 분류를 보여 주고 달을 누르면 그 달로 간다", async () => {
  const p = await budget();
  await p.click('.budget-nav a[href="#/budget/stats"]');
  const months = p.doc.querySelectorAll("#stats-months li");
  assert.equal(months.length, 6);
  assert.ok(months[5].textContent!.includes("145,000원"), months[5].textContent!);
  assert.ok(months[4].textContent!.includes("42,000원"), months[4].textContent!);

  const categories = Array.from(p.doc.querySelectorAll<HTMLElement>("#stats-categories li"), li => li.dataset.row);
  assert.equal(categories.join(), "식비,교통,생활,여가");

  months[4].querySelector("a")!.click();
  await wait(ROUTE_WAIT);
  assert.equal(p.titles().join(), "전기 요금,월급");
  p.close();
});

test("가계부: 내역이 없어도 통계가 깨지지 않는다", async () => {
  localStorage.setItem(BUDGET_STORAGE_KEY, "[]");
  const page = await openPage("./index.html?board=e2e#/budget/stats");
  const widths = Array.from(page.doc.querySelectorAll("#stats-months rect"), rect => rect.getAttribute("width"));
  assert.equal(widths.join(), "0%,0%,0%,0%,0%,0%");
  assert.equal(page.doc.querySelector("#stats-categories .budget-chart"), null);
  page.frame.remove();
  localStorage.removeItem(BUDGET_STORAGE_KEY);
});

test("가계부: 다시 열어도 저장되어 있고, 저장값이 잘못되면 예시 내역으로 시작한다", async () => {
  const p = await budget();
  await p.go("/budget/new");
  await p.fill("저장 확인", "1000");
  await p.click("#entry-submit");
  p.frame.contentWindow!.location.reload();
  await wait(50);
  await waitForReady(p.frame);
  const titles = Array.from(p.frame.contentDocument!.querySelectorAll(".task-title"), el => el.textContent);
  assert.ok(titles.includes("저장 확인"));
  p.close();

  localStorage.setItem(BUDGET_STORAGE_KEY, `[{"id":1}]`);
  const page = await openPage("./index.html?board=e2e#/budget");
  assert.equal(page.doc.querySelector("#sum-income")!.textContent, "2,500,000원");
  page.frame.remove();
  localStorage.removeItem(BUDGET_STORAGE_KEY);
});

test("가계부: 다른 탭에서 바꾼 내역을 반영한다", async () => {
  const p = await budget();
  const win = p.win as Window & typeof globalThis;
  const entries = [{ id: 1, date: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01`, title: "다른 탭", amount: 1, category: "식비" }];
  localStorage.setItem(BUDGET_STORAGE_KEY, JSON.stringify(entries));
  win.dispatchEvent(new win.StorageEvent("storage", { key: BUDGET_STORAGE_KEY }));
  await wait();
  assert.equal(p.titles().join(), "다른 탭");
  p.close();
});

test("Phase 2: 다시 열어도 할 일이 저장되어 있다", async () => {
  const p = await phase2();
  await p.add("저장 확인");
  p.frame.contentWindow!.location.reload();
  await wait(50);
  await waitForReady(p.frame);
  const titles = Array.from(p.frame.contentDocument!.querySelectorAll(".task-title"), el => el.textContent);
  assert.equal(titles.at(-1), "저장 확인");
  p.close();
});

// --- 랜딩: 자판기 ---

async function until(check: () => boolean, message: string): Promise<void> {
  for (let i = 0; i < 100; i++) {
    if (check()) return;
    await wait(20);
  }
  throw new Error(message);
}

test("자판기: 해킹 전에는 잔액이 부족하고, 해킹하면 고장 나서 음료를 공짜로 내준다", async () => {
  const page = await openPage("./index.html");
  const { doc } = page;
  // 동작 줄이기 설정이면 해킹 단계와 배출이 짧아진다
  page.win.matchMedia = (() => ({ matches: true })) as unknown as typeof page.win.matchMedia;

  $(doc, '[data-drink="chrome-cola"]').click();
  await wait();
  assert.equal($(doc, "#vm-display-text").textContent, "잔액 부족. A1 크롬 콜라: 1,500 크레딧 필요");
  assert.ok($(doc, '[data-drink="chrome-cola"]').classList.contains("picked"), "거절된 칸을 표시해야 합니다.");
  assert.equal(doc.querySelector("#vm-take"), null);

  $(doc, "#vm-hack").click();
  await wait();
  assert.ok($(doc, ".vm").classList.contains("is-hacking"));
  assert.equal(($(doc, '[data-drink="synapse"]') as HTMLButtonElement).disabled, true, "해킹 중에는 고를 수 없습니다.");

  await until(() => $(doc, ".vm").classList.contains("is-broken"), "해킹이 끝나지 않았습니다.");
  assert.equal(doc.querySelectorAll(".vm-log li.ok").length, 4);
  assert.equal($(doc, '[data-drink="synapse"] .vm-price-now').textContent, "0");

  // 직접 꺼내기: 누른 칸의 음료가 하나 나온다
  $(doc, '[data-drink="synapse"]').click();
  await until(() => doc.querySelector("#vm-take:not(:disabled)") !== null, "음료가 나오지 않았습니다.");
  const cans = doc.querySelectorAll<HTMLElement>(".vm-tray-can");
  assert.equal(cans.length, 1);
  assert.equal(cans[0].dataset.drinkId, "synapse");
  assert.equal($(doc, "#vm-take").textContent, "꺼내기 1개");
  assert.equal(($(doc, "#vm-reboot") as HTMLButtonElement).disabled, true, "꺼내기 전에는 재부팅할 수 없습니다.");

  $(doc, "#vm-take").click();
  await wait();
  assert.equal($(doc, "#vm-taken").textContent, "1");
  assert.equal($(doc, "#vm-balance").textContent, "0");

  $(doc, '[data-drink="synapse"]').click();
  await until(() => doc.querySelector("#vm-take:not(:disabled)") !== null, "두 번째 음료가 나오지 않았습니다.");
  $(doc, "#vm-take").click();
  await wait();
  assert.equal($(doc, "#vm-taken").textContent, "2");
  assert.equal($(doc, ".vm-bag-list").textContent, "시냅스 부스트 2");
  assert.equal(doc.querySelectorAll(".vm-tray-can").length, 0, "꺼내면 꺼내는 곳이 빈다.");

  $(doc, "#vm-reboot").click();
  await wait();
  assert.ok($(doc, ".vm").classList.contains("is-locked"));
  assert.equal($(doc, '[data-drink="synapse"] .vm-price-now').textContent, "2,400");
  page.frame.remove();
});

async function brokenMachine() {
  const page = await openPage("./index.html");
  const { doc } = page;
  // 동작 줄이기 설정이면 해킹 단계가 짧아지고 캔은 애니메이션 없이 바로 놓인다
  page.win.matchMedia = (() => ({ matches: true })) as unknown as typeof page.win.matchMedia;
  $(doc, "#vm-hack").click();
  await until(() => $(doc, ".vm").classList.contains("is-broken"), "해킹이 끝나지 않았습니다.");
  const idle = async () => {
    await wait();   // 다시 그리기 전에는 앞선 배출의 버튼 상태가 남아 있다
    await until(() => doc.querySelector("#vm-random:disabled") === null, "배출이 끝나지 않았습니다.");
  };
  return { page, doc, idle };
}

test("자판기: 랜덤 대량 배출은 아무 칸에서나 캔 여러 개를 한꺼번에 떨어뜨린다", async () => {
  const { page, doc, idle } = await brokenMachine();
  $(doc, "#vm-random").click();
  await idle();

  const ids = Array.from(doc.querySelectorAll<HTMLElement>(".vm-tray-can"), can => can.dataset.drinkId);
  assert.ok(ids.length >= 8 && ids.length <= 16, `캔 ${ids.length}개`);
  assert.ok(new Set(ids).size > 1, "여러 칸에서 섞여 나와야 합니다.");
  assert.equal($(doc, "#vm-take").textContent, `꺼내기 ${ids.length}개`);
  assert.equal($(doc, "#vm-load").textContent, `적재 ${ids.length}/30`);

  // 캔은 진열칸과 같은 크기로, 꺼내는 곳 안의 서로 다른 위치에 놓인다
  const box = $(doc, "#vm-tray-box").getBoundingClientRect();
  const rects = Array.from(doc.querySelectorAll(".vm-tray-can"), can => can.getBoundingClientRect());
  assert.ok(rects.every(rect => rect.left >= box.left - 2 && rect.right <= box.right + 2), "꺼내는 곳 안에 있어야 합니다.");
  assert.ok(rects.every(rect => rect.bottom <= box.bottom + 2), "바닥 아래로 빠지면 안 됩니다.");
  assert.ok(new Set(rects.map(rect => Math.round(rect.left / 10))).size > 3, "흩어져 놓여야 합니다.");
  const can = $(doc, ".vm-tray-can");
  assert.equal(can.offsetWidth, 34);
  assert.equal(can.offsetHeight, 58);

  $(doc, "#vm-take").click();
  await wait();
  assert.equal($(doc, "#vm-taken").textContent, String(ids.length));
  page.frame.remove();
});

test("자판기: 꺼내는 곳에 30개를 넘게 담으면 자판기가 터지고 화면 전체가 부서지며, 여러 번 눌러 고친다", async () => {
  const { page, doc, idle } = await brokenMachine();
  const ids = ["chrome-cola", "neon-cider", "synapse", "midnight", "lemonade", "blackout"];
  assert.ok($(doc, ".cp").classList.contains("is-alert"), "해킹하면 배경 전자기장이 빨갛게 바뀐다.");

  for (let i = 0; i < 24; i++) $(doc, `[data-drink="${ids[i % ids.length]}"]`).click();
  await idle();
  assert.ok($(doc, ".vm-tray").classList.contains("warning"));
  assert.equal($(doc, "#vm-display-text").textContent, "적재 경고 24/30. 더 담으면 위험합니다");

  for (let i = 0; i < 6; i++) $(doc, `[data-drink="${ids[i]}"]`).click();
  await idle();
  assert.ok($(doc, ".vm").classList.contains("is-broken"), "30개까지는 버틴다.");

  $(doc, '[data-drink="synapse"]').click();
  await until(() => $(doc, ".vm").classList.contains("is-exploded"), "31개째에 터져야 합니다.");
  assert.ok(doc.querySelector(".vm-blast") !== null);
  assert.equal(doc.querySelector("#vm-take"), null, "터지면 꺼낼 수 없습니다.");
  assert.equal(($(doc, '[data-drink="synapse"]') as HTMLButtonElement).disabled, true);
  assert.equal($(doc, "#vm-lost").textContent, "31");

  // 2차 피해: 화면 전체가 부서진다
  await until(() => doc.querySelector("#cp-wreck:not(.breaking)") !== null, "화면이 부서지지 않았습니다.");
  assert.ok($(doc, ".cp").classList.contains("is-wrecked"));
  assert.equal(doc.activeElement?.id, "cp-wreck", "부서진 화면에 초점이 가야 합니다.");
  assert.ok($(doc, ".cp-hero h1").style.transform !== "", "제목도 밀려난다.");
  assert.equal($(doc, "#cp-repair-count").textContent, "0/8");

  for (let i = 1; i < 8; i++) {
    $(doc, "#cp-wreck").click();
    await wait();
    assert.equal($(doc, "#cp-repair-count").textContent, `${i}/8`);
  }
  $(doc, "#cp-wreck").click();
  await wait();
  assert.equal(doc.querySelector("#cp-wreck"), null, "다 고치면 금이 사라진다.");
  assert.ok($(doc, ".vm").classList.contains("is-locked"));
  assert.ok($(doc, ".cp").classList.contains("is-normal"), "배경도 노랑으로 돌아온다.");
  assert.equal($(doc, "#vm-display-text").textContent, "시스템 복구 완료. 정상 영업을 시작합니다");
  assert.equal(doc.querySelectorAll(".vm-tray-can").length, 0);
  assert.equal($(doc, "#vm-load").textContent, "적재 0/30");
  assert.equal($(doc, "#vm-lost").textContent, "31", "날아간 캔 기록은 남는다.");
  page.frame.remove();
});

test("자판기: 쓰레기통을 뒤져 100 단위 크레딧을 모으고, 정상 영업 중인 자판기에서 사 먹는다", async () => {
  const page = await openPage("./index.html");
  const { doc } = page;
  page.win.matchMedia = (() => ({ matches: true })) as unknown as typeof page.win.matchMedia;
  assert.ok($(doc, ".cp").classList.contains("is-normal"));

  const balance = () => Number($(doc, "#vm-balance").textContent!.replace(/,/g, ""));
  let previous = 0;
  while (balance() < 1500) {
    $(doc, "#cp-trash").click();
    await wait();
    const gain = balance() - previous;
    assert.ok(gain >= 100 && gain <= 500 && gain % 100 === 0, `주운 크레딧 ${gain}`);
    assert.equal($(doc, "#cp-credit").textContent!.includes($(doc, "#vm-balance").textContent!), true, "헤더에도 잔액이 보인다.");
    previous = balance();
  }
  assert.ok(/^쓰레기통에서 [\d,]+ 크레딧을 주웠습니다$/.test($(doc, "#cp-trash-message").textContent!));

  $(doc, '[data-drink="chrome-cola"]').click();
  await until(() => doc.querySelector("#vm-take:not(:disabled)") !== null, "산 음료가 나오지 않았습니다.");
  assert.equal(balance(), previous - 1500);
  assert.equal($(doc, ".vm-tray-can").dataset.drinkId, "chrome-cola");
  $(doc, "#vm-take").click();
  await wait();
  assert.equal($(doc, ".vm-bag-list").textContent, "크롬 콜라 1");
  page.frame.remove();
});

test("자판기: 키패드로 열 문자와 번호를 눌러 고른다", async () => {
  const { page, doc, idle } = await brokenMachine();
  const key = (k: string) => $(doc, `.vm-key[data-key="${k}"]`).click();

  key("3");
  await wait();
  assert.equal($(doc, "#vm-display-text").textContent, "열 문자(A, B)를 먼저 누르세요");
  key("B");
  await wait();   // 누른 열 문자가 그려진 뒤에 번호를 누른다
  key("7");
  await wait();
  assert.equal($(doc, "#vm-display-text").textContent, "B7: 없는 번호입니다");

  key("B");
  await wait();
  key("2");
  await idle();
  assert.equal($(doc, ".vm-tray-can").dataset.drinkId, "lemonade");
  page.frame.remove();
});

test("자판기: 캔은 진열칸 그 자리에서 곧장 아래로, 중력처럼 점점 빨라지며 떨어진다", async () => {
  const { page, doc } = await brokenMachine();
  // 동작 줄이기를 끄고 배출해야 애니메이션이 붙는다
  page.win.matchMedia = (() => ({ matches: false })) as unknown as typeof page.win.matchMedia;
  $(doc, '[data-drink="midnight"]').click();
  await wait();
  const can = $(doc, ".vm-tray-can");
  const [animation] = can.getAnimations();
  assert.ok(animation !== undefined, "떨어지는 애니메이션이 있어야 합니다.");
  assert.equal(($(doc, "#vm-take") as HTMLButtonElement).disabled, true, "떨어지는 동안에는 꺼낼 수 없습니다.");

  animation.pause();
  const sample = (time: number) => {
    animation.currentTime = time;
    const rect = can.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, w: rect.width, h: rect.height };
  };
  const slot = $(doc, '[data-drink="midnight"] .vm-can').getBoundingClientRect();
  const [t0, t1, t2, t3] = [0, 80, 160, 240].map(sample);

  // 출발점은 진열칸의 캔, 크기는 1:1
  assert.ok(Math.abs(t0.x - (slot.left + slot.width / 2)) < 1 && Math.abs(t0.y - (slot.top + slot.height / 2)) < 1, "진열칸에서 출발해야 합니다.");
  assert.ok(Math.abs(t0.w - slot.width) < 1 && Math.abs(t0.h - slot.height) < 1, "진열칸 캔과 같은 크기여야 합니다.");
  // 자유 낙하 동안 옆으로 움직이거나 돌지 않는다
  assert.ok([t1, t2, t3].every(point => Math.abs(point.x - t0.x) < 0.5 && Math.abs(point.w - t0.w) < 0.5), "곧장 아래로 떨어져야 합니다.");
  // 같은 시간 동안 내려가는 거리가 늘어난다 (등가속도: 1 : 3 : 5)
  const d1 = t1.y - t0.y;
  const d2 = t2.y - t1.y;
  const d3 = t3.y - t2.y;
  assert.ok(d1 > 0 && d2 > d1 * 2.5 && d3 > d2 * 1.4, `낙하 거리 ${d1.toFixed(1)}, ${d2.toFixed(1)}, ${d3.toFixed(1)}`);

  animation.finish();
  await until(() => doc.querySelector("#vm-take:not(:disabled)") !== null, "애니메이션이 끝나면 꺼낼 수 있어야 합니다.");
  page.frame.remove();
});

test("자판기: 헤더 왼쪽 버튼으로 사이드바를 열고 Esc로 닫는다", async () => {
  const page = await openPage("./index.html");
  const { doc } = page;
  const menu = $(doc, "#cp-menu-btn");
  const sidebar = $(doc, "#cp-sidebar");
  assert.equal(menu.getAttribute("aria-expanded"), "false");
  assert.equal(page.win.getComputedStyle(sidebar).visibility, "hidden");

  menu.click();
  await wait();
  assert.equal(menu.getAttribute("aria-expanded"), "true");
  assert.ok(sidebar.classList.contains("open"));
  assert.equal(doc.activeElement?.id, "cp-sidebar-close");

  doc.dispatchEvent(new (page.win as typeof globalThis).KeyboardEvent("keydown", { key: "Escape" }));
  await wait();
  assert.equal(menu.getAttribute("aria-expanded"), "false");
  assert.equal(doc.activeElement?.id, "cp-menu-btn");

  menu.click();
  await wait();
  $(doc, ".cp-scrim").click();
  await wait();
  assert.equal(sidebar.classList.contains("open"), false, "바깥을 누르면 닫혀야 합니다.");
  page.frame.remove();
});

test("자판기: 다른 페이지로 떠나면 랜딩 전용 배경과 글꼴을 뗀다", async () => {
  const page = await openPage("./index.html");
  assert.ok(page.doc.body.classList.contains("cp-body"));
  assert.ok(page.doc.getElementById("cp-fonts") !== null);
  $(page.doc, '.cp-nav a[href="#/phase2"]').click();
  await wait(ROUTE_WAIT);
  assert.equal(page.doc.body.classList.contains("cp-body"), false);
  assert.equal(page.doc.getElementById("cp-fonts"), null);
  page.frame.remove();
});

// --- 면접 노트 ---

test("면접 노트: 홈의 카드로 들어가면 목차와 모든 절을 그린다", async () => {
  const page = await openPage("./index.html");
  $(page.doc, 'a.link-card[href="#/interview"]').click();
  await wait(ROUTE_WAIT);
  assert.equal(page.doc.title, "mini-react 면접 노트");
  const links = page.doc.querySelectorAll(".g-toc a");
  const topics = page.doc.querySelectorAll(".g-topic");
  assert.equal(links.length, topics.length);
  assert.ok(topics.length >= 30, `절 ${topics.length}개`);
  page.frame.remove();
});

test("면접 노트: 목차를 눌러도 라우트는 그대로이고 해당 절로 스크롤한다", async () => {
  const page = await openPage("./index.html#/interview");
  const target = $(page.doc, "#limits");
  // 화면 밖 iframe에서는 부드러운 스크롤이 진행되지 않으므로 동작 줄이기 설정으로 즉시 스크롤하게 한다
  page.win.matchMedia = (() => ({ matches: true })) as unknown as typeof page.win.matchMedia;
  Array.from(page.doc.querySelectorAll<HTMLAnchorElement>(".g-toc a")).at(-1)!.click();   // 마지막 항목 = 한계와 개선 방향
  await wait(ROUTE_WAIT);
  assert.equal(page.win.location.hash, "#/interview");
  assert.ok(page.doc.querySelector(".g-hero") !== null, "페이지가 바뀌면 안 됩니다.");
  // 마지막 절이라 문서 끝에 닿으면 맨 위까지 올라오지 않으므로 화면 안에 들어왔는지만 본다
  const top = target.getBoundingClientRect().top;
  assert.ok(top >= 0 && top < page.win.innerHeight, `절 위치 ${top}`);
  page.frame.remove();
});

test("면접 노트: 떠나면 이 페이지에서만 쓰는 글꼴을 뗀다", async () => {
  const page = await openPage("./index.html#/interview");
  assert.ok(page.doc.getElementById("guide-fonts") !== null);
  $(page.doc, ".g-back").click();
  await wait(ROUTE_WAIT);
  assert.equal(page.doc.getElementById("guide-fonts"), null);
  assert.ok(page.doc.querySelector(".link-list") !== null);
  page.frame.remove();
});
