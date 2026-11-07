export type Key = string | number;
export type Props = Record<string, unknown>;

interface ElementBase<C> {
  kind: "element";
  type: string;
  props: Props;
  children: C[];
  key: Key | null;
}

export interface TextVNode {
  kind: "text";
  value: string;
}

// null/undefined/boolean 자식과 null을 반환한 컴포넌트의 "빈 자리"
export interface EmptyVNode {
  kind: "empty";
}

export type Component<P extends object = any> = (props: P) => VNode | null;

export interface ComponentVNode<P extends object = any> {
  kind: "component";
  type: Component<P>;
  props: P;
  children: VNode[];
  key: Key | null;
}

// expand 전: 사용자가 h()로 만든 트리
export type ElementVNode = ElementBase<VNode>;
export type VNode = ElementVNode | TextVNode | ComponentVNode | EmptyVNode;

// expand 후: diff/patch가 다루는 트리
export type HostElementVNode = ElementBase<HostVNode>;
export type HostVNode = HostElementVNode | TextVNode | EmptyVNode;

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

// Patch의 vnode는 HostVNode로 변경
export type Patch =
  | { type: "CREATE"; vnode: HostVNode }
  | { type: "REMOVE" }
  | { type: "REPLACE"; vnode: HostVNode }
  | { type: "TEXT"; value: string }
  | { type: "UPDATE"; props: PropPatch[]; children: ChildPatch[] };

export type ChildPatch = Patch | null;   // null = 이 자식은 변경 없음