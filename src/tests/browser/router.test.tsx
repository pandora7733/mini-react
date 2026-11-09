import { Fragment, h } from "../../createElement.js";
import { useEffect, useState } from "../../hooks.js";
import { Link, Route, Routes, setLeaveGuard, startRouter, type Params } from "../../router.js";
import type { VNode } from "../../types.js";
import { assert, test, wait } from "./harness.js";

const ROUTE_WAIT = 30;

function container(): HTMLElement {
  const el = document.createElement("div");
  document.getElementById("sandbox")!.append(el);
  return el;
}

// 테스트 페이지 자신의 주소를 쓰므로 끝나면 되돌린다
async function goTo(path: string): Promise<void> {
  location.hash = path;
  await wait(ROUTE_WAIT);
}

async function withRouter(start: string, run: (el: HTMLElement) => Promise<void>, routes: () => VNode, strict = true): Promise<void> {
  await goTo(start);
  const el = container();
  const stop = startRouter(routes(), el, { rootOnlyHooks: strict });
  try {
    await run(el);
  } finally {
    stop();
    setLeaveGuard(null);
    await goTo("/");
  }
}

test("라우터 코어: 경로에 맞는 페이지를 루트로 그려서 훅을 쓸 수 있다", async () => {
  function Counter() {
    const [count, setCount] = useState(0);
    return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
  }
  await withRouter("/count", async el => {
    el.querySelector("button")!.click();
    await wait();
    assert.equal(el.textContent, "1");
  }, () => <Routes><Route path="/count" element={<Counter />} /></Routes>);
});

test("라우터 코어: 페이지의 자식이 훅을 쓰면 에러가 난다", async () => {
  function Child() {
    useState(0);
    return <p>자식</p>;
  }
  function Page() {
    return <div><Child /></div>;
  }
  await goTo("/bad");
  let message = "";
  try {
    startRouter(<Routes><Route path="/bad" element={<Page />} /></Routes>, container(), { rootOnlyHooks: true })();
  } catch (error) {
    message = String(error);
  }
  assert.ok(message.includes("rootOnlyHooks"), message);
  await goTo("/");
});

test("라우터 코어: 파라미터만 바뀌면 상태를 유지하고 props로 새 값을 받는다", async () => {
  function Post({ params = {} }: { params?: Params }) {
    const [count, setCount] = useState(0);
    return <button onClick={() => setCount(c => c + 1)}>{params.id}:{count}</button>;
  }
  await withRouter("/posts/1", async el => {
    el.querySelector("button")!.click();
    await wait();
    assert.equal(el.textContent, "1:1");
    const button = el.querySelector("button");
    await goTo("/posts/2");
    assert.equal(el.textContent, "2:1");
    assert.equal(el.querySelector("button"), button);
  }, () => <Routes><Route path="/posts/:id" element={<Post />} /></Routes>);
});

test("라우터 코어: 라우트가 바뀌면 이전 페이지의 effect를 정리한다", async () => {
  const log: string[] = [];
  function A() {
    useEffect(() => () => log.push("A 정리"), []);
    return <p>A</p>;
  }
  function B() {
    return <p>B</p>;
  }
  await withRouter("/a", async el => {
    assert.equal(el.textContent, "A");
    await goTo("/b");
    assert.equal(el.textContent, "B");
    assert.equal(log.join(), "A 정리");
  }, () => <Routes><Route path="/a" element={<A />} /><Route path="/b" element={<B />} /></Routes>);
});

test("라우터 코어: 먼저 선언한 라우트가 이기고, 맞는 것이 없으면 비운다", async () => {
  await withRouter("/a", async el => {
    assert.equal(el.textContent, "첫째");
    await goTo("/none");
    assert.equal(el.childNodes.length, 0);
  }, () => (
    <Routes>
      <Route path="/a" element={<p>첫째</p>} />
      <Route path="/:any" element={<></>} />
    </Routes>
  ));
});

test("라우터 코어: 한글 경로가 맞는다", async () => {
  await withRouter("/한글", async el => {
    assert.equal(el.textContent, "한글 페이지");
  }, () => <Routes><Route path="/한글" element={<p>한글 페이지</p>} /></Routes>);
});

test("라우터 코어: 가드가 거부하면 페이지와 주소를 유지한다", async () => {
  let allow = false;
  await withRouter("/a", async el => {
    setLeaveGuard(() => allow);
    await goTo("/b");
    assert.equal(el.textContent, "A");
    assert.equal(location.hash, "#/a");

    allow = true;
    await goTo("/b");
    assert.equal(el.textContent, "B");
  }, () => <Routes><Route path="/a" element={<p>A</p>} /><Route path="/b" element={<p>B</p>} /></Routes>);
});

test("라우터 코어: Link는 해시 주소의 a를 그린다", () => {
  const el = container();
  const stop = startRouter(<Routes><Route path="*" element={<Link to="/x" className="c">이동</Link>} /></Routes>, el);
  const anchor = el.querySelector("a")!;
  assert.equal(anchor.getAttribute("href"), "#/x");
  assert.equal(anchor.className, "c");
  stop();
});

test("라우터 코어: Route가 아닌 자식은 거부한다", () => {
  let message = "";
  try {
    startRouter(<Routes><p>잘못됨</p></Routes>, container());
  } catch (error) {
    message = String(error);
  }
  assert.ok(message.includes("Route"), message);
});
