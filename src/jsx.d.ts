// TypeScript는 <div> 같은 JSX 문법을 검사할 때 전역 JSX 네임스페이스를 본다.
// 파일 최상단에 import를 쓰면 모듈이 되어 전역 선언이 사라지므로 import()로 타입만 참조한다.
declare namespace JSX {
  // JSX 식의 타입이자, 컴포넌트가 반환할 수 있는 타입
  type Element = import("./types.js").VNode;

  // 태그 사이의 내용을 어떤 prop으로 검사할지 알려 준다
  interface ElementChildrenAttribute {
    children: {};
  }

  // 모든 컴포넌트에 쓸 수 있는 prop
  interface IntrinsicAttributes {
    key?: import("./types.js").Key | null;
  }

  // "click" → onClick: (event: PointerEvent) => void
  type EventProps = {
    [K in keyof HTMLElementEventMap as `on${Capitalize<K>}`]?: (event: HTMLElementEventMap[K]) => void;
  };

  interface HostProps extends EventProps {
    key?: import("./types.js").Key | null;
    children?: import("./types.js").VNodeChild;
    className?: string;
    style?: string | Record<string, string | number>;
    // patchProp은 나머지를 모두 속성으로 넘기므로 그 외 이름도 허용한다
    [attribute: string]: unknown;
  }

  // HTML 태그 이름만 허용 (<foo>는 컴파일 에러)
  type IntrinsicElements = Record<keyof HTMLElementTagNameMap, HostProps>;
}
