import { h } from "../createElement.js";
import { useEffect } from "../hooks.js";
import { Link, Route, Routes, startRouter } from "../router.js";
import { InterviewNotePage } from "./interview.js";
import { EditEntryPage, EntryPage, MonthPage, NewEntryPage, StatsPage } from "./budget/pages.js";
import { Phase1Page } from "./phase1.js";
import { Phase2Page } from "./phase2.js";

function Home() {
  useEffect(() => {
    document.title = "mini-react";
  }, []);

  return (
    <main className="page narrow">
      <header className="page-header">
        <h1>mini-react</h1>
        <p>Virtual DOM, Diff, Patch, Component, Hooks, Router를 의존성 없이 TypeScript로 직접 구현했습니다.</p>
      </header>
      <nav className="link-list">
        <Link className="link-card" to="/phase1">
          <strong>Phase 1. Diff 검증 페이지</strong>
          <span>HTML을 고치고 Patch를 누르면 바뀐 부분만 실제 영역에 반영됩니다. 뒤로가기와 앞으로가기를 지원합니다.</span>
        </Link>
        <Link className="link-card" to="/phase2">
          <strong>Phase 2. Focus Board</strong>
          <span>루트 컴포넌트에만 상태를 둔 할 일 보드입니다. 갱신마다 실제 DOM 변경 수를 보여 줍니다.</span>
        </Link>
        <Link className="link-card" to="/budget">
          <strong>예시 앱. 가계부</strong>
          <span>월별 내역, 항목 상세와 수정, 통계를 라우트로 나눈 앱입니다. mini-react만으로 만들었습니다.</span>
        </Link>
        {/* 테스트 러너는 앱과 분리된 별도 문서이므로 라우트가 아니다 */}
        <a className="link-card" href="./tests.html">
          <strong>브라우저 테스트</strong>
          <span>DOM이 필요한 단위 테스트와 각 페이지의 기능 테스트를 실행합니다.</span>
        </a>
        <Link className="link-card" to="/interview">
          <strong>mini-react 면접 노트</strong>
          <span>구현 방식과 React의 동작 원리를 면접 질문과 답변 예시와 함께 정리했습니다.</span>
        </Link>
      </nav>
    </main>
  );
}

function NotFound() {
  useEffect(() => {
    document.title = "페이지를 찾을 수 없습니다";
  }, []);

  return (
    <main className="page narrow">
      <Link className="back-link" to="/">mini-react</Link>
      <h1>페이지를 찾을 수 없습니다</h1>
      <p id="not-found" className="empty-state">주소를 확인하거나 첫 화면으로 돌아가세요.</p>
    </main>
  );
}

// 각 페이지가 루트 컴포넌트가 되므로, 명세의 "훅과 상태는 루트에만" 제약을 모든 페이지에 강제한다
startRouter(
  <Routes>
    <Route path="/" element={<Home />} />
    <Route path="/phase1" element={<Phase1Page />} />
    <Route path="/phase2" element={<Phase2Page />} />
    <Route path="/interview" element={<InterviewNotePage />} />
    {/* 먼저 선언한 라우트가 이기므로 고정 경로를 파라미터 경로보다 앞에 둔다 */}
    <Route path="/budget/new/:month?" element={<NewEntryPage />} />
    <Route path="/budget/stats" element={<StatsPage />} />
    <Route path="/budget/entries/:id/edit" element={<EditEntryPage />} />
    <Route path="/budget/entries/:id" element={<EntryPage />} />
    <Route path="/budget/:month?" element={<MonthPage />} />
    <Route path="*" element={<NotFound />} />
  </Routes>,
  document.getElementById("root")!,
  { rootOnlyHooks: true },
);
document.body.dataset.ready = "true";
