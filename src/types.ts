export type Key = string | number;

export type Props = Record<string, unknown>;

export interface ElementVNode {
  kind: "element";
  type: string;
  props: Props;
  children: VNode[];
  key: Key | null;
}

export interface TextVNode {
  kind: "text";
  value: string;
}

export type VNode = ElementVNode | TextVNode;

export type VNodeChild =
  | VNode
  | string
  | number
  | boolean
  | null
  | undefined
  | VNodeChild[];

export interface PropPatch {
  name: string;
  prev: unknown;
  next: unknown;
}

export type Patch =
  | { type: "CREATE"; vnode: VNode }
  | { type: "REMOVE" }
  | { type: "REPLACE"; vnode: VNode }
  | { type: "TEXT"; value: string }
  | { type: "UPDATE"; props: PropPatch[]; children: ChildPatch[] };

export type ChildPatch = Patch | null;   // null = 이 자식은 변경 없음