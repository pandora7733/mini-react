import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement, Fragment, h } from "../../createElement.js";
import { expand, toHostTree, type ExpandContext } from "../../expand.js";
import { useState } from "../../hooks.js";
import type { VNode } from "../../types.js";

function context(rootOnlyHooks = false): ExpandContext {
  return {
    instances: new Map(),
    visited: new Set(),
    effects: [],
    removed: [],
    scheduleUpdate: () => {},
    rootOnlyHooks,
  };
}

test("경로를 slot으로 붙인다: key가 있으면 key, 없으면 인덱스", () => {
  const [div] = toHostTree([h("div", null, h("p", { key: "a" }), h("p", null))]);
  assert.equal(div.slot, "root/i:0");
  if (div.kind !== "element") throw new Error("element여야 합니다");
  assert.deepEqual(div.children.map(c => c.slot), ["root/i:0/k:a", "root/i:0/i:1"]);
});

test("Fragment는 부모의 자식으로 펼쳐진다", () => {
  const tree = toHostTree([createElement(Fragment, null, h("a", null), h("b", null))]);
  assert.deepEqual(tree.map(v => (v.kind === "element" ? v.type : v.kind)), ["a", "b"]);
});

test("같은 부모에서 key가 중복되면 에러를 낸다", () => {
  assert.throws(() => toHostTree([h("p", { key: 1 }), h("p", { key: "1" })]), /중복/);
});

test("null을 반환한 컴포넌트는 빈 자리가 된다", () => {
  const Nothing = () => null;
  const [host] = expand(h(Nothing, null), "root", context());
  assert.equal(host.kind, "empty");
});

test("부모가 렌더되지 않고 dirty도 아니면 호출하지 않는다", () => {
  let calls = 0;
  const Child = () => {
    calls++;
    return h("p", null);
  };
  const element = h("div", null, h(Child, null));
  const ctx = context();
  expand(element, "root", ctx);
  expand(element, "root", ctx);
  assert.equal(calls, 1);
});

test("새 vnode를 받으면 다시 호출한다", () => {
  let calls = 0;
  const Child = (_props: { n: number }) => {
    calls++;
    return null;
  };
  const ctx = context();
  expand(h(Child, { n: 1 }), "root", ctx);
  expand(h(Child, { n: 2 }), "root", ctx);
  assert.equal(calls, 2);
});

test("같은 자리에 다른 컴포넌트가 오면 이전 인스턴스를 제거 목록에 넣는다", () => {
  const A = (): VNode | null => null;
  const B = (): VNode | null => null;
  const ctx = context();
  expand(h(A, null), "root", ctx);
  assert.equal(ctx.removed.length, 0);
  expand(h(B, null), "root", ctx);
  assert.equal(ctx.removed.length, 1);
  assert.equal(ctx.removed[0].type, A);
});

test("key가 같은 컴포넌트는 순서가 바뀌어도 인스턴스를 유지한다", () => {
  const Row = (_props: { id: string }) => null;
  const list = (...ids: string[]) => h("ul", null, ids.map(id => h(Row, { key: id, id })));
  const ctx = context();
  expand(list("a", "b"), "root", ctx);
  const before = new Map(ctx.instances);
  expand(list("b", "a"), "root", ctx);
  assert.equal(ctx.instances.size, before.size);
  for (const [path, instance] of before) assert.equal(ctx.instances.get(path), instance);
});

test("rootOnlyHooks: 루트는 훅을 쓸 수 있다", () => {
  const Root = () => {
    useState(0);
    return null;
  };
  expand(h(Root, null), "root", context(true));
});

test("rootOnlyHooks: 자식이 훅을 쓰면 에러를 낸다", () => {
  const Child = () => {
    useState(0);
    return null;
  };
  const Root = () => h(Child, null);
  assert.throws(() => expand(h(Root, null), "root", context(true)), /루트 컴포넌트만/);
});
