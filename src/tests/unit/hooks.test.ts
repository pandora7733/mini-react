import { test } from "node:test";
import assert from "node:assert/strict";
import { h } from "../../createElement.js";
import { FunctionComponent } from "../../FunctionComponent.js";
import { useCallback, useEffect, useMemo, useState } from "../../hooks.js";
import type { Component, ComponentVNode } from "../../types.js";

function setup(component: Component) {
  let scheduled = 0;
  const instance = new FunctionComponent(component, () => scheduled++);
  const vnode = h(component, {}) as ComponentVNode;
  return {
    instance,
    vnode,
    scheduled: () => scheduled,
    rerender() {
      instance.dirty = true;
      return instance.update(vnode);
    },
    flushEffects() {
      for (const run of instance.pendingEffects) run();
      instance.pendingEffects = [];
    },
  };
}

test("FunctionComponent: mount는 함수를 실행하고 hooks에 상태를 저장한다", () => {
  const { instance, vnode } = setup(() => {
    useState(1);
    useState("a");
    return null;
  });
  assert.equal(instance.isMounted, false);
  instance.mount(vnode);
  assert.equal(instance.isMounted, true);
  assert.equal(instance.hooks.length, 2);
});

test("FunctionComponent: update는 dirty가 아니고 같은 vnode면 함수를 실행하지 않는다", () => {
  let calls = 0;
  const { instance, vnode } = setup(() => {
    calls++;
    return h("p", null);
  });
  const first = instance.mount(vnode);
  assert.equal(instance.update(vnode), first);
  assert.equal(calls, 1);
});

test("FunctionComponent: 렌더가 throw하면 마운트되지 않은 상태로 남아 다시 시도할 수 있다", () => {
  let fail = true;
  const { instance, vnode } = setup(() => {
    if (fail) throw new Error("실패");
    return null;
  });
  assert.throws(() => instance.mount(vnode), /실패/);
  assert.equal(instance.isMounted, false);
  fail = false;
  instance.mount(vnode);
  assert.equal(instance.isMounted, true);
});

test("useState: 함수가 다시 실행되어도 값이 유지된다", () => {
  let seen = -1;
  let set: (n: number) => void = () => {};
  const { instance, vnode, scheduled } = setup(() => {
    const [count, setCount] = useState(0);
    seen = count;
    set = setCount;
    return null;
  });
  instance.mount(vnode);
  assert.equal(seen, 0);

  set(5);
  assert.equal(instance.dirty, true);
  assert.equal(scheduled(), 1);

  instance.update(vnode);
  assert.equal(seen, 5);
  assert.equal(instance.dirty, false);
});

test("useState: 초기값 함수는 처음 한 번만 호출한다", () => {
  let inits = 0;
  const { instance, vnode, rerender } = setup(() => {
    useState(() => {
      inits++;
      return 0;
    });
    return null;
  });
  instance.mount(vnode);
  rerender();
  assert.equal(inits, 1);
});

test("useState: 함수형 업데이트는 순서대로 쌓인다", () => {
  let seen = 0;
  let set: (action: (n: number) => number) => void = () => {};
  const { instance, vnode } = setup(() => {
    const [count, setCount] = useState(0);
    seen = count;
    set = setCount;
    return null;
  });
  instance.mount(vnode);
  set(n => n + 1);
  set(n => n + 1);
  instance.update(vnode);
  assert.equal(seen, 2);
});

test("useState: 같은 값이면 다시 렌더를 예약하지 않는다", () => {
  let set: (n: number) => void = () => {};
  const { instance, vnode, scheduled } = setup(() => {
    set = useState(0)[1];
    return null;
  });
  instance.mount(vnode);
  set(0);
  assert.equal(scheduled(), 0);
  assert.equal(instance.dirty, false);
});

test("useState: setter는 렌더가 달라도 같은 함수다", () => {
  const setters: unknown[] = [];
  const { instance, vnode, rerender } = setup(() => {
    setters.push(useState(0)[1]);
    return null;
  });
  instance.mount(vnode);
  rerender();
  assert.equal(setters[0], setters[1]);
});

test("useState: 언마운트 뒤의 setState는 무시한다", () => {
  let set: (n: number) => void = () => {};
  const { instance, vnode, scheduled } = setup(() => {
    set = useState(0)[1];
    return null;
  });
  instance.mount(vnode);
  instance.unmount();
  set(1);
  assert.equal(scheduled(), 0);
});

test("훅: 렌더 밖에서 호출하면 에러를 낸다", () => {
  assert.throws(() => useState(0), /렌더링되는 중에만/);
});

test("훅: 호출 순서가 바뀌면 에러를 낸다", () => {
  let first = true;
  const { instance, vnode, rerender } = setup(() => {
    if (first) useState(0);
    else useMemo(() => 0, []);
    return null;
  });
  instance.mount(vnode);
  first = false;
  assert.throws(() => rerender(), /순서/);
});

test("useEffect: 렌더 뒤에 실행되고, deps가 같으면 건너뛴다", () => {
  const log: string[] = [];
  let dep = 1;
  const { instance, vnode, rerender, flushEffects } = setup(() => {
    useEffect(() => {
      log.push(`run ${dep}`);
      return () => log.push("cleanup");
    }, [dep]);
    return null;
  });
  instance.mount(vnode);
  assert.deepEqual(log, []);
  flushEffects();
  assert.deepEqual(log, ["run 1"]);

  rerender();
  flushEffects();
  assert.deepEqual(log, ["run 1"]);

  dep = 2;
  rerender();
  flushEffects();
  assert.deepEqual(log, ["run 1", "cleanup", "run 2"]);
});

test("useEffect: deps를 생략하면 매 렌더 실행한다", () => {
  let runs = 0;
  const { instance, vnode, rerender, flushEffects } = setup(() => {
    useEffect(() => {
      runs++;
    });
    return null;
  });
  instance.mount(vnode);
  flushEffects();
  rerender();
  flushEffects();
  assert.equal(runs, 2);
});

test("useEffect: 언마운트하면 cleanup을 한 번만 실행한다", () => {
  let cleanups = 0;
  const { instance, vnode, flushEffects } = setup(() => {
    useEffect(() => () => {
      cleanups++;
    }, []);
    return null;
  });
  instance.mount(vnode);
  flushEffects();
  instance.unmount();
  instance.unmount();
  assert.equal(cleanups, 1);
});

test("useMemo: deps가 같으면 다시 계산하지 않는다", () => {
  let computes = 0;
  let dep = 1;
  let value = 0;
  const { instance, vnode, rerender } = setup(() => {
    value = useMemo(() => {
      computes++;
      return dep * 10;
    }, [dep]);
    return null;
  });
  instance.mount(vnode);
  rerender();
  assert.equal(computes, 1);

  dep = 2;
  rerender();
  assert.equal(computes, 2);
  assert.equal(value, 20);
});

test("useCallback: deps가 같으면 같은 함수를 돌려준다", () => {
  const seen: unknown[] = [];
  const { instance, vnode, rerender } = setup(() => {
    seen.push(useCallback(() => 1, []));
    return null;
  });
  instance.mount(vnode);
  rerender();
  assert.equal(seen[0], seen[1]);
});
