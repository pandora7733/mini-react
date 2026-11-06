import type { HostElementVNode, HostVNode, TextVNode } from "./types.js";

export function createDom(vnode: TextVNode): Text;
export function createDom(vnode: HostElementVNode): HTMLElement;
export function createDom(vnode: HostVNode): Text | HTMLElement;
export function createDom(vnode: HostVNode): Text | HTMLElement {
  if (vnode.kind === "text") {
    return document.createTextNode(vnode.value);
  }

  const el = document.createElement(vnode.type);

  for (const [name, value] of Object.entries(vnode.props)) {
    patchProp(el, name, undefined, value);
  }

  for (const child of vnode.children) {
    el.appendChild(createDom(child));
  }

  return el;
}

type StyleObject = Record<string, string | number>;

export function patchProp(
  dom: HTMLElement,
  name: string,
  prev: unknown,
  next: unknown,
): void {
  if (prev === next) return;

  if (name === "className") {
    dom.className = next == null ? "" : String(next);
    return;
  }

  if (name === "style") {
    patchStyle(dom, prev, next);
    return;
  }

  if (isEventProp(name)) {
    const type = name.slice(2).toLowerCase();       // "onClick" → "click"
    if (typeof prev === "function") dom.removeEventListener(type, prev as EventListener);
    if (typeof next === "function") dom.addEventListener(type, next as EventListener);
    return;
  }

  if ((name === "value" || name === "checked") && dom instanceof HTMLInputElement) {
    if (name === "value") dom.value = next == null ? "" : String(next);
    else dom.checked = Boolean(next);
    return;
  }

  if (next == null || next === false) {
    dom.removeAttribute(name);
  } else if (next === true) {
    dom.setAttribute(name, "");
  } else {
    dom.setAttribute(name, String(next));
  }
}

function isEventProp(name: string): boolean {
  return /^on[A-Z]/.test(name);
}

function isStyleObject(v: unknown): v is StyleObject {
  return typeof v === "object" && v !== null;
}

function patchStyle(dom: HTMLElement, prev: unknown, next: unknown): void {
  const style = dom.style as unknown as Record<string, string>;

  if (typeof next === "string") {
    dom.style.cssText = next;
    return;
  }

  const prevObj = isStyleObject(prev) ? prev : {};
  const nextObj = isStyleObject(next) ? next : {};

  for (const key in prevObj) {
    if (!(key in nextObj)) style[key] = "";
  }
  for (const key in nextObj) {
    if (prevObj[key] !== nextObj[key]) style[key] = String(nextObj[key]);
  }
}