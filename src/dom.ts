import type { HostElementVNode, HostEmptyVNode, HostTextVNode, HostVNode } from "./types.js";

const SVG_NS = "http://www.w3.org/2000/svg";

// parent는 SVG 안에 들어갈 노드의 네임스페이스를 정하는 데 쓴다
export function createDom(vnode: HostTextVNode, parent?: Node): Text;
export function createDom(vnode: HostEmptyVNode, parent?: Node): Comment;
export function createDom(vnode: HostElementVNode, parent?: Node): Element;
export function createDom(vnode: HostVNode, parent?: Node): Text | Comment | Element;
export function createDom(vnode: HostVNode, parent?: Node): Text | Comment | Element {
  if (vnode.kind === "text") {
    return document.createTextNode(vnode.value);
  }

  // 빈 자리는 화면에 보이지 않는 주석 노드로 표현한다
  if (vnode.kind === "empty") {
    return document.createComment("");
  }

  const el = isSvgTag(vnode.type, parent)
    ? document.createElementNS(SVG_NS, vnode.type)
    : document.createElement(vnode.type);

  // <select>의 value는 <option>이 있어야 적용되므로 자식을 먼저 붙인다
  for (const child of vnode.children) {
    el.appendChild(createDom(child, el));
  }

  // <input>의 value는 type, min, max에 따라 보정되므로 다른 속성 뒤에 넣는다
  for (const [name, value] of Object.entries(vnode.props)) {
    if (name !== "value") patchProp(el, name, undefined, value);
  }
  if ("value" in vnode.props) patchProp(el, "value", undefined, vnode.props.value);

  return el;
}

function isSvgTag(type: string, parent: Node | undefined): boolean {
  if (type === "svg") return true;
  return parent instanceof SVGElement && parent.localName !== "foreignObject";
}

type StyleObject = Record<string, string | number>;

export function patchProp(
  dom: Element,
  name: string,
  prev: unknown,
  next: unknown,
): void {
  if (prev === next) return;

  if (name === "style") {
    patchStyle(dom as HTMLElement | SVGElement, prev, next);
    return;
  }

  if (isEventProp(name)) {
    const type = name.slice(2).toLowerCase();       // "onClick" → "click"
    if (typeof prev === "function") dom.removeEventListener(type, prev as EventListener);
    if (typeof next === "function") dom.addEventListener(type, next as EventListener);
    return;
  }

  // 사용자가 입력하면 속성과 화면 값이 분리되므로 property를 직접 고친다.
  // <input>은 innerHTML에도 현재 값이 보이도록 속성까지 맞춘다
  if (name === "value" && isValueElement(dom)) {
    const value = next == null ? "" : String(next);
    if (dom instanceof HTMLInputElement) {
      if (value === "") dom.removeAttribute("value");
      else dom.setAttribute("value", value);
    }
    if (dom.value !== value) dom.value = value;   // 같은 값을 다시 쓰면 커서가 끝으로 튄다
    return;
  }
  if (name === "checked" && dom instanceof HTMLInputElement) {
    dom.toggleAttribute("checked", Boolean(next));
    dom.checked = Boolean(next);
    return;
  }

  const attribute = ATTRIBUTE_ALIASES[name] ?? name;
  if (next == null || next === false) {
    dom.removeAttribute(attribute);
  } else if (next === true) {
    dom.setAttribute(attribute, "");
  } else {
    dom.setAttribute(attribute, String(next));
  }
}

// className은 SVG에서 읽기 전용이므로 속성으로 통일한다
const ATTRIBUTE_ALIASES: Record<string, string> = { className: "class", htmlFor: "for" };

function isValueElement(dom: Element): dom is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
  return dom instanceof HTMLInputElement
    || dom instanceof HTMLTextAreaElement
    || dom instanceof HTMLSelectElement;
}

function isEventProp(name: string): boolean {
  return /^on[A-Z]/.test(name);
}

function isStyleObject(v: unknown): v is StyleObject {
  return typeof v === "object" && v !== null;
}

function patchStyle(dom: HTMLElement | SVGElement, prev: unknown, next: unknown): void {
  const style = dom.style as unknown as Record<string, string>;

  // cssText는 값을 정규화하므로("red" → "red;") DOM에서 다시 읽으면 바뀐 것처럼 보인다. 속성으로 그대로 쓴다
  if (typeof next === "string") {
    dom.setAttribute("style", next);
    return;
  }

  if (next == null) {
    // dom.style로 바꾼 직후에는 속성이 지연 동기화되어 removeAttribute만으로는 style=""가 되살아난다
    dom.setAttribute("style", "");
    dom.removeAttribute("style");
    return;
  }

  // 문자열 스타일은 키를 알 수 없으므로 전부 지우고 시작한다
  if (typeof prev === "string") dom.removeAttribute("style");

  const prevObj = isStyleObject(prev) ? prev : {};
  const nextObj = isStyleObject(next) ? next : {};

  for (const key in prevObj) {
    if (!(key in nextObj)) style[key] = "";
  }
  for (const key in nextObj) {
    if (prevObj[key] !== nextObj[key]) style[key] = String(nextObj[key]);
  }
}