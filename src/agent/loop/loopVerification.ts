import { type LoopWindow, type LoopWindowObservation } from './observationTiers';

// Cheap verification: window set, foreground and visible text changes. No model call;
// the result goes into the step log and the model decides what it means.

const TEXT_CHANGE_THRESHOLD = 0.85;

function labelSet(observation: LoopWindowObservation | null) {
  return new Set((observation?.elements ?? []).map((element) => element.label.normalize('NFKC').replace(/\s+/gu, '')));
}

function similarity(a: Set<string>, b: Set<string>) {
  if (!a.size && !b.size) return 1;
  let shared = 0;
  for (const value of a) if (b.has(value)) shared += 1;
  return shared / Math.max(a.size, b.size);
}

export interface LoopVerification {
  changed: boolean;
  summary: string;
}

export function compareLoopState(options: {
  after: { active: LoopWindow | null; observation: LoopWindowObservation | null; windows: LoopWindow[] };
  before: { active: LoopWindow | null; observation: LoopWindowObservation | null; windows: LoopWindow[] };
}): LoopVerification {
  const { after, before } = options;
  const notes: string[] = [];
  const beforeIds = new Map(before.windows.map((window) => [window.hwnd, window]));
  const afterIds = new Map(after.windows.map((window) => [window.hwnd, window]));
  const opened = after.windows.filter((window) => !beforeIds.has(window.hwnd));
  const closed = before.windows.filter((window) => !afterIds.has(window.hwnd));
  const retitled = after.windows.filter((window) => {
    const previous = beforeIds.get(window.hwnd);
    return previous && previous.title !== window.title;
  });
  if (opened.length) notes.push(`新窗口：${opened.map((window) => `「${window.title || window.processName}」`).join('、')}`);
  if (closed.length) notes.push(`关闭的窗口：${closed.map((window) => `「${window.title || window.processName}」`).join('、')}`);
  if (retitled.length) notes.push(`标题变化：${retitled.map((window) => `「${window.title}」`).join('、')}`);
  if (after.active?.hwnd && after.active.hwnd !== before.active?.hwnd) notes.push(`前台变为「${after.active.title || after.active.processName}」`);

  const sameWindow = before.observation && after.observation && before.observation.window.hwnd === after.observation.window.hwnd;
  if (sameWindow) {
    const beforeLabels = labelSet(before.observation);
    const afterLabels = labelSet(after.observation);
    const score = similarity(beforeLabels, afterLabels);
    if (score < TEXT_CHANGE_THRESHOLD) {
      const added = [...afterLabels].filter((label) => !beforeLabels.has(label)).slice(0, 6);
      notes.push(`窗口内容变化${added.length ? `，新出现：${added.map((label) => `「${label.slice(0, 20)}」`).join('、')}` : ''}`);
    }
  } else if (after.observation && before.observation) {
    notes.push(`当前窗口换成「${after.observation.window.title || after.observation.window.processName}」`);
  }
  return notes.length ? { changed: true, summary: notes.join('；') } : { changed: false, summary: '画面没有明显变化' };
}

/** Same action against the same target twice in a row without any change: the loop must switch approach. */
export function isRepeatedNoChange(history: Array<{ changed: boolean | null; signature: string }>, signature: string) {
  const last = history[history.length - 1];
  return Boolean(last && last.signature === signature && last.changed === false);
}
