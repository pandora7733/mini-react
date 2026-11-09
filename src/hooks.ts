import type { Component, VNode } from "./types.js";
import type { FunctionComponent } from "./FunctionComponent.js";

type SetStateAction<S> = S | ((prev: S) => S);
type Deps = readonly unknown[];
type EffectCallback = () => void | (() => void);

interface StateHook<S> {
  tag: "state";
  value: S;
  setState: (action: SetStateAction<S>) => void;
}

interface EffectHook {
  tag: "effect";
  deps: Deps | undefined;
  cleanup: (() => void) | undefined;
}

interface MemoHook<T> {
  tag: "memo";
  value: T;
  deps: Deps;
}

export type Hook = StateHook<any> | EffectHook | MemoHook<any>;

let currentInstance: FunctionComponent | null = null;
let hookIndex = 0;

export function renderComponent<P extends object>(
  instance: FunctionComponent, component: Component<P>, props: P,
): VNode | null {
  currentInstance = instance;
  hookIndex = 0;
  instance.pendingEffects = [];
  try {
    return component(props);
  } finally {
    currentInstance = null;
    hookIndex = 0;
  }
}

function nextHook<T extends Hook["tag"]>(tag: T): {
  instance: FunctionComponent;
  index: number;
  prev: Extract<Hook, { tag: T }> | undefined;
} {
  if (currentInstance === null) {
    throw new Error("훅은 컴포넌트가 렌더링되는 중에만 호출할 수 있습니다");
  }
  const instance = currentInstance;
  if (!instance.hooksAllowed) {
    throw new Error(`rootOnlyHooks 모드에서는 루트 컴포넌트만 훅을 쓸 수 있습니다: ${instance.type.name}`);
  }
  const index = hookIndex++;
  const prev = instance.hooks[index];
  if (prev !== undefined && prev.tag !== tag) {
    throw new Error(`훅 호출 순서가 바뀌었습니다: ${index}번째 훅이 ${prev.tag}에서 ${tag}(으)로 바뀜`);
  }
  return { instance, index, prev: prev as Extract<Hook, { tag: T }> | undefined };
}

export function useState<S>(
  initial: S | (() => S),
): [S, (action: SetStateAction<S>) => void] {
  const { instance, index, prev } = nextHook("state");

  if (prev !== undefined) {
    const hook = prev as StateHook<S>;
    return [hook.value, hook.setState];
  }

  const hook: StateHook<S> = {
    tag: "state",
    value: typeof initial === "function" ? (initial as () => S)() : initial,
    setState: action => {
      if (instance.unmounted) return;
      const next = typeof action === "function"
        ? (action as (prev: S) => S)(hook.value)
        : action;
      if (Object.is(next, hook.value)) return;
      hook.value = next;
      instance.dirty = true;
      instance.scheduleUpdate();
    },
  };
  instance.hooks[index] = hook;
  return [hook.value, hook.setState];
}

export function useEffect(effect: EffectCallback, deps?: Deps): void {
  const { instance, index, prev } = nextHook("effect");

  if (prev !== undefined && !depsChanged(prev.deps, deps)) return;

  const hook: EffectHook = prev ?? { tag: "effect", deps, cleanup: undefined };
  hook.deps = deps;
  instance.hooks[index] = hook;

  instance.pendingEffects.push(() => {
    hook.cleanup?.();
    const cleanup = effect();
    hook.cleanup = typeof cleanup === "function" ? cleanup : undefined;
  });
}

export function useMemo<T>(factory: () => T, deps: Deps): T {
  const { instance, index, prev } = nextHook("memo");

  if (prev !== undefined && !depsChanged(prev.deps, deps)) {
    return prev.value as T;
  }

  const hook: MemoHook<T> = { tag: "memo", value: factory(), deps };
  instance.hooks[index] = hook;
  return hook.value;
}

export function useCallback<F extends (...args: never[]) => unknown>(callback: F, deps: Deps): F {
  return useMemo(() => callback, deps);
}

function depsChanged(prev: Deps | undefined, next: Deps | undefined): boolean {
  if (prev === undefined || next === undefined) return true;   // deps 생략 = 매 렌더 실행
  return prev.length !== next.length || prev.some((d, i) => !Object.is(d, next[i]));
}
