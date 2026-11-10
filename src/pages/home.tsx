import { h } from "../createElement.js";
import { useEffect, useState } from "../hooks.js";
import { Link } from "../router.js";
import type { VNodeChild } from "../types.js";

// 랜딩페이지: 결제 모듈을 해킹하면 자판기가 고장 나고, 고장 난 자판기는 음료를 공짜로 내준다.
// 디자인 기준은 design/cyberpunk2077/README.md. 스타일은 styles.css의 "랜딩: 자판기" 절에 있다.

interface Drink {
  id: string;
  code: string;   // 자판기 버튼 번호
  name: string;
  note: string;
  price: number;
  can: string;   // 캔 몸통의 배경
}

const DRINKS: Drink[] = [
  { id: "chrome-cola", code: "A1", name: "크롬 콜라", note: "진한 탄산", price: 1500, can: "linear-gradient(90deg, #6b0f1f, #d4223f 45%, #ff8a9a 55%, #8e1428)" },
  { id: "neon-cider", code: "A2", name: "네온 사이다", note: "라임 향", price: 1200, can: "linear-gradient(90deg, #2c5d12, #8ee53f 45%, #e3ffb8 55%, #3f7d18)" },
  { id: "synapse", code: "A3", name: "시냅스 부스트", note: "에너지 음료", price: 2400, can: "linear-gradient(90deg, #00424a, #00c2d9 45%, #b8f7ff 55%, #006a78)" },
  { id: "midnight", code: "B1", name: "심야 아메리카노", note: "무가당", price: 1800, can: "linear-gradient(90deg, #2b1a10, #7a4a2a 45%, #d9b090 55%, #3d2516)" },
  { id: "lemonade", code: "B2", name: "합성 레모네이드", note: "레몬 향", price: 1300, can: "linear-gradient(90deg, #6b6200, #e6d800 45%, #fffbb0 55%, #8f8400)" },
  { id: "blackout", code: "B3", name: "정전 밀크티", note: "흑당", price: 2100, can: "linear-gradient(90deg, #2a1d3d, #6d4f9c 45%, #d2c0f0 55%, #3a2856)" },
];

const HACK_STEPS = [
  "결제 모듈에 접속",
  "펌웨어 서명 검사 우회",
  "가격표 메모리를 0으로 덮어쓰기",
  "배출구 잠금 해제",
];

const PAGES: Array<{ to: string; nav: string; title: string; description: string; external?: boolean }> = [
  {
    to: "/phase1",
    nav: "Diff 검증",
    title: "Phase 1. Diff 검증 페이지",
    description: "HTML을 고치고 Patch를 누르면 바뀐 부분만 실제 영역에 반영됩니다. 뒤로가기와 앞으로가기를 지원합니다.",
  },
  {
    to: "/phase2",
    nav: "Focus Board",
    title: "Phase 2. Focus Board",
    description: "루트 컴포넌트에만 상태를 둔 할 일 보드입니다. 갱신마다 실제 DOM 변경 수를 보여 줍니다.",
  },
  {
    to: "/budget",
    nav: "가계부",
    title: "예시 앱. 가계부",
    description: "월별 내역, 항목 상세와 수정, 통계를 라우트로 나눈 앱입니다. mini-react만으로 만들었습니다.",
  },
  {
    to: "/interview",
    nav: "면접 노트",
    title: "mini-react 면접 노트",
    description: "구현 방식과 React의 동작 원리를 면접 질문과 답변 예시와 함께 정리했습니다.",
  },
  {
    // 테스트 러너는 앱과 분리된 별도 문서이므로 라우트가 아니다
    to: "./tests.html",
    nav: "테스트",
    title: "브라우저 테스트",
    description: "DOM이 필요한 단위 테스트와 각 페이지의 기능 테스트를 실행합니다.",
    external: true,
  },
];

const FONT_ID = "cp-fonts";
const FONT_HREF = "https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;700&family=IBM+Plex+Sans+KR:wght@400;600&family=JetBrains+Mono:wght@400&display=swap";

type Machine = "locked" | "hacking" | "broken" | "exploded";

// 꺼내는 곳에 놓인 캔 하나. x는 꺼내는 곳 너비에 대한 중심 위치(%), y는 바닥에서 캔 아랫면까지의 높이(px)
interface TrayCan {
  key: number;
  drinkId: string;
  x: number;
  y: number;
  rot: number;     // 놓인 각도. ±90 근처면 누운 캔
  delay: number;   // 대량 배출 때 떨어지기 시작하는 시차
}

const TRAY_CAPACITY = 30;   // 이보다 많이 담기면 자판기가 터진다
const TRAY_WARNING = 24;
const BURST_MIN = 8;
const BURST_MAX = 16;
const BURST_GAP_MS = 90;

// 진열칸의 캔과 같은 크기. 꺼내는 곳에서도 1:1로 그린다
const CAN_W = 34;
const CAN_H = 58;

// 회전한 캔이 화면에서 차지하는 너비와 높이
function footprint(rot: number): { w: number; h: number } {
  const rad = (rot * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  return { w: cos * CAN_W + sin * CAN_H, h: sin * CAN_W + cos * CAN_H };
}

// 이 위치에 놓으면 아래 캔 위에 얹혀 바닥에서 얼마나 뜨는지
function restHeight(existing: TrayCan[], width: number, center: number, w: number): number {
  let y = 0;
  for (const can of existing) {
    const other = footprint(can.rot);
    const otherCenter = (can.x / 100) * width;
    const overlap = Math.min(center + w / 2, otherCenter + other.w / 2) - Math.max(center - w / 2, otherCenter - other.w / 2);
    if (overlap > 12) y = Math.max(y, can.y + other.h - 8);   // 살짝 파고들어 더미가 자리를 잡은 것처럼 보이게 한다
  }
  return y;
}

// 무작위 위치에 떨어뜨린다. 캔은 구르다가 낮은 곳에 멈추므로, 후보 몇 곳 중 가장 낮게 놓이는 자리를 고른다
function placeCan(existing: TrayCan[], width: number): { x: number; y: number; rot: number } {
  const lying = Math.random() < 0.8;
  const side = Math.random() < 0.5 ? -1 : 1;
  const rot = lying ? side * (90 + randomInt(-12, 12)) : randomInt(-8, 8);
  const { w } = footprint(rot);
  let best = { center: w / 2, y: Infinity };
  for (let attempt = 0; attempt < 5; attempt++) {
    const center = w / 2 + Math.random() * Math.max(0, width - w);
    const y = restHeight(existing, width, center, w);
    if (y < best.y) best = { center, y };
  }
  return { x: (best.center / width) * 100, y: best.y, rot };
}

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function won(value: number): string {
  return value.toLocaleString("ko-KR");
}

// --- 전자기파 파형 ---
// 파형은 가로 800 단위로 그리고 400 단위만큼 옮기며 반복한다. 파장이 400의 약수여야 이음매가 보이지 않는다

const WAVE_PERIOD = 400;

function sinePath(amplitude: number, wavelength: number): string {
  let d = "M0 20";
  for (let x = 0; x <= WAVE_PERIOD * 2; x += 4) {
    d += ` L${x} ${(20 + amplitude * Math.sin((2 * Math.PI * x) / wavelength)).toFixed(2)}`;
  }
  return d;
}

// 고장 났을 때의 잡음. 매번 같은 모양이 나오도록 고정된 씨앗으로 만든다
function noisePath(): string {
  let seed = 7;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const points: number[] = [];
  for (let x = 0; x < WAVE_PERIOD; x += 6) points.push(20 + (random() - 0.5) * (random() < 0.15 ? 36 : 12));
  let d = "M0 20";
  for (let i = 0; i < points.length * 2; i++) d += ` L${i * 6} ${points[i % points.length].toFixed(2)}`;
  return d;
}

const WAVES = [
  { className: "w1", d: sinePath(9, 80) },
  { className: "w2", d: sinePath(5, 50) },
  { className: "w3", d: sinePath(13, 200) },
];
const NOISE = noisePath();

function reducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

// --- 자식 컴포넌트: 상태 없이 props만 받는 순수 함수 ---

function PageLink({ page, className, children }: {
  page: (typeof PAGES)[number];
  className: string;
  children?: VNodeChild;
}) {
  return page.external
    ? <a className={className} href={page.to}>{children}</a>
    : <Link className={className} to={page.to}>{children}</Link>;
}

function Header({ menuOpen, onToggleMenu }: { menuOpen: boolean; onToggleMenu: () => void }) {
  return (
    <header className="cp-header">
      <button
        id="cp-menu-btn"
        className="cp-menu-btn"
        type="button"
        aria-label={menuOpen ? "사이드바 닫기" : "사이드바 열기"}
        aria-expanded={String(menuOpen)}
        aria-controls="cp-sidebar"
        onClick={onToggleMenu}
      >
        <span className="cp-menu-icon" aria-hidden="true" />
      </button>
      <Link className="cp-brand" to="/">mini-react</Link>
      <nav className="cp-nav" aria-label="주요 페이지">
        {PAGES.map(page => (
          <PageLink key={page.to} page={page} className="cp-nav-link">{page.nav}</PageLink>
        ))}
      </nav>
    </header>
  );
}

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <div>
      <aside
        id="cp-sidebar"
        className={open ? "cp-sidebar open" : "cp-sidebar"}
        aria-label="전체 메뉴"
        aria-hidden={String(!open)}
      >
        <div className="cp-sidebar-head">
          <h2>전체 메뉴</h2>
          <button id="cp-sidebar-close" className="cp-ghost" type="button" onClick={onClose}>닫기</button>
        </div>
        <nav className="link-list">
          {PAGES.map(page => (
            <PageLink key={page.to} page={page} className="link-card">
              <strong>{page.title}</strong>
              <span>{page.description}</span>
            </PageLink>
          ))}
        </nav>
      </aside>
      <div className={open ? "cp-scrim open" : "cp-scrim"} aria-hidden="true" onClick={onClose} />
    </div>
  );
}

function Steps({ current }: { current: number }) {
  const labels = ["결제 모듈 해킹", "자판기 고장", "무료 음료 받기"];
  return (
    <ol className="cp-steps" aria-label="진행 단계">
      {labels.map((label, index) => (
        <li
          key={label}
          className={index < current ? "done" : index === current ? "current" : ""}
          aria-current={index === current ? "step" : undefined}
        >
          {label}
        </li>
      ))}
    </ol>
  );
}

function EmWave({ machine }: { machine: Machine }) {
  const reading = machine === "exploded" ? "신호 없음"
    : machine === "broken" ? "신호 손상"
    : machine === "hacking" ? "주파수 교란"
    : "2.4 GHz 안정";
  return (
    <div className="vm-signal">
      <svg className="vm-wave" viewBox="0 0 400 40" preserveAspectRatio="none" aria-hidden="true">
        <g className="vm-wave-sine">
          {WAVES.map(wave => <path key={wave.className} className={`vm-wave-line ${wave.className}`} d={wave.d} />)}
        </g>
        <g className="vm-wave-noise">
          <path className="vm-wave-line w1" d={NOISE} />
        </g>
        <g className="vm-wave-flat">
          <path className="vm-wave-line w1" d="M0 20 L800 20" />
        </g>
      </svg>
      <span className="vm-signal-reading">{reading}</span>
    </div>
  );
}

// 폭발 파편. 매번 같은 모양이 나오도록 고정된 씨앗으로 만든다
const SHARDS = (() => {
  let seed = 11;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const colors = ["#00f0ff", "#ff2bd6", "#f3ff1a", "#ff3b5c", "#e9ecf2"];
  return Array.from({ length: 22 }, (_, index) => {
    const angle = -Math.PI * (0.05 + 0.9 * random()) - (random() < 0.25 ? Math.PI * 0.9 : 0);
    const distance = 160 + random() * 260;
    return {
      key: index,
      style: [
        `--dx: ${(Math.cos(angle) * distance).toFixed(0)}px`,
        `--dy: ${(Math.sin(angle) * distance).toFixed(0)}px`,
        `--r: ${(random() * 720 - 360).toFixed(0)}deg`,
        `width: ${(4 + random() * 10).toFixed(0)}px`,
        `height: ${(3 + random() * 6).toFixed(0)}px`,
        `background: ${colors[index % colors.length]}`,
        `animation-delay: ${(random() * 60).toFixed(0)}ms`,
      ].join("; "),
    };
  });
})();

function Blast() {
  return (
    <div className="vm-blast" aria-hidden="true">
      <span className="vm-blast-flash" />
      <span className="vm-blast-ring" />
      <span className="vm-blast-ring late" />
      {SHARDS.map(shard => <span key={shard.key} className="vm-shard" style={shard.style} />)}
    </div>
  );
}

function Cracks() {
  return (
    <svg className="vm-cracks" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <path d="M58 100 L55 82 L61 70 L52 58 L57 44 L49 30 L53 18 L47 0" />
      <path d="M55 82 L40 76 L28 80 L14 72" />
      <path d="M52 58 L68 52 L80 56 L96 48" />
      <path d="M57 44 L44 40 L34 30 L20 32" />
      <path d="M49 30 L62 22 L74 24" />
    </svg>
  );
}

function VendingMachine({ machine, hackStep, trayCans, falling, lastDrop, denied, taken, lost, onSelect, onRandom, onHack, onReboot, onTake, onInstall }: {
  machine: Machine;
  hackStep: number;
  trayCans: TrayCan[];
  falling: number;   // 아직 떨어지는 중인 캔 수
  lastDrop: string | null;
  denied: Drink | null;   // 잔액이 부족해 거절된 음료
  taken: Record<string, number>;
  lost: number;      // 폭발로 날아간 캔 수
  onSelect: (drink: Drink) => void;
  onRandom: () => void;
  onHack: () => void;
  onReboot: () => void;
  onTake: () => void;
  onInstall: () => void;
}) {
  const broken = machine === "broken";
  const exploded = machine === "exploded";
  const percent = Math.round((hackStep / HACK_STEPS.length) * 100);
  const totalTaken = Object.values(taken).reduce((sum, count) => sum + count, 0);
  const count = trayCans.length;
  const warning = count >= TRAY_WARNING;

  let display: string;
  if (exploded) display = "치명적 오류. 적재 한계를 넘어 자판기가 파손되었습니다";
  else if (machine === "hacking") display = `해킹 진행 ${percent}%`;
  else if (broken && falling > 0 && lastDrop) display = lastDrop;
  else if (broken && warning) display = `적재 경고 ${count}/${TRAY_CAPACITY}. 더 담으면 위험합니다`;
  else if (broken && count > 0) display = `꺼내는 곳에 캔 ${count}개`;
  else if (broken) display = "ERR 0x0F 가격표 손상. 모든 음료 0 크레딧";
  else if (denied) display = `잔액 부족. ${denied.code} ${denied.name}: ${won(denied.price)} 크레딧 필요`;
  else display = "음료를 고르세요";

  const stateLabel = exploded ? "파손" : broken ? "고장" : machine === "hacking" ? "침입 감지" : "정상 영업";

  return (
    // 바깥 두 겹: 번지는 형광 빛(vm-frame)과 형광 테두리(vm-edge). 깎은 모서리 때문에 테두리를 겹으로 만든다
    <div className={`vm-frame is-${machine}${warning && broken ? " is-warning" : ""}`}>
      <div className="vm-edge">
        <section id="vending" className={`vm is-${machine}`} aria-label="자판기">
          <div className="vm-top">
            <span className="vm-name">NIGHT VEND 24</span>
            <span className="vm-led" aria-hidden="true" />
            <span className="vm-state">{stateLabel}</span>
          </div>

          <EmWave machine={machine} />

          <div className="vm-body">
            <ul className="vm-shelf" aria-label="음료 목록">
              {DRINKS.map(drink => (
                <li key={drink.id}>
                  <button
                    className={machine === "locked" && denied?.id === drink.id ? "vm-item picked" : "vm-item"}
                    type="button"
                    data-drink={drink.id}
                    disabled={machine === "hacking" || exploded}
                    aria-label={`${drink.code} ${drink.name}, ${broken ? "0" : won(drink.price)} 크레딧`}
                    onClick={() => onSelect(drink)}
                  >
                    <span className="vm-code" aria-hidden="true">{drink.code}</span>
                    <span className="vm-can" style={{ background: drink.can }} aria-hidden="true" />
                    <span className="vm-item-name">{drink.name}</span>
                    <span className="vm-item-note">{drink.note}</span>
                    <span className="vm-price">
                      {broken ? <s>{won(drink.price)}</s> : null}
                      <span className="vm-price-now">{broken ? "0" : won(drink.price)}</span>
                    </span>
                  </button>
                </li>
              ))}
              {exploded && <li className="vm-cracks-wrap" aria-hidden="true"><Cracks /></li>}
            </ul>

            <div className="vm-panel">
              <p id="vm-display" className="vm-display" role="status" aria-live="polite">
                <span id="vm-display-text">{display}</span>
                <span className="vm-cursor" aria-hidden="true" />
              </p>
              <dl className="vm-credit">
                <dt>잔액</dt>
                <dd><span id="vm-balance">0</span> 크레딧</dd>
              </dl>

              {machine === "locked" && (
                <button id="vm-hack" className="cp-primary" type="button" onClick={onHack}>결제 모듈 해킹</button>
              )}
              {machine === "hacking" && (
                <button id="vm-hack" className="cp-primary" type="button" disabled>해킹 중</button>
              )}
              {broken && (
                <div className="vm-modes">
                  <p className="vm-hint">칸을 누르면 그 음료가 하나씩 나옵니다.</p>
                  <button id="vm-random" className="cp-primary" type="button" disabled={falling > 0} onClick={onRandom}>
                    랜덤 대량 배출
                  </button>
                  <button id="vm-reboot" className="cp-ghost" type="button" disabled={count > 0} onClick={onReboot}>
                    자판기 재부팅
                  </button>
                </div>
              )}
              {exploded && (
                <button id="vm-install" className="cp-primary" type="button" onClick={onInstall}>새 자판기 설치</button>
              )}

              {machine !== "locked" && (
                <div className="vm-log">
                  <div
                    className="vm-progress"
                    role="progressbar"
                    aria-label="해킹 진행률"
                    aria-valuemin="0"
                    aria-valuemax="100"
                    aria-valuenow={String(percent)}
                  >
                    <div className="vm-progress-fill" style={{ width: `${percent}%` }} />
                  </div>
                  <ol>
                    {HACK_STEPS.map((step, index) => (
                      <li key={step} className={index < hackStep ? "ok" : index === hackStep ? "run" : "wait"}>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          </div>

          <div className={`vm-tray${count > 0 ? " filled" : ""}${warning ? " warning" : ""}`}>
            <div className="vm-tray-head">
              <span className="vm-tray-label">꺼내는 곳</span>
              <span id="vm-load" className="vm-load">적재 {count}/{TRAY_CAPACITY}</span>
            </div>
            <div id="vm-tray-box" className="vm-tray-box" aria-label={`꺼내는 곳의 캔 ${count}개`}>
              {trayCans.map(can => {
                const drink = DRINKS.find(item => item.id === can.drinkId)!;
                const height = footprint(can.rot).h;   // h는 JSX 팩토리라 다른 이름을 쓴다
                return (
                  <span
                    key={can.key}
                    className="vm-tray-can"
                    data-can-key={can.key}
                    data-drink-id={can.drinkId}
                    data-rot={can.rot}
                    style={{
                      left: `calc(${can.x.toFixed(2)}% - ${CAN_W / 2}px)`,
                      bottom: `${(can.y + height / 2 - CAN_H / 2).toFixed(1)}px`,
                      transform: `rotate(${can.rot}deg)`,
                      background: drink.can,
                    }}
                  />
                );
              })}
              {count === 0 && !exploded && <span className="vm-tray-empty">비어 있음</span>}
            </div>
            {count > 0 && !exploded && (
              <button id="vm-take" className="vm-tray-item" type="button" disabled={falling > 0} onClick={onTake}>
                꺼내기 {count}개
              </button>
            )}
          </div>

          <div className="vm-bag">
            <p>꺼낸 무료 음료 <strong id="vm-taken">{totalTaken}</strong>개</p>
            {lost > 0 && <p>폭발로 날아간 캔 <strong id="vm-lost">{lost}</strong>개</p>}
            {totalTaken > 0 && (
              <ul className="vm-bag-list" aria-label="꺼낸 음료">
                {DRINKS.filter(drink => taken[drink.id]).map(drink => (
                  <li key={drink.id}>
                    <span className="vm-can tiny" style={{ background: drink.can }} aria-hidden="true" />
                    {drink.name} <span className="vm-bag-count">{taken[drink.id]}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
      {exploded && <Blast />}
    </div>
  );
}

// --- 물리 애니메이션 ---
// 캔은 처음부터 꺼내는 곳의 최종 자리에 그린다. 그다음 진열칸 위치에서 출발하는 움직임만
// Web Animations API로 덧입힌다 (FLIP 방식). effect는 커밋 직후 같은 작업 안에서 실행되므로
// 캔이 최종 자리에 한 번 보였다가 튀는 일이 없다.
// 경로는 등가속도 운동 공식으로 16ms마다 직접 계산해 키프레임으로 넘긴다.

const GRAVITY = 0.0032;      // px/ms². 화면 높이 300px을 약 0.43초에 떨어진다
const RESTITUTION = 0.3;     // 바닥에 튈 때 남는 속도의 비율
const FRAME_MS = 16;

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

function easeOutQuad(t: number): number {
  return 1 - (1 - t) ** 2;
}

function centerOf(element: Element): { x: number; y: number } {
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function animateFall(can: TrayCan): Promise<void> {
  const element = document.querySelector<HTMLElement>(`[data-can-key="${can.key}"]`);
  const source = document.querySelector<HTMLElement>(`[data-drink="${can.drinkId}"] .vm-can`);
  if (element === null || source === null || typeof element.animate !== "function") return Promise.resolve();

  // 좌표는 모두 최종 자리의 중심을 원점으로 한다 (아래가 +y)
  const from = centerOf(source);
  const to = centerOf(element);
  const startX = from.x - to.x;
  const startY = from.y - to.y;
  // 선 채로 바닥에 닿으면 누운 자리보다 중심이 높다
  const lift = CAN_H / 2 - footprint(can.rot).h / 2;
  const impactY = -lift;
  const drop = Math.max(10, impactY - startY);

  const fallTime = Math.sqrt((2 * drop) / GRAVITY);
  const hop1Speed = GRAVITY * fallTime * RESTITUTION;
  const hop1Time = (2 * hop1Speed) / GRAVITY;
  const hop2Speed = hop1Speed * RESTITUTION;
  const hop2Time = (2 * hop2Speed) / GRAVITY;
  const rollTime = hop1Time + hop2Time + 80;
  const total = fallTime + rollTime;

  const frames: Keyframe[] = [];
  for (let t = 0; t <= total + FRAME_MS; t += FRAME_MS) {
    const time = Math.min(t, total);
    let x: number;
    let y: number;
    let rot: number;
    if (time <= fallTime) {
      // 자유 낙하: 옆으로 움직이지도, 돌지도 않고 그 자리에서 곧장 아래로 빨라진다
      x = startX;
      y = startY + 0.5 * GRAVITY * time * time;
      rot = 0;
    } else {
      // 바닥에 닿은 뒤: 넘어지며 두 번 튀고, 마찰로 느려지며 놓일 자리까지 굴러간다
      const after = time - fallTime;
      const tip = easeOutCubic(Math.min(1, after / (hop1Time * 0.9 + 1)));
      x = startX * (1 - easeOutQuad(Math.min(1, after / rollTime)));
      rot = can.rot * tip;
      let hop = 0;
      if (after < hop1Time) hop = hop1Speed * after - 0.5 * GRAVITY * after * after;
      else if (after < hop1Time + hop2Time) {
        const second = after - hop1Time;
        hop = hop2Speed * second - 0.5 * GRAVITY * second * second;
      }
      y = impactY * (1 - tip) - hop;
    }
    frames.push({ offset: time / total, transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${rot.toFixed(1)}deg)` });
    if (time === total) break;
  }

  const animation = element.animate(frames, { duration: total, delay: can.delay, easing: "linear", fill: "backwards" });
  // 바닥에 닿는 순간 꺼내는 곳을 살짝 흔든다
  const tray = element.closest<HTMLElement>(".vm-tray");
  const thud = setTimeout(() => {
    tray?.animate([{ transform: "translateY(0)" }, { transform: "translateY(2px)" }, { transform: "translateY(0)" }], { duration: 120 });
  }, can.delay + fallTime);
  // 탭이 숨겨지면 애니메이션 시간이 멈춰 finished가 늦게 온다. 예정 시간이 지나면 끝난 것으로 본다
  const deadline = new Promise<void>(resolve => setTimeout(resolve, can.delay + total + 250));
  return Promise.race([animation.finished.then(() => undefined, () => clearTimeout(thud)), deadline]);
}

// 폭발: 꺼내는 곳과 진열칸의 캔이 폭심에서 바깥으로 튕겨 나가 포물선을 그리며 떨어진다
function blastCans(): void {
  const origin = document.getElementById("vm-tray-box");
  if (origin === null) return;
  const center = centerOf(origin);
  const cans = document.querySelectorAll<HTMLElement>(".vm-tray-can, .vm-shelf .vm-can");
  cans.forEach((element, index) => {
    if (typeof element.animate !== "function") return;
    const here = centerOf(element);
    const baseRot = Number(element.dataset.rot ?? 0);
    const angle = Math.atan2(here.y - center.y - 60, here.x - center.x) + (Math.random() - 0.5) * 0.8;
    const speed = 0.55 + Math.random() * 0.7;
    const vx = Math.cos(angle) * speed;
    const vy = Math.min(-0.35, Math.sin(angle) * speed) - Math.random() * 0.4;   // 항상 위로 솟구친다
    const spin = (Math.random() - 0.5) * 1.6;
    const duration = 1300 + Math.random() * 400;
    const frames: Keyframe[] = [];
    for (let t = 0; t <= duration; t += FRAME_MS * 2) {
      const x = vx * t;
      const y = vy * t + 0.5 * GRAVITY * 0.6 * t * t;
      const fade = t > duration * 0.65 ? 1 - (t - duration * 0.65) / (duration * 0.35) : 1;
      frames.push({
        offset: t / duration,
        opacity: Math.max(0, fade),
        transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${(baseRot + spin * t).toFixed(1)}deg)`,
      });
    }
    frames[frames.length - 1] = { ...frames[frames.length - 1], offset: 1, opacity: 0 };
    element.animate(frames, { duration, delay: (index % 7) * 12, easing: "linear", fill: "forwards" });
  });
}

// --- 루트 컴포넌트: 상태와 훅은 모두 여기에만 둔다 ---

let menuTouched = false;   // 첫 렌더에서 메뉴 버튼으로 포커스를 옮기지 않기 위한 표시
let nextCanKey = 1;
const animatedCans = new Set<number>();   // 이미 떨어뜨린 캔. 다시 그려도 애니메이션을 반복하지 않는다

export function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [machine, setMachine] = useState<Machine>("locked");
  const [hackStep, setHackStep] = useState(0);
  const [trayCans, setTrayCans] = useState<TrayCan[]>([]);
  const [falling, setFalling] = useState(0);
  const [lastDrop, setLastDrop] = useState<string | null>(null);
  const [deniedId, setDeniedId] = useState<string | null>(null);
  const [taken, setTaken] = useState<Record<string, number>>({});
  const [lost, setLost] = useState(0);

  // 이 페이지에서만 쓰는 글꼴과 배경이므로 들어올 때 붙이고 떠날 때 뗀다
  useEffect(() => {
    document.title = "mini-react";
    document.body.classList.add("cp-body");
    menuTouched = false;
    animatedCans.clear();
    let link = document.getElementById(FONT_ID);
    if (link === null) {
      const created = document.createElement("link");
      created.id = FONT_ID;
      created.rel = "stylesheet";
      created.href = FONT_HREF;
      document.head.append(created);
      link = created;
    }
    const fonts = link;
    return () => {
      document.body.classList.remove("cp-body", "cp-menu-open");
      fonts.remove();
    };
  }, []);

  // 해킹은 단계마다 잠깐씩 멈추며 진행하고, 마지막 단계가 끝나면 자판기가 고장 난다
  useEffect(() => {
    if (machine !== "hacking") return;
    if (hackStep >= HACK_STEPS.length) {
      setMachine("broken");
      return;
    }
    const timer = setTimeout(() => setHackStep(step => step + 1), reducedMotion() ? 120 : 650);
    return () => clearTimeout(timer);
  }, [machine, hackStep]);

  // 새로 꺼내는 곳에 들어온 캔만 떨어뜨리고, 모두 닿으면 falling을 줄인다
  useEffect(() => {
    const fresh = trayCans.filter(can => !animatedCans.has(can.key));
    if (fresh.length === 0) return;
    for (const can of fresh) animatedCans.add(can.key);
    if (reducedMotion()) {
      setFalling(n => n - fresh.length);
      return;
    }
    Promise.all(fresh.map(animateFall)).then(() => setFalling(n => n - fresh.length));
  }, [trayCans]);

  // 마지막 캔까지 떨어졌을 때 적재 한계를 넘었으면 터진다
  const overloaded = trayCans.length > TRAY_CAPACITY;
  useEffect(() => {
    if (machine !== "broken" || !overloaded || falling > 0) return;
    setMachine("exploded");
    setLost(n => n + trayCans.length);
  }, [machine, overloaded, falling]);

  useEffect(() => {
    if (machine === "exploded" && !reducedMotion()) blastCans();
  }, [machine]);

  // 사이드바: 열면 닫기 버튼으로, 닫으면 메뉴 버튼으로 포커스를 옮기고 Esc로 닫는다
  useEffect(() => {
    document.body.classList.toggle("cp-menu-open", menuOpen);
    if (menuTouched) {
      document.getElementById(menuOpen ? "cp-sidebar-close" : "cp-menu-btn")?.focus();
    }
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const toggleMenu = () => {
    menuTouched = true;
    setMenuOpen(open => !open);
  };

  const closeMenu = () => {
    menuTouched = true;
    setMenuOpen(false);
  };

  const dispense = (drinkIds: string[], message: string) => {
    const width = document.getElementById("vm-tray-box")?.getBoundingClientRect().width || 300;
    // 다시 그리기 전에 여러 번 눌려도 앞선 캔을 덮어쓰지 않도록 항상 최신 목록 위에 쌓는다
    setTrayCans(prev => {
      const placed = [...prev];
      drinkIds.forEach((drinkId, index) => {
        placed.push({ key: nextCanKey++, drinkId, ...placeCan(placed, width), delay: index * BURST_GAP_MS });
      });
      return placed;
    });
    setFalling(n => n + drinkIds.length);
    setLastDrop(message);
  };

  // 직접 꺼내기: 고른 칸의 음료 하나
  const select = (drink: Drink) => {
    if (machine !== "broken") {
      setDeniedId(drink.id);
      return;
    }
    dispense([drink.id], `${drink.code} ${drink.name} 배출`);
  };

  // 랜덤 대량 배출: 고장 난 배출 모터가 아무 칸에서나 여러 개를 한꺼번에 떨어뜨린다
  const dropRandom = () => {
    const count = randomInt(BURST_MIN, BURST_MAX);
    const ids = Array.from({ length: count }, () => DRINKS[randomInt(0, DRINKS.length - 1)].id);
    dispense(ids, `배출 모터 폭주. 캔 ${count}개`);
  };

  const hack = () => {
    setDeniedId(null);
    setHackStep(0);
    setMachine("hacking");
  };

  const reboot = () => {
    setMachine("locked");
    setHackStep(0);
    setDeniedId(null);
    setLastDrop(null);
  };

  const take = () => {
    setTaken(prev => {
      const next = { ...prev };
      for (const can of trayCans) next[can.drinkId] = (next[can.drinkId] ?? 0) + 1;
      return next;
    });
    setTrayCans([]);
  };

  // 새 자판기: 폭발로 날아간 진열칸 캔의 애니메이션을 지워 제자리에 다시 보이게 한다
  const install = () => {
    document.querySelectorAll<HTMLElement>(".vm-shelf .vm-can").forEach(element => {
      element.getAnimations().forEach(animation => animation.cancel());
    });
    setTrayCans([]);
    setFalling(0);
    reboot();
  };

  const denied = DRINKS.find(drink => drink.id === deniedId) ?? null;
  const tookAny = Object.keys(taken).length > 0;
  const step = machine === "locked" || machine === "hacking" ? 0 : !tookAny && trayCans.length === 0 && machine === "broken" ? 1 : 2;

  return (
    <div className="cp">
      <Header menuOpen={menuOpen} onToggleMenu={toggleMenu} />
      <Sidebar open={menuOpen} onClose={closeMenu} />
      <main className="cp-main">
        <section className="cp-hero">
          <div className="cp-copy">
            <h1>잔액은 0 크레딧, 목은 마르다</h1>
            <p>
              mini-react로 만든 자판기입니다. 결제 모듈을 해킹하면 자판기가 고장 나고,
              고장 난 자판기는 음료를 공짜로 내줍니다. 꺼내는 곳에 {TRAY_CAPACITY}개 넘게 쌓이면 터집니다.
            </p>
            <p className="cp-sub">
              상태와 훅은 이 페이지의 루트 컴포넌트 하나에만 있고, 자판기와 메뉴는 props만 받는 함수입니다.
            </p>
            <Steps current={step} />
          </div>
          <VendingMachine
            machine={machine}
            hackStep={hackStep}
            trayCans={trayCans}
            falling={falling}
            lastDrop={lastDrop}
            denied={denied}
            taken={taken}
            lost={lost}
            onSelect={select}
            onRandom={dropRandom}
            onHack={hack}
            onReboot={reboot}
            onTake={take}
            onInstall={install}
          />
        </section>
      </main>
      <footer className="cp-footer">
        <p>사이버펑크 장르의 분위기를 참고한 오리지널 디자인입니다. 게임 Cyberpunk 2077 및 CD PROJEKT RED와 관계가 없습니다.</p>
      </footer>
      {machine === "exploded" && <div className="cp-flash" aria-hidden="true" />}
    </div>
  );
}
