import { test } from "node:test";
import assert from "node:assert/strict";
import { createTextVNode, h } from "../../createElement.js";
import { diffChildren, isUnchanged } from "../../diff.js";
import { describePatch } from "../../describePatch.js";
import { toHostTree } from "../../expand.js";
import type { ChildOp, VNode } from "../../types.js";

function changesBetween(oldTree: VNode[], newTree: VNode[]) {
  const old = toHostTree(oldTree);
  return describePatch(old, diffChildren(old, toHostTree(newTree)));
}

function kinds(oldTree: VNode[], newTree: VNode[]): string[] {
  return changesBetween(oldTree, newTree).map(change => change.kind);
}

test("같은 트리면 바뀐 것이 없다", () => {
  const make = () => toHostTree([h("div", { id: "a" }, h("p", null, "x"))]);
  assert.ok(isUnchanged(diffChildren(make(), make())));
});

test("케이스 1: 노드 추가", () => {
  assert.deepEqual(kinds([h("ul", null, h("li", null))], [h("ul", null, h("li", null), h("li", null))]), ["ADD"]);
});

test("케이스 2: 노드 삭제", () => {
  assert.deepEqual(kinds([h("ul", null, h("li", null), h("li", null))], [h("ul", null, h("li", null))]), ["REMOVE"]);
});

test("케이스 3: 태그가 다르면 교체한다", () => {
  assert.deepEqual(kinds([h("p", null, "a")], [h("div", null, "a")]), ["REPLACE"]);
});

test("텍스트와 엘리먼트가 서로 바뀌어도 교체한다", () => {
  assert.deepEqual(kinds([h("div", null, "a")], [h("div", null, h("b", null))]), ["REPLACE"]);
});

test("케이스 4: 텍스트 변경", () => {
  assert.deepEqual(kinds([h("p", null, "a")], [h("p", null, "b")]), ["TEXT"]);
});

test("케이스 5: 속성 변경과 제거", () => {
  const changes = changesBetween([h("p", { id: "a", title: "t" })], [h("p", { id: "b" })]);
  assert.deepEqual(changes.map(c => c.kind), ["ATTR", "ATTR"]);
  assert.ok(changes.some(c => c.detail === "title 제거"));
  assert.ok(changes.some(c => c.detail.startsWith("id =")));
});

test("key가 있으면 순서가 바뀌어도 노드를 재사용한다", () => {
  const li = (key: string) => h("li", { key }, key);
  const old = toHostTree([h("ul", null, li("a"), li("b"), li("c"))]);
  const next = toHostTree([h("ul", null, li("c"), li("a"), li("b"))]);
  const op = diffChildren(old, next).order[0];
  if (op.type !== "REUSE" || op.patch?.type !== "UPDATE") throw new Error("ul을 재사용해야 합니다");

  const froms = op.patch.children.order.map((child: ChildOp) => (child.type === "REUSE" ? child.from : -1));
  assert.deepEqual(froms, [2, 0, 1]);
  assert.deepEqual(op.patch.children.removed, []);
});

test("앞 노드를 지워 인덱스만 밀린 경우는 이동으로 세지 않는다", () => {
  const li = (key: string) => h("li", { key });
  assert.deepEqual(kinds([h("ul", null, li("a"), li("b"))], [h("ul", null, li("b"))]), ["REMOVE"]);
});

test("순서가 뒤집히면 이동으로 설명한다", () => {
  const li = (key: string) => h("li", { key });
  assert.deepEqual(kinds([h("ul", null, li("a"), li("b"))], [h("ul", null, li("b"), li("a"))]), ["MOVE"]);
});

test("key가 없으면 인덱스로 비교해 내용을 고친다", () => {
  assert.deepEqual(
    kinds([h("ul", null, h("li", null, "a"), h("li", null, "b"))], [h("ul", null, h("li", null, "b"))]),
    ["TEXT", "REMOVE"],
  );
});

test("빈 자리가 생겨도 뒤 형제는 바뀌지 않는다", () => {
  const old = [h("div", null, h("b", null), h("input", null))];
  const next = [h("div", null, null, h("input", null))];
  assert.deepEqual(kinds(old, next), ["REPLACE"]);
});

test("빈 트리에서 시작하면 전부 INSERT다", () => {
  const patch = diffChildren([], toHostTree([h("p", null), createTextVNode("x")]));
  assert.deepEqual(patch.order.map(op => op.type), ["INSERT", "INSERT"]);
});

test("깊은 곳의 변경도 찾아낸다", () => {
  const tree = (text: string) => [h("div", null, h("section", null, h("p", null, text)))];
  const [change] = changesBetween(tree("a"), tree("b"));
  assert.equal(change.kind, "TEXT");
  assert.equal(change.path, "root/i:0/i:0/i:0/i:0");
});
