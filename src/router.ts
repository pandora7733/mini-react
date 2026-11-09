import { Fragment, h } from "./createElement.js";
import { useEffect, useState } from "./hooks.js";
import type { VNode, VNodeChild } from "./types.js";

// 해시 기반 라우터. 경로를 # 뒤에 두면 서버로 전송되지 않으므로,
// 정적 파일 서버에서도 새로고침과 직접 접속이 404 없이 동작한다.

export type Params = Record<string, string>;

export interface RouteProps {
  path: string;
  element: VNode;
}

// --- 경로 매칭 ---

// "/posts/:id"는 값 하나, ":id?"는 있어도 없어도 되는 값, "*"는 나머지 전부와 맞는다. 맞지 않으면 null
export function matchPath(pattern: string, pathname: string): Params | null {
  const patternParts = toSegments(pattern);
  const pathParts = toSegments(pathname);
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
      params[part.slice(1, optional ? -1 : undefined)] = decode(value);
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

// --- 주소 구독 ---

// 구독자들의 setState가 한 번의 렌더로 합쳐지도록 리스너를 하나만 둔다.
// 컴포넌트마다 리스너를 달면 리스너 사이에 렌더가 끼어들어, 자식이 부모보다 먼저 새 주소로 렌더될 수 있다
const subscribers = new Set<() => void>();

function notifySubscribers(): void {
  subscribers.forEach(notify => notify());
}

function subscribe(notify: () => void): () => void {
  if (subscribers.size === 0) window.addEventListener("hashchange", notifySubscribers);
  subscribers.add(notify);
  return () => {
    subscribers.delete(notify);
    if (subscribers.size === 0) window.removeEventListener("hashchange", notifySubscribers);
  };
}

function currentHref(): string {
  return location.hash.slice(1) || "/";
}

export function useLocation(): { pathname: string; search: string } {
  const [href, setHref] = useState(currentHref);
  useEffect(() => subscribe(() => setHref(currentHref())), []);

  const queryStart = href.indexOf("?");
  return queryStart < 0
    ? { pathname: href, search: "" }
    : { pathname: href.slice(0, queryStart), search: href.slice(queryStart) };
}

// --- 이동 ---

export function navigate(to: string | number, options: { replace?: boolean } = {}): void {
  if (typeof to === "number") history.go(to);   // navigate(-1) = 뒤로가기
  else if (options.replace) location.replace(`#${to}`);
  else location.hash = to;
}

export function useNavigate(): typeof navigate {
  return navigate;
}

// 진짜 <a>를 그린다: 해시만 바뀌므로 문서를 다시 불러오지 않고, 새 탭 열기와 키보드 이동도 그대로 동작한다
export function Link({ to, children, ...rest }: {
  to: string;
  children?: VNodeChild;
  [attribute: string]: unknown;
}): VNode {
  return h("a", { ...rest, href: `#${to}` }, children);
}

// --- 라우트 ---

// Routes가 props를 읽기 위한 표식이므로 실제로 호출되지는 않는다
export function Route(_props: RouteProps): null {
  return null;
}

// Context가 없으므로 모듈 변수로 전달한다. Routes가 페이지보다 먼저 렌더되므로 페이지는 항상 새 값을 읽는다
let currentParams: Params = {};

export function useParams(): Params {
  useLocation();   // element는 같은 vnode라서 Routes만 다시 렌더되면 페이지가 호출되지 않는다. 직접 구독한다
  return currentParams;
}

export function Routes({ children }: { children?: VNodeChild }): VNode | null {
  const { pathname } = useLocation();

  // 문서를 다시 불러오지 않으므로 브라우저가 스크롤을 올려 주지 않는다
  useEffect(() => window.scrollTo(0, 0), [pathname]);

  for (const route of collectRoutes(children)) {
    const params = matchPath(route.path, pathname);
    if (params !== null) {
      currentParams = params;
      // 반환값 자신의 key는 경로에 쓰이지 않으므로 한 겹 감싼다. 라우트가 바뀌면 이전 페이지 전체가 언마운트된다
      return h(Fragment, null, h(Fragment, { key: route.path }, route.element));
    }
  }
  currentParams = {};
  return null;
}

function collectRoutes(child: VNodeChild): RouteProps[] {
  if (Array.isArray(child)) return child.flatMap(collectRoutes);
  if (child === null || typeof child !== "object" || child.kind === "empty") return [];
  if (child.kind === "fragment") return collectRoutes(child.children);
  if (child.kind === "component" && child.type === Route) return [child.props as RouteProps];
  throw new Error("Routes의 자식은 Route여야 합니다");
}
