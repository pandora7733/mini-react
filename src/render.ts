import type { HostVNode, VNode } from "./types.js";
import { unmountInstance, type Instance } from "./hooks.js";
import { diffChildren } from "./diff.js";
import { patchChildren } from "./patch.js";
import { expand } from "./expand.js";

interface RootState {
  container: HTMLElement;
  element: VNode;
  prevHost: HostVNode[];   // 루트도 Fragment를 반환할 수 있으므로 배열
  instances: Map<string, Instance>;
  scheduled: boolean;
}

const roots = new WeakMap<HTMLElement, RootState>();

export function render(element: VNode, container: HTMLElement): void {
  let root = roots.get(container);
  if (root === undefined) {
    root = { container, element, prevHost: [], instances: new Map(), scheduled: false };
    roots.set(container, root);
    container.replaceChildren();   // 첫 렌더는 "빈 상태 → 전부 INSERT"인 일반 diff가 된다
  } else {
    root.element = element;
  }
  performRender(root);
}

function scheduleUpdate(root: RootState): void {
  if (root.scheduled) return;
  root.scheduled = true;
  queueMicrotask(() => {
    root.scheduled = false;
    performRender(root);
  });
}

function performRender(root: RootState): void {
  // 1) render 단계: 컴포넌트 실행 (DOM은 건드리지 않음)
  const visited = new Set<string>();
  const effects: Array<() => void> = [];
  const removed: Instance[] = [];
  const next = expand(root.element, "root", {
    instances: root.instances,
    visited,
    effects,
    removed,
    scheduleUpdate: () => scheduleUpdate(root),
  });

  // 2) 사라진 컴포넌트 수집
  for (const [path, instance] of root.instances) {
    if (!visited.has(path)) {
      root.instances.delete(path);
      removed.push(instance);
    }
  }

  // 3) commit 단계: DOM 반영
  patchChildren(root.container, diffChildren(root.prevHost, next));
  root.prevHost = next;

  // 4) effect 단계: unmount cleanup → 이번 렌더의 effect
  for (const instance of removed) unmountInstance(instance);
  for (const run of effects) run();
}