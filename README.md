# mini-react

Virtual DOM, Diff, Patch, 함수형 Component, Hooks를 외부 라이브러리 없이 TypeScript로 직접 구현한 학습용 React입니다. (Krafton Jungle week 11)

- **Phase 1. Diff 검증 페이지:** HTML을 고치고 Patch를 누르면 바뀐 부분만 실제 영역에 반영합니다. 뒤로가기와 앞으로가기를 지원합니다.
- **Phase 2. Focus Board:** 루트 컴포넌트에만 상태를 둔 할 일 보드와 타이머입니다. 갱신마다 실제 DOM 변경 수를 보여 줍니다.

## 실행

```bash
npm install
npm run build
npm run serve
```

`http://localhost:5173`에 접속합니다. 개발 중에는 다른 터미널에서 `npm run dev`로 자동 빌드를 켭니다.

| 주소 | 내용 |
|---|---|
| `/phase1.html` | Diff 검증 페이지 |
| `/phase2.html` | Focus Board |
| `/budget.html` | 예시 앱: 가계부 |
| `/tests.html` | 브라우저 단위 테스트와 기능 테스트 |

## 구조

```
h(App)  ──expand──▶  HostVNode[]  ──diffChildren──▶  ChildrenPatch  ──patchChildren──▶  DOM
        컴포넌트 실행             이전 트리와 비교                     바뀐 부분만 반영
```

| 파일 | 역할 |
|---|---|
| `src/types.ts` | VNode, HostVNode, Patch 타입 |
| `src/createElement.ts` | `h()`, JSX가 컴파일되는 함수 |
| `src/domToVNode.ts` | 실제 DOM → Virtual DOM 변환 |
| `src/serializeHtml.ts` | 입력값까지 담아 DOM을 HTML 문자열로 변환 |
| `src/expand.ts` | 컴포넌트를 실행해 DOM 노드만 남은 트리로 펼치고, 경로를 `slot`으로 붙임 |
| `src/diff.ts` | 두 트리를 비교해 패치 생성 |
| `src/patch.ts`, `src/dom.ts` | 패치를 실제 DOM에 반영 |
| `src/FunctionComponent.ts` | 컴포넌트 인스턴스. `hooks` 배열, `mount()`, `update()`, `unmount()` |
| `src/hooks.ts` | `useState`, `useEffect`, `useMemo`, `useCallback` |
| `src/render.ts` | 렌더 → 커밋 → effect 순서 제어, 배칭 |
| `src/history.ts` | State History |
| `src/describePatch.ts` | 패치를 사람이 읽는 변경 내역으로 변환 |
| `src/pages/` | Phase 1, Phase 2 페이지 |

## Phase 1

### Diff의 다섯 가지 핵심 케이스

| 케이스 | 판단 기준 | 패치 표현 |
|---|---|---|
| 추가 | 새 트리의 slot이 이전 트리에 없음 | `INSERT` |
| 삭제 | 이전 트리의 slot이 새 트리에 없음 | `removed` |
| 교체 | 같은 slot인데 종류나 태그가 다름 | 같은 slot의 `removed` + `INSERT` |
| 텍스트 변경 | 같은 slot의 텍스트 값이 다름 | `REUSE` + `TEXT` |
| 속성 변경 | 같은 slot, 같은 태그에서 속성이 다름 | `REUSE` + `UPDATE` |

여기에 더해 `key`가 있으면 순서가 바뀌어도 같은 노드를 재사용하고 `insertBefore`로 옮깁니다. HTML에서는 `data-key` 속성이 key가 됩니다.

### 설계 결정

- **DOM 노드와 vnode를 1:1로 대응시킵니다.** patch는 "vnode의 i번째 = DOM의 i번째"를 전제로 합니다. 그래서 공백 텍스트도 노드로 변환하고 주석은 빈 자리로 둡니다. 공백 노드에는 key가 없어 인덱스로 비교되므로, key로 항목을 옮길 때 항목 사이에 공백이 있으면 공백 노드의 변경까지 함께 기록됩니다.
- **입력값은 속성이 아니라 property에서 읽습니다.** 사용자가 타이핑한 값은 `value` 속성에 남지 않기 때문입니다. 같은 이유로 `innerHTML`에도 입력값이 빠지므로, HTML 코드 입력창에는 복사본에 입력값을 옮겨 적어 직렬화한 결과를 보여 줍니다. 원본의 `textarea` 자식을 고치면 "vnode의 i번째 = DOM의 i번째" 전제가 깨질 수 있어 복사본을 씁니다.
- **적용하지 않은 편집은 이동 전에 확인합니다.** 테스트 영역을 현재 기록과 Diff해서 실제로 다를 때만 묻습니다. 입력했다가 되돌린 경우에는 묻지 않습니다.
- **입력한 HTML은 `<template>`에서 파싱합니다.** 문서에 바로 넣으면 `onerror` 같은 핸들러가 실행됩니다. 변환할 때 `script`와 `on*` 속성도 뺍니다. 사용자 본인의 입력을 다루는 검증 도구를 위한 조치이고, `javascript:` 링크 등을 막는 완전한 HTML 정제 기능은 아닙니다.
- **변화 감지에 `MutationObserver`를 씁니다.** 테스트 영역 편집을 HTML 코드에 동기화하고, 패치가 실제로 일으킨 DOM 변경 수를 셉니다.

## Phase 2

### 상태는 어떻게 유지되는가

함수 컴포넌트는 호출이 끝나면 지역 변수가 사라집니다. 그래서 값은 함수 밖의 `FunctionComponent.hooks` 배열에 두고, 렌더마다 인덱스를 0부터 다시 세며 "호출 순서"로 찾아갑니다. 조건문 안에서 훅을 호출하면 안 되는 이유가 이것이며, 순서가 바뀌면 에러를 냅니다.

### 루트 전용 상태 제약

명세의 제약(Hook과 State는 루트에서만, 자식은 props만 받는 순수 함수)은 Focus Board에서 지킵니다. 약속에 그치지 않도록 엔진 옵션으로 강제합니다.

```tsx
render(<App />, root, { rootOnlyHooks: true });   // 자식이 훅을 호출하면 에러
```

옵션을 끄면 자식 컴포넌트도 자신의 상태를 가질 수 있습니다. 경로 기반 인스턴스 관리와 변경된 컴포넌트 하위만 다시 렌더하는 기능은 이 경우를 위한 추가 구현입니다.

### `setState`가 하는 일

1. 새 값을 저장합니다. 같은 값이면 여기서 끝납니다.
2. 컴포넌트를 `dirty`로 표시합니다.
3. 마이크로태스크로 다시 렌더를 예약합니다. 이미 예약되어 있으면 추가하지 않으므로, 한 이벤트 안의 `setState` 여러 번이 렌더 한 번으로 합쳐집니다(배칭).

## 예시 앱: 가계부

`src/pages/budget.tsx`는 mini-react를 라이브러리처럼 써서 만든 앱입니다. Focus Board가 루트 전용 상태 제약을 지키는 페이지라면, 이 앱은 제약 없이 쓸 때의 모습을 보여 줍니다.

- **자식 컴포넌트의 자체 상태:** 입력 중인 값과 항목별 수정 모드는 `EntryForm`, `EntryRow`가 직접 가집니다. 여러 컴포넌트가 함께 쓰는 내역과 선택한 달만 루트에 둡니다.
- **커스텀 훅:** `useStoredState`는 `useState`와 `useEffect`를 묶어 `localStorage`에 저장되는 상태를 만듭니다.
- **그 외:** Fragment, `key`로 재사용되는 목록, SVG 막대 차트, `useMemo`로 계산한 합계.

## 개념 정리

- **실제 DOM 변경이 비싼 이유:** DOM API 호출 자체보다 그 뒤의 렌더링 비용이 큽니다. 크기나 위치가 바뀌면 레이아웃을 다시 계산하고(Reflow), 다시 칠합니다(Repaint). 색처럼 모양만 바뀌면 Repaint만 일어납니다.
- **Virtual DOM이 필요한 이유:** 화면을 "상태의 결과"로 선언하면 무엇을 고칠지 직접 관리하지 않아도 됩니다. 새 트리를 통째로 다시 그리면 비용이 크고 입력값과 포커스도 사라지므로, 가벼운 객체 트리끼리 비교해 필요한 변경만 적용합니다. 잘 최적화한 수동 DOM 조작보다 항상 빠른 것은 아닙니다. 핵심 이점은 개발 모델과 충분히 좋은 성능의 조합입니다.
- **상태를 둘 위치:** 여러 컴포넌트가 함께 쓰는 값은 가장 가까운 공통 부모로 올립니다(Lifting State Up).

## 실제 React와의 차이

| 항목 | mini-react | React |
|---|---|---|
| 렌더링 | 한 번에 끝까지 실행하는 동기 방식 | Fiber 기반으로 작업을 나누고 우선순위를 둠 |
| 인스턴스 식별 | 트리 경로 문자열 | Fiber 노드 |
| 재조정 | 경로로 같은 자리를 찾음 | 타입과 key로 비교. 타입이 다르면 하위 전체 교체 |
| 빈 자리 | 주석 노드를 실제로 만듦 | DOM 노드를 만들지 않음 |
| 이벤트 | 노드마다 `addEventListener` | 루트에서 위임하는 합성 이벤트 |
| 이벤트 이름 | 브라우저 이름을 따름 (`onKeydown`, `onChange`는 포커스가 빠질 때 발생) | 카멜 표기 (`onKeyDown`, `onChange`는 입력할 때마다 발생) |
| 배칭 | 마이크로태스크 | 스케줄러와 우선순위(lane) |
| `useEffect` 시점 | 커밋 직후 동기 실행 | 보통 페인트 이후 비동기 실행 |
| 제어 컴포넌트 | 사용자 입력을 상태 값으로 되돌리지 않음 | 렌더 후 상태 값으로 되돌림 |
| 그 외 | Context, Ref, Suspense, 에러 경계, 서버 렌더링 없음 | 지원 |

## 테스트

```bash
npm test
```

순수 로직(`createElement`, `expand`, `diff`, `describePatch`, `history`, `hooks`, `FunctionComponent`)을 Node 내장 `node:test`로 검증합니다.

DOM이 필요한 부분은 의존성 없이 Node에서 돌릴 수 없어, 서버를 켠 뒤 `/tests.html`을 열어 실제 브라우저에서 실행합니다. DOM 변환, 속성, Patch, 렌더링의 단위 테스트와, 두 페이지를 iframe으로 열어 조작하는 기능 테스트가 있습니다. 이 페이지는 자동으로 실행되지만 CI에는 연결되어 있지 않습니다.

## 알려진 한계

- 재정렬 시 이동 횟수를 최소화하지 않습니다(LIS 미적용). 결과는 맞지만 DOM 이동이 더 많을 수 있습니다.
- key가 없는 목록의 중간을 삭제하면 인덱스 기준으로 비교하므로 뒤 항목들의 내용이 고쳐집니다.
- `<select multiple>`의 선택 상태는 property가 아니라 `selected` 속성으로만 비교합니다.
- SVG 외의 네임스페이스(MathML)는 지원하지 않습니다.
- `rootOnlyHooks`는 렌더 트리의 최상위 컴포넌트만 루트로 봅니다.
