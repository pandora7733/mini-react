import { Fragment, h } from "../createElement.js";
import { useEffect } from "../hooks.js";
import { Link } from "../router.js";
import type { VNodeChild } from "../types.js";

// 면접 대비 노트. 내용이 바뀌지 않는 문서라서 상태는 없고, 루트는 문서 제목과 글꼴만 effect로 다룬다.
// 자식은 모두 props만 받는 순수 컴포넌트다 (rootOnlyHooks).

type ChipKind = "theory" | "spec" | "extra";

const CHIP_LABEL: Record<ChipKind, string> = {
  theory: "React 이론",
  spec: "명세 구현",
  extra: "요청 구현",
};

const FONT_ID = "guide-fonts";
const FONT_HREF = "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap";

const TOC: Array<{ title: string; items: Array<[id: string, label: string]> }> = [
  {
    title: "1부 · React 이론",
    items: [
      ["r-declarative", "선언형 UI와 UI = f(state)"],
      ["r-element", "JSX와 React Element"],
      ["r-vdom", "Virtual DOM과 재조정"],
      ["r-fiber", "Fiber와 render·commit 단계"],
      ["r-hooks", "Hooks의 내부 원리"],
      ["r-batching", "렌더 시점과 자동 배칭"],
      ["r-events", "이벤트 시스템"],
      ["r-router", "React Router와 SPA"],
      ["r-compare", "React와 mini-react 비교"],
    ],
  },
  {
    title: "2부 · 명세 구현",
    items: [
      ["a-pipeline", "전체 흐름 한눈에"],
      ["a-vnode", "VNode 타입 설계"],
      ["a-h", "createElement와 JSX"],
      ["a-dom2v", "DOM → Virtual DOM"],
      ["a-slot", "expand와 slot(경로)"],
      ["a-diff", "Diff 알고리즘"],
      ["a-patch", "Patch와 patchProp"],
      ["a-history", "State History"],
      ["a-phase1", "Phase 1 검증 페이지"],
      ["a-fc", "FunctionComponent 클래스"],
      ["a-hooks", "useState·useEffect·useMemo"],
      ["a-render", "render와 배칭"],
      ["a-rootonly", "루트 전용 Hook 강제"],
      ["a-phase2", "Phase 2 Focus Board"],
      ["a-edge", "엣지 케이스와 보안"],
      ["a-tests", "테스트 전략"],
    ],
  },
  {
    title: "3부 · 요청 구현",
    items: [
      ["b-router", "해시 라우터"],
      ["b-unmount", "unmount와 남은 예약"],
      ["b-guard", "이탈 확인 (Leave Guard)"],
      ["b-budget", "가계부 예시 앱"],
    ],
  },
  {
    title: "4부 · 마무리",
    items: [
      ["qa-rapid", "빠른 문답 20선"],
      ["limits", "한계와 개선 방향"],
    ],
  },
];

// --- 순수 컴포넌트 ---

// 해시는 라우터가 쓰므로 목차는 주소를 바꾸지 않고 해당 절로 스크롤만 한다
function TocLink({ id, label }: { id: string; label: string }) {
  return (
    <a
      href="#/interview"
      onClick={event => {
        event.preventDefault();
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        document.getElementById(id)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
      }}
    >
      {label}
    </a>
  );
}

function Toc() {
  return (
    <nav className="g-toc" aria-label="목차">
      {TOC.map(group => (
        <div key={group.title}>
          <h2>{group.title}</h2>
          <ol>
            {group.items.map(([id, label]) => <li key={id}><TocLink id={id} label={label} /></li>)}
          </ol>
        </div>
      ))}
    </nav>
  );
}

function Chip({ kind }: { kind: ChipKind }) {
  return <span className={`g-chip ${kind}`}>{CHIP_LABEL[kind]}</span>;
}

function Part({ id, label, title, children }: { id: string; label: string; title: string; children?: VNodeChild }) {
  return (
    <div className="g-part" id={id}>
      <div className="g-part-label">{label}</div>
      <h2>{title}</h2>
      {children}
    </div>
  );
}

function Topic({ id, title, file, chip, children }: {
  id: string;
  title: string;
  file?: string;
  chip?: ChipKind;
  children?: VNodeChild;
}) {
  return (
    <section className="g-topic" id={id}>
      <h3>
        {title}
        {file !== undefined && <span className="g-file">{file}</span>}
        {chip !== undefined && <Chip kind={chip} />}
      </h3>
      {children}
    </section>
  );
}

function Easy({ children }: { children?: VNodeChild }) {
  return (
    <div className="g-easy">
      <span className="g-easy-label">쉽게 말하면</span>
      <p>{children}</p>
    </div>
  );
}

function QA({ title = "면접 질문", children }: { title?: string | null; children?: VNodeChild }) {
  return (
    <div className="g-qa">
      {title !== null && <h4>{title}</h4>}
      {children}
    </div>
  );
}

function Q({ q, children }: { q: string; children?: VNodeChild }) {
  return (
    <div className="g-q">
      <b>{q}</b>
      <p>{children}</p>
    </div>
  );
}

function C({ children }: { children?: VNodeChild }) {
  return <code>{children}</code>;
}

// 줄마다 // 뒤를 주석 색으로 칠한다
function Code({ code, tree = false }: { code: string; tree?: boolean }) {
  const lines = code.replace(/^\n|\n\s*$/g, "").split("\n");
  return (
    <pre className={tree ? "g-tree" : undefined}>
      <code>
        {lines.map((line, i) => {
          const at = line.indexOf("//");
          const end = i < lines.length - 1 ? "\n" : "";
          return at < 0
            ? line + end
            : <>{line.slice(0, at)}<span className="g-c">{line.slice(at)}</span>{end}</>;
        })}
      </code>
    </pre>
  );
}

function Table({ head, rows }: { head: string[]; rows: VNodeChild[][] }) {
  return (
    <div className="g-table-wrap">
      <table>
        <tr>{head.map(cell => <th>{cell}</th>)}</tr>
        {rows.map(row => <tr>{row.map(cell => <td>{cell}</td>)}</tr>)}
      </table>
    </div>
  );
}

function Flow({ steps }: { steps: Array<[title: string, detail: string]> }) {
  return (
    <div className="g-flow" role="list">
      {steps.map(([title, detail], i) => (
        <>
          {i > 0 && <div className="g-arrow" aria-hidden="true">→</div>}
          <div className="g-step" role="listitem"><b>{title}</b><span>{detail}</span></div>
        </>
      ))}
    </div>
  );
}

// --- 1부: React 이론 ---

function ReactTheory() {
  return (
    <>
      <Part id="part-react" label="PART 1" title="React는 어떻게 동작하는가">
        <p className="g-intro">먼저 진짜 React(18 기준)의 원리를 정리합니다. mini-react의 설계는 모두 이 원리를 작게 따라 만든 것이라, 이 부분을 이해하면 2부가 훨씬 쉬워집니다.</p>
      </Part>

      <Topic id="r-declarative" title="선언형 UI와 UI = f(state)" chip="theory">
        <Easy>
          예전 방식(명령형)은 "버튼을 누르면 이 <C>li</C>를 찾아서 글자를 바꾸고, 저 클래스를 지워라"처럼 <strong>어떻게 바꿀지</strong>를 하나하나 지시합니다. React(선언형)는 "지금 상태가 이렇다면 화면은 이렇게 생겼다"만 적습니다. 바꾸는 방법은 React가 알아서 계산합니다.
        </Easy>
        <p>React 컴포넌트는 상태(state)와 입력(props)을 받아 화면 설계도를 돌려주는 <strong>함수</strong>입니다. 상태가 바뀌면 함수를 다시 호출해 새 설계도를 얻고, 이전 설계도와 비교해서 달라진 부분만 실제 DOM에 반영합니다.</p>
        <Code code={`
화면 = Component(state, props)
상태 변경 → Component 다시 호출 → 새 설계도 → 이전 설계도와 비교 → 바뀐 DOM만 수정`} />
        <p>이 구조의 장점은 세 가지입니다.</p>
        <ul>
          <li><strong>예측 가능성</strong>: 같은 상태면 항상 같은 화면이 나옵니다. 버그가 나면 "어떤 상태였는지"만 보면 됩니다.</li>
          <li><strong>DOM 조작 코드가 사라짐</strong>: 개발자는 상태만 바꾸고, DOM을 어떻게 고칠지는 라이브러리가 계산합니다.</li>
          <li><strong>조합</strong>: 작은 함수(컴포넌트)를 조립해 큰 화면을 만듭니다.</li>
        </ul>
        <QA>
          <Q q="명령형과 선언형 UI의 차이는?">명령형은 DOM을 어떻게 바꿀지 단계별로 지시하고, 선언형은 상태에 따라 화면이 어떤 모습이어야 하는지만 기술합니다. 선언형에서는 "이전 화면 → 다음 화면"의 변경 계산을 라이브러리가 대신 하며, 그 계산이 바로 Virtual DOM diff입니다.</Q>
        </QA>
      </Topic>

      <Topic id="r-element" title="JSX와 React Element" chip="theory">
        <Easy>
          JSX는 HTML처럼 보이지만 실제로는 <strong>함수 호출을 짧게 쓰는 문법</strong>입니다. 컴파일러가 JSX를 함수 호출로 바꾸고, 그 함수는 "어떤 태그를 어떤 속성으로 그려라"라는 평범한 객체를 돌려줍니다.
        </Easy>
        <Code code={`
<button className="primary">저장</button>
// 컴파일 결과 (React 17+ 자동 런타임)
jsx("button", { className: "primary", children: "저장" })
// 반환값: 그냥 객체 (React Element)
{ type: "button", props: { className: "primary", children: "저장" }, key: null }`} />
        <p>이 객체는 실제 DOM이 아니라 <strong>설계도</strong>입니다. 만드는 비용이 아주 싸서 렌더할 때마다 새로 만들어도 됩니다. <C>type</C>이 문자열이면 HTML 태그, 함수면 컴포넌트입니다.</p>
        <p>mini-react에서는 <C>tsconfig.json</C>의 <C>"jsx": "react"</C>, <C>"jsxFactory": "h"</C> 설정으로 JSX가 <C>{'h("button", {...}, "저장")'}</C>로 바뀝니다. React 16 이전의 고전 런타임과 같은 방식입니다.</p>
        <QA>
          <Q q="JSX는 브라우저가 이해하나요?">아닙니다. TypeScript나 Babel 같은 컴파일러가 JSX를 함수 호출로 바꾼 뒤에야 브라우저가 실행할 수 있습니다. 저는 tsc의 jsxFactory 옵션으로 JSX가 제가 만든 <C>h</C> 함수를 호출하게 했습니다.</Q>
        </QA>
      </Topic>

      <Topic id="r-vdom" title="Virtual DOM과 재조정(Reconciliation)" chip="theory">
        <Easy>
          실제 DOM을 바로 고치면 비쌉니다(레이아웃 계산, 다시 그리기). 그래서 먼저 <strong>JS 객체로 된 가짜 화면</strong>(Virtual DOM)을 새로 만들고, 이전 가짜 화면과 비교해서 <strong>틀린 그림 찾기</strong>를 합니다. 다른 곳만 실제 DOM에 고칩니다.
        </Easy>
        <p>두 트리를 완벽하게 비교하는 일반 알고리즘은 O(n³)이라 실제로 쓸 수 없습니다. React는 두 가지 가정(휴리스틱)으로 O(n)에 끝냅니다.</p>
        <ol>
          <li><strong>타입이 다르면 다른 트리다.</strong> <C>{"<div>"}</C>가 <C>{"<span>"}</C>으로 바뀌면 비교하지 않고 그 아래를 통째로 새로 만듭니다. 컴포넌트 타입이 바뀌어도 마찬가지로 상태가 버려집니다.</li>
          <li><strong>key가 같으면 같은 항목이다.</strong> 목록에서 순서가 바뀌어도 key로 짝을 찾아 DOM과 상태를 재사용하고 이동만 합니다.</li>
        </ol>
        <p>같은 레벨끼리만 비교하고, 다른 부모 아래로 옮겨 간 노드는 "삭제 후 새로 생성"으로 처리합니다. 이 판단 과정을 <strong>재조정(reconciliation)</strong>이라고 부릅니다.</p>
        <p><strong>Virtual DOM이 항상 빠른 것은 아닙니다.</strong> 손으로 정확히 필요한 DOM만 고치는 코드가 이론상 가장 빠릅니다. Virtual DOM의 가치는 "선언형으로 써도 <strong>충분히 빠르다</strong>"는 데 있습니다.</p>
        <QA>
          <Q q="Virtual DOM은 왜 쓰나요? 실제 DOM보다 빠른가요?">선언형으로 매번 화면 전체를 다시 기술해도, 실제 DOM에는 바뀐 부분만 반영할 수 있게 하려고 씁니다. 직접 최적화한 DOM 조작보다 빠르지는 않지만, 개발자가 DOM 변경을 신경 쓰지 않아도 대부분의 경우 충분한 성능을 보장합니다.</Q>
          <Q q="key를 index로 쓰면 왜 문제가 되나요?">항목을 앞에 추가하거나 순서를 바꾸면 index가 밀려서, 다른 항목을 같은 항목으로 착각합니다. 그러면 입력창 값이나 컴포넌트 상태가 엉뚱한 항목에 붙습니다. 저는 Focus Board에서 <C>{"key={task.id}"}</C>를 써서, 순서를 바꿔도 같은 항목의 DOM 노드가 재사용되고 이동만 일어나게 했습니다.</Q>
        </QA>
      </Topic>

      <Topic id="r-fiber" title="Fiber 아키텍처와 render·commit 단계" chip="theory">
        <Easy>
          React 16부터는 컴포넌트 하나하나를 <strong>Fiber라는 작업 카드</strong>로 만듭니다. 카드 단위로 일을 하므로, 중간에 더 급한 일(사용자 입력)이 오면 잠깐 멈췄다가 이어서 할 수 있습니다.
        </Easy>
        <p>React의 한 번의 업데이트는 두 단계로 나뉩니다.</p>
        <Table
          head={["단계", "하는 일", "특징"]}
          rows={[
            [<strong>Render 단계</strong>, "컴포넌트 함수를 호출하고, 새 트리를 이전 트리와 비교해 바뀐 점을 표시", "DOM을 건드리지 않음. 순수해야 함. React 18 동시성 모드에서는 중단·재시작 가능"],
            [<strong>Commit 단계</strong>, "표시해 둔 변경을 실제 DOM에 한 번에 반영", "중단되지 않고 동기적으로 실행. 화면이 반쯤 바뀐 상태를 사용자가 보지 않음"],
            ["Effect", <><C>useLayoutEffect</C>는 commit 직후·그리기 전, <C>useEffect</C>는 화면을 그린 뒤 실행</>, "effect 안에서는 DOM을 읽어도 됨"],
          ]}
        />
        <p>Fiber 노드는 <C>child</C>, <C>sibling</C>, <C>return</C>(부모) 포인터로 연결된 연결 리스트라서 재귀 없이 반복문으로 순회할 수 있습니다. 그래서 순회를 멈추고 다시 시작할 수 있습니다. React는 화면에 보이는 <strong>current 트리</strong>와 작업 중인 <strong>workInProgress 트리</strong> 두 개를 두고(더블 버퍼링), commit 때 포인터만 바꿉니다.</p>
        <p>React 18의 <C>startTransition</C>, <C>useDeferredValue</C>는 이 중단 가능한 render 단계를 이용해 급하지 않은 업데이트를 뒤로 미룹니다. 우선순위는 <strong>Lane</strong>이라는 비트마스크로 관리합니다.</p>
        <p><strong>mini-react는</strong> render → commit → effect 단계 구분은 그대로 따랐지만, Fiber처럼 중단할 수는 없습니다. 재귀로 한 번에 끝까지 계산합니다.</p>
        <QA>
          <Q q="render 단계와 commit 단계를 왜 나누나요?">계산(무엇을 바꿀지)과 반영(실제로 바꾸기)을 분리하면, 계산이 끝나기 전까지 화면이 반쯤 바뀐 상태로 보이지 않습니다. 또 계산 단계에 부작용이 없으니 중단하거나 버리고 다시 해도 안전합니다. 제 구현도 <C>performRender</C>에서 expand(계산) → patchChildren(반영) → effect 실행 순서를 지킵니다.</Q>
        </QA>
      </Topic>

      <Topic id="r-hooks" title="Hooks의 내부 원리" chip="theory">
        <Easy>
          함수는 실행이 끝나면 지역 변수가 사라집니다. 그런데 <C>useState</C>는 다음 렌더에도 값을 기억합니다. 비밀은 <strong>값이 함수 안이 아니라 바깥 사물함</strong>(React에서는 Fiber, 제 구현에서는 <C>FunctionComponent</C> 객체)에 저장된다는 것입니다. 사물함 번호는 <strong>훅을 호출한 순서</strong>입니다.
        </Easy>
        <Code code={`
function Counter() {
  const [count, setCount] = useState(0);   // 0번 사물함
  const [name, setName] = useState("");    // 1번 사물함
  useEffect(() => { ... }, [count]);       // 2번 사물함
}`} />
        <p>React는 Fiber의 <C>memoizedState</C>에 훅을 연결 리스트로 저장하고, 렌더할 때마다 처음부터 하나씩 꺼냅니다. 그래서 <strong>Hooks 규칙</strong>이 생깁니다.</p>
        <ul>
          <li><strong>조건문·반복문 안에서 호출하지 않는다</strong>: 어떤 렌더에서 훅 하나를 건너뛰면 그 뒤 훅들이 다른 사물함 값을 꺼냅니다.</li>
          <li><strong>컴포넌트(또는 커스텀 훅) 안에서만 호출한다</strong>: "지금 렌더 중인 컴포넌트"가 있어야 어느 사물함인지 압니다.</li>
        </ul>
        <Table
          head={["훅", "하는 일", "핵심 포인트"]}
          rows={[
            [<C>useState</C>, "렌더 사이에 값을 보존하고, 바꾸면 다시 렌더 예약", <>같은 값(<C>Object.is</C>)이면 렌더를 생략. 함수형 업데이트 <C>{"set(prev => ...)"}</C>로 최신 값 기반 계산</>],
            [<C>useEffect</C>, "렌더 결과가 화면에 반영된 뒤 부수 효과 실행", "deps가 바뀔 때만 실행. 다음 실행 전과 언마운트 시 cleanup 호출"],
            [<C>useMemo</C>, "비싼 계산 결과를 기억", "deps가 같으면 이전 값 반환"],
            [<C>useCallback</C>, "함수 자체를 기억", <C>{"useMemo(() => fn, deps)"}</C>],
            [<C>useRef</C>, "렌더를 일으키지 않는 변경 가능한 상자", "mini-react에는 미구현"],
          ]}
        />
        <p><strong>클로저 함정(stale closure)</strong>: 컴포넌트 함수 안의 이벤트 핸들러는 <strong>그 렌더 때의 state 값</strong>을 붙잡고 있습니다. 렌더 전에 이벤트가 연달아 오면 오래된 값으로 계산합니다. 해결책은 <C>{"setState(prev => ...)"}</C> 함수형 업데이트입니다. 가계부 수정 페이지에서 실제로 이 버그를 겪고 고쳤습니다(3부).</p>
        <QA>
          <Q q="왜 훅을 조건문 안에서 쓰면 안 되나요?">훅은 이름이 아니라 호출 순서로 구분되기 때문입니다. 조건에 따라 호출 개수가 달라지면 뒤 훅들이 다른 칸의 값을 읽습니다. 제 구현은 각 칸에 <C>tag</C>(state/effect/memo)를 저장해서, 순서가 바뀌면 "훅 호출 순서가 바뀌었습니다"라는 에러를 냅니다.</Q>
          <Q q="useEffect와 useLayoutEffect의 차이는?">useLayoutEffect는 DOM 반영 직후 브라우저가 그리기 전에 동기로 실행되고, useEffect는 그린 뒤에 실행됩니다. 레이아웃 측정처럼 깜빡임을 막아야 하면 useLayoutEffect를 씁니다. 제 구현의 useEffect는 patch 직후 동기로 실행되므로 실제로는 useLayoutEffect에 더 가깝습니다.</Q>
        </QA>
      </Topic>

      <Topic id="r-batching" title="렌더 시점과 자동 배칭" chip="theory">
        <Easy>
          택배를 하나 주문할 때마다 트럭을 보내면 낭비입니다. 같은 시간에 들어온 주문은 모아서 <strong>트럭 한 대</strong>로 보냅니다. setState를 세 번 불러도 렌더는 한 번만 합니다.
        </Easy>
        <p>컴포넌트가 다시 렌더되는 경우는 세 가지입니다: <strong>자기 state 변경</strong>, <strong>부모 리렌더</strong>, <strong>구독한 Context 변경</strong>. 리렌더가 곧 DOM 변경은 아닙니다. 다시 호출해도 결과가 같으면 diff에서 걸러집니다.</p>
        <p>React 17까지는 이벤트 핸들러 안에서만 배칭했고, <C>setTimeout</C>이나 Promise 안에서는 setState마다 렌더했습니다. React 18의 <C>createRoot</C>는 <strong>어디서든 자동 배칭</strong>합니다. 즉시 반영이 필요하면 <C>flushSync</C>를 씁니다.</p>
        <p>부모가 리렌더되면 자식도 기본적으로 다시 호출됩니다. 이를 막으려면 <C>React.memo</C>로 props가 같을 때 건너뜁니다.</p>
        <QA>
          <Q q="setState 직후 값을 읽으면 바뀐 값이 나오나요?">아닙니다. setState는 렌더를 예약할 뿐이고, 현재 함수 실행 중의 변수는 그 렌더 시점 값 그대로입니다. 제 구현도 setState가 <C>queueMicrotask</C>로 렌더를 예약하고, 같은 틱의 여러 호출을 한 번의 렌더로 합칩니다.</Q>
        </QA>
      </Topic>

      <Topic id="r-events" title="이벤트 시스템" chip="theory">
        <p>React는 각 버튼에 리스너를 붙이지 않고 <strong>루트 컨테이너 하나에 이벤트 종류별 리스너</strong>를 붙입니다(이벤트 위임, React 17부터 document가 아닌 root). 이벤트가 버블링되어 올라오면 어느 컴포넌트의 핸들러인지 찾아 호출하고, 브라우저 차이를 감춘 <strong>SyntheticEvent</strong>로 감싸서 넘깁니다.</p>
        <p><strong>mini-react는</strong> 단순하게 <C>addEventListener</C>로 각 요소에 직접 붙입니다. 핸들러 함수가 바뀌면 <C>patchProp</C>이 이전 리스너를 떼고 새 리스너를 붙입니다. 이벤트 이름은 <C>onClick</C> → <C>"click"</C>처럼 <C>on</C>을 떼고 소문자로 바꿔 만듭니다. 그래서 브라우저 이벤트를 그대로 따릅니다.</p>
        <ul>
          <li>JSX 타입 정의에 맞춰 키 입력은 <C>onKeydown</C>으로 씁니다(React는 <C>onKeyDown</C>).</li>
          <li><C>onChange</C>는 브라우저의 <C>change</C> 이벤트라서 텍스트 입력에서는 <strong>포커스가 빠질 때</strong> 발생합니다. React의 onChange는 입력할 때마다 발생하므로, 입력마다 반응하려면 <C>onInput</C>을 씁니다.</li>
        </ul>
        <QA>
          <Q q="이벤트 위임을 안 하면 어떤 단점이 있나요?">요소마다 리스너가 생기고, 렌더마다 핸들러 함수가 새로 만들어지면 떼었다 붙이는 비용이 듭니다. 목록이 길면 메모리와 시간이 늘어납니다. 대신 구현이 단순하고 동작이 브라우저 기본과 같아서 디버깅이 쉽습니다. 개선 방향으로 루트 위임을 꼽고 있습니다.</Q>
        </QA>
      </Topic>

      <Topic id="r-router" title="React Router와 SPA" chip="theory">
        <Easy>
          MPA(여러 페이지 앱)는 링크를 누를 때마다 서버에서 새 HTML을 받아 화면을 처음부터 다시 그립니다. SPA(단일 페이지 앱)는 HTML을 한 번만 받고, 이후에는 <strong>주소만 바꾸고 JS가 화면을 바꿔 끼웁니다</strong>.
        </Easy>
        <p>React 자체에는 라우팅이 없고, React Router 같은 라이브러리를 씁니다.</p>
        <Code code={`
<BrowserRouter>
  <Routes>
    <Route path="/" element={<Home />} />
    <Route path="/posts/:id" element={<Post />} />
  </Routes>
</BrowserRouter>
// Post 안에서: const { id } = useParams();`} />
        <ul>
          <li><strong>BrowserRouter</strong>: History API(<C>pushState</C>, <C>popstate</C>)로 <C>/posts/1</C> 같은 깔끔한 주소를 씁니다. 새로고침하면 서버가 그 주소로 요청을 받으므로, 서버가 모든 주소에 <C>index.html</C>을 돌려주도록 설정해야 합니다.</li>
          <li><strong>HashRouter</strong>: <C>/#/posts/1</C>처럼 <C>#</C> 뒤에 경로를 둡니다. <C>#</C> 뒤는 서버로 가지 않으므로 정적 서버에서도 새로고침이 됩니다.</li>
          <li>React Router는 Context로 현재 위치를 내려주고, <C>useParams</C>, <C>useNavigate</C> 같은 훅으로 읽습니다. 중첩 라우트는 <C>{"<Outlet />"}</C>으로 그립니다.</li>
        </ul>
        <p>CSR(클라이언트 렌더링)과 SSR(서버 렌더링)은 "HTML을 누가 만드나"의 문제이고, SPA와 MPA는 "페이지 이동 때 문서를 새로 받나"의 문제입니다. 서로 다른 축입니다. Next.js처럼 SSR로 첫 화면을 만들고 이후에는 SPA처럼 이동하는 방식도 있습니다.</p>
        <QA>
          <Q q="Hash 방식과 History API 방식 중 왜 Hash를 골랐나요?">이 프로젝트는 <C>python3 -m http.server</C>라는 정적 서버를 씁니다. History 방식은 <C>/budget/stats</C>에서 새로고침하면 서버가 그런 파일이 없다고 404를 냅니다. Hash 방식은 서버 설정 없이 새로고침과 직접 접속이 되므로 의존성 0개 원칙과 맞습니다.</Q>
        </QA>
      </Topic>

      <Topic id="r-compare" title="React와 mini-react 비교표" chip="theory">
        <Table
          head={["항목", "React 18", "mini-react"]}
          rows={[
            ["설계도", "React Element", <><C>VNode</C> (element, text, component, fragment, empty)</>],
            ["컴포넌트 저장소", "Fiber 노드", <><C>FunctionComponent</C> 인스턴스</>],
            ["컴포넌트 정체성", "트리 위치 + type + key", <>slot 경로 문자열(<C>root/i:0/k:3</C>) + type</>],
            ["훅 저장", "Fiber의 연결 리스트", <><C>hooks</C> 배열 + 호출 순서 인덱스</>],
            ["렌더 단계", "중단 가능(동시성)", "재귀로 한 번에 끝까지"],
            ["배칭", "자동 배칭 + Lane 우선순위", "마이크로태스크 한 번으로 합침"],
            ["부분 리렌더", "state 바뀐 Fiber부터 + memo", "dirty 컴포넌트 또는 새 vnode를 받은 컴포넌트만 호출"],
            ["effect 시점", "그린 뒤 비동기", "patch 직후 동기 (자식 → 부모 순)"],
            ["이벤트", "루트 위임 + SyntheticEvent", <>요소별 <C>addEventListener</C></>],
            ["상태 위치", "어느 컴포넌트든", <>명세상 루트만 (<C>rootOnlyHooks</C>로 강제)</>],
            ["라우팅", "별도 라이브러리, Context와 훅", "직접 만든 해시 라우터, 페이지마다 별도 루트, props로 params 전달"],
          ]}
        />
      </Topic>
    </>
  );
}

// --- 2부: 명세 구현 ---

function SpecPart() {
  return (
    <>
      <Part id="part-spec" label="PART 2" title="명세에 따라 구현한 부분">
        <p className="g-intro">Phase 1(Virtual DOM, Diff, Patch, 검증 페이지)과 Phase 2(Component, Hooks, 자동 리렌더)입니다. 파일 경로는 <C>src/</C> 기준입니다.</p>
      </Part>

      <Topic id="a-pipeline" title="전체 흐름 한눈에" chip="spec">
        <p>면접에서 "전체 구조를 설명해 보세요"라는 질문이 가장 먼저 나옵니다. 이 그림 하나로 답할 수 있어야 합니다.</p>
        <Flow
          steps={[
            ["1. h() / JSX", "설계도 VNode 트리 생성"],
            ["2. expand", "컴포넌트를 실행해 펼치고 slot 부여 → HostVNode[]"],
            ["3. diff", "이전 HostVNode와 비교 → ChildrenPatch"],
            ["4. patch", "바뀐 부분만 실제 DOM에 반영"],
            ["5. effects", "cleanup → 새 effect 실행"],
          ]}
        />
        <p>Phase 1은 1, 2단계 대신 <strong>실제 DOM을 읽어서</strong>(<C>domToVNode</C>) VNode를 만들고 3, 4단계를 그대로 씁니다. Phase 2는 상태가 바뀔 때마다 1~5단계 전체를 반복합니다. 즉 <strong>Phase 1의 diff/patch 엔진을 Phase 2가 그대로 재사용</strong>하며, 이것이 명세의 "Phase 1·2 연결"입니다.</p>
        <Table
          head={["파일", "역할"]}
          rows={[
            [<C>types.ts</C>, "VNode, HostVNode, Patch 타입 정의"],
            [<C>createElement.ts</C>, <><C>h</C>, Fragment, 자식 정규화</>],
            [<C>domToVNode.ts</C>, "실제 DOM → VNode"],
            [<C>expand.ts</C>, "컴포넌트 실행, slot 경로 부여, key 중복 검사"],
            [<><C>diff.ts</C> / <C>patch.ts</C> / <C>dom.ts</C></>, "비교 / DOM 반영 / 노드 생성과 속성 적용"],
            [<><C>FunctionComponent.ts</C> / <C>hooks.ts</C></>, "컴포넌트 인스턴스 / 훅 구현"],
            [<C>render.ts</C>, "루트 관리, 렌더 예약(배칭), 4단계 실행"],
            [<><C>history.ts</C> / <C>describePatch.ts</C> / <C>serializeHtml.ts</C></>, "State History / 변경 설명 / 입력값 포함 HTML 직렬화"],
          ]}
        />
      </Topic>

      <Topic id="a-vnode" title="VNode 타입 설계" file="types.ts" chip="spec">
        <p>VNode는 다섯 종류이며, <C>kind</C> 필드로 구분하는 <strong>판별 유니온(discriminated union)</strong>입니다. TypeScript가 <C>switch (vnode.kind)</C>에서 모든 경우를 처리했는지 검사해 줍니다.</p>
        <Table
          head={["kind", "의미", "예"]}
          rows={[
            [<C>element</C>, "HTML/SVG 태그", <C>{"<li>"}</C>],
            [<C>text</C>, "글자", <C>"할 일"</C>],
            [<C>component</C>, "함수 컴포넌트 호출 예정", <C>{"<TaskItem />"}</C>],
            [<C>fragment</C>, "DOM 없이 자식 여러 개 묶음", <><C>{"<>...</>"}</C>, 배열</>],
            [<C>empty</C>, "빈 자리", <><C>null</C>, <C>false</C>, <C>{"{cond && ...}"}</C></>],
          ]}
        />
        <p>트리는 두 단계로 나뉩니다. 사용자가 만든 <strong>VNode</strong>(컴포넌트, Fragment 포함)와, expand가 펼친 뒤의 <strong>HostVNode</strong>(element, text, empty만, 각각 <C>slot</C> 문자열을 가짐)입니다. diff와 patch는 HostVNode만 다룹니다. 그래서 diff는 컴포넌트가 무엇인지 몰라도 됩니다.</p>
        <p>패치 타입도 단순합니다. 노드 하나를 고치는 <C>TEXT</C>, <C>UPDATE</C>와, 자식 목록을 어떻게 채울지 적은 <C>{"ChildrenPatch { removed, order }"}</C>입니다.</p>
        <QA>
          <Q q="왜 empty 노드를 따로 만들었나요? null은 그냥 빼면 되지 않나요?">빼 버리면 뒤에 있는 형제들의 index가 하나씩 당겨집니다. 그러면 <C>{"{show && <b/>}<input/>"}</C>에서 show가 바뀔 때 input이 다른 자리로 인식되어 새로 만들어지고 입력값을 잃습니다. 빈 자리를 남겨 두면 index가 고정됩니다. DOM에서는 화면에 안 보이는 주석 노드로 표현합니다.</Q>
        </QA>
      </Topic>

      <Topic id="a-h" title="createElement와 JSX" file="createElement.ts" chip="spec">
        <p><C>h(type, props, ...children)</C>는 type에 따라 세 가지 VNode를 만듭니다. <C>Fragment</C> 함수면 fragment, 다른 함수면 component, 문자열이면 element입니다. <C>key</C>는 props에서 꺼내 따로 저장합니다(React처럼 컴포넌트에 key가 props로 전달되지 않음).</p>
        <p>핵심은 <strong>자식 정규화</strong>입니다.</p>
        <Code code={`
function flatten(child, out) {
  if (Array.isArray(child))      out.push(fragment(child));   // 배열 = 자리 하나를 차지하는 묶음
  else if (child == null || typeof child === "boolean")
                                 out.push(EMPTY);            // 빈 자리로 남김
  else if (문자열 또는 숫자)        out.push(text(String(child)));
  else                           out.push(child);
}`} />
        <p>배열을 그대로 펼치지 않고 fragment 하나로 감싸는 이유는, <C>{"{items.map(...)}"}</C>의 길이가 3에서 5로 바뀌어도 <strong>그 뒤 형제의 index가 밀리지 않게</strong> 하려는 것입니다. 오버로드 타입으로 컴포넌트 props도 타입 검사합니다(필수 props를 빠뜨리면 컴파일 에러).</p>
      </Topic>

      <Topic id="a-dom2v" title="DOM → Virtual DOM 변환" file="domToVNode.ts" chip="spec">
        <p>Phase 1의 출발점입니다. 실제 DOM 노드를 재귀로 읽어 VNode로 바꿉니다.</p>
        <ul>
          <li><strong>1:1 대응</strong>: 공백 텍스트와 주석까지 DOM 노드 하나당 VNode 하나를 만듭니다. patch는 "VNode의 i번째 자식 = DOM의 i번째 자식"을 전제로 하기 때문입니다. 공백을 버리면 index가 어긋나 엉뚱한 노드를 고칩니다.</li>
          <li><strong>태그 이름</strong>: <C>tagName</C>은 HTML에서 대문자(<C>"DIV"</C>)이므로 <C>localName</C>을 씁니다. SVG의 <C>linearGradient</C> 같은 대소문자도 유지됩니다.</li>
          <li><strong>폼 상태 읽기</strong>: 사용자가 입력한 값은 HTML 속성이 아니라 DOM <strong>property</strong>(<C>input.value</C>, <C>checked</C>)에만 있습니다. 속성만 읽으면 입력한 내용이 사라지므로 따로 읽습니다.</li>
          <li><strong>보안</strong>: <C>{"<script>"}</C>는 빈 자리로, <C>onclick</C> 같은 <C>on*</C> 속성은 버립니다. 테스트 영역에 적은 HTML이 실제 영역에서 실행되지 않게 하려는 것입니다.</li>
          <li><strong>key</strong>: HTML에는 key가 없으므로 <C>data-key</C> 속성을 key로 씁니다. Phase 1에서도 key 기반 이동을 확인할 수 있습니다.</li>
        </ul>
        <QA>
          <Q q="attribute와 property의 차이는?">attribute는 HTML에 적힌 초기값이고, property는 DOM 객체의 현재 상태입니다. 사용자가 input에 입력하면 <C>value</C> property만 바뀌고 <C>value</C> attribute는 그대로입니다. 그래서 변환할 때는 property를 읽고, patch할 때도 property를 직접 씁니다.</Q>
        </QA>
      </Topic>

      <Topic id="a-slot" title="expand와 slot(경로) 기반 정체성" file="expand.ts" chip="spec">
        <Easy>
          모든 노드에 <strong>주소</strong>를 붙입니다. "루트의 0번째 자식의 key가 3인 자식"이면 <C>root/i:0/k:3</C>입니다. 다음 렌더에서 주소가 같으면 "같은 자리의 같은 노드"로 보고 재사용합니다.
        </Easy>
        <p>expand는 VNode 트리를 돌며 세 가지 일을 합니다.</p>
        <ol>
          <li><strong>컴포넌트 실행</strong>: component 노드를 만나면 그 경로의 <C>FunctionComponent</C> 인스턴스를 찾고(없으면 생성), mount 또는 update로 함수를 호출해 결과를 다시 expand합니다.</li>
          <li><strong>Fragment 펼치기</strong>: fragment의 자식을 부모의 자식 목록에 그대로 끼웁니다. 그래서 반환 타입이 배열입니다.</li>
          <li><strong>slot 부여</strong>: key가 있으면 <C>부모경로/k:key</C>, 없으면 <C>부모경로/i:index</C>를 붙입니다. 컴포넌트의 출력은 <C>경로/r</C> 아래에 놓입니다.</li>
        </ol>
        <Code tree code={`
<App>                         root
  <ul>                        root/r
    <TaskItem key=1>          root/r/k:1
      <li>                    root/r/k:1/r
    <TaskItem key=2>          root/r/k:2
      <li>                    root/r/k:2/r`} />
        <p><strong>왜 index 비교가 아니라 경로인가?</strong> Fragment를 펼치면 실제 DOM 위치(index)는 앞 Fragment 길이에 따라 바뀝니다. 위치 번호로 비교하면 같은 노드를 다른 노드로 착각합니다. 경로는 <strong>트리 구조상 자리</strong>라서 펼친 뒤에도 변하지 않습니다. 같은 경로가 상태(인스턴스 Map의 키)와 DOM(diff의 짝 맞추기) 양쪽의 기준이 되므로, 둘이 어긋날 일이 없습니다.</p>
        <p>같은 부모 안에서 key가 겹치면 경로가 같아지므로 바로 에러를 던집니다. 같은 경로에 다른 타입의 컴포넌트가 오면 이전 인스턴스를 버리고 새로 만듭니다(React의 "타입이 다르면 다른 트리" 규칙).</p>
        <p>컴포넌트를 호출하지 않고 건너뛴 경우에도 출력 아래로 계속 내려갑니다. 자손 중에 setState로 dirty가 된 컴포넌트가 있을 수 있고, 살아 있는 인스턴스를 <C>visited</C>에 기록해야 사라진 인스턴스를 가려낼 수 있기 때문입니다.</p>
        <QA>
          <Q q="컴포넌트의 상태는 어디에 붙어 있고, 언제 사라지나요?">상태는 slot 경로를 키로 하는 <C>instances</C> Map의 FunctionComponent 인스턴스에 있습니다. 렌더 후 이번에 방문하지 않은 경로의 인스턴스는 제거되고 effect cleanup이 실행됩니다. 같은 경로에 다른 타입이 와도 새 인스턴스로 바뀌어 상태가 초기화됩니다.</Q>
        </QA>
      </Topic>

      <Topic id="a-diff" title="Diff 알고리즘" file="diff.ts" chip="spec">
        <Easy>
          새 자식 목록을 처음부터 보면서 "이 자리에 원래 누가 있었지?"를 주소(slot)로 찾습니다. 같은 종류면 재사용하고 속성만 고치고, 없거나 종류가 다르면 새로 만듭니다. 새 목록에서 아무도 데려가지 않은 옛 노드는 삭제합니다.
        </Easy>
        <Code code={`
function diffChildren(old, next) {
  const oldIndexBySlot = Map(slot → 옛 index);
  const order = next.map(child => {
    const from = oldIndexBySlot.get(child.slot);
    if (from 있음 && canReuse(old[from], child))      // 같은 종류, 같은 태그
      return { type: "REUSE", from, patch: diffNode(old[from], child) };
    return { type: "INSERT", vnode: child };
  });
  const removed = 재사용되지 않은 옛 index들;
  return { removed, order };
}`} />
        <p>Map 조회라서 자식 n개를 O(n)에 비교합니다. 재사용된 노드는 <C>diffNode</C>로 들어가 텍스트면 값 비교, 엘리먼트면 <C>diffProps</C>(사라진 속성, 바뀐 속성)와 자식에 대한 <C>diffChildren</C>을 재귀로 호출합니다. 아무것도 바뀌지 않았으면 <C>null</C>을 돌려줘 patch가 건너뜁니다.</p>
        <h4>핵심 케이스가 패치에 어떻게 표현되나</h4>
        <Table
          head={["케이스", "패치 표현"]}
          rows={[
            ["추가 (ADD)", <>새 slot → <C>INSERT</C></>],
            ["삭제 (REMOVE)", <>옛 index가 <C>removed</C>에 들어감</>],
            ["교체 (REPLACE)", <>같은 slot인데 태그가 다름 → <C>removed</C> + <C>INSERT</C></>],
            ["텍스트 변경 (TEXT)", <><C>REUSE</C> + <C>{'{ type: "TEXT" }'}</C></>],
            ["속성 변경 (ATTR)", <><C>REUSE</C> + <C>{'{ type: "UPDATE", props }'}</C></>],
            ["이동 (MOVE)", <>key가 같은데 순서가 바뀜 → <C>REUSE</C>의 <C>from</C>이 다름</>],
          ]}
        />
        <p>패치 자체에는 REPLACE, MOVE 타입이 없습니다. 최소한의 연산(재사용·삽입·삭제)만 두고, 사람에게 보여 줄 때는 <C>describePatch.ts</C>가 "같은 slot의 삭제 + 삽입 = 교체", "남은 노드끼리 순서가 뒤집힘 = 이동"으로 다시 묶어 6가지로 설명합니다. 이 설명이 Phase 1 화면의 변경 로그입니다.</p>
        <QA>
          <Q q="Diff의 시간 복잡도는?">같은 레벨의 자식끼리만 비교하고 slot→index를 Map으로 찾으므로, 전체 노드 수 n에 대해 O(n)입니다. 대신 노드가 다른 부모로 옮겨 가면 이동으로 인식하지 못하고 삭제 후 새로 만듭니다. React와 같은 트레이드오프입니다.</Q>
          <Q q="태그가 같은데 key가 다르면 어떻게 되나요?">key가 slot에 들어가므로 slot이 달라집니다. 옛 노드는 삭제되고 새 노드가 만들어집니다. React와 같이 key 변경은 "다른 항목"이라는 뜻입니다.</Q>
          <Q q="이동할 때 최소 이동 횟수를 보장하나요?">아니요. React나 Vue는 최장 증가 부분 수열(LIS) 같은 방법으로 움직일 노드 수를 줄이는데, 저는 앞에서부터 "i번째 자리에 이 노드가 없으면 끼워 넣기"만 합니다. 결과는 같지만 DOM 이동이 더 많을 수 있습니다. 개선 과제로 남겨 두었습니다.</Q>
        </QA>
      </Topic>

      <Topic id="a-patch" title="Patch와 patchProp" file="patch.ts · dom.ts" chip="spec">
        <Code code={`
function patchChildren(parent, { removed, order }) {
  const oldNodes = Array.from(parent.childNodes);   // ① 스냅샷
  for (const i of removed) parent.removeChild(oldNodes[i]);   // ② 삭제
  order.forEach((op, i) => {                          // ③ 앞에서부터 채우기
    const node = op.type === "INSERT" ? createDom(op.vnode) : oldNodes[op.from];
    if (REUSE이고 patch 있음) patchNode(node, op.patch);   // 제자리 수정
    if (parent.childNodes[i] !== node) parent.insertBefore(node, parent.childNodes[i]);
  });
}`} />
        <ul>
          <li><strong>① 스냅샷을 먼저 뜨는 이유</strong>: diff의 <C>from</C>은 "patch 전" index입니다. 노드를 지우거나 옮기면 <C>childNodes</C>가 바로 바뀌므로, 원래 목록을 배열로 복사해 둡니다.</li>
          <li><strong>③ insertBefore 한 줄로 이동·삽입 처리</strong>: 이미 i번째에 있으면 아무것도 안 하고, 아니면 i번째 자리로 옮깁니다. DOM에 이미 있는 노드를 insertBefore하면 복사가 아니라 이동입니다.</li>
          <li><strong>자식 먼저, 속성 나중</strong>: <C>{'<select value="b">'}</C>는 <C>{'<option value="b">'}</C>가 붙어 있어야 값이 적용됩니다. 그래서 createDom과 UPDATE 모두 자식을 먼저 처리합니다.</li>
        </ul>
        <h4>patchProp의 특수 처리</h4>
        <Table
          head={["속성", "처리 방법", "이유"]}
          rows={[
            [<><C>onClick</C> 등</>, "이전 리스너 remove, 새 리스너 add", <><C>/^on[A-Z]/</C>로 판별, 이벤트 이름은 소문자</>],
            [<C>value</C>, "property에 쓰고, 값이 같으면 쓰지 않음", "같은 값을 다시 쓰면 커서가 맨 끝으로 튐"],
            [<C>checked</C>, "property와 attribute 둘 다", "화면 상태와 직렬화 HTML 모두 맞추기"],
            [<C>style</C>, "문자열은 attribute로, 객체는 키별로 비교", <><C>cssText</C>는 값을 정규화해서 바뀐 것처럼 보이는 문제 회피</>],
            [<C>className</C>, <><C>class</C> 속성으로 변환</>, <>SVG에서 <C>className</C> property는 읽기 전용</>],
            [<><C>true</C>/<C>false</C>/<C>null</C></>, "빈 속성 / 제거 / 제거", <><C>{"disabled={false}"}</C>가 <C>disabled="false"</C>로 남으면 여전히 비활성</>],
          ]}
        />
        <p>SVG 태그는 <C>createElementNS</C>로 SVG 네임스페이스에 만들어야 그려집니다. 부모가 SVG면 자식도 SVG로 만듭니다(<C>foreignObject</C> 안은 예외). 가계부 통계의 막대 차트가 이 기능을 씁니다.</p>
        <QA>
          <Q q="입력 중에 다시 렌더되면 커서가 튀지 않나요?">diff가 같은 input 노드를 재사용하고, patchProp은 <C>dom.value !== value</C>일 때만 값을 씁니다. 사용자가 입력해서 이미 같은 값이면 건드리지 않아 커서가 유지됩니다. 노드가 같은지와 커서 위치가 유지되는지를 브라우저 테스트로 확인했습니다.</Q>
        </QA>
      </Topic>

      <Topic id="a-history" title="State History" file="history.ts" chip="spec">
        <Easy>
          브라우저의 뒤로가기/앞으로가기와 같습니다. 과거로 돌아간 상태에서 새 페이지로 이동하면, 앞으로가기 기록은 사라집니다.
        </Easy>
        <Code code={`
push(entry) {
  this.entries = [...this.entries.slice(0, this.index + 1), entry];   // 현재 위치 뒤는 버림
  this.index = this.entries.length - 1;
}
go(index) { 범위 검사 후 this.index = index; return this.current; }`} />
        <p>제네릭 클래스(<C>{"StateHistory<T>"}</C>)로 만들어 무엇이든 저장할 수 있습니다. Phase 1은 <C>{"{ label, vdom }"}</C>을 저장합니다. 저장하는 것은 <strong>DOM이 아니라 Virtual DOM</strong>입니다. 기록 사이를 이동할 때 현재 VDOM과 목표 VDOM을 diff해서 바뀐 부분만 patch하므로, 뒤로가기도 일반 patch와 같은 엔진으로 처리됩니다. 범위를 벗어난 index는 <C>RangeError</C>를 던집니다.</p>
      </Topic>

      <Topic id="a-phase1" title="Phase 1 검증 페이지" file="pages/phase1.tsx" chip="spec">
        <p>왼쪽 <strong>실제 영역</strong>은 patch로만 바뀌고, 오른쪽 <strong>테스트 영역</strong>은 사용자가 직접 편집합니다(contenteditable 또는 HTML 코드 입력창).</p>
        <Flow
          steps={[
            ["시작", "실제 영역 DOM → VDOM → 기록 #0"],
            ["편집", "테스트 영역 수정. 코드 입력창과 서로 동기화"],
            ["Patch", "테스트 영역 → VDOM → 현재 기록과 diff → 실제 영역 patch → 기록 push"],
            ["뒤로/앞으로", "history.go → diff(현재, 목표) → patch"],
          ]}
        />
        <ul>
          <li><strong>실제로 바뀐 DOM 수 세기</strong>: 실제 영역에 <C>MutationObserver</C>를 붙이고, patch 직후 <C>takeRecords()</C>로 기록 수를 읽습니다. "Virtual DOM이 정말 바뀐 부분만 고쳤다"를 숫자로 증명하고, 바뀐 노드를 잠깐 강조 표시합니다.</li>
          <li><strong>양방향 동기화</strong>: 테스트 영역을 편집하면 MutationObserver와 <C>input</C> 이벤트로 감지해 코드 입력창을 갱신합니다. 코드를 고치면 <C>{"<template>"}</C>에서 파싱해 테스트 영역을 다시 그립니다. 프로그램이 테스트 영역을 바꿀 때는 감시를 잠깐 끊어 사용자 편집으로 오인하지 않게 합니다.</li>
          <li><strong>변경이 없으면</strong>: diff 결과가 <C>isUnchanged</C>면 "바꿀 것이 없습니다"를 띄우고 기록을 남기지 않습니다.</li>
          <li><strong>적용 안 한 편집 보호</strong>: 뒤로/앞으로를 누르거나 다른 라우트로 갈 때, 테스트 영역이 현재 기록과 다르면 확인 창을 띄웁니다.</li>
          <li><strong>시나리오 버튼</strong>: 추가, 삭제, 교체, 텍스트, 속성, 이동을 버튼 하나로 재현해 시연할 수 있습니다.</li>
        </ul>
        <QA>
          <Q q="Patch가 정말 바뀐 부분만 고친다는 걸 어떻게 증명하나요?">실제 영역에 MutationObserver를 붙여 patch가 일으킨 DOM 변경 레코드 수를 화면에 보여 줍니다. 텍스트 하나만 바꾸면 레코드가 1건입니다. 브라우저 테스트에서도 바뀌지 않은 노드가 같은 객체로 남아 있는지를 확인합니다.</Q>
          <Q q="innerHTML을 통째로 바꾸면 안 되나요?">그러면 모든 노드가 새로 만들어져 입력값, 포커스, 스크롤, 이벤트 리스너가 모두 사라지고 비용도 큽니다. 이 페이지의 목적이 바로 그 차이를 보여 주는 것입니다.</Q>
        </QA>
      </Topic>

      <Topic id="a-fc" title="FunctionComponent 클래스" file="FunctionComponent.ts" chip="spec">
        <Easy>
          함수 컴포넌트에 딸린 <strong>사물함</strong>입니다. 함수는 매번 새로 실행되지만, 사물함은 화면에 컴포넌트가 있는 동안 계속 남아 훅 값을 보관합니다. React의 Fiber 역할을 작게 만든 것입니다.
        </Easy>
        <Table
          head={["멤버", "역할"]}
          rows={[
            [<C>hooks: Hook[]</C>, "훅 값 저장소. 호출 순서가 index"],
            [<C>mount(vnode)</C>, "처음 렌더. 함수 호출"],
            [<C>update(vnode)</C>, <>다시 렌더. <strong>dirty이거나 vnode가 새 객체일 때만</strong> 함수 호출, 아니면 이전 결과 재사용</>],
            [<C>unmount()</C>, <><C>unmounted</C> 표시 후 모든 effect cleanup 실행</>],
            [<C>dirty</C>, "setState가 일어났다는 표시"],
            [<C>pendingEffects</C>, "이번 렌더에서 실행해야 하는 effect 목록"],
          ]}
        />
        <p><strong>부분 리렌더의 원리</strong>: 부모가 다시 렌더되지 않았다면 부모의 이전 출력이 그대로 재사용되므로, 자식이 받는 vnode는 <strong>이전과 같은 객체</strong>입니다. 그래서 <C>this.vnode !== vnode</C> 참조 비교 한 번으로 "부모가 다시 그렸는가"를 알 수 있습니다. 결과적으로 setState가 일어난 컴포넌트와 그 아래만 다시 호출됩니다.</p>
        <p><strong>예외 안전</strong>: <C>run()</C>은 렌더 전에 <C>this.vnode = null</C>로 비워 둡니다. 함수가 에러를 던지면 vnode가 null로 남아 다음 번에 다시 시도합니다. <C>dirty</C>도 렌더 전에 지워서, 렌더 도중 일어난 setState는 다음 렌더로 넘어갑니다.</p>
        <QA>
          <Q q="React.memo 없이 어떻게 자식 리렌더를 건너뛰나요?">props를 비교하지 않고 vnode 객체 자체를 참조 비교합니다. 부모가 다시 호출되지 않으면 자식 vnode는 지난번과 같은 객체이므로 건너뜁니다. 반대로 부모가 다시 호출되면 props가 같아도 자식을 다시 호출합니다. React의 기본 동작(memo 없음)과 같습니다.</Q>
        </QA>
      </Topic>

      <Topic id="a-hooks" title="useState · useEffect · useMemo" file="hooks.ts" chip="spec">
        <p>모듈 전역 변수 두 개로 "지금 렌더 중인 컴포넌트"와 "몇 번째 훅인지"를 추적합니다.</p>
        <Code code={`
let currentInstance = null;
let hookIndex = 0;

function renderComponent(instance, component, props) {
  currentInstance = instance; hookIndex = 0; instance.pendingEffects = [];
  try { return component(props); }
  finally { currentInstance = null; hookIndex = 0; }   // 에러가 나도 정리
}

function nextHook(tag) {
  if (currentInstance === null) throw "렌더 중에만 호출 가능";
  if (!instance.hooksAllowed)   throw "루트만 훅 사용 가능";
  const prev = instance.hooks[hookIndex++];
  if (prev && prev.tag !== tag) throw "훅 호출 순서가 바뀌었습니다";
  return prev;
}`} />
        <h4>useState</h4>
        <Code code={`
setState(action) {
  if (instance.unmounted) return;                 // 사라진 컴포넌트는 무시
  const next = typeof action === "function" ? action(hook.value) : action;
  if (Object.is(next, hook.value)) return;        // 같으면 렌더 안 함
  hook.value = next;                              // 즉시 저장 → 연속 호출이 누적됨
  instance.dirty = true;
  instance.scheduleUpdate();                      // 마이크로태스크로 렌더 예약
}`} />
        <p>값을 바로 hook에 저장하므로, <C>{"setA(n => n + 1)"}</C>를 두 번 부르면 두 번째는 첫 번째 결과를 받아 2가 됩니다. 초기값에 함수를 주면 첫 렌더에만 호출합니다(<C>useState(loadTasks)</C>로 localStorage를 한 번만 읽음). setState 함수는 hook에 한 번 만들어 저장하므로 렌더마다 같은 함수입니다.</p>
        <h4>useEffect</h4>
        <p>deps가 바뀌었을 때만 <C>pendingEffects</C>에 "이전 cleanup 실행 → effect 실행 → 반환값을 cleanup으로 저장" 작업을 넣습니다. 실제 실행은 render.ts가 DOM 반영 후에 합니다. deps를 생략하면 매 렌더마다, <C>[]</C>면 처음 한 번만 실행됩니다. 비교는 <C>Object.is</C>입니다.</p>
        <h4>useMemo / useCallback</h4>
        <p>deps가 같으면 저장해 둔 값을 돌려주고, 다르면 factory를 다시 호출합니다. useCallback은 <C>{"useMemo(() => callback, deps)"}</C> 한 줄입니다.</p>
        <QA>
          <Q q="같은 값으로 setState하면 렌더가 일어나나요?">아니요. <C>Object.is</C>로 비교해 같으면 dirty 표시도 예약도 하지 않습니다. 그래서 객체나 배열 state는 새 객체를 만들어야 변경으로 인식됩니다(불변성).</Q>
          <Q q="useEffect의 cleanup은 언제 실행되나요?">두 번입니다. deps가 바뀌어 effect가 다시 실행되기 직전, 그리고 컴포넌트가 사라질 때입니다. Focus Board의 타이머 effect가 <C>clearInterval</C>을 cleanup으로 돌려주므로, 일시정지하거나 페이지를 떠나면 타이머가 멈춥니다.</Q>
        </QA>
      </Topic>

      <Topic id="a-render" title="render와 배칭" file="render.ts" chip="spec">
        <p>컨테이너마다 <C>RootState</C>(이전 HostVNode, 인스턴스 Map, 예약 여부)를 <C>WeakMap</C>에 보관합니다. 컨테이너 DOM이 사라지면 함께 메모리에서 해제됩니다.</p>
        <Code code={`
function performRender(root) {
  // 1) render 단계: 컴포넌트 실행. DOM은 건드리지 않음
  const next = expand(root.element, "root", ctx);
  // 2) 이번에 방문하지 않은 인스턴스 = 사라진 컴포넌트
  for (path, instance of root.instances) if (!visited.has(path)) removed.push(instance);
  // 3) commit 단계
  patchChildren(root.container, diffChildren(root.prevHost, next));
  root.prevHost = next;
  // 4) effect 단계: 사라진 컴포넌트 cleanup → 이번 effect (자식 → 부모 순)
}`} />
        <p><strong>배칭</strong>: <C>scheduleUpdate</C>는 <C>root.scheduled</C>가 false일 때만 <C>queueMicrotask</C>로 렌더를 예약합니다. 같은 이벤트 핸들러 안에서 setState를 여러 번 불러도 마이크로태스크는 한 번만 잡히고, 모든 setState가 끝난 뒤 렌더 한 번에 반영됩니다. 마이크로태스크는 현재 JS 실행이 끝난 직후, 브라우저가 화면을 그리기 전에 실행되므로 중간 상태가 화면에 보이지 않습니다.</p>
        <p><strong>첫 렌더도 diff</strong>: 처음에는 이전 트리를 빈 배열로 두므로 "빈 상태 → 전부 INSERT"가 됩니다. 첫 렌더용 코드를 따로 만들지 않아 경로가 하나로 통일됩니다.</p>
        <p><strong>effect 순서</strong>: expand가 자식을 먼저 처리한 뒤 자기 effect를 쌓으므로 자식 effect가 먼저 실행됩니다(React와 같음). 사라진 컴포넌트의 cleanup이 새 effect보다 먼저 실행되는 것도 테스트로 확인했습니다.</p>
        <QA>
          <Q q="왜 setTimeout이 아니라 queueMicrotask인가요?">setTimeout은 매크로태스크라 브라우저가 그 사이에 화면을 그릴 수 있고 최소 지연도 있습니다. 마이크로태스크는 현재 작업이 끝나자마자 그리기 전에 실행되므로, 여러 setState를 모으면서도 사용자가 느끼는 지연이 없습니다.</Q>
          <Q q="Batching이 실제로 되는지 어떻게 확인했나요?">렌더 횟수를 세는 테스트에서 setState를 세 번 부른 직후에는 렌더 횟수가 그대로 1이고, 마이크로태스크를 기다린 뒤 2가 되며 값이 모두 반영되는 것을 확인했습니다. Focus Board의 엔진 지표에서도 렌더 횟수를 볼 수 있습니다.</Q>
        </QA>
      </Topic>

      <Topic id="a-rootonly" title="루트 전용 Hook 강제 (rootOnlyHooks)" chip="spec">
        <p>명세는 "Hook과 State는 최상위 컴포넌트에서만, 자식은 props만 받는 순수 함수"를 요구합니다. 규칙을 코드 리뷰에만 맡기지 않고 <strong>엔진이 강제</strong>하도록 했습니다.</p>
        <Code code={`
render(<App />, root, { rootOnlyHooks: true });

// expand.ts: 인스턴스를 만들 때
new FunctionComponent(type, scheduleUpdate, !ctx.rootOnlyHooks || path === "root");
// hooks.ts: 훅을 부를 때
if (!instance.hooksAllowed) throw new Error("rootOnlyHooks 모드에서는 루트 컴포넌트만 훅을 쓸 수 있습니다");`} />
        <p>옵션으로 둔 이유는 엔진 자체는 일반 React처럼 어느 컴포넌트에서나 훅을 쓸 수 있게 만들고, 명세 제약은 앱 쪽에서 선택해 켜도록 하기 위해서입니다. 엔진 단위 테스트에서는 자식 상태도 검증하고, 실제 앱은 모두 이 옵션을 켭니다.</p>
        <p><strong>커스텀 훅은 괜찮은가?</strong> <C>useEntries()</C> 같은 커스텀 훅은 루트 컴포넌트가 렌더 중에 호출하는 평범한 함수이므로 훅이 루트 인스턴스에 저장됩니다. 제약 위반이 아닙니다.</p>
        <QA>
          <Q q="상태를 루트에만 두면 어떤 장단점이 있나요?">장점은 데이터 흐름이 한 방향(루트 → 자식)이라 추적이 쉽고, 자식이 순수 함수라 테스트하기 쉽다는 것입니다. 단점은 깊은 자식까지 props를 계속 전달해야 하는 prop drilling과, 작은 상태 변경에도 루트부터 다시 렌더된다는 것입니다. React에서는 Context나 상태를 필요한 곳 가까이 두는 방식으로 해결합니다.</Q>
        </QA>
      </Topic>

      <Topic id="a-phase2" title="Phase 2 시연 앱: Focus Board" file="pages/phase2.tsx" chip="spec">
        <p>할 일 목록과 25분 집중 타이머입니다. 상태 7개(tasks, draft, priority, filter, query, seconds, running)가 모두 루트 <C>Phase2Page</C>에 있고, <C>FocusTimer</C>, <C>Stats</C>, <C>TaskForm</C>, <C>FilterBar</C>, <C>TaskItem</C>은 props만 받습니다(Lifting State Up).</p>
        <Table
          head={["기능", "사용한 엔진 기능"]}
          rows={[
            ["필터·검색 결과", <><C>useMemo</C>: 타이머가 매초 렌더해도 tasks/filter/query가 같으면 다시 계산하지 않음</>],
            ["저장", <C>{"useEffect(() => saveTasks(tasks), [tasks])"}</C>],
            ["탭 제목", <><C>useEffect</C>로 <C>document.title</C> 갱신</>],
            ["타이머", <><C>useEffect</C> + <C>setInterval</C>, cleanup으로 정지. 함수형 업데이트 <C>{"s => s - 1"}</C></>],
            ["순서 이동", <><C>{"key={task.id}"}</C>로 DOM 재사용 + 이동</>],
            ["추가 버튼", "setState 3번(tasks, draft, priority)이 렌더 한 번으로 배칭"],
            ["엔진 지표", "렌더 횟수, useMemo 재계산 횟수, 실제 DOM 변경 수(MutationObserver), 노드 수"],
          ]}
        />
        <p>엔진 지표는 state가 아니라 effect 안에서 DOM 텍스트를 직접 고칩니다. state로 만들면 지표를 갱신하는 렌더가 다시 지표를 바꾸는 무한 루프가 생기기 때문입니다.</p>
        <p>저장된 데이터는 사용자가 개발자 도구로 고칠 수 있으므로 <C>isTaskList</C>로 모양(배열, 필드 타입, id 중복)을 검증하고, 실패하면 기본값으로 시작합니다.</p>
        <QA>
          <Q q="타이머 effect의 deps가 [running]뿐인데 seconds가 오래된 값이 되지 않나요?">setInterval 안에서 <C>{"setSeconds(s => Math.max(0, s - 1))"}</C> 함수형 업데이트를 쓰기 때문에, 클로저에 붙잡힌 seconds를 읽지 않고 항상 최신 값을 받습니다. 그래서 interval을 매초 다시 만들 필요가 없습니다.</Q>
        </QA>
      </Topic>

      <Topic id="a-edge" title="엣지 케이스와 보안" chip="spec">
        <Table
          head={["문제", "해결"]}
          rows={[
            [<>테스트 영역 HTML의 <C>{"<img onerror>"}</C>가 실행됨</>, <><C>{"<template>"}</C>(비활성 문서)에서 파싱, 변환 시 <C>on*</C>와 script 제거</>],
            [<><C>innerHTML</C>에 사용자가 입력한 값이 안 나옴</>, <><C>serializeHtml</C>: 비활성 문서로 복사 후 value/checked/selected를 속성으로 옮겨 적음. textarea 앞 줄바꿈 보정</>],
            [<><C>cssText</C> 정규화로 안 바뀐 style이 바뀐 것으로 감지</>, "문자열 style은 attribute로 그대로 쓰기"],
            [<>style 제거 후 <C>style=""</C>가 되살아남</>, "빈 값을 쓴 뒤 제거해 지연 동기화 회피"],
            ["깨진 localStorage 값으로 페이지 멈춤", "타입 가드로 검증, 실패 시 기본값"],
            ["적용 안 한 편집이 뒤로가기로 사라짐", "실제 diff가 있을 때만 확인 창"],
            ["같은 key 중복", "expand에서 즉시 에러 (조용히 깨지는 것보다 낫다)"],
            ["훅 순서 바뀜, 렌더 밖 훅 호출", "tag 검사로 명확한 에러 메시지"],
            ["언마운트된 컴포넌트의 setState", "무시"],
          ]}
        />
      </Topic>

      <Topic id="a-tests" title="테스트 전략" chip="spec">
        <Table
          head={["종류", "위치·도구", "대상"]}
          rows={[
            ["단위 테스트 (57개)", <><C>src/tests/unit</C>, Node 내장 <C>node:test</C>, <C>npm test</C></>, "createElement, diff, expand, history, hooks, router 매칭. DOM이 필요 없는 순수 로직"],
            ["브라우저 테스트 (120개)", <><C>tests.html</C>, 직접 만든 작은 하네스</>, "dom/patch, render, serializeHtml, 라우터, 그리고 각 페이지를 실제로 조작하는 기능 테스트"],
          ]}
        />
        <p>테스트를 둘로 나눈 이유는 diff 같은 순수 로직은 Node에서 빠르게 돌리고, DOM이 필요한 부분은 jsdom 같은 의존성 없이 진짜 브라우저에서 검증하기 위해서입니다. 기능 테스트는 페이지를 iframe에 띄우고 버튼 클릭, 입력 이벤트를 보낸 뒤 화면을 확인합니다.</p>
        <QA>
          <Q q="테스트 라이브러리를 안 쓴 이유는?">과제가 바닐라 스택과 핵심 로직 직접 구현을 강조해서 런타임 의존성을 0개로 유지했습니다. Node에는 <C>node:test</C>가 내장되어 있고, 브라우저 쪽은 test/assert/runAll 정도의 작은 하네스면 충분했습니다.</Q>
        </QA>
      </Topic>
    </>
  );
}

// --- 3부: 요청 구현 ---

function ExtraPart() {
  return (
    <>
      <Part id="part-extra" label="PART 3" title="요청으로 추가 구현한 부분">
        <p className="g-intro"><C>test-app</C> 브랜치의 라우터와 예시 앱입니다. 엔진이 실제 앱을 만들 수 있을 만큼 쓸모 있는지 확인하는 목적입니다.</p>
      </Part>

      <Topic id="b-router" title="해시 라우터" file="router.ts" chip="extra">
        <Code code={`
startRouter(
  <Routes>
    <Route path="/" element={<Home />} />
    <Route path="/budget/entries/:id" element={<EntryPage />} />
    <Route path="/budget/:month?" element={<MonthPage />} />
    <Route path="*" element={<NotFound />} />
  </Routes>,
  document.getElementById("root"),
  { rootOnlyHooks: true },
);`} />
        <p>사용법은 React Router와 비슷하지만 구조가 다릅니다. <strong>라우터는 컴포넌트가 아니라 함수</strong>입니다.</p>
        <h4>왜 컴포넌트로 만들지 않았나</h4>
        <p>React Router의 <C>{"<Routes>"}</C>는 내부에서 현재 위치를 state와 Context로 들고 있는 컴포넌트입니다. 그렇게 만들면 라우터가 루트가 되고, 실제 페이지(<C>Phase2Page</C> 등)는 자식이 되어 <strong>훅을 쓸 수 없습니다</strong>(rootOnlyHooks 위반). 실제로 처음에 그렇게 만들었다가 이 충돌을 확인하고 구조를 바꿨습니다.</p>
        <p>지금 구조에서 <C>startRouter</C>는 주소에 맞는 라우트의 <C>element</C>를 <C>render()</C>에 <strong>최상위로</strong> 넘깁니다. 그래서 각 페이지가 곧 루트 컴포넌트가 되고, 페이지 안에서는 훅을 자유롭게 쓰되 그 자식은 여전히 순수 함수여야 합니다.</p>
        <h4>동작 순서 (hashchange마다 sync 실행)</h4>
        <ol>
          <li><C>location.hash</C>에서 경로를 읽고 <C>?</C> 뒤는 뗍니다.</li>
          <li>선언 순서대로 <C>matchPath</C>를 시도해 처음 맞는 라우트를 고릅니다.</li>
          <li>라우트가 바뀌는데 leave guard가 거부하면 <C>location.replace</C>로 주소를 되돌리고 끝냅니다.</li>
          <li><strong>라우트가 바뀌면</strong> <C>unmount(container)</C>로 이전 페이지의 effect를 정리하고 스크롤을 맨 위로 올립니다.</li>
          <li><C>params</C>를 페이지 props에 넣어 <C>render()</C>합니다. <strong>파라미터만 바뀌면</strong>(<C>/budget/2026-10</C> → <C>/budget/2026-11</C>) unmount하지 않으므로 같은 루트가 다시 렌더되어 state가 유지됩니다.</li>
        </ol>
        <h4>matchPath</h4>
        <Table
          head={["패턴", "뜻", "예"]}
          rows={[
            [<C>:id</C>, "값 하나 (필수)", <><C>/entries/:id</C> ↔ <C>/entries/7</C> → <C>{'{ id: "7" }'}</C></>],
            [<C>:month?</C>, "있어도 없어도 됨", <><C>/budget</C>, <C>/budget/2026-11</C> 모두 맞음</>],
            [<C>*</C>, "나머지 전부", "404 페이지"],
          ]}
        />
        <p>경로 조각은 <C>decodeURIComponent</C>로 풉니다. <C>location.hash</C>는 한글을 <C>%ED%95%9C</C>처럼 인코딩해서 돌려주므로, 풀지 않으면 한글 경로가 맞지 않습니다(실제로 겪은 버그). 깨진 인코딩은 에러 대신 원래 문자열을 씁니다.</p>
        <ul>
          <li><C>Link</C>는 진짜 <C>{'<a href="#/...">'}</C>를 그립니다. 새 탭 열기, 주소 복사, 키보드 이동이 브라우저 기본대로 동작합니다.</li>
          <li><C>{"navigate(to, { replace })"}</C>: replace면 <C>location.replace</C>로 기록을 남기지 않습니다(저장 후 폼 페이지로 뒤로가기 방지). 숫자를 주면 <C>history.go</C>입니다.</li>
          <li><C>Route</C>, <C>Routes</C>는 호출되지 않는 표식 함수입니다. <C>collectRoutes</C>가 JSX 트리에서 props만 읽어 라우트 표를 만듭니다.</li>
        </ul>
        <QA>
          <Q q="useParams가 없는데 페이지는 파라미터를 어떻게 받나요?">React Router는 Context로 내려주지만, 저는 Context를 구현하지 않았고 라우터가 컴포넌트도 아닙니다. 대신 라우터가 페이지 vnode의 props에 <C>params</C>를 넣어 렌더합니다. 페이지가 루트라서 전달 단계가 한 번뿐이므로 Context가 필요 없습니다.</Q>
          <Q q="페이지마다 루트를 따로 두는 게 명세의 &quot;최상위 컴포넌트&quot; 조건을 만족하나요?">한 시점에 화면에 있는 루트는 하나이고, 그 루트만 상태와 훅을 가지며 자식은 순수 함수라는 점에서 조건을 지킨다고 봤습니다. 엔진이 rootOnlyHooks로 이를 강제합니다. 다만 해석의 여지가 있어 코치님께 확인할 부분으로 정리해 두었습니다.</Q>
        </QA>
      </Topic>

      <Topic id="b-unmount" title="unmount와 남은 렌더 예약" file="render.ts" chip="extra">
        <p>라우트를 바꿀 때 이전 페이지를 깨끗이 정리하려고 엔진에 <C>unmount(container)</C>를 추가했습니다. 루트 기록을 지우고, 화면을 비우고, 모든 인스턴스의 <C>unmount()</C>를 불러 effect cleanup(타이머 정지, 이벤트 리스너 제거, MutationObserver 해제)을 실행합니다.</p>
        <p><strong>까다로운 경우</strong>: 이전 페이지에서 setState로 마이크로태스크 렌더를 예약해 둔 직후 라우트가 바뀔 수 있습니다. 그러면 예약된 렌더가 새 페이지 위에 옛 페이지를 그리려 합니다. 그래서 예약된 렌더는 실행 직전에 <C>roots.get(root.container) === root</C>인지, 즉 자기 루트가 아직 살아 있는지 확인합니다.</p>
      </Topic>

      <Topic id="b-guard" title="이탈 확인 (Leave Guard)" chip="extra">
        <p>Phase 1에서 편집하던 중 다른 메뉴를 누르면 편집 내용이 사라지는 문제를 겪고 추가했습니다. 페이지가 <C>{"setLeaveGuard(() => boolean)"}</C>로 "떠나도 되는지 묻는 함수"를 등록합니다.</p>
        <ul>
          <li>Phase 1: 테스트 영역과 현재 기록을 diff해서 차이가 있을 때만 <C>confirm</C>. 페이지 안의 뒤로/앞으로 버튼과 같은 함수를 씁니다.</li>
          <li>가계부: <C>useLeaveConfirm(dirty)</C> 커스텀 훅. dirty일 때만 effect에서 guard를 등록하고, cleanup에서 해제합니다.</li>
        </ul>
        <p><strong>한계</strong>: <C>hashchange</C>는 주소가 이미 바뀐 뒤에 발생하므로 진짜로 막을 수는 없고, 거부하면 이전 주소로 되돌립니다. 브라우저 뒤로가기를 취소하면 기록 스택이 원래와 조금 달라지고, 탭 닫기와 새로고침에는 아직 <C>beforeunload</C> 확인이 없습니다.</p>
      </Topic>

      <Topic id="b-budget" title="가계부 예시 앱" file="pages/budget/" chip="extra">
        <Table
          head={["라우트", "페이지"]}
          rows={[
            [<C>/budget/:month?</C>, "월별 내역과 합계, 이전/다음 달 이동"],
            [<C>/budget/new/:month?</C>, "새 항목 추가"],
            [<C>/budget/entries/:id</C>, "항목 상세, 삭제"],
            [<C>/budget/entries/:id/edit</C>, "항목 수정"],
            [<C>/budget/stats</C>, "최근 6개월 통계, SVG 막대 차트"],
          ]}
        />
        <p>파일은 역할별로 나눴습니다. <C>store.ts</C>(데이터와 계산), <C>ui.tsx</C>(순수 컴포넌트: 레이아웃, 합계, 차트, 폼), <C>pages.tsx</C>(라우트별 루트 컴포넌트)입니다.</p>
        <h4>페이지 사이 데이터 공유</h4>
        <p>페이지마다 루트가 다르고 라우트가 바뀌면 이전 루트의 state는 사라집니다. 그래서 데이터는 컴포넌트 밖 <strong>모듈 저장소</strong>(localStorage + 메모리 대체)에 두고, 각 페이지는 <C>useEntries()</C> 커스텀 훅으로 읽습니다.</p>
        <ul>
          <li><strong>저장은 effect를 기다리지 않고 즉시</strong>: 저장 직후 <C>navigate</C>로 다른 라우트에 가면 effect가 실행되기 전에 unmount될 수 있기 때문입니다.</li>
          <li><strong>다른 탭 반영</strong>: <C>storage</C> 이벤트를 effect에서 구독합니다.</li>
          <li><strong>메모리 대체</strong>: 시크릿 모드처럼 localStorage가 막혀도 앱이 동작합니다.</li>
          <li><strong>검증</strong>: 저장된 값을 <C>isEntryList</C>로 검사합니다.</li>
        </ul>
        <h4>실제로 겪은 클로저 버그</h4>
        <p>수정 폼에서 키 입력이 렌더 전에 연달아 들어오면 앞 입력이 사라졌습니다. 핸들러가 <C>{"setEdit({ ...draft, title })"}</C>처럼 <strong>렌더 시점의 draft</strong>로 새 값을 만들었기 때문입니다. <C>{"setEdit(prev => ...)"}</C> 함수형 업데이트로 바꿔 해결했습니다. 또 같은 페이지에서 id만 바뀌면 state가 유지되므로, 작성 중인 내용을 <C>{"{ id, draft }"}</C>로 묶어 다른 항목의 초안이 섞이지 않게 했습니다.</p>
        <QA>
          <Q q="전역 상태 관리 라이브러리 없이 페이지 간 데이터를 어떻게 공유했나요?">데이터의 원본을 컴포넌트 밖 모듈 저장소(localStorage)에 두고, 각 페이지 루트가 첫 렌더에 읽어 자기 state로 씁니다. 바꿀 때는 저장소에 먼저 쓰고 state를 갱신합니다. 페이지가 동시에 하나만 떠 있으므로 이 정도면 충분했고, 다른 탭과의 동기화는 storage 이벤트로 처리했습니다.</Q>
        </QA>
      </Topic>
    </>
  );
}

// --- 4부: 마무리 ---

const RAPID_QA: Array<[q: string, a: VNodeChild]> = [
  ["Virtual DOM이란?", "실제 DOM 구조를 흉내 낸 가벼운 JS 객체 트리입니다. 이전 트리와 비교해 바뀐 부분만 실제 DOM에 반영하려고 씁니다."],
  ["diff와 patch의 차이는?", "diff는 두 트리를 비교해 \"무엇을 바꿀지\" 목록을 만들고, patch는 그 목록대로 실제 DOM을 고칩니다. 계산과 반영을 나눈 것입니다."],
  ["slot이 뭔가요?", <>트리 안의 자리를 나타내는 경로 문자열(<C>root/i:0/k:3</C>)입니다. 렌더가 달라도 slot이 같으면 같은 노드로 보고 DOM과 상태를 재사용합니다.</>],
  ["교체는 어떻게 감지하나요?", "같은 slot인데 태그나 종류가 다르면 재사용할 수 없으므로 옛 노드는 removed, 새 노드는 INSERT가 됩니다. 변경 로그에서는 이를 교체로 묶어 보여 줍니다."],
  ["Hook 값은 어디 저장되나요?", <>컴포넌트 자리마다 하나씩 있는 FunctionComponent 인스턴스의 <C>hooks</C> 배열에 호출 순서대로 저장됩니다.</>],
  ["현재 렌더 중인 컴포넌트는 어떻게 아나요?", <>렌더 직전에 모듈 전역 <C>currentInstance</C>에 인스턴스를 넣고, 끝나면 finally에서 비웁니다.</>],
  ["setState는 언제 화면에 반영되나요?", "바로가 아니라 마이크로태스크에 예약된 렌더에서 반영됩니다. 같은 틱의 여러 setState는 한 번에 처리됩니다."],
  ["함수형 업데이트는 왜 필요한가요?", <>핸들러가 붙잡은 state는 그 렌더 시점 값이라, 연속 호출이나 interval 안에서는 오래된 값일 수 있습니다. <C>{"set(prev => ...)"}</C>는 항상 최신 값을 받습니다.</>],
  ["useEffect는 언제 실행되나요?", "DOM 반영(commit)이 끝난 뒤, 자식부터 부모 순으로 실행됩니다. deps가 바뀌었을 때만 실행되고 이전 cleanup이 먼저 호출됩니다."],
  ["useMemo는 언제 쓰나요?", "렌더마다 다시 하기 아까운 계산이 있을 때 씁니다. Focus Board에서는 타이머가 매초 렌더해도 필터 결과를 다시 계산하지 않게 했습니다."],
  ["부모가 렌더되지 않으면 자식은?", "자식이 받는 vnode가 이전과 같은 객체이므로 호출을 건너뛰고 이전 출력을 재사용합니다. dirty인 자식만 다시 호출됩니다."],
  ["컴포넌트가 사라지면?", "렌더 중 방문하지 않은 slot의 인스턴스를 모아, commit 후 새 effect보다 먼저 cleanup을 실행하고 Map에서 지웁니다."],
  ["key 중복이면?", "slot이 겹쳐 상태와 DOM 짝이 깨지므로 expand에서 즉시 에러를 던집니다."],
  ["null을 반환하는 컴포넌트는?", "빈 자리(empty)가 되고 DOM에는 주석 노드가 남습니다. 뒤 형제의 자리가 유지됩니다."],
  ["input value는 왜 특별 취급하나요?", "입력값은 attribute가 아니라 property에 있고, 같은 값을 다시 쓰면 커서가 튀기 때문에 다를 때만 property를 씁니다."],
  ["State History는 무엇을 저장하나요?", "DOM이 아니라 Virtual DOM입니다. 기록 이동도 현재와 목표 VDOM의 diff/patch로 처리합니다."],
  ["patch가 최소 변경임을 어떻게 보였나요?", "MutationObserver로 patch가 일으킨 DOM 변경 수를 세어 화면에 보여 주고, 테스트에서 바뀌지 않은 노드가 같은 객체인지 확인했습니다."],
  ["라우터가 컴포넌트가 아닌 이유는?", "컴포넌트면 라우터가 루트가 되어 페이지가 훅을 못 씁니다. 함수로 만들어 페이지를 루트로 직접 렌더합니다."],
  ["라우트 이동과 파라미터 변경의 차이는?", "라우트가 바뀌면 이전 루트를 unmount해 상태와 effect를 정리하고, 파라미터만 바뀌면 같은 루트를 다시 렌더해 상태를 유지합니다."],
  ["React와 가장 큰 차이 하나만 꼽는다면?", "렌더 단계를 중단할 수 없다는 점입니다. React는 Fiber로 작업을 잘게 나눠 우선순위에 따라 멈추고 재개하지만, 제 구현은 재귀로 한 번에 끝냅니다."],
];

function WrapUpPart() {
  return (
    <>
      <Part id="part-wrap" label="PART 4" title="마무리 점검" />

      <Topic id="qa-rapid" title="빠른 문답 20선">
        <p>한두 문장으로 바로 답할 수 있도록 연습하세요.</p>
        <QA title={null}>
          {RAPID_QA.map(([q, a]) => <Q key={q} q={q}>{a}</Q>)}
        </QA>
      </Topic>

      <Topic id="limits" title="한계와 개선 방향">
        <p>"부족한 점은?" 질문에는 한계와 함께 개선 방법을 말하면 좋습니다.</p>
        <Table
          head={["한계", "개선 방향"]}
          rows={[
            ["렌더 중단 불가", <>Fiber처럼 작업 단위로 쪼개 반복문으로 순회, <C>requestIdleCallback</C>이나 MessageChannel로 나눠 실행</>],
            ["이동 최적화 없음", "LIS로 움직이지 않아도 되는 노드를 찾아 이동 최소화"],
            ["요소별 이벤트 리스너", "루트 이벤트 위임"],
            [<><C>useRef</C>, Context 없음</>, "hooks 배열에 ref 칸 추가, Provider 경로 기반 Context"],
            ["에러 경계 없음", "렌더 실패 시 이전 화면 유지 또는 대체 UI"],
            ["effect가 동기 실행", "layout effect와 passive effect 분리"],
            ["해시 라우터만 지원, 중첩 라우트 없음", "History API 모드 + 서버 폴백, Outlet 방식 중첩"],
            ["탭 닫기·새로고침 이탈 확인 없음", <><C>beforeunload</C> 처리</>],
            [<><C>/budget/abc</C>가 404 대신 이번 달 표시</>, "월 형식 검증 후 NotFound"],
          ]}
        />
      </Topic>
    </>
  );
}

// --- 루트 페이지 ---

export function InterviewNotePage() {
  useEffect(() => {
    document.title = "mini-react 면접 노트";
  }, []);

  // 이 페이지에서만 쓰는 글꼴이므로 들어올 때 붙이고 떠날 때 뗀다. 불러오지 못하면 시스템 글꼴을 쓴다
  useEffect(() => {
    if (document.getElementById(FONT_ID) !== null) return;
    const link = document.createElement("link");
    link.id = FONT_ID;
    link.rel = "stylesheet";
    link.href = FONT_HREF;
    document.head.append(link);
    return () => link.remove();
  }, []);

  return (
    <div className="guide">
      <div className="g-shell">
        <Toc />
        <main className="g-main">
          <header className="g-hero">
            <Link className="g-back" to="/">← mini-react</Link>
            <div className="g-eyebrow">Krafton Jungle · Week 11 · mini-react</div>
            <h1>구현 방식과 React 원리, 면접 질문까지 한 번에</h1>
            <p className="g-lede">직접 만든 mini-react의 각 부분이 <strong>무엇을 하는지, 어떻게 동작하는지, 왜 그렇게 만들었는지</strong>를 차례로 설명합니다. 각 절 끝에는 면접에서 나올 만한 질문과 답변 예시를 붙였습니다. 코드는 <C>test-app</C> 브랜치 기준입니다.</p>
            <div className="g-legend">
              <Chip kind="theory" />
              <Chip kind="spec" />
              <Chip kind="extra" />
            </div>
          </header>
          <ReactTheory />
          <SpecPart />
          <ExtraPart />
          <WrapUpPart />
        </main>
      </div>
    </div>
  );
}
