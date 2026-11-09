import type { HostVNode, Key, VNode } from "./types.js";
import { renderComponent, type Instance } from "./hooks.js";
import { EMPTY } from "./createElement.js";

export interface ExpandContext {
  instances: Map<string, Instance>;
  visited: Set<string>;
  effects: Array<() => void>;   // commit 후 실행할 effect (자식 → 부모 순)
  removed: Instance[];          // 이번 렌더에서 사라진 인스턴스
  scheduleUpdate: () => void;
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
        instance = {
          type: vnode.type,
          hooks: [],
          pendingEffects: [],
          scheduleUpdate: ctx.scheduleUpdate,
          unmounted: false,
          dirty: false,
          vnode: null,
          output: null,
        };
        ctx.instances.set(path, instance);
      }
      ctx.visited.add(path);

      // 부모가 다시 렌더되지 않았으면 vnode가 같은 객체다. dirty도 아니면 호출하지 않는다
      if (instance.dirty || instance.vnode !== vnode) {
        instance.dirty = false;   // 렌더 전에 지워서, 렌더 중 setState는 다음 렌더로 남긴다
        instance.vnode = null;    // 렌더가 throw하면 다음에 다시 시도하도록 비워 둔다
        instance.output = renderComponent(instance, vnode.type, {
          ...vnode.props,
          children: vnode.children,
        });
        instance.vnode = vnode;
      }

      // 호출을 건너뛰어도 아래로 내려간다: 자손 중에 dirty가 있을 수 있고, visited도 기록해야 한다
      const hosts = expand(instance.output ?? EMPTY, `${path}/r`, ctx);   // null 반환 = 빈 자리
      ctx.effects.push(...instance.pendingEffects);   // 자식의 effect가 먼저 쌓인 뒤 부모
      instance.pendingEffects = [];                   // 렌더를 건너뛰는 다음 번에 다시 실행되면 안 된다
      return hosts;
    }
  }
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
