import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement, EMPTY, Fragment, h } from "../../createElement.js";
import type { ElementVNode } from "../../types.js";

test("element vnode에서 key를 props와 분리한다", () => {
  const vnode = h("li", { key: "a", id: "x" });
  assert.equal(vnode.kind, "element");
  assert.equal(vnode.key, "a");
  assert.deepEqual(vnode.props, { id: "x" });
});

test("문자열과 숫자 자식은 text vnode가 된다", () => {
  const vnode = h("p", null, "a", 0);
  assert.deepEqual(vnode.children, [{ kind: "text", value: "a" }, { kind: "text", value: "0" }]);
});

test("null, undefined, boolean 자식은 빈 자리로 남아 인덱스를 지킨다", () => {
  const vnode = h("p", null, null, undefined, false, true);
  assert.deepEqual(vnode.children, [EMPTY, EMPTY, EMPTY, EMPTY]);
});

test("배열 자식은 자리 하나를 차지하는 fragment가 된다", () => {
  const vnode = h("ul", null, [h("li", null), h("li", null)], "끝");
  assert.equal(vnode.children.length, 2);
  assert.equal(vnode.children[0].kind, "fragment");
});

test("Fragment 타입은 fragment vnode를 만든다", () => {
  const vnode = createElement(Fragment, { key: 1 }, "a");
  assert.equal(vnode.kind, "fragment");
  assert.equal(vnode.key, 1);
});

test("함수 타입은 component vnode를 만든다", () => {
  const Child = (_props: { n: number }): ElementVNode => h("p", null);
  const vnode = h(Child, { n: 1, key: "k" });
  assert.equal(vnode.kind, "component");
  assert.equal(vnode.key, "k");
  assert.deepEqual(vnode.props, { n: 1 });
});
