import type { ChildPatch, ChildrenPatch, HostVNode, Key, KeyedChildPatch, Patch, PropPatch, Props } from "./types.js";

export function diff(oldVNode: HostVNode | undefined, newVNode: HostVNode | undefined): Patch | null {
  // 1. 한쪽이 없는 경우
  if (oldVNode === undefined) {
    return newVNode === undefined ? null : { type: "CREATE", vnode: newVNode };
  }
  if (newVNode === undefined) {
    return { type: "REMOVE" };
  }

  // 2. 완전히 같은 객체면 비교할 필요 없음
  if (oldVNode === newVNode) return null;

  // 3. 빈 자리: 둘 다 비었으면 변경 없음, 한쪽만 비었으면 교체
  if (oldVNode.kind === "empty" && newVNode.kind === "empty") return null;
  if (oldVNode.kind === "empty" || newVNode.kind === "empty") {
    return { type: "REPLACE", vnode: newVNode };
  }

  // 4. 둘 다 텍스트
  if (oldVNode.kind === "text" && newVNode.kind === "text") {
    return oldVNode.value === newVNode.value
      ? null
      : { type: "TEXT", value: newVNode.value };
  }

  // 5. 하나만 텍스트 → 종류가 다름
  if (oldVNode.kind === "text" || newVNode.kind === "text") {
    return { type: "REPLACE", vnode: newVNode };
  }

  // 여기부터 둘 다 HostElementVNode로 좁혀짐

  // 6. 태그나 key가 다르면 다른 노드
  if (oldVNode.type !== newVNode.type || oldVNode.key !== newVNode.key) {
    return { type: "REPLACE", vnode: newVNode };
  }

  // 7. 같은 노드 → props와 children 비교
  const props = diffProps(oldVNode.props, newVNode.props);
  const children = diffChildren(oldVNode.children, newVNode.children);

  if (props.length === 0 && isUnchanged(children)) {
    return null;
  }

  return { type: "UPDATE", props, children };
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

function diffChildren(oldChildren: HostVNode[], newChildren: HostVNode[]): ChildrenPatch {
  // key가 하나라도 있으면 key로 짝을 맞추고, 없으면 기존처럼 인덱스로 비교
  if (oldChildren.some(hasKey) || newChildren.some(hasKey)) {
    return diffKeyedChildren(oldChildren, newChildren);
  }
  return { mode: "index", patches: diffIndexedChildren(oldChildren, newChildren) };
}

function diffIndexedChildren(oldChildren: HostVNode[], newChildren: HostVNode[]): ChildPatch[] {
  const patches: ChildPatch[] = [];
  const length = Math.max(oldChildren.length, newChildren.length);

  for (let i = 0; i < length; i++) {
    patches.push(diff(oldChildren[i], newChildren[i]));
  }

  return patches;
}

function diffKeyedChildren(oldChildren: HostVNode[], newChildren: HostVNode[]): ChildrenPatch {
  const oldIndexByKey = new Map<Key, number>();
  oldChildren.forEach((child, i) => {
    const key = keyOf(child);
    if (key !== null) oldIndexByKey.set(key, i);
  });

  const reused = new Set<number>();
  const order: KeyedChildPatch[] = newChildren.map((child, i) => {
    // key가 있으면 같은 key를, 없으면 같은 인덱스의 key 없는 노드를 짝으로 본다 (expand의 경로 규칙과 동일)
    const key = keyOf(child);
    const from = key !== null
      ? oldIndexByKey.get(key)
      : i < oldChildren.length && keyOf(oldChildren[i]) === null ? i : undefined;

    if (from !== undefined && canReuse(oldChildren[from], child)) {
      reused.add(from);
      return { type: "REUSE", from, patch: diff(oldChildren[from], child) };
    }
    return { type: "INSERT", vnode: child };
  });

  const removed: number[] = [];
  oldChildren.forEach((_, i) => {
    if (!reused.has(i)) removed.push(i);
  });

  return { mode: "keyed", removed, order };
}

// 재사용 = 같은 DOM 노드를 제자리에서 고칠 수 있다 (REPLACE가 필요하면 재사용하지 않고 새로 만든다)
function canReuse(oldVNode: HostVNode, newVNode: HostVNode): boolean {
  if (oldVNode.kind === "element" && newVNode.kind === "element") {
    return oldVNode.type === newVNode.type && oldVNode.key === newVNode.key;
  }
  return oldVNode.kind === newVNode.kind;
}

function isUnchanged(children: ChildrenPatch): boolean {
  if (children.mode === "index") return children.patches.every(c => c === null);
  return children.removed.length === 0
    && children.order.every((c, i) => c.type === "REUSE" && c.from === i && c.patch === null);
}

function keyOf(vnode: HostVNode): Key | null {
  return vnode.kind === "element" ? vnode.key : null;
}

function hasKey(vnode: HostVNode): boolean {
  return keyOf(vnode) !== null;
}
