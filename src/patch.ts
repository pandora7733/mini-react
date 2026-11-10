import type { ChildrenPatch, Patch } from "./types.js";
import { createDom, patchProp } from "./dom.js";

export function patchChildren(parent: Node, { removed, order }: ChildrenPatch): void {
  // diff의 from은 "patch 전" 인덱스이므로, DOM을 바꾸기 전에 스냅샷을 뜬다
  const oldNodes = Array.from(parent.childNodes);

  for (const i of removed) {
    parent.removeChild(requireNode(oldNodes[i]));
  }

  order.forEach((child, i) => {
    let node: ChildNode;
    if (child.type === "INSERT") {
      node = createDom(child.vnode, parent);
    } else {
      node = requireNode(oldNodes[child.from]);
      if (child.patch !== null) patchNode(node, child.patch);
    }

    // 이미 i번째에 있으면 그대로, 아니면 i번째 자리로 이동(또는 삽입)
    const current = parent.childNodes[i] ?? null;
    if (current !== node) parent.insertBefore(node, current);
  });
}

function patchNode(node: ChildNode, p: Patch): void {
  switch (p.type) {
    case "TEXT": {
      if (!(node instanceof Text)) throw new Error("TEXT patch의 대상이 텍스트 노드가 아닙니다");
      node.nodeValue = p.value;
      return;
    }

    case "UPDATE": {
      if (!(node instanceof Element)) throw new Error("UPDATE patch의 대상이 엘리먼트가 아닙니다");

      // <select>의 value는 새 <option>이 붙은 뒤에 적용해야 하므로 자식을 먼저 고친다
      patchChildren(node, p.children);
      for (const { name, prev, next } of p.props) {
        patchProp(node, name, prev, next);
      }
      return;
    }

    default: {
      const _exhaustive: never = p;
      throw new Error(`알 수 없는 patch: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

function requireNode(dom: ChildNode | undefined): ChildNode {
  if (dom === undefined) throw new Error("patch 대상 DOM 노드가 없습니다");
  return dom;
}
