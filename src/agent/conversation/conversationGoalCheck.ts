import { resolveLoopWindow } from '../loop/loopExecutor';
import type { LoopWindow } from '../loop/observationTiers';

// Goal-level verification for the conversation loop (2026-11-06). Tools reporting success is not
// the task succeeding: "打开记事本，写上日期，移到副屏" is done only when a Notepad window with
// the date is on the second screen. Before she says a changing task is done, she lists what the
// end state should look like (verify_goal) and each item is checked against a fresh look at the
// computer — not against what the tools said earlier.

export type GoalCheckKind =
  | 'window_open'
  | 'window_closed'
  | 'window_text'
  | 'file_exists'
  | 'file_absent'
  | 'file_contains'
  | 'browser_page'
  | 'other';

export interface GoalCheck {
  kind: GoalCheckKind;
  /** Window title / program name, file path, words of the page (title or address), or a description for `other`. */
  target: string;
  /** window_text / file_contains: the words that must be there. */
  text?: string;
  /** window_open: which screen the window should be on. */
  screen?: 'primary' | 'secondary';
}

export type GoalCheckStatus = 'passed' | 'failed' | 'unknown';

export interface GoalCheckOutcome {
  check: GoalCheck;
  /** What was actually seen, in plain words. */
  evidence: string;
  status: GoalCheckStatus;
}

export interface GoalVerification {
  failed: number;
  outcomes: GoalCheckOutcome[];
  passed: number;
  total: number;
  unknown: number;
}

export interface GoalDisplay {
  isPrimary: boolean;
  nativeHeight: number;
  nativeWidth: number;
  nativeX: number;
  nativeY: number;
}

export interface GoalCheckReaders {
  listBrowserPages: () => Promise<Array<{ title: string; url: string }> | null>;
  listDisplays: () => Promise<GoalDisplay[]>;
  listWindows: () => Promise<LoopWindow[]>;
  readFile: (path: string) => Promise<{ ok: true; text: string } | { exists: boolean; ok: false }>;
  /** Labels / text of a window's elements (UI Automation + OCR), joined. */
  readWindowText: (window: LoopWindow) => Promise<string>;
}

export const GOAL_CHECK_KINDS: GoalCheckKind[] = ['window_open', 'window_closed', 'window_text', 'file_exists', 'file_absent', 'file_contains', 'browser_page', 'other'];
const MAX_CHECKS = 6;

// Built-in Windows apps are titled in English ("… - Notepad"); she often names them in Chinese.
// Same idea as electron/appLauncher/windowsAppChineseAliases.cjs, which the renderer cannot import.
const WINDOW_WORDS: Record<string, string[]> = {
  '记事本': ['Notepad'],
  '计算器': ['Calculator', 'CalculatorApp'],
  '画图': ['Paint', 'mspaint'],
  '任务管理器': ['Task Manager', 'Taskmgr'],
  '资源管理器': ['File Explorer', 'explorer'],
  '文件资源管理器': ['File Explorer', 'explorer'],
  '终端': ['Terminal', 'WindowsTerminal'],
  '命令提示符': ['Command Prompt', 'cmd'],
  '设置': ['Settings', 'SystemSettings'],
};

function normalizeText(value: string) {
  return value.replace(/\s+/gu, '').toLowerCase();
}

export function findGoalWindow(query: string, windows: LoopWindow[]) {
  const direct = resolveLoopWindow(query, windows);
  if (direct) return direct;
  for (const word of WINDOW_WORDS[query.trim()] ?? []) {
    const found = resolveLoopWindow(word, windows);
    if (found) return found;
  }
  return null;
}

function windowLabel(window: LoopWindow) {
  return window.title || window.processName || `窗口 ${window.hwnd}`;
}

function screenOf(window: LoopWindow, displays: GoalDisplay[]) {
  if (!window.box) return null;
  const centerX = window.box.x + window.box.width / 2;
  const centerY = window.box.y + window.box.height / 2;
  return displays.find((display) => centerX >= display.nativeX && centerX < display.nativeX + display.nativeWidth
    && centerY >= display.nativeY && centerY < display.nativeY + display.nativeHeight) ?? null;
}

function openWindowNames(windows: LoopWindow[]) {
  const names = windows.filter((window) => window.title).slice(0, 8).map(windowLabel);
  return names.length ? `现在开着的有：${names.join('、')}` : '现在没有看到其他窗口';
}

/** Reads `checks` as the model sent them (an array, or a JSON string of one). */
export function parseGoalChecks(raw: unknown): GoalCheck[] {
  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_CHECKS).flatMap((item) => {
    const record = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    const kind = GOAL_CHECK_KINDS.includes(record.kind as GoalCheckKind) ? record.kind as GoalCheckKind : null;
    const target = typeof record.target === 'string' ? record.target.trim() : '';
    if (!kind || !target) return [];
    const text = typeof record.text === 'string' && record.text.trim() ? record.text.trim() : undefined;
    const screen = record.screen === 'primary' || record.screen === 'secondary' ? record.screen : undefined;
    return [{ kind, target, ...(text ? { text } : {}), ...(screen ? { screen } : {}) }];
  });
}

async function checkOne(check: GoalCheck, readers: GoalCheckReaders, cache: { windows?: LoopWindow[]; displays?: GoalDisplay[] }): Promise<GoalCheckOutcome> {
  const windows = async () => (cache.windows ??= await readers.listWindows());
  const result = (status: GoalCheckStatus, evidence: string): GoalCheckOutcome => ({ check, evidence, status });

  switch (check.kind) {
    case 'window_open': {
      const all = await windows();
      const window = findGoalWindow(check.target, all);
      if (!window) return result('failed', `没有找到「${check.target}」的窗口。${openWindowNames(all)}。`);
      if (!check.screen) return result('passed', `窗口「${windowLabel(window)}」开着。`);
      const displays = (cache.displays ??= await readers.listDisplays());
      const display = screenOf(window, displays);
      if (!display || displays.length < 2) return result('unknown', `窗口「${windowLabel(window)}」开着，但判断不出在哪块屏幕上。`);
      const where = display.isPrimary ? '主屏' : '副屏';
      return result((check.screen === 'primary') === display.isPrimary ? 'passed' : 'failed', `窗口「${windowLabel(window)}」在${where}上。`);
    }
    case 'window_closed': {
      const window = findGoalWindow(check.target, await windows());
      return window ? result('failed', `「${windowLabel(window)}」还开着。`) : result('passed', `没有「${check.target}」的窗口了。`);
    }
    case 'window_text': {
      if (!check.text) return result('unknown', '没说要找哪段文字。');
      const all = await windows();
      const window = findGoalWindow(check.target, all);
      if (!window) return result('failed', `没有找到「${check.target}」的窗口。${openWindowNames(all)}。`);
      const text = await readers.readWindowText(window);
      if (!text.trim()) return result('unknown', `读不到窗口「${windowLabel(window)}」里的文字。`);
      return normalizeText(text).includes(normalizeText(check.text))
        ? result('passed', `窗口「${windowLabel(window)}」里有“${check.text}”。`)
        : result('failed', `窗口「${windowLabel(window)}」里没有找到“${check.text}”。`);
    }
    case 'file_exists':
    case 'file_absent':
    case 'file_contains': {
      const read = await readers.readFile(check.target);
      const text = 'text' in read ? read.text : null;
      const exists = text !== null || ('exists' in read && read.exists);
      if (check.kind === 'file_absent') return exists ? result('failed', `${check.target} 还在。`) : result('passed', `${check.target} 已经不在了。`);
      if (!exists) return result('failed', `${check.target} 不存在。`);
      if (check.kind === 'file_exists') return result('passed', `${check.target} 存在。`);
      if (!check.text) return result('unknown', '没说文件里应该有什么。');
      if (text === null) return result('unknown', `${check.target} 存在，但读不出文字内容。`);
      return normalizeText(text).includes(normalizeText(check.text))
        ? result('passed', `${check.target} 里有“${check.text}”。`)
        : result('failed', `${check.target} 里没有“${check.text}”。`);
    }
    case 'browser_page': {
      const pages = await readers.listBrowserPages();
      if (!pages) return result('unknown', '她的浏览器没开，或者读不到标签页。');
      const wanted = normalizeText(check.target);
      const page = pages.find((item) => normalizeText(item.title).includes(wanted) || normalizeText(decodeURIComponentSafe(item.url)).includes(wanted));
      return page
        ? result('passed', `她的浏览器里开着「${page.title || page.url}」。`)
        : result('failed', `她的浏览器里没有“${check.target}”的页面（开着 ${pages.length} 个标签页）。`);
    }
    default:
      return result('unknown', `“${check.target}”没法自动核对。`);
  }
}

function decodeURIComponentSafe(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export async function verifyGoalChecks(checks: GoalCheck[], readers: GoalCheckReaders): Promise<GoalVerification> {
  const cache: { windows?: LoopWindow[]; displays?: GoalDisplay[] } = {};
  const outcomes: GoalCheckOutcome[] = [];
  for (const check of checks) {
    try {
      outcomes.push(await checkOne(check, readers, cache));
    } catch (error) {
      outcomes.push({ check, evidence: `核对时出错：${error instanceof Error ? error.message : String(error)}`, status: 'unknown' });
    }
  }
  const count = (status: GoalCheckStatus) => outcomes.filter((outcome) => outcome.status === status).length;
  return { failed: count('failed'), outcomes, passed: count('passed'), total: outcomes.length, unknown: count('unknown') };
}

/** What the model reads back: every item with what was seen, then what to do next. */
export function formatGoalVerification(verification: GoalVerification) {
  const mark = { failed: '✗', passed: '✓', unknown: '?' } as const;
  const lines = verification.outcomes.map((outcome) => `${mark[outcome.status]} ${outcome.evidence}`);
  const head = verification.failed
    ? `失败：核对没通过（${verification.passed}/${verification.total} 项达到）。`
    : verification.unknown
      ? `核对：${verification.passed}/${verification.total} 项达到，${verification.unknown} 项没法自动核对。`
      : `核对通过：${verification.passed}/${verification.total} 项都达到了。`;
  const next = verification.failed
    ? '没达到的接着做完再核对一次；做不到就如实告诉用户哪一项没做到、为什么。'
    : verification.unknown
      ? '可以告诉用户做完了，没法核对的那几项如实说明。'
      : '可以告诉用户做完了。';
  return [head, ...lines, next].join('\n');
}

/** The task card's closing words from the last goal check (see conversationGoalCheck). */
export function describeGoalCheckOutcome(verification: GoalVerification | null, uncheckedChange: boolean) {
  if (uncheckedChange || !verification) return uncheckedChange ? '做完了，但没有核对结果' : undefined;
  if (verification.failed) return `做了，但核对没通过（${verification.passed}/${verification.total}）`;
  if (verification.unknown) return `已完成，核对 ${verification.passed}/${verification.total}（${verification.unknown} 项没法自动核对）`;
  return `已完成，核对通过 ${verification.passed}/${verification.total}`;
}
