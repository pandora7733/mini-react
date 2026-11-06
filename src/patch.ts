import type { ChildPatch, Patch } from "./types.js";
import { createDom, patchProp } from "./dom.js";

export function patch(parent: Node, dom: ChildNode | undefined, p: Patch): void {
  switch (p.type) {
    case "CREATE": {
      parent.appendChild(createDom(p.vnode));
      return;
    }

    case "REMOVE": {
      parent.removeChild(requireNode(dom));
      return;
    }

    case "REPLACE": {
      parent.replaceChild(createDom(p.vnode), requireNode(dom));
      return;
    }

    case "TEXT": {
      const node = requireNode(dom);
      if (!(node instanceof Text)) throw new Error("TEXT patch의 대상이 텍스트 노드가 아닙니다");
      node.nodeValue = p.value;
      return;
    }

    case "UPDATE": {
      const node = requireNode(dom);
      if (!(node instanceof HTMLElement)) throw new Error("UPDATE patch의 대상이 엘리먼트가 아닙니다");

      for (const { name, prev, next } of p.props) {
        patchProp(node, name, prev, next);
      }
      patchChildren(node, p.children);
      return;
    }

    default: {
      const _exhaustive: never = p;
      throw new Error(`알 수 없는 patch: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

function patchChildren(parent: HTMLElement, patches: ChildPatch[]): void {
  const childNodes = Array.from(parent.childNodes);

  for (let i = 0; i < patches.length; i++) {
    const p = patches[i];
    if (p === null || p === undefined) continue;
    patch(parent, childNodes[i], p);
  }
}

function requireNode(dom: ChildNode | undefined): ChildNode {
  if (dom === undefined) throw new Error("patch 대상 DOM 노드가 없습니다");
  return dom;
}