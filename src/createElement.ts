import type { ElementVNode, Key, Props, TextVNode, VNode, VNodeChild } from "./types.js";

type RawProps = Props & { key?: Key | null };

export function createElement(
  type: string,
  props: RawProps | null,
  ...children: VNodeChild[]
): ElementVNode {
  const raw: RawProps = props ?? {};
  const { key = null, ...rest } = raw;

  return {
    kind: "element",
    type,
    props: rest,
    children: normalizeChildren(children),
    key,
  };
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