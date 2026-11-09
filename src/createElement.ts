import type { Component, ComponentVNode, ElementVNode, EmptyVNode, FragmentVNode, Key, Props, TextVNode, VNode, VNodeChild } from "./types.js";

type KeyProp = { key?: Key | null };
type RawProps = Props & KeyProp;

// props가 전부 optional인 컴포넌트만 null을 허용
type ComponentProps<P> = {} extends P ? (P & KeyProp) | null : P & KeyProp;

// createElement가 이 함수를 표식으로만 쓰므로 실제로 호출되지는 않는다
export function Fragment(_props: { children?: VNodeChild }): null {
  return null;
}

export function createElement(
  type: string, props: RawProps | null, ...children: VNodeChild[]
): ElementVNode;
export function createElement(
  type: typeof Fragment, props: KeyProp | null, ...children: VNodeChild[]
): FragmentVNode;
export function createElement<P extends object>(
  type: Component<P>, props: ComponentProps<P>, ...children: VNodeChild[]
): ComponentVNode<P>;
export function createElement(
  type: string | Component, props: object | null, ...children: VNodeChild[]
): VNode {
  const { key = null, ...rest } = (props ?? {}) as RawProps;
  const normalized = normalizeChildren(children);

  if (type === Fragment) {
    return { kind: "fragment", children: normalized, key };
  }
  if (typeof type === "function") {
    return { kind: "component", type, props: rest, children: normalized, key };
  }
  return { kind: "element", type, props: rest, children: normalized, key };
}

export function createTextVNode(value: string): TextVNode {
  return { kind: "text", value };
}

export const EMPTY: EmptyVNode = { kind: "empty" };

function normalizeChildren(children: VNodeChild[]): VNode[] {
  const out: VNode[] = [];
  for (const child of children) {
    flatten(child, out);
  }
  return out;
}

function flatten(child: VNodeChild, out: VNode[]): void {
  // 배열은 자리 하나를 차지하는 묶음이다: 길이가 바뀌어도 뒤 형제의 인덱스가 밀리지 않는다
  if (Array.isArray(child)) {
    out.push({ kind: "fragment", children: normalizeChildren(child), key: null });
    return;
  }

  // 제거하지 않고 빈 자리로 남겨서 뒤 형제들의 인덱스를 지킨다
  if (child === null || child === undefined || typeof child === "boolean") {
    out.push(EMPTY);
    return;
  }

  if (typeof child === "string" || typeof child === "number") {
    out.push(createTextVNode(String(child)));
    return;
  }

  out.push(child);
}

export { createElement as h };