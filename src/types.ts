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

// 자신의 DOM 노드 없이 자식 여러 개를 묶는다. expand에서 부모의 children으로 펼쳐진다
export interface FragmentVNode {
  kind: "fragment";
  children: VNode[];
  key: Key | null;
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
export type VNode = ElementVNode | TextVNode | ComponentVNode | EmptyVNode | FragmentVNode;

// expand 후: diff/patch가 다루는 트리
// slot = expand 경로. 렌더가 달라도 slot이 같으면 "같은 자리의 노드"다
interface Slot {
  slot: string;
}

export type HostElementVNode = ElementBase<HostVNode> & Slot;
export type HostTextVNode = TextVNode & Slot;
export type HostEmptyVNode = EmptyVNode & Slot;
export type HostVNode = HostElementVNode | HostTextVNode | HostEmptyVNode;

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

// 재사용된 노드를 제자리에서 고치는 패치. 노드 교체는 ChildOp의 INSERT + removed로 표현한다
export type Patch =
  | { type: "TEXT"; value: string }
  | { type: "UPDATE"; props: PropPatch[]; children: ChildrenPatch };

// 새 children의 i번째 자리를 무엇으로 채울지
export type ChildOp =
  | { type: "REUSE"; from: number; patch: Patch | null }   // 기존 from번째 노드를 재사용 (필요하면 이동)
  | { type: "INSERT"; vnode: HostVNode };                   // 새 노드 생성

export interface ChildrenPatch {
  removed: number[];
  order: ChildOp[];
}
