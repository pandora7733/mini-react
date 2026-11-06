import type { Component, VNode } from "./types.js";

export interface Instance {
  type: Component;
  hooks: unknown[];          // 8단계에서 Hook 유니온으로 바꿈
  scheduleUpdate: () => void;
}

let currentInstance: Instance | null = null;
let hookIndex = 0;

export function renderComponent<P extends object>(
  instance: Instance, component: Component<P>, props: P,
): VNode {
  currentInstance = instance;
  hookIndex = 0;
  try {
    return component(props);
  } finally {
    currentInstance = null;
    hookIndex = 0;
  }
}

function nextHook(): { instance: Instance; index: number } {
  if (currentInstance === null) {
    throw new Error("훅은 컴포넌트가 렌더링되는 중에만 호출할 수 있습니다");
  }
  return { instance: currentInstance, index: hookIndex++ };
}

type SetStateAction<S> = S | ((prev: S) => S);

interface StateHook<S> {
  value: S;
  setState: (action: SetStateAction<S>) => void;
}

export function useState<S>(
  initial: S | (() => S),
): [S, (action: SetStateAction<S>) => void] {
  const { instance, index } = nextHook();

  if (index >= instance.hooks.length) {
    const hook: StateHook<S> = {
      value: typeof initial === "function" ? (initial as () => S)() : initial,
      setState: action => {
        const next = typeof action === "function"
          ? (action as (prev: S) => S)(hook.value)
          : action;
        if (Object.is(next, hook.value)) return;
        hook.value = next;
        instance.scheduleUpdate();
      },
    };
    instance.hooks[index] = hook;
  }

  const hook = instance.hooks[index] as StateHook<S>;
  return [hook.value, hook.setState];
}