// 뒤로가기/앞으로가기를 위한 상태 기록. 과거로 돌아간 뒤 새로 저장하면 그 뒤의 기록은 버린다
export class StateHistory<T> {
  private entries: T[];
  private index = 0;

  constructor(initial: T) {
    this.entries = [initial];
  }

  get current(): T {
    return this.entries[this.index];
  }

  get position(): number {
    return this.index;
  }

  get canBack(): boolean {
    return this.index > 0;
  }

  get canForward(): boolean {
    return this.index < this.entries.length - 1;
  }

  all(): readonly T[] {
    return this.entries;
  }

  push(entry: T): void {
    this.entries = [...this.entries.slice(0, this.index + 1), entry];
    this.index = this.entries.length - 1;
  }

  go(index: number): T {
    if (!Number.isInteger(index) || index < 0 || index >= this.entries.length) {
      throw new RangeError(`없는 기록입니다: ${index}`);
    }
    this.index = index;
    return this.current;
  }
}
