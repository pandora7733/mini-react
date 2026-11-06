import type { HostVNode, VNode } from "./types.js";
import { renderComponent, type Instance } from "./hooks.js";

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
      return vnode;

    case "element":
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
      const host = expand(output, `${path}/r`, ctx);
      ctx.effects.push(...instance.pendingEffects);   // 자식의 effect가 먼저 쌓인 뒤 부모
      return host;
    }
  }
}

function childPath(parent: string, child: VNode, index: number): string {
  if (child.kind !== "text" && child.key !== null) return `${parent}/k:${child.key}`;
  return `${parent}/i:${index}`;
}