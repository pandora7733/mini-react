import type { VNode } from "./types.js";
import { createDom } from "./dom.js";
import { diff } from "./diff.js";
import { patch } from "./patch.js";

const roots = new WeakMap<HTMLElement, VNode>();

export function render(vnode: VNode, container: HTMLElement): void {
  const prevVNode = roots.get(container);

  if (prevVNode === undefined) {
    container.replaceChildren(createDom(vnode));
  } else {
    const p = diff(prevVNode, vnode);
    if (p !== null) { 
      patch(container, container.firstChild ?? undefined, p);
    }
  }

  roots.set(container, vnode);
}