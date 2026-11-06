import type { HostVNode, VNode } from "./types.js";
import { renderComponent, type Instance } from "./hooks.js";

export interface ExpandContext {
  instances: Map<string, Instance>;
  visited: Set<string>;
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
        instance = { type: vnode.type, hooks: [], scheduleUpdate: ctx.scheduleUpdate };
        ctx.instances.set(path, instance);
      }
      ctx.visited.add(path);

      const output = renderComponent(instance, vnode.type, {
        ...vnode.props,
        children: vnode.children,
      });
      return expand(output, `${path}/r`, ctx);
    }
  }
}

function childPath(parent: string, child: VNode, index: number): string {
  if (child.kind !== "text" && child.key !== null) return `${parent}/k:${child.key}`;
  return `${parent}/i:${index}`;
}