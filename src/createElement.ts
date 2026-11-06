import type { Component, ComponentVNode, ElementVNode, Key, Props, TextVNode, VNode, VNodeChild } from "./types.js";

type KeyProp = { key?: Key | null };
type RawProps = Props & KeyProp;

// props가 전부 optional인 컴포넌트만 null을 허용
type ComponentProps<P> = {} extends P ? (P & KeyProp) | null : P & KeyProp;

export function createElement(
  type: string, props: RawProps | null, ...children: VNodeChild[]
): ElementVNode;
export function createElement<P extends object>(
  type: Component<P>, props: ComponentProps<P>, ...children: VNodeChild[]
): ComponentVNode<P>;
export function createElement(
  type: string | Component, props: object | null, ...children: VNodeChild[]
): VNode {
  const { key = null, ...rest } = (props ?? {}) as RawProps;
  const normalized = normalizeChildren(children);

  if (typeof type === "function") {
    return { kind: "component", type, props: rest, children: normalized, key };
  }
  return { kind: "element", type, props: rest, children: normalized, key };
}

export function createTextVNode(value: string): TextVNode {
  return { kind: "text", value };
}

function normalizeChildren(children: VNodeChild[]): VNode[] {
  const out: VNode[] = [];
  for (const child of children) {
    flatten(child, out);
  }
  return out;
}

function flatten(child: VNodeChild, out: VNode[]): void {
  if (Array.isArray(child)) {
    for (const c of child) flatten(c, out);
    return;
  }

  if (child === null || child === undefined || typeof child === "boolean") {
    return;
  }

  if (typeof child === "string" || typeof child === "number") {
    out.push(createTextVNode(String(child)));
    return;
  }

  out.push(child);
}

export { createElement as h };