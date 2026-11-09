import type { HostVNode, VNode } from "./types.js";
import { renderComponent, type Instance } from "./hooks.js";
import { EMPTY } from "./createElement.js";

export interface ExpandContext {
  instances: Map<string, Instance>;
  visited: Set<string>;
  effects: Array<() => void>;   // commit 후 실행할 effect (자식 → 부모 순)
  removed: Instance[];          // 이번 렌더에서 사라진 인스턴스
  scheduleUpdate: () => void;
}

export function expand(vnode: VNode, path: string, ctx: ExpandContext): HostVNode {
  switch (vnode.kind) {
    case "text":
    case "empty":
      return vnode;

    case "element":
      assertUniqueKeys(vnode.children);
      return {
        ...vnode,
        children: vnode.children.map((child, i) => expand(child, childPath(path, child, i), ctx)),
      };

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
        };
        ctx.instances.set(path, instance);
      }
      ctx.visited.add(path);

      const output = renderComponent(instance, vnode.type, {
        ...vnode.props,
        children: vnode.children,
      });
      const host = expand(output ?? EMPTY, `${path}/r`, ctx);   // null 반환 = 빈 자리
      ctx.effects.push(...instance.pendingEffects);   // 자식의 effect가 먼저 쌓인 뒤 부모

      // 컴포넌트의 key를 결과 엘리먼트로 옮겨야 diff가 리스트 항목을 알아볼 수 있다
      if (vnode.key !== null && host.kind === "element") return { ...host, key: vnode.key };
      return host;
    }
  }
}

function childPath(parent: string, child: VNode, index: number): string {
  if ((child.kind === "element" || child.kind === "component") && child.key !== null) {
    return `${parent}/k:${child.key}`;
  }
  return `${parent}/i:${index}`;
}

// 같은 key가 두 번 나오면 경로(k:<key>)와 diff의 짝 맞추기가 모두 깨진다
function assertUniqueKeys(children: VNode[]): void {
  const seen = new Set<string>();
  for (const child of children) {
    if ((child.kind === "element" || child.kind === "component") && child.key !== null) {
      const key = String(child.key);   // 경로는 문자열이므로 1과 "1"도 같은 key로 본다
      if (seen.has(key)) throw new Error(`같은 부모 안에서 key "${key}"가 중복됩니다`);
      seen.add(key);
    }
  }
}
