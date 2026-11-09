import type { Props, VNode } from "./types.js";
import { createTextVNode, EMPTY } from "./createElement.js";

// 브라우저 DOM을 읽어 Virtual DOM으로 변환한다.
// patch는 "vnode의 i번째 자식 = DOM의 i번째 자식"을 전제로 하므로
// 공백 텍스트와 주석까지 노드 하나당 vnode 하나로 1:1 대응시킨다.
export function domToVNode(node: Node): VNode {
  if (node.nodeType === Node.TEXT_NODE) {
    return createTextVNode(node.nodeValue ?? "");
  }
  if (node.nodeType === Node.ELEMENT_NODE) {
    return elementToVNode(node as Element);
  }
  return EMPTY;   // 주석 등 화면에 보이지 않는 노드는 빈 자리로 둔다
}

export function domChildrenToVNodes(parent: Node): VNode[] {
  return Array.from(parent.childNodes, domToVNode);
}

function elementToVNode(el: Element): VNode {
  // 다시 DOM으로 만들 때 입력한 HTML이 실행되지 않도록 스크립트와 인라인 핸들러는 옮기지 않는다
  if (el.localName === "script") return EMPTY;

  const props: Props = {};
  for (const { name, value } of Array.from(el.attributes)) {
    if (!name.startsWith("on")) props[name] = value;
  }
  readFormState(el, props);

  return {
    kind: "element",
    type: el.localName,   // tagName은 HTML에서 대문자라서 쓰지 않는다. SVG는 대소문자를 유지한다
    props,
    children: domChildrenToVNodes(el),
    key: el.getAttribute("data-key"),
  };
}

// 사용자가 입력한 값은 속성이 아니라 property에만 남는다
function readFormState(el: Element, props: Props): void {
  if (el instanceof HTMLInputElement) {
    if (el.type === "checkbox" || el.type === "radio") props.checked = el.checked;
    else if (el.type !== "file") props.value = el.value;   // file input의 value는 스크립트로 쓸 수 없다
  } else if (el instanceof HTMLTextAreaElement) {
    props.value = el.value;
  } else if (el instanceof HTMLSelectElement && !el.multiple) {
    props.value = el.value;   // multiple은 value로 표현할 수 없어 option의 selected 속성에 맡긴다
  }
}
