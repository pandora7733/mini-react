import type { ChildOp, ChildrenPatch, HostVNode, Patch, PropPatch, Props } from "./types.js";

export function diffChildren(oldChildren: HostVNode[], newChildren: HostVNode[]): ChildrenPatch {
  const oldIndexBySlot = new Map<string, number>();
  oldChildren.forEach((child, i) => oldIndexBySlot.set(child.slot, i));

  const reused = new Set<number>();
  const order: ChildOp[] = newChildren.map(child => {
    const from = oldIndexBySlot.get(child.slot);
    if (from !== undefined && canReuse(oldChildren[from], child)) {
      reused.add(from);
      return { type: "REUSE", from, patch: diffNode(oldChildren[from], child) };
    }
    return { type: "INSERT", vnode: child };
  });

  const removed: number[] = [];
  oldChildren.forEach((_, i) => {
    if (!reused.has(i)) removed.push(i);
  });

  return { removed, order };
}

// 재사용 = 같은 DOM 노드를 제자리에서 고칠 수 있다
function canReuse(oldVNode: HostVNode, newVNode: HostVNode): boolean {
  if (oldVNode.kind === "element" && newVNode.kind === "element") {
    return oldVNode.type === newVNode.type;
  }
  return oldVNode.kind === newVNode.kind;
}

function diffNode(oldVNode: HostVNode, newVNode: HostVNode): Patch | null {
  if (oldVNode.kind === "text" && newVNode.kind === "text") {
    return oldVNode.value === newVNode.value
      ? null
      : { type: "TEXT", value: newVNode.value };
  }

  if (oldVNode.kind === "element" && newVNode.kind === "element") {
    const props = diffProps(oldVNode.props, newVNode.props);
    const children = diffChildren(oldVNode.children, newVNode.children);

    if (props.length === 0 && isUnchanged(children)) {
      return null;
    }

    return { type: "UPDATE", props, children };
  }

  return null;   // 빈 자리끼리는 고칠 것이 없다
}

function diffProps(oldProps: Props, newProps: Props): PropPatch[] {
  const patches: PropPatch[] = [];

  for (const name in oldProps) {
    if (!(name in newProps)) {
      patches.push({ name, prev: oldProps[name], next: undefined });
    }
  }

  for (const name in newProps) {
    if (oldProps[name] !== newProps[name]) {
      patches.push({ name, prev: oldProps[name], next: newProps[name] });
    }
  }

  return patches;
}

function isUnchanged(children: ChildrenPatch): boolean {
  return children.removed.length === 0
    && children.order.every((c, i) => c.type === "REUSE" && c.from === i && c.patch === null);
}
