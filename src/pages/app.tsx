import { h } from "../createElement.js";
import { useEffect } from "../hooks.js";
import { Link, Route, Routes, startRouter } from "../router.js";
import { Home } from "./home.js";
import { InterviewNotePage } from "./interview.js";
import { EditEntryPage, EntryPage, MonthPage, NewEntryPage, StatsPage } from "./budget/pages.js";
import { Phase1Page } from "./phase1.js";
import { Phase2Page } from "./phase2.js";

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
