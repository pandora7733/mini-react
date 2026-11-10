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

type Machine = "locked" | "hacking" | "broken";

// 꺼내는 곳에 쌓인 캔 하나. tilt는 바닥에 누운 각도, delay는 대량 배출 때 떨어지기 시작하는 시차
interface TrayCan {
  key: number;
  drinkId: string;
  tilt: number;
  delay: number;
}

const TRAY_CAPACITY = 14;
const BURST_MIN = 5;
const BURST_MAX = 10;
const FALL_MS = 950;
const BURST_GAP_MS = 120;

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
  const reading = machine === "broken" ? "신호 손상" : machine === "hacking" ? "주파수 교란" : "2.4 GHz 안정";
  return (
    <div className="vm-signal">
      <svg className="vm-wave" viewBox="0 0 400 40" preserveAspectRatio="none" aria-hidden="true">
        <g className="vm-wave-sine">
          {WAVES.map(wave => <path key={wave.className} className={`vm-wave-line ${wave.className}`} d={wave.d} />)}
        </g>
        <g className="vm-wave-noise">
          <path className="vm-wave-line w1" d={NOISE} />
        </g>
      </svg>
      <span className="vm-signal-reading">{reading}</span>
    </div>
  );
}

// 캔을 눕히면 몸통 무늬도 세로에서 가로로 돈다
function lyingCan(drink: Drink): string {
  return drink.can.replace("90deg", "180deg");
}

function VendingMachine({ machine, hackStep, trayCans, falling, lastDrop, denied, taken, onSelect, onRandom, onHack, onReboot, onTake }: {
  machine: Machine;
  hackStep: number;
  trayCans: TrayCan[];
  falling: number;   // 아직 떨어지는 중인 캔 수
  lastDrop: string | null;
  denied: Drink | null;   // 잔액이 부족해 거절된 음료
  taken: Record<string, number>;
  onSelect: (drink: Drink) => void;
  onRandom: () => void;
  onHack: () => void;
  onReboot: () => void;
  onTake: () => void;
}) {
  const broken = machine === "broken";
  const percent = Math.round((hackStep / HACK_STEPS.length) * 100);
  const totalTaken = Object.values(taken).reduce((sum, count) => sum + count, 0);
  const trayFull = trayCans.length >= TRAY_CAPACITY;

  let display: string;
  if (machine === "hacking") display = `해킹 진행 ${percent}%`;
  else if (broken && falling > 0 && lastDrop) display = lastDrop;
  else if (broken && trayFull) display = "꺼내는 곳이 가득 찼습니다. 먼저 꺼내세요";
  else if (broken && trayCans.length > 0) display = `꺼내는 곳에 캔 ${trayCans.length}개`;
  else if (broken) display = "ERR 0x0F 가격표 손상. 모든 음료 0 크레딧";
  else if (denied) display = `잔액 부족. ${denied.code} ${denied.name}: ${won(denied.price)} 크레딧 필요`;
  else display = "음료를 고르세요";

  return (
    // 바깥 두 겹: 번지는 형광 빛(vm-frame)과 형광 테두리(vm-edge). 깎은 모서리 때문에 테두리를 겹으로 만든다
    <div className={`vm-frame is-${machine}`}>
      <div className="vm-edge">
        <section id="vending" className={`vm is-${machine}`} aria-label="자판기">
          <div className="vm-top">
            <span className="vm-name">NIGHT VEND 24</span>
            <span className="vm-led" aria-hidden="true" />
            <span className="vm-state">{broken ? "고장" : machine === "hacking" ? "침입 감지" : "정상 영업"}</span>
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
                    disabled={machine === "hacking" || (broken && trayFull)}
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
                  <button
                    id="vm-random"
                    className="cp-primary"
                    type="button"
                    disabled={trayFull || falling > 0}
                    onClick={onRandom}
                  >
                    랜덤 대량 배출
                  </button>
                  <button
                    id="vm-reboot"
                    className="cp-ghost"
                    type="button"
                    disabled={trayCans.length > 0}
                    onClick={onReboot}
                  >
                    자판기 재부팅
                  </button>
                </div>
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

          <div className={trayCans.length > 0 ? "vm-tray filled" : "vm-tray"}>
            <span className="vm-tray-label">꺼내는 곳</span>
            <div id="vm-tray-pile" className="vm-tray-pile" aria-label={`꺼내는 곳의 캔 ${trayCans.length}개`}>
              {trayCans.map(can => {
                const drink = DRINKS.find(item => item.id === can.drinkId)!;
                return (
                  <span
                    key={can.key}
                    className="vm-tray-can"
                    data-can-key={can.key}
                    data-drink-id={can.drinkId}
                    title={drink.name}
                    style={{ background: lyingCan(drink), transform: `rotate(${can.tilt}deg)` }}
                  />
                );
              })}
              {trayCans.length === 0 && <span className="vm-tray-empty">비어 있음</span>}
            </div>
            {trayCans.length > 0 && (
              <button id="vm-take" className="vm-tray-item" type="button" disabled={falling > 0} onClick={onTake}>
                꺼내기 {trayCans.length}개
              </button>
            )}
          </div>

          <div className="vm-bag">
            <p>꺼낸 무료 음료 <strong id="vm-taken">{totalTaken}</strong>개</p>
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
    </div>
  );
}

// --- 캔 낙하 애니메이션 ---
// 캔은 처음부터 꺼내는 곳의 최종 자리에 그린다. 그다음 진열칸의 캔 위치에서 출발해
// 그 자리로 떨어지는 움직임만 Web Animations API로 덧입힌다 (FLIP 방식).
// effect는 커밋 직후 같은 작업 안에서 실행되므로, 캔이 최종 자리에 한 번 보였다가 튀는 일이 없다.

function animateFall(can: TrayCan): Promise<void> {
  const element = document.querySelector<HTMLElement>(`[data-can-key="${can.key}"]`);
  const source = document.querySelector<HTMLElement>(`[data-drink="${can.drinkId}"] .vm-can`);
  if (element === null || source === null || typeof element.animate !== "function") return Promise.resolve();

  const from = source.getBoundingClientRect();
  const to = element.getBoundingClientRect();
  const dx = from.left + from.width / 2 - (to.left + to.width / 2);
  const dy = from.top + from.height / 2 - (to.top + to.height / 2);
  const rest = `rotate(${can.tilt}deg)`;
  const spin = can.tilt + (can.key % 2 === 0 ? 200 : -160);   // 떨어지며 한 바퀴 가까이 구른다

  const animation = element.animate(
    [
      // 진열칸에서 세워진 채로 튀어나온다 (눕힌 캔을 -90도 돌리면 세운 캔이 된다)
      { offset: 0, opacity: 0, transform: `translate(${dx}px, ${dy}px) rotate(-90deg) scale(0.9)` },
      { offset: 0.1, opacity: 1, transform: `translate(${dx}px, ${dy}px) rotate(-90deg) scale(1.12)`, easing: "ease-out" },
      { offset: 0.2, transform: `translate(${dx * 0.92}px, ${dy + 10}px) rotate(-70deg) scale(1)`, easing: "cubic-bezier(0.55, 0, 1, 0.45)" },
      // 중력: 점점 빨라지며 꺼내는 곳으로 떨어진다
      { offset: 0.72, transform: `translate(0px, 0px) rotate(${spin}deg)`, easing: "ease-out" },
      // 바닥에 부딪혀 한 번 튄다
      { offset: 0.84, transform: `translate(0px, -12px) rotate(${can.tilt + 8}deg)`, easing: "ease-in" },
      { offset: 0.93, transform: `translate(0px, 0px) ${rest}`, easing: "ease-out" },
      { offset: 0.97, transform: `translate(0px, -3px) ${rest}` },
      { offset: 1, opacity: 1, transform: `translate(0px, 0px) ${rest}` },
    ],
    { duration: FALL_MS, delay: can.delay, fill: "backwards" },
  );
  // 캔이 닿는 순간 꺼내는 곳을 살짝 흔든다
  animation.finished.then(() => {
    element.closest(".vm-tray")?.animate(
      [{ transform: "translateY(0)" }, { transform: "translateY(2px)" }, { transform: "translateY(0)" }],
      { duration: 140 },
    );
  }, () => {});
  return animation.finished.then(() => undefined, () => undefined);
}

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
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
      setFalling(count => count - fresh.length);
      return;
    }
    Promise.all(fresh.map(animateFall)).then(() => setFalling(count => count - fresh.length));
  }, [trayCans]);

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
    const room = TRAY_CAPACITY - trayCans.length;
    const ids = drinkIds.slice(0, room);
    if (ids.length === 0) return;
    const cans = ids.map((drinkId, index) => ({
      key: nextCanKey++,
      drinkId,
      tilt: randomInt(-14, 14),
      delay: index * BURST_GAP_MS,
    }));
    setTrayCans(prev => [...prev, ...cans]);
    setFalling(count => count + cans.length);
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
    const count = Math.min(randomInt(BURST_MIN, BURST_MAX), TRAY_CAPACITY - trayCans.length);
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

  const denied = DRINKS.find(drink => drink.id === deniedId) ?? null;
  const tookAny = Object.keys(taken).length > 0;
  const step = machine !== "broken" ? 0 : !tookAny && trayCans.length === 0 ? 1 : 2;

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
              고장 난 자판기는 음료를 공짜로 내줍니다.
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
            onSelect={select}
            onRandom={dropRandom}
            onHack={hack}
            onReboot={reboot}
            onTake={take}
          />
        </section>
      </main>
      <footer className="cp-footer">
        <p>사이버펑크 장르의 분위기를 참고한 오리지널 디자인입니다. 게임 Cyberpunk 2077 및 CD PROJEKT RED와 관계가 없습니다.</p>
      </footer>
    </div>
  );
}
