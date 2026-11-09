import type { HostVNode, Key, VNode } from "./types.js";
import { FunctionComponent } from "./FunctionComponent.js";
import { EMPTY } from "./createElement.js";

export interface ExpandContext {
  instances: Map<string, FunctionComponent>;
  visited: Set<string>;
  effects: Array<() => void>;   // commit 후 실행할 effect (자식 → 부모 순)
  removed: FunctionComponent[]; // 이번 렌더에서 사라진 인스턴스
  scheduleUpdate: () => void;
  rootOnlyHooks: boolean;       // true면 루트 컴포넌트 밖에서 훅을 쓸 때 에러를 낸다
}

// vnode 하나가 DOM 노드 여러 개가 될 수 있으므로(Fragment) 배열을 반환한다
export function expand(vnode: VNode, path: string, ctx: ExpandContext): HostVNode[] {
  switch (vnode.kind) {
    case "text":
    case "empty":
      return [{ ...vnode, slot: path }];

    case "element":
      return [{ ...vnode, children: expandChildren(vnode.children, path, ctx), slot: path }];

    case "fragment":
      return expandChildren(vnode.children, path, ctx);

    case "component": {
      let instance = ctx.instances.get(path);
      if (instance === undefined || instance.type !== vnode.type) {
        if (instance !== undefined) ctx.removed.push(instance);   // 같은 자리, 다른 컴포넌트
        instance = new FunctionComponent(
          vnode.type,
          ctx.scheduleUpdate,
          !ctx.rootOnlyHooks || path === "root",
        );
        ctx.instances.set(path, instance);
      }
      ctx.visited.add(path);

      const output = instance.isMounted ? instance.update(vnode) : instance.mount(vnode);

      // 호출을 건너뛰어도 아래로 내려간다: 자손 중에 dirty가 있을 수 있고, visited도 기록해야 한다
      const hosts = expand(output ?? EMPTY, `${path}/r`, ctx);   // null 반환 = 빈 자리
      ctx.effects.push(...instance.pendingEffects);   // 자식의 effect가 먼저 쌓인 뒤 부모
      instance.pendingEffects = [];                   // 렌더를 건너뛰는 다음 번에 다시 실행되면 안 된다
      return hosts;
    }
  }
}

// 컴포넌트가 없는 트리(DOM에서 변환한 트리)에 slot을 붙여 diff할 수 있게 만든다
export function toHostTree(children: VNode[]): HostVNode[] {
  return expandChildren(children, "root", {
    instances: new Map(),
    visited: new Set(),
    effects: [],
    removed: [],
    scheduleUpdate: () => {},
    rootOnlyHooks: false,
  });
}

function expandChildren(children: VNode[], path: string, ctx: ExpandContext): HostVNode[] {
  assertUniqueKeys(children);
  return children.flatMap((child, i) => expand(child, childPath(path, child, i), ctx));
}

function childPath(parent: string, child: VNode, index: number): string {
  const key = keyOf(child);
  return key !== null ? `${parent}/k:${key}` : `${parent}/i:${index}`;
}

function keyOf(vnode: VNode): Key | null {
  return vnode.kind === "text" || vnode.kind === "empty" ? null : vnode.key;
}

// 같은 key가 두 번 나오면 경로(k:<key>)가 겹쳐 상태와 DOM의 짝 맞추기가 모두 깨진다
function assertUniqueKeys(children: VNode[]): void {
  const seen = new Set<string>();
  for (const child of children) {
    const key = keyOf(child);
    if (key === null) continue;
    const name = String(key);   // 경로는 문자열이므로 1과 "1"도 같은 key로 본다
    if (seen.has(name)) throw new Error(`같은 부모 안에서 key "${name}"가 중복됩니다`);
    seen.add(name);
  }
}
