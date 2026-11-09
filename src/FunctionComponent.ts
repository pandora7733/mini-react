import type { Component, ComponentVNode, VNode } from "./types.js";
import { renderComponent, type Hook } from "./hooks.js";

// 함수 컴포넌트는 호출이 끝나면 지역 변수가 사라진다.
// 그래서 호출 사이에 남아야 하는 것(hooks 등)을 이 객체가 대신 들고 있는다.
export class FunctionComponent<P extends object = any> {
  hooks: Hook[] = [];
  pendingEffects: Array<() => void> = [];   // 이번 렌더에서 실행이 필요한 effect
  dirty = false;                            // setState가 일어나서 다시 렌더해야 한다
  unmounted = false;

  private vnode: ComponentVNode<P> | null = null;   // 마지막으로 렌더한 vnode (null = 다시 렌더 필요)
  private output: VNode | null = null;              // 마지막 렌더 결과. 렌더를 건너뛸 때 그대로 다시 쓴다

  constructor(
    readonly type: Component<P>,
    readonly scheduleUpdate: () => void,
    readonly hooksAllowed: boolean = true,
  ) {}

  get isMounted(): boolean {
    return this.vnode !== null;
  }

  // 처음 렌더링
  mount(vnode: ComponentVNode<P>): VNode | null {
    return this.run(vnode);
  }

  // 상태 변경 후 다시 렌더링
  update(vnode: ComponentVNode<P>): VNode | null {
    // 부모가 다시 렌더되지 않았으면 vnode가 같은 객체다. dirty도 아니면 호출하지 않는다
    if (this.dirty || this.vnode !== vnode) this.run(vnode);
    return this.output;
  }

  unmount(): void {
    this.unmounted = true;
    for (const hook of this.hooks) {
      if (hook.tag === "effect") {
        hook.cleanup?.();
        hook.cleanup = undefined;
      }
    }
  }

  private run(vnode: ComponentVNode<P>): VNode | null {
    this.dirty = false;   // 렌더 전에 지워서, 렌더 중 setState는 다음 렌더로 남긴다
    this.vnode = null;    // 렌더가 throw하면 다음에 다시 시도하도록 비워 둔다
    this.output = renderComponent(this, this.type, { ...vnode.props, children: vnode.children });
    this.vnode = vnode;
    return this.output;
  }
}
