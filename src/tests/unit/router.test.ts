import { test } from "node:test";
import assert from "node:assert/strict";
import { matchPath } from "../../router.js";

test("경로: 같은 경로만 맞는다", () => {
  assert.deepEqual(matchPath("/budget", "/budget"), {});
  assert.equal(matchPath("/budget", "/phase1"), null);
  assert.equal(matchPath("/budget", "/budget/2026"), null);
  assert.equal(matchPath("/budget/2026", "/budget"), null);
});

test("경로: 루트와 끝의 슬래시", () => {
  assert.deepEqual(matchPath("/", "/"), {});
  assert.equal(matchPath("/", "/budget"), null);
  assert.deepEqual(matchPath("/budget", "/budget/"), {});
});

test("경로: 파라미터를 읽고 디코딩한다", () => {
  assert.deepEqual(matchPath("/posts/:id", "/posts/42"), { id: "42" });
  assert.deepEqual(matchPath("/a/:x/b/:y", "/a/1/b/2"), { x: "1", y: "2" });
  assert.deepEqual(matchPath("/posts/:id", "/posts/%ED%95%9C%EA%B8%80"), { id: "한글" });
  assert.equal(matchPath("/posts/:id", "/posts"), null);
});

test("경로: 깨진 인코딩이어도 예외를 던지지 않는다", () => {
  assert.deepEqual(matchPath("/posts/:id", "/posts/%E0%A4%A"), { id: "%E0%A4%A" });
});

test("경로: 선택 파라미터는 있어도 없어도 맞는다", () => {
  assert.deepEqual(matchPath("/budget/:month?", "/budget"), {});
  assert.deepEqual(matchPath("/budget/:month?", "/budget/2026-11"), { month: "2026-11" });
  assert.equal(matchPath("/budget/:month?", "/budget/2026-11/extra"), null);
});

test("경로: *는 나머지 전부와 맞는다", () => {
  assert.deepEqual(matchPath("*", "/"), { "*": "" });
  assert.deepEqual(matchPath("*", "/a/b"), { "*": "a/b" });
  assert.deepEqual(matchPath("/files/*", "/files/a/b"), { "*": "a/b" });
  assert.equal(matchPath("/files/*", "/other"), null);
});
