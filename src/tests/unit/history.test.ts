import { test } from "node:test";
import assert from "node:assert/strict";
import { StateHistory } from "../../history.js";

test("처음에는 뒤로도 앞으로도 갈 수 없다", () => {
  const history = new StateHistory("a");
  assert.equal(history.current, "a");
  assert.equal(history.canBack, false);
  assert.equal(history.canForward, false);
});

test("저장한 기록 사이를 오간다", () => {
  const history = new StateHistory("a");
  history.push("b");
  history.push("c");
  assert.equal(history.go(0), "a");
  assert.equal(history.canForward, true);
  assert.equal(history.go(2), "c");
  assert.equal(history.canForward, false);
});

test("과거에서 새로 저장하면 앞쪽 기록을 버린다", () => {
  const history = new StateHistory("a");
  history.push("b");
  history.push("c");
  history.go(0);
  history.push("d");
  assert.deepEqual(history.all(), ["a", "d"]);
  assert.equal(history.position, 1);
});

test("범위를 벗어나면 에러를 내고 위치를 유지한다", () => {
  const history = new StateHistory("a");
  assert.throws(() => history.go(-1), /없는 기록/);
  assert.throws(() => history.go(1), /없는 기록/);
  assert.equal(history.current, "a");
});
