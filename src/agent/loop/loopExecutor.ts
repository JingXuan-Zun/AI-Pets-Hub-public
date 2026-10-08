import { desktopPetShellRuntime } from '../../desktopShellRuntime';
import { executeDesktopInputWithFocusRetry } from '../desktopTools/desktopInputFocusRetry';
import { type LoopElement } from './elementMarks';
import { type LoopAction } from './loopActions';
import { observeLoopWindows, type LoopWindow } from './observationTiers';

export interface LoopActionOutcome {
  detail: string;
  focusWindow?: LoopWindow | null;
  ok: boolean;
}

const OWN_WINDOW = /^AI Desktop Pet\b/iu;
const FOCUS_SETTLE_MS = 250;
const LAUNCH_POLL_MS = 700;
const LAUNCH_WAIT_MS = 12_000;

const sleep = (ms: number) => new Promise((resolve) => { globalThis.setTimeout(resolve, ms); });

function normalize(value: string) {
  return value.normalize('NFKC').replace(/\s+/gu, '').toLowerCase();
}

/** Finds a window by hwnd, exact title, or title/process substring; never the pet's own windows. */
export function resolveLoopWindow(query: string, windows: LoopWindow[]) {
  const candidates = windows.filter((window) => !OWN_WINDOW.test(window.title));
  const hwnd = Number(query);
  if (Number.isInteger(hwnd) && hwnd > 0) return candidates.find((window) => window.hwnd === hwnd) ?? null;
  const wanted = normalize(query);
  if (!wanted) return null;
  return candidates.find((window) => normalize(window.title) === wanted)
    ?? candidates.find((window) => normalize(window.title).includes(wanted) || normalize(window.processName) === wanted)
    ?? candidates.find((window) => wanted.includes(normalize(window.title)) && normalize(window.title).length >= 2)
    ?? candidates.find((window) => normalize(window.processName).includes(wanted))
    ?? null;
}

function inputError(result: unknown) {
  const record = (result ?? {}) as { error?: unknown; ok?: unknown; reason?: unknown };
  if (record.ok !== false) return null;
  return String(record.error ?? record.reason ?? '输入执行失败');
}

async function bringToFront(window: LoopWindow) {
  if (!(window.hwnd > 0)) return; // whole-screen observation: nothing to focus
  try {
    await desktopPetShellRuntime.focusWindow({ hwnd: window.hwnd, pid: window.pid ?? undefined } as never);
  } catch {
    // The input guard reports a foreground problem if focusing did not work.
  }
  await sleep(FOCUS_SETTLE_MS);
}

async function sendInput(window: LoopWindow, request: Record<string, unknown>) {
  const result = await executeDesktopInputWithFocusRetry({
    ...request,
    ...(window.hwnd > 0 ? { expectedForegroundHwnd: window.hwnd } : {}),
    ...(window.pid ? { expectedForegroundPid: window.pid } : {}),
  });
  return inputError(result);
}

async function launchApp(name: string): Promise<LoopActionOutcome> {
  const before = new Set((await observeLoopWindows()).windows.map((window) => window.hwnd));
  const launched = await desktopPetShellRuntime.launchLocalApp({ query: name });
  const appName = launched?.app?.name?.trim() || name;
  // Launchers often return before their window exists; poll for a new matching window.
  const deadline = Date.now() + LAUNCH_WAIT_MS;
  while (Date.now() < deadline) {
    await sleep(LAUNCH_POLL_MS);
    const { windows } = await observeLoopWindows();
    const match = resolveLoopWindow(appName, windows.filter((window) => !before.has(window.hwnd)))
      ?? resolveLoopWindow(name, windows.filter((window) => !before.has(window.hwnd)))
      ?? resolveLoopWindow(appName, windows);
    if (match?.box) return { detail: `已启动，窗口「${match.title}」出现。`, focusWindow: match, ok: true };
  }
  return launched?.action === 'failed'
    ? { detail: `启动失败：${launched.error ?? '没有找到应用'}`, ok: false }
    : { detail: `已请求启动「${appName}」，${LAUNCH_WAIT_MS / 1000} 秒内没有看到它的窗口（可能在托盘或仍在加载）。`, ok: true };
}

/**
 * Runs one actuating action. Element actions only accept ids from the current observation,
 * so the click point always comes from a box read moments ago in that same window.
 */
export async function executeLoopAction(action: LoopAction, context: {
  elements: LoopElement[];
  focus: LoopWindow | null;
  windows: LoopWindow[];
}): Promise<LoopActionOutcome> {
  const element = 'element' in action && action.element
    ? context.elements.find((candidate) => candidate.id === action.element) ?? null
    : null;
  switch (action.action) {
    case 'launch_app':
      return launchApp(action.name);
    case 'focus_window': {
      const window = resolveLoopWindow(action.window, context.windows);
      if (!window) return { detail: `没有找到窗口「${action.window}」。`, ok: false };
      await bringToFront(window);
      return { detail: `已切换到「${window.title}」。`, focusWindow: window, ok: true };
    }
    case 'click':
    case 'double_click':
    case 'right_click': {
      if (!context.focus) return { detail: '当前没有目标窗口，先 observe 一个窗口。', ok: false };
      if (!element) return { detail: `清单里没有编号 [${action.element}]。`, ok: false };
      if (!element.enabled) return { detail: `[${element.id}]「${element.label}」当前不可用。`, ok: false };
      await bringToFront(context.focus);
      const error = await sendInput(context.focus, { action: action.action, coordinateSpace: 'native-screen', x: element.center.x, y: element.center.y });
      return error ? { detail: `点击失败：${error}`, ok: false } : { detail: `已${action.action === 'click' ? '点击' : action.action === 'double_click' ? '双击' : '右键'}「${element.label}」。`, ok: true };
    }
    case 'type_text': {
      if (!context.focus) return { detail: '当前没有目标窗口，先 observe 一个窗口。', ok: false };
      await bringToFront(context.focus);
      if (action.element) {
        if (!element) return { detail: `清单里没有编号 [${action.element}]。`, ok: false };
        const clickError = await sendInput(context.focus, { action: 'click', coordinateSpace: 'native-screen', x: element.center.x, y: element.center.y });
        if (clickError) return { detail: `点击输入框失败：${clickError}`, ok: false };
      }
      const error = await sendInput(context.focus, { action: 'type_text', text: action.text });
      return error ? { detail: `输入失败：${error}`, ok: false } : { detail: `已输入 ${action.text.length} 个字符。`, ok: true };
    }
    case 'press_keys': {
      if (!context.focus) return { detail: '当前没有目标窗口，先 observe 一个窗口。', ok: false };
      await bringToFront(context.focus);
      const error = await sendInput(context.focus, { action: 'send_keys', keys: action.keys });
      return error ? { detail: `按键失败：${error}`, ok: false } : { detail: `已按下 ${action.keys}。`, ok: true };
    }
    default:
      return { detail: `${action.action} 不是执行类动作。`, ok: false };
  }
}
