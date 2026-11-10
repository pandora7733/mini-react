import { h } from "../createElement.js";
import { useEffect, useState } from "../hooks.js";
import { Link } from "../router.js";
import type { VNodeChild } from "../types.js";

// 랜딩페이지: 쓰레기통을 뒤져 모은 크레딧으로 음료를 사거나, 결제 모듈을 해킹해 공짜로 꺼낸다.
// 꺼내는 곳에 너무 많이 쌓이면 자판기가 터지고, 그 충격으로 화면 전체가 부서진다. 부서진 화면은 여러 번 눌러 고친다.
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
type WreckPhase = "none" | "breaking" | "wrecked";

// 꺼내는 곳에 놓인 캔 하나. x는 꺼내는 곳 너비에 대한 중심 위치(%), y는 바닥에서 캔 아랫면까지의 높이(px)
interface TrayCan {
  key: number;
  drinkId: string;
  x: number;
  y: number;
  rot: number;     // 놓인 각도. ±90 근처면 누운 캔
  delay: number;   // 대량 배출 때 떨어지기 시작하는 시차
}

const TRAY_CAPACITY = 30;   // 고장 난 자판기에 이보다 많이 담기면 터진다
const TRAY_WARNING = 24;
const BURST_MIN = 8;
const BURST_MAX = 16;
const BURST_GAP_MS = 90;
const REPAIR_CLICKS = 8;    // 부서진 화면을 이만큼 누르면 고쳐진다
const BREAK_MS = 1500;      // 부서지는 연출 동안에는 수리를 받지 않는다

// 진열칸의 캔과 같은 크기. 꺼내는 곳에서도 1:1로 그린다
const CAN_W = 34;
const CAN_H = 58;

const KEYS = ["A", "B", "C", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

function won(value: number): string {
  return value.toLocaleString("ko-KR");
}

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
}

function reducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

// --- 꺼내는 곳의 캔 배치 ---

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

// --- 파형 ---

// length 단위 길이의 사인파. 파장이 반복 거리의 약수여야 옮기며 반복할 때 이음매가 보이지 않는다
function sinePath(mid: number, amplitude: number, wavelength: number, length: number, step = 4): string {
  let d = `M0 ${mid}`;
  for (let x = 0; x <= length; x += step) {
    d += ` L${x} ${(mid + amplitude * Math.sin((2 * Math.PI * x) / wavelength)).toFixed(2)}`;
  }
  return d;
}

// 자판기 간판의 파형: 가로 800 단위로 그리고 400 단위만큼 옮기며 반복한다
const WAVES = [
  { className: "w1", d: sinePath(20, 9, 80, 800) },
  { className: "w2", d: sinePath(20, 5, 50, 800) },
  { className: "w3", d: sinePath(20, 13, 200, 800) },
];

// 고장 났을 때의 잡음
const NOISE = (() => {
  const random = seeded(7);
  const points: number[] = [];
  for (let x = 0; x < 400; x += 6) points.push(20 + (random() - 0.5) * (random() < 0.15 ? 36 : 12));
  let d = "M0 20";
  for (let i = 0; i < points.length * 2; i++) d += ` L${i * 6} ${points[i % points.length].toFixed(2)}`;
  return d;
})();

// 화면 전체 배경의 전자기장: 1600×900 화면에 3200 단위로 그리고 1600 단위만큼 옮기며 반복한다
const FIELD = [
  { className: "f1", d: sinePath(110, 18, 400, 3200, 8) },
  { className: "f2", d: sinePath(250, 46, 800, 3200, 8) },
  { className: "f3", d: sinePath(380, 10, 200, 3200, 8) },
  { className: "f1", d: sinePath(520, 60, 1600, 3200, 8) },
  { className: "f2", d: sinePath(650, 24, 320, 3200, 8) },
  { className: "f3", d: sinePath(790, 8, 160, 3200, 8) },
];

// --- 부서진 화면의 금 ---
// 폭심을 원점으로 한 단위 좌표(-1.6~1.6)로 만들고, 그릴 때 화면 크기에 맞춰 키운다.
// 순서가 수리 순서다: 뒤쪽(가지 → 바깥 고리 → 안쪽 고리)부터 사라지고, 큰 금(방사선)이 마지막에 사라진다

type Point = [number, number];

const SCREEN_CRACKS = (() => {
  const random = seeded(23);
  const RAYS = 18;
  const rings = [0.035, 0.08, 0.15, 0.26, 0.42];
  const toPath = (points: Point[]) => "M" + points.map(([x, y]) => `${x.toFixed(4)} ${y.toFixed(4)}`).join(" L");

  const rays: Point[][] = [];
  const branches: Point[][] = [];
  for (let i = 0; i < RAYS; i++) {
    let angle = (i * 2 * Math.PI) / RAYS + (random() - 0.5) * 0.25;
    let radius = 0.012;
    const points: Point[] = [[Math.cos(angle) * radius, Math.sin(angle) * radius]];
    while (radius < 1.6) {
      radius += 0.03 + random() * 0.07;
      angle += (random() - 0.5) * 0.12;
      points.push([Math.cos(angle) * radius, Math.sin(angle) * radius]);
    }
    rays.push(points);

    for (let b = 0; b < 2; b++) {
      const from = points[2 + Math.floor(random() * (points.length - 4))];
      let branchAngle = Math.atan2(from[1], from[0]) + (random() < 0.5 ? -1 : 1) * (0.35 + random() * 0.5);
      const branch: Point[] = [from];
      let [x, y] = from;
      const segments = 3 + Math.floor(random() * 3);
      for (let s = 0; s < segments; s++) {
        const length = 0.03 + random() * 0.05;
        branchAngle += (random() - 0.5) * 0.4;
        x += Math.cos(branchAngle) * length;
        y += Math.sin(branchAngle) * length;
        branch.push([x, y]);
      }
      branches.push(branch);
    }
  }

  // 고리는 각 방사선에서 그 반지름에 가장 가까운 점끼리 잇는다 (거미줄 무늬)
  const nearest = (points: Point[], radius: number): Point =>
    points.reduce((best, point) => Math.abs(Math.hypot(...point) - radius) < Math.abs(Math.hypot(...best) - radius) ? point : best);
  const ringPoints = rings.map(radius => rays.map(points => nearest(points, radius)));
  const ringSegments: Point[][] = [];
  ringPoints.forEach(points => {
    points.forEach((point, i) => {
      const next = points[(i + 1) % points.length];
      if (random() < 0.25) return;   // 고리가 군데군데 끊겨 있어야 자연스럽다
      const sag = 1 + (random() - 0.5) * 0.18;
      const middle: Point = [((point[0] + next[0]) / 2) * sag, ((point[1] + next[1]) / 2) * sag];
      ringSegments.push([point, middle, next]);
    });
  });

  // 고리 사이의 유리 조각. 조각마다 빛을 다르게 받아 깨진 유리처럼 보인다
  const cells: Array<{ d: string; opacity: number }> = [];
  for (let k = 0; k < rings.length - 1; k++) {
    for (let i = 0; i < RAYS; i++) {
      const j = (i + 1) % RAYS;
      const quad = [ringPoints[k][i], ringPoints[k][j], ringPoints[k + 1][j], ringPoints[k + 1][i]];
      cells.push({ d: toPath(quad) + " Z", opacity: random() * 0.12 });
    }
  }

  const hole = toPath(ringPoints[0].map(([x, y]) => [x * (0.7 + random() * 0.35), y * (0.7 + random() * 0.35)] as Point)) + " Z";
  const cracks = [
    ...rays.map(points => ({ d: toPath(points), kind: "ray" })),
    ...ringSegments.map(points => ({ d: toPath(points), kind: "ring" })),
    ...branches.map(points => ({ d: toPath(points), kind: "branch" })),
  ];
  return { cracks, cells, hole };
})();

// --- 부서질 때 각 부분이 밀려나는 정도 ---
// 피해(0~1)를 곱해 transform으로 쓴다. 수리할수록 피해가 줄어 제자리로 돌아온다

interface Offset {
  x: number;
  y: number;
  r: number;
  delay: number;   // 폭발이 닿는 시차 (ms)
}

const OFFSETS = {
  machine: { x: 16, y: 34, r: 4.5, delay: 0 },
  sign: { x: -6, y: 30, r: -13, delay: 60 },
  flap: { x: 0, y: 6, r: 48, delay: 40 },
  header: { x: 0, y: 22, r: -3.5, delay: 260 },
  menu: { x: -6, y: 34, r: -24, delay: 320 },
  brand: { x: 10, y: 16, r: 9, delay: 300 },
  credit: { x: 20, y: 60, r: 32, delay: 280 },
  h1: { x: -40, y: 52, r: -8, delay: 200 },
  lead: { x: 28, y: 90, r: 5, delay: 240 },
  sub: { x: -14, y: 130, r: -4, delay: 280 },
  footer: { x: 0, y: 44, r: 2.5, delay: 360 },
  trash: { x: -70, y: 14, r: -86, delay: 180 },
};

const NAV_OFFSETS: Offset[] = [
  { x: -10, y: 90, r: 28, delay: 340 },
  { x: 6, y: 150, r: -42, delay: 300 },
  { x: 0, y: 64, r: 16, delay: 280 },
  { x: 22, y: 190, r: 72, delay: 260 },
  { x: -8, y: 120, r: -26, delay: 240 },
];

const STEP_OFFSETS: Offset[] = [
  { x: -24, y: 160, r: -18, delay: 260 },
  { x: 34, y: 190, r: 26, delay: 300 },
  { x: -8, y: 230, r: -44, delay: 340 },
];

// 키패드 버튼은 몇 개가 빠져 매달린다
const KEY_OFFSETS: Offset[] = (() => {
  const random = seeded(5);
  return KEYS.map(() => random() < 0.45
    ? { x: (random() - 0.5) * 30, y: 10 + random() * 40, r: (random() - 0.5) * 160, delay: 20 }
    : { x: 0, y: 0, r: (random() - 0.5) * 10, delay: 20 });
})();

interface Wreck {
  damage: number;      // 0 = 멀쩡함, 1 = 완전히 부서짐
  breaking: boolean;   // 부서지는 중이면 시차를 두고 밀려난다
}

function damaged(offset: Offset, wreck: Wreck): Record<string, string> {
  const d = wreck.damage;
  return {
    transform: `translate(${(offset.x * d).toFixed(1)}px, ${(offset.y * d).toFixed(1)}px) rotate(${(offset.r * d).toFixed(2)}deg)`,
    transitionDelay: wreck.breaking ? `${offset.delay}ms` : "0ms",
  };
}

// --- 자식 컴포넌트: 상태 없이 props만 받는 순수 함수 ---

function PageLink({ page, className, style, children }: {
  page: (typeof PAGES)[number];
  className: string;
  style?: Record<string, string>;
  children?: VNodeChild;
}) {
  return page.external
    ? <a className={className} style={style} href={page.to}>{children}</a>
    : <Link className={className} style={style} to={page.to}>{children}</Link>;
}

function Header({ menuOpen, balance, wreck, onToggleMenu }: {
  menuOpen: boolean;
  balance: number;
  wreck: Wreck;
  onToggleMenu: () => void;
}) {
  return (
    <header className="cp-header dmg" style={damaged(OFFSETS.header, wreck)}>
      <button
        id="cp-menu-btn"
        className="cp-menu-btn dmg"
        style={damaged(OFFSETS.menu, wreck)}
        type="button"
        aria-label={menuOpen ? "사이드바 닫기" : "사이드바 열기"}
        aria-expanded={String(menuOpen)}
        aria-controls="cp-sidebar"
        onClick={onToggleMenu}
      >
        <span className="cp-menu-icon" aria-hidden="true" />
      </button>
      <Link className="cp-brand dmg" style={damaged(OFFSETS.brand, wreck)} to="/">mini-react</Link>
      <nav className="cp-nav" aria-label="주요 페이지">
        {PAGES.map((page, index) => (
          <PageLink key={page.to} page={page} className="cp-nav-link dmg" style={damaged(NAV_OFFSETS[index], wreck)}>
            {page.nav}
          </PageLink>
        ))}
      </nav>
      <span id="cp-credit" className="cp-credit dmg" style={damaged(OFFSETS.credit, wreck)}>
        <span className="cp-credit-coin" aria-hidden="true" />
        {won(balance)} 크레딧
      </span>
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

function Steps({ current, wreck }: { current: number; wreck: Wreck }) {
  const labels = ["결제 모듈 해킹", "자판기 고장", "무료 음료 받기"];
  return (
    <ol className="cp-steps" aria-label="해킹 진행 단계">
      {labels.map((label, index) => (
        <li
          key={label}
          className={`dmg ${index < current ? "done" : index === current ? "current" : ""}`}
          style={damaged(STEP_OFFSETS[index], wreck)}
          aria-current={index === current ? "step" : undefined}
        >
          {label}
        </li>
      ))}
    </ol>
  );
}

// 화면 전체 배경의 전자기장. 색과 속도는 .cp의 상태 클래스가 정한다
function Field() {
  return (
    <div className="cp-field" aria-hidden="true">
      <svg viewBox="0 0 1600 900" preserveAspectRatio="none">
        {FIELD.map((wave, index) => (
          <g key={index} className={`cp-field-wave ${wave.className}`}>
            <path className="cp-field-glow" d={wave.d} />
            <path className="cp-field-line" d={wave.d} />
          </g>
        ))}
      </svg>
      <div className="cp-field-pulse" />
    </div>
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

// 진열칸의 나선 코일 (정면에서 본 모습)
function Coil() {
  return (
    <svg className="vm-coil" viewBox="0 0 60 14" aria-hidden="true">
      <path className="back" d="M0 7 Q5 13 10 7 T20 7 T30 7 T40 7 T50 7 T60 7" />
      <path className="front" d="M0 7 Q5 1 10 7 T20 7 T30 7 T40 7 T50 7 T60 7" />
    </svg>
  );
}

// 폭발 파편과 유리 조각. 매번 같은 모양이 나오도록 고정된 씨앗으로 만든다
const SHARDS = (() => {
  const random = seeded(11);
  const colors = ["#00f0ff", "#ff2bd6", "#f3ff1a", "#ff3b5c", "#e9ecf2", "#ff8a1f"];
  return Array.from({ length: 44 }, (_, index) => {
    const angle = random() * Math.PI * 2;
    const distance = 260 + random() * 900;
    return {
      key: index,
      style: [
        `--dx: ${(Math.cos(angle) * distance).toFixed(0)}px`,
        `--dy: ${(Math.sin(angle) * distance - 120).toFixed(0)}px`,
        `--r: ${(random() * 1080 - 540).toFixed(0)}deg`,
        `width: ${(4 + random() * 14).toFixed(0)}px`,
        `height: ${(3 + random() * 8).toFixed(0)}px`,
        `background: ${colors[index % colors.length]}`,
        `color: ${colors[index % colors.length]}`,
        `animation-delay: ${(random() * 80).toFixed(0)}ms`,
      ].join("; "),
    };
  });
})();

const GLASS = (() => {
  const random = seeded(31);
  return Array.from({ length: 18 }, (_, index) => {
    const size = 24 + random() * 46;
    const points = [0, 1, 2].map(() => `${(random() * 100).toFixed(0)}% ${(random() * 100).toFixed(0)}%`).join(", ");
    const angle = -Math.PI / 2 + (random() - 0.5) * Math.PI * 1.6;
    const distance = 300 + random() * 700;
    return {
      key: index,
      style: [
        `left: ${((random() - 0.75) * 200).toFixed(0)}px`,
        `top: ${((random() - 0.7) * 260).toFixed(0)}px`,
        `width: ${size.toFixed(0)}px`,
        `height: ${(size * (0.6 + random())).toFixed(0)}px`,
        `clip-path: polygon(${points})`,
        `--dx: ${(Math.cos(angle) * distance).toFixed(0)}px`,
        `--dy: ${(Math.sin(angle) * distance + 500).toFixed(0)}px`,
        `--r: ${(random() * 900 - 450).toFixed(0)}deg`,
        `animation-delay: ${(random() * 60).toFixed(0)}ms`,
      ].join("; "),
    };
  });
})();

function Blast() {
  return (
    <div className="vm-blast" aria-hidden="true">
      <span className="vm-blast-fire" />
      <span className="vm-blast-fire second" />
      <span className="vm-blast-flash" />
      <span className="vm-blast-ring" />
      <span className="vm-blast-ring late" />
      <span className="vm-blast-ring last" />
      {GLASS.map(piece => <span key={`g${piece.key}`} className="vm-glass-shard" style={piece.style} />)}
      {SHARDS.map(shard => <span key={shard.key} className="vm-shard" style={shard.style} />)}
      {[0, 1, 2, 3, 4, 5].map(index => <span key={`s${index}`} className={`vm-smoke s${index}`} />)}
      {[0, 1, 2].map(index => <span key={`z${index}`} className={`vm-zap z${index}`} />)}
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
      <path d="M61 70 L74 78 L88 74 L100 82" />
    </svg>
  );
}

function VendingMachine(props: {
  machine: Machine;
  hackStep: number;
  trayCans: TrayCan[];
  falling: number;   // 아직 떨어지는 중인 캔 수
  lastDrop: string | null;
  notice: string | null;
  entry: string;     // 키패드로 누르는 중인 번호
  denied: Drink | null;   // 잔액이 부족해 거절된 음료
  balance: number;
  wreck: Wreck;
  onSelect: (drink: Drink) => void;
  onKey: (key: string) => void;
  onRandom: () => void;
  onHack: () => void;
  onReboot: () => void;
  onTake: () => void;
}) {
  const { machine, hackStep, trayCans, falling, lastDrop, notice, entry, denied, balance, wreck } = props;
  const broken = machine === "broken";
  const exploded = machine === "exploded";
  const percent = Math.round((hackStep / HACK_STEPS.length) * 100);
  const count = trayCans.length;
  const warning = broken && count >= TRAY_WARNING;

  let display: string;
  if (exploded) display = "치명적 오류. 적재 한계를 넘어 자판기가 파손되었습니다";
  else if (machine === "hacking") display = `해킹 진행 ${percent}%`;
  else if (entry !== "") display = `선택 ${entry}_`;
  else if (falling > 0 && lastDrop) display = lastDrop;
  else if (notice) display = notice;
  else if (warning) display = `적재 경고 ${count}/${TRAY_CAPACITY}. 더 담으면 위험합니다`;
  else if (count > 0) display = `꺼내는 곳에 캔 ${count}개`;
  else if (broken) display = "ERR 0x0F 가격표 손상. 모든 음료 0 크레딧";
  else if (denied) display = `잔액 부족. ${denied.code} ${denied.name}: ${won(denied.price)} 크레딧 필요`;
  else display = balance > 0 ? "음료를 고르거나 번호를 누르세요" : "음료를 고르세요";

  const stateLabel = exploded ? "파손" : broken ? "고장" : machine === "hacking" ? "침입 감지" : "정상 영업";

  return (
    // 바깥 두 겹: 번지는 형광 빛(vm-frame)과 형광 테두리(vm-edge). 깎은 모서리 때문에 테두리를 겹으로 만든다
    <div
      className={`vm-frame dmg is-${machine}${warning ? " is-warning" : ""}`}
      style={damaged(OFFSETS.machine, wreck)}
    >
      <div className="vm-edge">
        <section id="vending" className={`vm is-${machine}`} aria-label="자판기">
          {/* 위쪽 조명 간판 */}
          <div className="vm-sign dmg" style={damaged(OFFSETS.sign, wreck)}>
            <div className="vm-top">
              <span className="vm-name">NIGHT VEND 24</span>
              <span className="vm-led" aria-hidden="true" />
              <span className="vm-state">{stateLabel}</span>
            </div>
            <EmWave machine={machine} />
          </div>

          <div className="vm-body">
            {/* 유리창 안의 진열칸 */}
            <div className="vm-window">
              <ul className="vm-shelf" aria-label="음료 목록">
                {DRINKS.map(drink => (
                  <li key={drink.id}>
                    <button
                      className={machine === "locked" && denied?.id === drink.id ? "vm-item picked" : "vm-item"}
                      type="button"
                      data-drink={drink.id}
                      disabled={machine === "hacking" || exploded}
                      aria-label={`${drink.code} ${drink.name}, ${broken ? "0" : won(drink.price)} 크레딧`}
                      onClick={() => props.onSelect(drink)}
                    >
                      <span className="vm-can" style={{ background: drink.can }} aria-hidden="true" />
                      <Coil />
                      <span className="vm-item-name">{drink.name}</span>
                      <span className="vm-tag">
                        <span className="vm-code">{drink.code}</span>
                        <span className="vm-price">
                          {broken ? <s>{won(drink.price)}</s> : null}
                          <span className="vm-price-now">{broken ? "0" : won(drink.price)}</span>
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <span className="vm-glass" aria-hidden="true" />
              {exploded && <Cracks />}
            </div>

            {/* 오른쪽 조작부 */}
            <div className="vm-panel">
              <p id="vm-display" className="vm-display" role="status" aria-live="polite">
                <span id="vm-display-text">{display}</span>
                <span className="vm-cursor" aria-hidden="true" />
              </p>
              <dl className="vm-credit">
                <dt>잔액</dt>
                <dd><span id="vm-balance">{won(balance)}</span> 크레딧</dd>
              </dl>

              <div className="vm-keypad" role="group" aria-label="번호 입력">
                {KEYS.map((key, index) => (
                  <button
                    key={key}
                    className="vm-key dmg"
                    style={damaged(KEY_OFFSETS[index], wreck)}
                    type="button"
                    data-key={key}
                    disabled={machine === "hacking" || exploded}
                    onClick={() => props.onKey(key)}
                  >
                    {key}
                  </button>
                ))}
                <button className="vm-key wide" type="button" data-key="CLR" disabled={machine === "hacking" || exploded} onClick={() => props.onKey("CLR")}>
                  CLR
                </button>
              </div>

              <div className="vm-slots" aria-hidden="true">
                <span className="vm-coin"><i /><b>COIN</b></span>
                <span className="vm-bill"><i /><b>BILL</b></span>
                <span className="vm-card"><i /><b>CARD</b></span>
              </div>

              {machine === "locked" && (
                <button id="vm-hack" className="cp-primary" type="button" onClick={props.onHack}>결제 모듈 해킹</button>
              )}
              {machine === "hacking" && (
                <button id="vm-hack" className="cp-primary" type="button" disabled>해킹 중</button>
              )}
              {broken && (
                <div className="vm-modes">
                  <p className="vm-hint">칸을 누르면 그 음료가 하나씩 나옵니다.</p>
                  <button id="vm-random" className="cp-primary" type="button" disabled={falling > 0} onClick={props.onRandom}>
                    랜덤 대량 배출
                  </button>
                  <button id="vm-reboot" className="cp-ghost" type="button" disabled={count > 0} onClick={props.onReboot}>
                    자판기 재부팅
                  </button>
                </div>
              )}

              {(machine === "hacking" || broken) && (
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

          {/* 아래쪽 꺼내는 곳: 덮개(PUSH)를 밀고 꺼낸다 */}
          <div className={`vm-tray${count > 0 ? " filled" : ""}${warning ? " warning" : ""}`}>
            <div className="vm-tray-head">
              <span className="vm-tray-label">PUSH</span>
              <span id="vm-load" className="vm-load">적재 {count}/{TRAY_CAPACITY}</span>
            </div>
            <div id="vm-tray-box" className="vm-tray-box" aria-label={`꺼내는 곳의 캔 ${count}개`}>
              <span className="vm-flap dmg" style={damaged(OFFSETS.flap, wreck)} aria-hidden="true" />
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
              <button id="vm-take" className="vm-tray-item" type="button" disabled={falling > 0} onClick={props.onTake}>
                꺼내기 {count}개
              </button>
            )}
          </div>

          <div className="vm-base" aria-hidden="true">
            <span className="vm-grille" />
          </div>
        </section>
      </div>
      {exploded && <Blast />}
    </div>
  );
}

function Bag({ taken, lost }: { taken: Record<string, number>; lost: number }) {
  const total = Object.values(taken).reduce((sum, count) => sum + count, 0);
  return (
    <div className="vm-bag">
      <p>꺼낸 음료 <strong id="vm-taken">{total}</strong>개</p>
      {lost > 0 && <p>폭발로 날아간 캔 <strong id="vm-lost">{lost}</strong>개</p>}
      {total > 0 && (
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
  );
}

function TrashCan({ popups, bumps, message, wreck, onRummage }: {
  popups: Array<{ key: number; amount: number }>;
  bumps: number;
  message: string;
  wreck: Wreck;
  onRummage: () => void;
}) {
  return (
    <div className="cp-trash-wrap">
      <button
        id="cp-trash"
        className={`cp-trash dmg${bumps > 0 ? ` bump-${bumps % 2 === 0 ? "a" : "b"}` : ""}`}
        style={damaged(OFFSETS.trash, wreck)}
        type="button"
        aria-label="쓰레기통 뒤지기. 100 크레딧 단위로 동전을 주울 수 있습니다"
        onClick={onRummage}
      >
        <span className="cp-trash-lid" aria-hidden="true" />
        <span className="cp-trash-body" aria-hidden="true" />
        <span className="cp-trash-label">뒤지기</span>
        {popups.map(popup => (
          <span key={popup.key} className="cp-trash-pop" aria-hidden="true">+{won(popup.amount)}</span>
        ))}
      </button>
      <p id="cp-trash-message" className="cp-sr" aria-live="polite">{message}</p>
    </div>
  );
}

function ScreenWreck({ damage, phase, origin, repairs, sparks, onRepair }: {
  damage: number;
  phase: WreckPhase;
  origin: { x: number; y: number; w: number; h: number };
  repairs: number;
  sparks: Array<{ key: number; x: number; y: number }>;
  onRepair: (x: number, y: number) => void;
}) {
  const { cracks, cells, hole } = SCREEN_CRACKS;
  const scale = Math.hypot(origin.w, origin.h) * 0.75;
  const visibleCracks = Math.ceil(cracks.length * damage);
  const visibleCells = Math.ceil(cells.length * damage);
  return (
    <div
      id="cp-wreck"
      className={`cp-wreck ${phase}`}
      role="button"
      tabIndex={0}
      aria-label={`화면이 부서졌습니다. 눌러서 수리하세요. ${repairs}/${REPAIR_CLICKS}`}
      onClick={(event: MouseEvent) => onRepair(event.clientX, event.clientY)}
      onKeyDown={(event: KeyboardEvent) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onRepair(origin.x, origin.y);
      }}
    >
      <div className="cp-wreck-shade" style={{ opacity: String(damage) }} />
      <svg className="cp-cracks" viewBox={`0 0 ${origin.w} ${origin.h}`} preserveAspectRatio="none" aria-hidden="true">
        <g transform={`translate(${origin.x.toFixed(1)} ${origin.y.toFixed(1)}) scale(${scale.toFixed(1)})`}>
          {cells.map((cell, index) => (
            <path
              key={`c${index}`}
              className={index < visibleCells ? "cp-cell" : "cp-cell healed"}
              d={cell.d}
              fill-opacity={cell.opacity.toFixed(3)}
            />
          ))}
          <path className={damage > 0.5 ? "cp-hole" : "cp-hole healed"} d={hole} stroke-width={(1.5 / scale).toFixed(5)} />
          {cracks.map((crack, index) => (
            <g key={index} className={index < visibleCracks ? `cp-crack ${crack.kind}` : `cp-crack ${crack.kind} healed`}>
              <path
                className="glow"
                d={crack.d}
                pathLength="1"
                stroke-width={(5 / scale).toFixed(5)}
                style={{ animationDelay: `${180 + index * 6}ms` }}
              />
              <path
                className="core"
                d={crack.d}
                pathLength="1"
                stroke-width={((crack.kind === "ray" ? 1.6 : 1) / scale).toFixed(5)}
                style={{ animationDelay: `${180 + index * 6}ms` }}
              />
            </g>
          ))}
        </g>
      </svg>
      {phase === "wrecked" && (
        <div className="cp-wreck-hint" aria-hidden="true">
          <span>화면이 부서졌습니다. 아무 데나 눌러 수리하세요</span>
          <b id="cp-repair-count">{repairs}/{REPAIR_CLICKS}</b>
          <span className="cp-repair-bar"><span style={{ width: `${(repairs / REPAIR_CLICKS) * 100}%` }} /></span>
        </div>
      )}
      {sparks.map(spark => (
        <span key={spark.key} className="cp-weld" style={{ left: `${spark.x}px`, top: `${spark.y}px` }} aria-hidden="true" />
      ))}
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

// 폭발: 꺼내는 곳과 진열칸의 캔이 폭심에서 바깥으로 튕겨 나가 화면 밖까지 포물선을 그리며 날아간다
function blastCans(): void {
  const origin = document.getElementById("vm-tray-box");
  if (origin === null) return;
  const center = centerOf(origin);
  const cans = document.querySelectorAll<HTMLElement>(".vm-tray-can, .vm-shelf .vm-can");
  cans.forEach((element, index) => {
    if (typeof element.animate !== "function") return;
    const here = centerOf(element);
    const baseRot = Number(element.dataset.rot ?? 0);
    const angle = Math.atan2(here.y - center.y - 80, here.x - center.x) + (Math.random() - 0.5) * 1.1;
    const speed = 0.9 + Math.random() * 1.2;
    const vx = Math.cos(angle) * speed;
    const vy = Math.min(-0.5, Math.sin(angle) * speed) - Math.random() * 0.6;   // 항상 위로 솟구친다
    const spin = (Math.random() - 0.5) * 2.4;
    const duration = 1700 + Math.random() * 600;
    const frames: Keyframe[] = [];
    for (let t = 0; t <= duration; t += FRAME_MS * 2) {
      const x = vx * t;
      const y = vy * t + 0.5 * GRAVITY * 0.7 * t * t;
      const scale = 1 + Math.min(0.6, t / 2000);   // 화면 쪽으로 튀어나오는 느낌
      const fade = t > duration * 0.75 ? 1 - (t - duration * 0.75) / (duration * 0.25) : 1;
      frames.push({
        offset: t / duration,
        opacity: Math.max(0, fade),
        transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${(baseRot + spin * t).toFixed(1)}deg) scale(${scale.toFixed(2)})`,
      });
    }
    frames[frames.length - 1] = { ...frames[frames.length - 1], offset: 1, opacity: 0 };
    element.animate(frames, { duration, delay: (index % 7) * 12, easing: "linear", fill: "forwards" });
  });
}

// --- 루트 컴포넌트: 상태와 훅은 모두 여기에만 둔다 ---

let menuTouched = false;   // 첫 렌더에서 메뉴 버튼으로 포커스를 옮기지 않기 위한 표시
let nextKey = 1;
const animatedCans = new Set<number>();   // 이미 떨어뜨린 캔. 다시 그려도 애니메이션을 반복하지 않는다

export function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [machine, setMachine] = useState<Machine>("locked");
  const [hackStep, setHackStep] = useState(0);
  const [trayCans, setTrayCans] = useState<TrayCan[]>([]);
  const [falling, setFalling] = useState(0);
  const [lastDrop, setLastDrop] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [entry, setEntry] = useState("");
  const [deniedId, setDeniedId] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);
  const [taken, setTaken] = useState<Record<string, number>>({});
  const [lost, setLost] = useState(0);
  const [popups, setPopups] = useState<Array<{ key: number; amount: number }>>([]);
  const [trashBumps, setTrashBumps] = useState(0);
  const [trashMessage, setTrashMessage] = useState("");
  const [wreckPhase, setWreckPhase] = useState<WreckPhase>("none");
  const [origin, setOrigin] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [repairs, setRepairs] = useState(0);
  const [sparks, setSparks] = useState<Array<{ key: number; x: number; y: number }>>([]);
  const [repairedKey, setRepairedKey] = useState(0);

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

  // 터지는 순간: 폭심(자판기 중심)을 재고, 캔을 날리고, 화면이 부서지기 시작한다
  useEffect(() => {
    if (machine !== "exploded") return;
    const frame = document.querySelector(".vm-frame");
    const center = frame ? centerOf(frame) : { x: innerWidth / 2, y: innerHeight / 2 };
    setOrigin({ x: center.x, y: center.y, w: innerWidth, h: innerHeight });
    setWreckPhase("breaking");
    if (!reducedMotion()) blastCans();
  }, [machine]);

  useEffect(() => {
    if (wreckPhase !== "breaking") return;
    const timer = setTimeout(() => {
      setWreckPhase("wrecked");
      document.getElementById("cp-wreck")?.focus();
    }, reducedMotion() ? 0 : BREAK_MS);
    return () => clearTimeout(timer);
  }, [wreckPhase]);

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
        placed.push({ key: nextKey++, drinkId, ...placeCan(placed, width), delay: index * BURST_GAP_MS });
      });
      return placed;
    });
    setFalling(n => n + drinkIds.length);
    setLastDrop(message);
  };

  // 칸을 누르거나 번호를 입력했을 때. 정상 영업이면 크레딧으로 사고, 고장 났으면 공짜로 나온다
  const select = (drink: Drink) => {
    setEntry("");
    setNotice(null);
    if (machine === "broken") {
      dispense([drink.id], `${drink.code} ${drink.name} 배출`);
      return;
    }
    if (machine !== "locked") return;
    if (trayCans.length >= TRAY_CAPACITY) {
      setNotice("꺼내는 곳이 가득 찼습니다. 먼저 꺼내세요");
      return;
    }
    if (balance < drink.price) {
      setDeniedId(drink.id);
      return;
    }
    setDeniedId(null);
    setBalance(prev => prev - drink.price);
    dispense([drink.id], `${drink.code} ${drink.name} 구매. 잔액 ${won(balance - drink.price)} 크레딧`);
  };

  // 키패드: 열 문자(A, B)를 누른 다음 숫자를 누르면 그 칸이 선택된다
  const pressKey = (key: string) => {
    if (machine === "hacking" || machine === "exploded") return;
    if (key === "CLR") {
      setEntry("");
      setNotice(null);
      return;
    }
    if (/^[A-Z]$/.test(key)) {
      setEntry(key);
      setNotice(null);
      return;
    }
    if (entry === "") {
      setNotice("열 문자(A, B)를 먼저 누르세요");
      return;
    }
    const code = entry + key;
    const drink = DRINKS.find(item => item.code === code);
    if (drink === undefined) {
      setEntry("");
      setNotice(`${code}: 없는 번호입니다`);
      return;
    }
    select(drink);
  };

  // 랜덤 대량 배출: 고장 난 배출 모터가 아무 칸에서나 여러 개를 한꺼번에 떨어뜨린다
  const dropRandom = () => {
    const count = randomInt(BURST_MIN, BURST_MAX);
    const ids = Array.from({ length: count }, () => DRINKS[randomInt(0, DRINKS.length - 1)].id);
    dispense(ids, `배출 모터 폭주. 캔 ${count}개`);
  };

  // 쓰레기통: 뒤질 때마다 100~500 크레딧을 100 단위로 줍는다
  const rummage = () => {
    if (machine === "exploded") return;
    const amount = randomInt(1, 5) * 100;
    const key = nextKey++;
    setBalance(prev => prev + amount);
    setPopups(list => [...list, { key, amount }]);
    setTrashBumps(n => n + 1);
    setTrashMessage(`쓰레기통에서 ${won(amount)} 크레딧을 주웠습니다`);
    setDeniedId(null);
    setTimeout(() => setPopups(list => list.filter(popup => popup.key !== key)), 1200);
  };

  const hack = () => {
    setDeniedId(null);
    setNotice(null);
    setEntry("");
    setHackStep(0);
    setMachine("hacking");
  };

  const reboot = () => {
    setMachine("locked");
    setHackStep(0);
    setDeniedId(null);
    setLastDrop(null);
    setNotice(null);
    setEntry("");
  };

  const take = () => {
    setTaken(prev => {
      const next = { ...prev };
      for (const can of trayCans) next[can.drinkId] = (next[can.drinkId] ?? 0) + 1;
      return next;
    });
    setTrayCans([]);
    setNotice(null);
  };

  // 부서진 화면을 누를 때마다 조금씩 고쳐지고, 다 고치면 자판기가 다시 정상 영업한다
  const repair = (x: number, y: number) => {
    if (machine !== "exploded" || wreckPhase !== "wrecked") return;
    const key = nextKey++;
    setSparks(list => [...list, { key, x, y }]);
    setTimeout(() => setSparks(list => list.filter(spark => spark.key !== key)), 700);
    if (repairs + 1 < REPAIR_CLICKS) {
      setRepairs(repairs + 1);
      return;
    }
    // 날아간 진열칸 캔의 애니메이션을 지워 제자리에 다시 보이게 한다
    document.querySelectorAll<HTMLElement>(".vm-shelf .vm-can").forEach(element => {
      element.getAnimations().forEach(animation => animation.cancel());
    });
    setTrayCans([]);
    setFalling(0);
    setRepairs(0);
    setWreckPhase("none");
    setOrigin(null);
    setRepairedKey(n => n + 1);
    reboot();
    setNotice("시스템 복구 완료. 정상 영업을 시작합니다");
  };

  const wreck: Wreck = {
    damage: machine === "exploded" ? 1 - repairs / REPAIR_CLICKS : 0,
    breaking: wreckPhase === "breaking",
  };
  const denied = DRINKS.find(drink => drink.id === deniedId) ?? null;
  const tookAny = Object.keys(taken).length > 0;
  const step = machine === "locked" || machine === "hacking" ? 0 : !tookAny && trayCans.length === 0 && machine === "broken" ? 1 : 2;
  // 배경 전자기장: 평소에는 노랑, 해킹하면 빨강, 부서지면 꺼진다
  const field = machine === "exploded" ? "is-wrecked" : machine === "hacking" || machine === "broken" ? "is-alert" : "is-normal";

  return (
    <div className={`cp ${field}${wreck.breaking ? " is-breaking" : ""}`}>
      <Field />
      <Header menuOpen={menuOpen} balance={balance} wreck={wreck} onToggleMenu={toggleMenu} />
      <Sidebar open={menuOpen} onClose={closeMenu} />
      <main className="cp-main">
        <section className="cp-hero">
          <div className="cp-copy">
            <h1 className="dmg" style={damaged(OFFSETS.h1, wreck)}>잔액은 0 크레딧, 목은 마르다</h1>
            <p className="dmg" style={damaged(OFFSETS.lead, wreck)}>
              오른쪽 아래 쓰레기통을 뒤지면 크레딧이 나옵니다. 모은 크레딧으로 정상 영업 중인 자판기에서
              음료를 사거나, 결제 모듈을 해킹해 공짜로 꺼내세요. 고장 난 자판기의 꺼내는 곳에
              {` ${TRAY_CAPACITY}`}개 넘게 쌓이면 터집니다.
            </p>
            <p className="cp-sub dmg" style={damaged(OFFSETS.sub, wreck)}>
              상태와 훅은 이 페이지의 루트 컴포넌트 하나에만 있고, 자판기와 메뉴는 props만 받는 함수입니다.
            </p>
            <Steps current={step} wreck={wreck} />
          </div>
          <div className="vm-unit">
            <VendingMachine
              machine={machine}
              hackStep={hackStep}
              trayCans={trayCans}
              falling={falling}
              lastDrop={lastDrop}
              notice={notice}
              entry={entry}
              denied={denied}
              balance={balance}
              wreck={wreck}
              onSelect={select}
              onKey={pressKey}
              onRandom={dropRandom}
              onHack={hack}
              onReboot={reboot}
              onTake={take}
            />
            <Bag taken={taken} lost={lost} />
          </div>
        </section>
      </main>
      <footer className="cp-footer dmg" style={damaged(OFFSETS.footer, wreck)}>
        <p>사이버펑크 장르의 분위기를 참고한 오리지널 디자인입니다. 게임 Cyberpunk 2077 및 CD PROJEKT RED와 관계가 없습니다.</p>
      </footer>
      <TrashCan popups={popups} bumps={trashBumps} message={trashMessage} wreck={wreck} onRummage={rummage} />
      {machine === "exploded" && origin !== null && (
        <ScreenWreck damage={wreck.damage} phase={wreckPhase} origin={origin} repairs={repairs} sparks={sparks} onRepair={repair} />
      )}
      {machine === "exploded" && <div className="cp-flash" aria-hidden="true" />}
      {repairedKey > 0 && <div key={repairedKey} className="cp-repair-flash" aria-hidden="true" />}
    </div>
  );
}
