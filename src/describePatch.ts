import type { ChildrenPatch, HostVNode, Patch } from "./types.js";

export type ChangeKind = "ADD" | "REMOVE" | "REPLACE" | "TEXT" | "ATTR" | "MOVE";

export interface Change {
  kind: ChangeKind;
  path: string;
  detail: string;
}

// 패치를 Diff의 핵심 케이스(추가, 삭제, 교체, 텍스트, 속성)와 이동으로 풀어서 설명한다.
// 교체는 패치에서 "같은 slot의 삭제 + 삽입"으로 표현되므로 여기서 다시 묶는다.
export function describePatch(oldChildren: HostVNode[], { removed, order }: ChildrenPatch): Change[] {
  const changes: Change[] = [];
  const removedBySlot = new Map(removed.map(i => [oldChildren[i].slot, oldChildren[i]]));
  let lastFrom = -1;

  for (const op of order) {
    if (op.type === "INSERT") {
      const replaced = removedBySlot.get(op.vnode.slot);
      removedBySlot.delete(op.vnode.slot);
      changes.push(replaced === undefined
        ? { kind: "ADD", path: op.vnode.slot, detail: label(op.vnode) }
        : { kind: "REPLACE", path: op.vnode.slot, detail: `${label(replaced)} → ${label(op.vnode)}` });
      continue;
    }

    const prev = oldChildren[op.from];
    // 남은 노드끼리의 상대 순서가 뒤집혔을 때만 이동이다 (앞 노드 삭제로 인덱스만 밀린 경우 제외)
    if (op.from < lastFrom) {
      changes.push({ kind: "MOVE", path: prev.slot, detail: label(prev) });
    } else {
      lastFrom = op.from;
    }
    if (op.patch !== null) changes.push(...describeNode(prev, op.patch));
  }

  for (const [slot, vnode] of removedBySlot) {
    changes.push({ kind: "REMOVE", path: slot, detail: label(vnode) });
  }
  return changes;
}

function describeNode(prev: HostVNode, patch: Patch): Change[] {
  if (patch.type === "TEXT") {
    return [{ kind: "TEXT", path: prev.slot, detail: `${label(prev)} → ${quote(patch.value)}` }];
  }

  const attrs: Change[] = patch.props.map(({ name, next }) => ({
    kind: "ATTR",
    path: prev.slot,
    detail: next === undefined ? `${name} 제거` : `${name} = ${quote(String(next))}`,
  }));
  const children = prev.kind === "element" ? describePatch(prev.children, patch.children) : [];
  return [...attrs, ...children];
}

function label(vnode: HostVNode): string {
  switch (vnode.kind) {
    case "element": return `<${vnode.type}>`;
    case "text": return quote(vnode.value);
    case "empty": return "빈 자리";
  }
}

function quote(text: string): string {
  const flat = text.replace(/\s+/g, " ");
  return `"${flat.length > 40 ? `${flat.slice(0, 40)}…` : flat}"`;
}
