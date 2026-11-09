import { h } from "./createElement.js";
import { render, unmount, type RenderOptions } from "./render.js";
import type { VNode, VNodeChild } from "./types.js";

// 해시 기반 라우터. 경로를 # 뒤에 두면 서버로 전송되지 않으므로,
// 정적 파일 서버에서도 새로고침과 직접 접속이 404 없이 동작한다.
//
// 라우터는 컴포넌트가 아니고 훅도 쓰지 않는다. 라우트의 element를 그대로 render의 최상위로 넘기므로
// 각 페이지가 곧 루트 컴포넌트이고, "훅과 상태는 루트에만" 제약을 페이지마다 강제할 수 있다.

export type Params = Record<string, string>;

export interface RouteProps {
  path: string;
  element: VNode;
}

// --- 경로 매칭 ---

// "/posts/:id"는 값 하나, ":id?"는 있어도 없어도 되는 값, "*"는 나머지 전부와 맞는다. 맞지 않으면 null
export function matchPath(pattern: string, pathname: string): Params | null {
  const patternParts = toSegments(pattern);
  const pathParts = toSegments(pathname).map(decode);   // location.hash는 한글을 %ED...로 인코딩해서 돌려준다
  const params: Params = {};

  for (let i = 0; i < patternParts.length; i++) {
    const part = patternParts[i];
    const value = pathParts[i];

    if (part === "*") {
      params["*"] = pathParts.slice(i).join("/");
      return params;
    }
    if (part.startsWith(":")) {
      const optional = part.endsWith("?");
      if (value === undefined) {
        if (optional) continue;
        return null;
      }
      params[part.slice(1, optional ? -1 : undefined)] = value;
    } else if (part !== value) {
      return null;
    }
  }
  return pathParts.length <= patternParts.length ? params : null;
}

function toSegments(path: string): string[] {
  return path.split("/").filter(segment => segment !== "");
}

function decode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;   // 주소는 사용자가 직접 고칠 수 있으므로 깨진 인코딩이어도 죽지 않는다
  }
}

// --- 이동 ---

export function navigate(to: string | number, options: { replace?: boolean } = {}): void {
  if (typeof to === "number") history.go(to);   // navigate(-1) = 뒤로가기
  else if (options.replace) location.replace(`#${to}`);
  else location.hash = to;
}

// 진짜 <a>를 그린다: 해시만 바뀌므로 문서를 다시 불러오지 않고, 새 탭 열기와 키보드 이동도 그대로 동작한다
export function Link({ to, children, ...rest }: {
  to: string;
  children?: VNodeChild;
  [attribute: string]: unknown;
}): VNode {
  return h("a", { ...rest, href: `#${to}` }, children);
}

// 현재 페이지를 떠나도 되는지 묻는다. false를 돌려주면 이동을 취소한다
let leaveGuard: (() => boolean) | null = null;

export function setLeaveGuard(guard: (() => boolean) | null): void {
  leaveGuard = guard;
}

// --- 라우트 ---

// 둘 다 startRouter가 props를 읽기 위한 표식이므로 실제로 호출되지는 않는다
export function Route(_props: RouteProps): null {
  return null;
}

export function Routes(_props: { children?: VNodeChild }): null {
  return null;
}

// 주소가 바뀔 때마다 맞는 라우트를 container에 그린다. 돌려주는 함수를 호출하면 멈춘다
export function startRouter(routes: VNode, container: HTMLElement, options: RenderOptions = {}): () => void {
  const table = collectRoutes(routes);
  let currentHref: string | null = null;
  let currentPath: string | null = null;

  const sync = () => {
    const href = location.hash.slice(1) || "/";
    if (href === currentHref) return;   // 이동을 취소하며 주소를 되돌린 경우

    const pathname = href.split("?")[0];
    const match = findRoute(table, pathname);
    const nextPath = match === null ? null : match.route.path;
    const routeChanged = currentHref === null || nextPath !== currentPath;

    if (routeChanged && leaveGuard !== null && !leaveGuard()) {
      location.replace(`#${currentHref}`);
      return;
    }

    currentHref = href;
    if (routeChanged) {
      unmount(container);   // 이전 페이지의 effect를 정리한다
      currentPath = nextPath;
      window.scrollTo(0, 0);   // 문서를 다시 불러오지 않으므로 브라우저가 스크롤을 올려 주지 않는다
    }
    // 파라미터만 바뀌면 같은 루트에 다시 그리므로 페이지의 상태가 유지된다
    if (match !== null) render(withParams(match.route.element, match.params), container, options);
  };

  window.addEventListener("hashchange", sync);
  sync();

  return () => {
    window.removeEventListener("hashchange", sync);
    unmount(container);
  };
}

function findRoute(table: RouteProps[], pathname: string): { route: RouteProps; params: Params } | null {
  for (const route of table) {
    const params = matchPath(route.path, pathname);
    if (params !== null) return { route, params };
  }
  return null;
}

// 훅과 Context를 쓰지 않으므로 파라미터는 페이지의 props로 전달한다
function withParams(element: VNode, params: Params): VNode {
  return element.kind === "component" ? { ...element, props: { ...element.props, params } } : element;
}

function collectRoutes(child: VNodeChild): RouteProps[] {
  if (Array.isArray(child)) return child.flatMap(collectRoutes);
  if (child === null || typeof child !== "object" || child.kind === "empty") return [];
  if (child.kind === "fragment") return collectRoutes(child.children);
  if (child.kind === "component" && child.type === Routes) return collectRoutes(child.children);
  if (child.kind === "component" && child.type === Route) return [child.props as RouteProps];
  throw new Error("Routes의 자식은 Route여야 합니다");
}
