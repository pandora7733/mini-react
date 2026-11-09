import { Fragment, h } from "../../createElement.js";
import { render, unmount } from "../../render.js";
import { useEffect, useMemo, useState } from "../../hooks.js";
import { assert, test, wait } from "./harness.js";

function container(): HTMLElement {
  const el = document.createElement("div");
  document.getElementById("sandbox")!.append(el);
  return el;
}

test("unmount: 화면을 비우고 자식까지 cleanup을 실행하며, 예약된 렌더도 취소한다", async () => {
  const log: string[] = [];
  let set: (n: number) => void = () => {};
  function Child() {
    useEffect(() => () => log.push("child"), []);
    return <span>자식</span>;
  }
  function App() {
    const [count, setCount] = useState(0);
    set = setCount;
    useEffect(() => () => log.push("app"), []);
    return <div>{count}<Child /></div>;
  }
  const el = container();
  render(<App />, el);

  set(1);   // 렌더가 예약된 상태에서 해제한다
  unmount(el);
  assert.equal(el.childNodes.length, 0);
  assert.equal(log.slice().sort().join(), "app,child");

  await wait();
  set(2);
  await wait();
  assert.equal(el.childNodes.length, 0);
  assert.equal(log.length, 2, "cleanup은 한 번만 실행해야 합니다.");
});

test("unmount: 같은 컨테이너에 다시 render하면 새 상태로 시작한다", async () => {
  function App() {
    const [count] = useState(() => Math.random());
    return <p>{count}</p>;
  }
  const el = container();
  render(<App />, el);
  const first = el.textContent;
  unmount(el);
  render(<App />, el);
  assert.ok(el.textContent !== first);
});

test("unmount: 그린 적 없는 컨테이너는 아무 일도 하지 않는다", () => {
  unmount(container());
});

test("render: 상태가 바뀌면 자동으로 다시 그린다", async () => {
  let set: (n: number) => void = () => {};
  function App() {
    const [count, setCount] = useState(0);
    set = setCount;
    return <p>{count}</p>;
  }
  const el = container();
  render(<App />, el);
  assert.equal(el.textContent, "0");
  set(1);
  await wait();
  assert.equal(el.textContent, "1");
});

test("render: 같은 틱의 setState 여러 번은 렌더 한 번으로 합친다", async () => {
  let renders = 0;
  let bump: () => void = () => {};
  function App() {
    renders++;
    const [a, setA] = useState(0);
    const [b, setB] = useState(0);
    bump = () => {
      setA(n => n + 1);
      setA(n => n + 1);
      setB(n => n + 1);
    };
    return <p>{a}/{b}</p>;
  }
  const el = container();
  render(<App />, el);
  bump();
  assert.equal(renders, 1);
  await wait();
  assert.equal(renders, 2);
  assert.equal(el.textContent, "2/1");
});

test("render: DOM을 반영한 뒤에 effect를 실행한다", () => {
  let seen: string | null = null;
  const el = container();
  function App() {
    useEffect(() => {
      seen = el.textContent;
    }, []);
    return <p>그림</p>;
  }
  render(<App />, el);
  assert.equal(seen, "그림");
});

test("render: effect는 자식부터, 언마운트 cleanup은 새 effect보다 먼저 실행한다", async () => {
  const log: string[] = [];
  let hide: () => void = () => {};
  function Child() {
    useEffect(() => {
      log.push("child");
      return () => log.push("child cleanup");
    }, []);
    return null;
  }
  function App() {
    const [show, setShow] = useState(true);
    hide = () => setShow(false);
    useEffect(() => {
      log.push(`app ${show}`);
    }, [show]);
    return <div>{show && <Child />}</div>;
  }
  render(<App />, container());
  assert.equal(log.join(), "child,app true");
  hide();
  await wait();
  assert.equal(log.join(), "child,app true,child cleanup,app false");
});

test("render: 자식의 상태 변경은 부모를 다시 호출하지 않는다", async () => {
  let parents = 0;
  let set: (n: number) => void = () => {};
  function Child() {
    const [n, setN] = useState(0);
    set = setN;
    return <span>{n}</span>;
  }
  function Parent() {
    parents++;
    return <Child />;
  }
  const el = container();
  render(<Parent />, el);
  set(1);
  await wait();
  assert.equal(parents, 1);
  assert.equal(el.textContent, "1");
});

test("render: null을 반환하면 비워 두고 뒤 형제 DOM을 유지한다", async () => {
  let toggle: () => void = () => {};
  function Maybe({ show }: { show: boolean }) {
    return show ? <b>보임</b> : null;
  }
  function App() {
    const [show, setShow] = useState(true);
    toggle = () => setShow(s => !s);
    return <div><Maybe show={show} /><input /></div>;
  }
  const el = container();
  render(<App />, el);
  const input = el.querySelector("input")!;
  input.value = "유지";
  toggle();
  await wait();
  assert.equal(el.querySelector("b"), null);
  assert.equal(el.querySelector("input"), input);
  assert.equal(input.value, "유지");
});

test("render: Fragment 길이가 바뀌어도 뒤 형제를 유지한다", async () => {
  let setCount: (n: number) => void = () => {};
  function Tags({ count }: { count: number }) {
    return <>{Array.from({ length: count }, (_, i) => <b key={i}>{i}</b>)}</>;
  }
  function App() {
    const [count, set] = useState(1);
    setCount = set;
    return <div><Tags count={count} /><input /></div>;
  }
  const el = container();
  render(<App />, el);
  const input = el.querySelector("input")!;
  setCount(3);
  await wait();
  assert.equal(el.querySelectorAll("b").length, 3);
  assert.equal(el.querySelector("input"), input);
});

test("render: 입력 중 다시 렌더해도 같은 노드와 커서를 유지한다", async () => {
  function App() {
    const [text, setText] = useState("");
    return <input value={text} onInput={e => setText((e.target as HTMLInputElement).value)} />;
  }
  const el = container();
  render(<App />, el);
  const input = el.querySelector("input")!;
  input.value = "abcd";
  input.setSelectionRange(2, 2);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await wait();
  assert.equal(el.querySelector("input"), input);
  assert.equal(input.selectionStart, 2);
});

test("render: useMemo는 관련 없는 상태 변경에 다시 계산하지 않는다", async () => {
  let computes = 0;
  let set: (n: number) => void = () => {};
  function App() {
    const [other, setOther] = useState(0);
    set = setOther;
    const value = useMemo(() => {
      computes++;
      return 1;
    }, []);
    return <p>{value}{other}</p>;
  }
  render(<App />, container());
  set(1);
  await wait();
  assert.equal(computes, 1);
});

test("render: rootOnlyHooks에서 자식이 훅을 쓰면 렌더가 실패한다", () => {
  function Child() {
    useState(0);
    return null;
  }
  function App() {
    return <Child />;
  }
  let message = "";
  try {
    render(<App />, container(), { rootOnlyHooks: true });
  } catch (error) {
    message = (error as Error).message;
  }
  assert.ok(message.includes("루트 컴포넌트만"), message);
});
