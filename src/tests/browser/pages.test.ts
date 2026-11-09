import { assert, test, wait } from "./harness.js";

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
  const page = await openPage("./phase1.html");
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
    const page = await openPage("./phase2.html?board=e2e");
    assert.equal(page.doc.querySelectorAll(".task-title").length, 3);
    page.frame.remove();
    localStorage.removeItem(E2E_STORAGE_KEY);
  });
}

test("Phase 2: 저장된 빈 목록은 그대로 빈 목록이다", async () => {
  localStorage.setItem(E2E_STORAGE_KEY, "[]");
  const page = await openPage("./phase2.html?board=e2e");
  assert.equal(page.doc.querySelectorAll(".task-title").length, 0);
  assert.ok(page.doc.querySelector("#empty-state") !== null);
  page.frame.remove();
  localStorage.removeItem(E2E_STORAGE_KEY);
});

async function phase2() {
  localStorage.removeItem("mini-react:focus-board:e2e");
  const page = await openPage("./phase2.html?board=e2e");
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

// --- 예시 앱: 가계부 ---

const BUDGET_STORAGE_KEY = "mini-react:budget:e2e";

async function budget() {
  localStorage.removeItem(BUDGET_STORAGE_KEY);
  const page = await openPage("./budget.html?board=e2e");
  const { doc } = page;
  const text = (selector: string) => $(doc, selector).textContent;
  return {
    ...page,
    text,
    row: (id: number) => doc.querySelector<HTMLElement>(`[data-entry-id="${id}"]`),
    titles: () => Array.from(doc.querySelectorAll(".task-title"), el => el.textContent),
    add: async (title: string, amount: string) => {
      typeInto($<HTMLInputElement>(doc, "#entry-title"), title);
      typeInto($<HTMLInputElement>(doc, "#entry-amount"), amount);
      await wait();
      $(doc, "#entry-add").click();
      await wait();
    },
    close: () => {
      page.frame.remove();
      localStorage.removeItem(BUDGET_STORAGE_KEY);
    },
  };
}

test("가계부: 이번 달 합계와 분류별 지출을 보여 준다", async () => {
  const p = await budget();
  assert.equal(p.text("#sum-income"), "2,500,000원");
  assert.equal(p.text("#sum-expense"), "145,000원");
  assert.equal(p.text("#sum-balance"), "2,355,000원");
  const categories = Array.from(p.doc.querySelectorAll<HTMLElement>(".budget-chart li"), li => li.dataset.category);
  assert.equal(categories.join(), "식비,교통,여가");
  assert.equal(p.doc.querySelector(".budget-chart rect")!.getAttribute("width"), "100%");
  assert.equal(p.doc.querySelector(".budget-chart rect")!.namespaceURI, "http://www.w3.org/2000/svg");
  p.close();
});

test("가계부: 항목을 추가하면 합계가 바뀌고 입력창이 비며 금액이 잘못되면 추가할 수 없다", async () => {
  const p = await budget();
  const button = $<HTMLButtonElement>(p.doc, "#entry-add");
  typeInto($<HTMLInputElement>(p.doc, "#entry-title"), "커피");
  typeInto($<HTMLInputElement>(p.doc, "#entry-amount"), "-5");
  await wait();
  assert.equal(button.disabled, true);

  await p.add("커피", "5000");
  assert.equal(p.text("#sum-expense"), "150,000원");
  assert.ok(p.titles().includes("커피"));
  assert.equal($<HTMLInputElement>(p.doc, "#entry-title").value, "");
  assert.equal($<HTMLInputElement>(p.doc, "#entry-amount").value, "");
  p.close();
});

test("가계부: 다른 달의 항목을 추가하면 그 달로 이동한다", async () => {
  const p = await budget();
  typeInto($<HTMLInputElement>(p.doc, "#entry-date"), "2020-03-15");
  await p.add("과거 지출", "1000");
  assert.equal(p.text("#month-label"), "2020년 3월");
  assert.equal(p.titles().join(), "과거 지출");
  p.close();
});

test("가계부: 수정 모드는 항목별 상태이고 다른 항목이 바뀌어도 유지된다", async () => {
  const p = await budget();
  const row = p.row(2)!;
  row.querySelector<HTMLButtonElement>('[data-action="edit"]')!.click();
  await wait();
  const input = row.querySelector<HTMLInputElement>('input[aria-label="내용 수정"]')!;
  assert.equal(input.value, "장보기");
  assert.equal(p.doc.querySelectorAll(".budget-edit").length, 2);

  typeInto(input, "작성 중");
  await wait();
  p.row(5)!.querySelector<HTMLButtonElement>('[data-action="remove"]')!.click();
  await wait();
  assert.equal(p.row(5), null);
  assert.equal(p.row(2), row, "같은 DOM 노드여야 합니다.");
  assert.equal(row.querySelector<HTMLInputElement>('input[aria-label="내용 수정"]'), input);
  assert.equal(input.value, "작성 중");
  p.close();
});

test("가계부: 저장하면 반영하고 취소하면 원래 값으로 돌아간다", async () => {
  const p = await budget();
  const row = p.row(4)!;
  const edit = async (amount: string, action: string) => {
    row.querySelector<HTMLButtonElement>('[data-action="edit"]')!.click();
    await wait();
    typeInto(row.querySelector<HTMLInputElement>('input[aria-label="금액 수정"]')!, amount);
    await wait();
    row.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!.click();
    await wait();
  };

  await edit("99999", "cancel");
  assert.equal(p.text("#sum-expense"), "145,000원");

  row.querySelector<HTMLButtonElement>('[data-action="edit"]')!.click();
  await wait();
  const KeyboardEventOf = (p.win as Window & typeof globalThis).KeyboardEvent;
  row.querySelector("input")!.dispatchEvent(new KeyboardEventOf("keydown", { key: "Escape", bubbles: true }));
  await wait();
  assert.equal(row.querySelector("input"), null, "Esc로 수정을 취소해야 합니다.");

  await edit("25000", "save");
  assert.equal(p.text("#sum-expense"), "155,000원");
  assert.ok(row.textContent!.includes("-25,000원"), row.textContent!);
  p.close();
});

test("가계부: 달을 옮기면 내역과 차트가 바뀌고, 내역이 없으면 안내한다", async () => {
  const p = await budget();
  $(p.doc, "#month-prev").click();
  await wait();
  assert.equal(p.titles().join(), "전기 요금,월급");
  assert.equal(p.text("#sum-expense"), "42,000원");

  $(p.doc, "#month-prev").click();
  await wait();
  assert.equal(p.titles().length, 0);
  assert.ok(p.doc.querySelector("#empty-state") !== null);
  assert.equal(p.doc.querySelector(".budget-chart"), null);
  p.close();
});

test("가계부: 다시 열어도 저장되어 있고, 저장값이 잘못되면 예시 내역으로 시작한다", async () => {
  const p = await budget();
  await p.add("저장 확인", "1000");
  p.frame.contentWindow!.location.reload();
  await wait(50);
  await waitForReady(p.frame);
  const titles = Array.from(p.frame.contentDocument!.querySelectorAll(".task-title"), el => el.textContent);
  assert.ok(titles.includes("저장 확인"));
  p.close();

  localStorage.setItem(BUDGET_STORAGE_KEY, `[{"id":1}]`);
  const page = await openPage("./budget.html?board=e2e");
  assert.equal(page.doc.querySelector("#sum-income")!.textContent, "2,500,000원");
  page.frame.remove();
  localStorage.removeItem(BUDGET_STORAGE_KEY);
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
