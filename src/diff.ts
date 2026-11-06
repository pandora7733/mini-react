import type { ChildPatch, HostVNode, Patch, PropPatch, Props } from "./types.js";

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

  // 3. 둘 다 텍스트
  if (oldVNode.kind === "text" && newVNode.kind === "text") {
    return oldVNode.value === newVNode.value
      ? null
      : { type: "TEXT", value: newVNode.value };
  }

  // 4. 하나만 텍스트 → 종류가 다름
  if (oldVNode.kind === "text" || newVNode.kind === "text") {
    return { type: "REPLACE", vnode: newVNode };
  }

  // 여기부터 둘 다 HostElementVNode로 좁혀짐

  // 5. 태그나 key가 다르면 다른 노드
  if (oldVNode.type !== newVNode.type || oldVNode.key !== newVNode.key) {
    return { type: "REPLACE", vnode: newVNode };
  }

  // 6. 같은 노드 → props와 children 비교
  const props = diffProps(oldVNode.props, newVNode.props);
  const children = diffChildren(oldVNode.children, newVNode.children);

  if (props.length === 0 && children.every(c => c === null)) {
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

function diffChildren(oldChildren: HostVNode[], newChildren: HostVNode[]): ChildPatch[] {
  const patches: ChildPatch[] = [];
  const length = Math.max(oldChildren.length, newChildren.length);

  for (let i = 0; i < length; i++) {
    patches.push(diff(oldChildren[i], newChildren[i]));
  }

  return patches;
}