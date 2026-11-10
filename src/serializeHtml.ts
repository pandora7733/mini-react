// innerHTML은 속성만 직렬화하므로 사용자가 입력한 값이 빠진다.
// 복사본의 속성과 내용에 현재 입력값을 옮겨 적어, 다시 파싱해도 같은 상태가 되는 HTML을 만든다.
export function serializeHtml(parent: Element): string {
  // 비활성 문서로 복사하면 이미지 로드와 인라인 핸들러가 실행되지 않는다
  const inertDocument = document.createElement("template").content.ownerDocument;
  const copy = inertDocument.importNode(parent, true);

  const lives = parent.querySelectorAll(FORM_SELECTOR);
  const copies = copy.querySelectorAll(FORM_SELECTOR);
  lives.forEach((live, i) => reflectFormState(live, copies[i]));

  return copy.innerHTML;
}

const FORM_SELECTOR = "input, textarea, select";

function reflectFormState(live: Element, copy: Element): void {
  if (live instanceof HTMLInputElement) {
    if (live.type === "checkbox" || live.type === "radio") {
      copy.toggleAttribute("checked", live.checked);
    } else if (live.type !== "file") {
      if (live.value === "") copy.removeAttribute("value");
      else copy.setAttribute("value", live.value);
    }
  } else if (live instanceof HTMLTextAreaElement) {
    // HTML 파서가 textarea 맨 앞의 줄바꿈 하나를 버리므로 하나 더 넣어 둔다
    copy.textContent = live.value.startsWith("\n") ? `\n${live.value}` : live.value;
  } else if (live instanceof HTMLSelectElement) {
    reflectSelect(live, copy as HTMLSelectElement);
  }
}

function reflectSelect(live: HTMLSelectElement, copy: HTMLSelectElement): void {
  // 복사본은 속성만으로 선택이 정해진다. 결과가 같으면 불필요한 selected 속성을 만들지 않는다
  if (live.multiple || copy.selectedIndex === live.selectedIndex) return;
  Array.from(copy.options).forEach((option, i) => {
    option.toggleAttribute("selected", i === live.selectedIndex);
  });
}
