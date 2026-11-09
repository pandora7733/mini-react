// tests.html 전용 최소 테스트 러너. DOM이 필요한 테스트는 실제 브라우저에서 돌린다
type TestFn = () => void | Promise<void>;

const tests: Array<{ name: string; fn: TestFn }> = [];

export function test(name: string, fn: TestFn): void {
  tests.push({ name, fn });
}

export const assert = {
  equal(actual: unknown, expected: unknown, message = ""): void {
    if (!Object.is(actual, expected)) {
      throw new Error(`${message} 기대값 ${JSON.stringify(expected)}, 실제값 ${JSON.stringify(actual)}`);
    }
  },
  ok(value: unknown, message = "참이어야 합니다"): void {
    if (!value) throw new Error(message);
  },
};

export function wait(ms = 0): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function runAll(): Promise<void> {
  const results = document.getElementById("results")!;
  const summary = document.getElementById("summary")!;
  let passed = 0;
  const failures: string[] = [];

  for (const { name, fn } of tests) {
    const item = document.createElement("li");
    try {
      await fn();
      passed++;
      item.textContent = `통과: ${name}`;
    } catch (error) {
      failures.push(name);
      item.className = "fail";
      item.textContent = `실패: ${name}`;
      const detail = document.createElement("pre");
      detail.textContent = error instanceof Error ? error.message : String(error);
      item.append(detail);
    }
    results.append(item);
  }

  summary.textContent = `통과 ${passed}개, 실패 ${failures.length}개`;
  document.body.dataset.done = "true";
  document.body.dataset.failed = String(failures.length);
}
