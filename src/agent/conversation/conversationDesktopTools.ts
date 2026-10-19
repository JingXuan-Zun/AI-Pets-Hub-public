import { desktopPetShellRuntime } from '../../desktopShellRuntime';
import { resolveVisionModelSettings } from '../../visionModelSettings';
import type { PetConfig } from '../../types';
import { executeDesktopInputWithFocusRetry, setElevatedInputApprover } from '../desktopTools/desktopInputFocusRetry';
import { formatElementMarks, type LoopElement } from '../loop/elementMarks';
import { type LoopAction } from '../loop/loopActions';
import {
  classifyLoopActionRisk,
  createActionApprovalRequest,
  createTaskScopeApprovalRequest,
  type LoopActionRisk,
} from '../loop/loopApproval';
import { executeLoopAction, resolveLoopWindow, type LoopActionOutcome } from '../loop/loopExecutor';
import { formatLoopWindows } from '../loop/loopPrompt';
import { compareLoopState } from '../loop/loopVerification';
import { lookAtLoopWindow } from '../loop/loopVision';
import {
  observeLoopScreen,
  observeLoopWindowElements,
  observeLoopWindows,
  type LoopWindow,
  type LoopWindowObservation,
} from '../loop/observationTiers';
import type { ConversationToolDefinition } from './conversationToolTypes';

// Fine-grained desktop tools for the conversation loop. The model reads a window as a
// numbered element list, acts on an element id (or a screen point), and every action
// returns what changed plus the fresh list, so it can judge success without a separate
// verification layer. Reuses the desktop loop's observation tiers, executor and approval
// policy: one approval for operating the computer, typing/sending/deleting asked each time.

export interface DesktopToolDependencies {
  executeLoop: (action: LoopAction, context: { elements: LoopElement[]; focus: LoopWindow | null; windows: LoopWindow[] }) => Promise<LoopActionOutcome>;
  focusWindow: (window: LoopWindow) => Promise<void>;
  /** Sends one raw input request; resolves with an error message, or null on success. */
  input: (request: Record<string, unknown>) => Promise<string | null>;
  /** Opens a URL in the default browser; resolves with an error message, or null. */
  openUrl: (url: string) => Promise<string | null>;
  look: ((observation: LoopWindowObservation, question: string) => Promise<{ answer: string; elements: LoopElement[] }>) | null;
  observeElements: (window: LoopWindow) => Promise<LoopWindowObservation>;
  observeScreen: () => Promise<LoopWindowObservation>;
  observeWindows: () => Promise<{ active: LoopWindow | null; windows: LoopWindow[] }>;
  sleep: (ms: number) => Promise<void>;
}

export interface DesktopToolResult {
  /** Shorter form that replaces this result once a newer observation exists. */
  compact?: string;
  content: string;
}

export interface ConversationDesktopTool {
  definition: ConversationToolDefinition;
  run: (args: Record<string, unknown>) => Promise<DesktopToolResult>;
}

export interface ConversationDesktopSession {
  tools: ConversationDesktopTool[];
}

const SETTLE_MS = 600;
const MAX_ACTIONS = 40;
const MAX_DURATION_MS = 5 * 60_000;
const OWN_WINDOW = /^AI Desktop Pet\b/iu;
const SCREEN_QUERY = /^(?:屏幕|整个屏幕|全屏|桌面|screen)$/iu;
const TRASH_LABEL = /(?:回收站|废纸篓|recycle|trash)/iu;
const NO_VISION_HINT = '（没有配置视觉模型，看不了画面：纯图标按钮可以改用快捷键、命令、清单里相邻文字的坐标，或请用户告诉你位置；必要时提醒用户可以在设置里配置一个视觉模型。）';

function defaultDependencies(settings: PetConfig['settings']): DesktopToolDependencies {
  const vision = resolveVisionModelSettings(settings);
  return {
    executeLoop: executeLoopAction,
    focusWindow: async (window) => {
      if (!(window.hwnd > 0)) return;
      try {
        await desktopPetShellRuntime.focusWindow({ hwnd: window.hwnd, pid: window.pid ?? undefined } as never);
      } catch {
        // The input guard reports it if the window did not come forward.
      }
      await new Promise((resolve) => { globalThis.setTimeout(resolve, 250); });
    },
    input: async (request) => {
      const result = (await executeDesktopInputWithFocusRetry(request) ?? {}) as { error?: unknown; ok?: unknown; reason?: unknown };
      return result.ok === false ? String(result.error ?? result.reason ?? '输入执行失败') : null;
    },
    look: !vision.disabled && vision.mode === 'dedicated-vision-model'
      ? (observation, question) => lookAtLoopWindow({ observation, question, settings })
      : null,
    openUrl: async (url) => {
      const result = (await desktopPetShellRuntime.openResource({ resourceType: 'url', url }) ?? {}) as { error?: unknown; ok?: unknown };
      return result.ok === false ? String(result.error ?? '打开失败') : null;
    },
    observeElements: observeLoopWindowElements,
    observeScreen: observeLoopScreen,
    observeWindows: observeLoopWindows,
    sleep: (ms) => new Promise((resolve) => { globalThis.setTimeout(resolve, ms); }),
  };
}

function readableUrl(url: string) {
  let readable = url;
  try {
    readable = decodeURI(url);
  } catch {
    // Keep the raw form when it is not valid percent-encoding.
  }
  return readable.length > 100 ? `${readable.slice(0, 100)}…` : readable;
}

function tool(name: string, description: string, properties: Record<string, unknown>, required: string[], run: ConversationDesktopTool['run']): ConversationDesktopTool {
  return {
    definition: { function: { description, name, parameters: { properties, required, type: 'object' } }, type: 'function' },
    run,
  };
}

function text(args: Record<string, unknown>, key: string) {
  const value = args[key];
  return typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '';
}

function inside(point: { x: number; y: number }, window: LoopWindow | null) {
  const box = window?.box;
  return Boolean(box && point.x >= box.x && point.x <= box.x + box.width && point.y >= box.y && point.y <= box.y + box.height);
}

/** The window a login/splash screen turned into keeps its title or process. */
function followReplacedWindow(focus: LoopWindow | null, windows: LoopWindow[], active: LoopWindow | null) {
  if (!focus || focus.hwnd === 0 || windows.some((window) => window.hwnd === focus.hwnd)) return focus;
  return windows.find((window) => window.title && window.title === focus.title && window.box)
    ?? windows.find((window) => window.processName && window.processName === focus.processName && window.box)
    ?? (active && !OWN_WINDOW.test(active.title) ? active : null);
}

export function createConversationDesktopSession(options: {
  dependencies?: Partial<DesktopToolDependencies>;
  goal: string;
  now?: () => number;
  requestApproval: (request: { detail: string; title: string }) => Promise<boolean>;
  settings: PetConfig['settings'];
}): ConversationDesktopSession {
  const deps: DesktopToolDependencies = { ...defaultDependencies(options.settings), ...options.dependencies };
  const now = options.now ?? Date.now;
  let active: LoopWindow | null = null;
  let windows: LoopWindow[] = [];
  let focus: LoopWindow | null = null;
  let observation: LoopWindowObservation | null = null;
  let scopeApproved = false;
  let denied = false;
  let previousAction: LoopAction | null = null;
  let actions = 0;
  let startedAt: number | null = null;
  let approvalWaitMs = 0;
  const launched = new Set<string>();

  const ensureWindows = async () => {
    if (!windows.length) ({ active, windows } = await deps.observeWindows());
  };
  const observe = async (window: LoopWindow) => {
    focus = window;
    observation = window.hwnd === 0 ? await deps.observeScreen() : await deps.observeElements(window);
    focus = observation.window;
    return observation;
  };
  const formatObservation = (current: LoopWindowObservation) => {
    const status = current.captureStatus === 'not-capturable'
      ? '窗口最小化或不可见，先 focus_window。'
      : current.ocrStatus !== 'ok' ? '文字识别不可用，只有控件信息。' : '';
    const list = current.elements.length ? formatElementMarks(current.elements) : `（没有读到元素，可能还在加载，wait 一下再读）${deps.look ? '' : NO_VISION_HINT}`;
    return [`窗口「${current.window.title || current.window.processName}」（${current.elements.length} 个元素${status ? `，${status}` : ''}）：`, list].join('\n');
  };
  const compactObservation = (current: LoopWindowObservation) => `（读过窗口「${current.window.title || current.window.processName}」，${current.elements.length} 个元素；编号以最新一次为准）`;

  const approve = async (request: { detail: string; title: string }) => {
    const asked = now();
    const granted = await options.requestApproval(request);
    approvalWaitMs += now() - asked;
    return granted;
  };
  // A window running as administrator (WeGame, some launchers) ignores normal input; the user
  // can let an elevated helper act for this conversation (Windows asks once more).
  setElevatedInputApprover(() => approve({
    detail: [
      '要操作的窗口是以管理员身份运行的（例如 WeGame），普通权限点不动它。',
      '同意后 Windows 会再弹一个确认框，点“是”即可。管理员助手只负责点击和输入，几分钟不用会自动关闭。',
    ].join('\n'),
    title: '临时使用管理员权限操作这个窗口',
  }));
  /** Returns a refusal message, or null when the action may run. */
  const authorize = async (action: LoopAction, label: string | undefined, override?: { reason: string; risk: LoopActionRisk; title?: string }) => {
    if (denied) return '用户没有允许操作电脑。不要再尝试，直接告诉用户。';
    startedAt ??= now();
    if (actions >= MAX_ACTIONS) return `这次已经操作了 ${MAX_ACTIONS} 步，先停下，把进展告诉用户，问要不要继续。`;
    if (now() - startedAt - approvalWaitMs > MAX_DURATION_MS) return '这次操作超过 5 分钟了，先停下，把进展告诉用户。';
    const { reason, risk } = override ?? classifyLoopActionRisk(action, { elementLabel: label, previousAction });
    if (risk === 'confirm') {
      const request = override?.title
        ? { detail: `${override.title}\n原因：${reason}`, title: override.title }
        : { detail: createActionApprovalRequest(action, reason, label).detail, title: '' };
      if (!await approve({ detail: request.detail, title: request.title || request.detail.split('\n')[0] })) return '用户拒绝了这一步，没有执行。换个方法，或问用户。';
      return null;
    }
    if (risk === 'scope' && !scopeApproved) {
      const request = createTaskScopeApprovalRequest(options.goal);
      if (!await approve({ detail: request.detail, title: '让我操作你的电脑' })) {
        denied = true;
        return '用户没有允许操作电脑。不要再尝试，直接告诉用户。';
      }
      scopeApproved = true;
    }
    return null;
  };

  /** After an action: let the UI settle, re-read windows and the focused window, report the change. */
  const afterAction = async (action: LoopAction, outcome: LoopActionOutcome): Promise<DesktopToolResult> => {
    actions += 1;
    previousAction = action;
    if (outcome.focusWindow) focus = outcome.focusWindow;
    const before = { active, observation, windows };
    if (action.action !== 'launch_app') await deps.sleep(SETTLE_MS);
    ({ active, windows } = await deps.observeWindows());
    focus = followReplacedWindow(focus, windows, active);
    const current = focus ? await observe(focus) : null;
    if (!current) observation = null;
    const change = outcome.ok ? compareLoopState({ after: { active, observation, windows }, before }).summary : '';
    // A failed input is usually a dialog or another window in front; say which, so the model
    // deals with it instead of retrying the same click.
    const blocker = !outcome.ok && active && active.hwnd !== (focus as LoopWindow | null)?.hwnd && !OWN_WINDOW.test(active.title)
      ? `当前前台是「${active.title || active.processName}」，可能挡住了目标窗口：先处理它（例如关掉对话框），或 read_window 读它。`
      : '';
    const head = [`结果：${outcome.ok ? '' : '失败，'}${outcome.detail}`, change ? `变化：${change}` : '', blocker].filter(Boolean).join('\n');
    return current
      ? { compact: `${head}\n${compactObservation(current)}`, content: `${head}\n${formatObservation(current)}` }
      : { content: head };
  };

  /** "12" / "[12]" → element of the latest observation; "x,y" → native screen point. */
  const resolveTarget = (raw: string): { element?: LoopElement; error?: string; point?: { x: number; y: number } } => {
    const id = /^\s*[[#]?(\d+)\]?\s*$/u.exec(raw);
    if (id) {
      const element = (observation as LoopWindowObservation | null)?.elements.find((item) => item.id === Number(id[1]));
      if (!element) return { error: observation ? `最新清单里没有编号 [${id[1]}]，先 read_window。` : '还没有读过窗口，先 read_window 拿到编号。' };
      if (!element.enabled) return { error: `[${element.id}]「${element.label}」当前不可用。` };
      return { element, point: element.center };
    }
    const xy = /^\s*@?\s*\(?\s*(-?\d+(?:\.\d+)?)\s*[,，\s]\s*(-?\d+(?:\.\d+)?)\s*\)?\s*$/u.exec(raw);
    if (xy) return { point: { x: Math.round(Number(xy[1])), y: Math.round(Number(xy[2])) } };
    return { error: `看不懂位置「${raw}」：写元素编号（如 12）或屏幕坐标（如 "640,360"）。` };
  };
  const guardFor = (...points: Array<{ x: number; y: number }>) => (focus && focus.hwnd > 0 && points.every((point) => inside(point, focus))
    ? { expectedForegroundHwnd: focus.hwnd, ...(focus.pid ? { expectedForegroundPid: focus.pid } : {}) }
    : {});

  const targetProperty = (what: string) => ({ description: `${what}：最新清单里的元素编号（如 12），或屏幕坐标 "x,y"（清单每行的 @x,y 就是坐标）`, type: 'string' });

  const tools: ConversationDesktopTool[] = [
    tool('list_windows', '列出电脑上打开的窗口（标题、进程、是否最小化）和前台窗口。操作电脑前先用它或 read_window 了解现状。', {}, [], async () => {
      ({ active, windows } = await deps.observeWindows());
      return { compact: `（看过窗口列表，${windows.length} 个窗口）`, content: formatLoopWindows(windows, active) };
    }),
    tool('read_window', [
      '读取一个窗口的界面：按钮、输入框、列表项、文字，每个带编号和屏幕坐标。之后的点击、输入、拖动用这些编号。',
      'window 写窗口标题、进程名或 hwnd；写“屏幕”读取整个主屏幕的文字。',
      '每次操作后都会自动返回最新清单，不需要重复读取。编号只在最新一次清单里有效。',
    ].join(''), { window: { description: '窗口标题、进程名、hwnd，或“屏幕”', type: 'string' } }, ['window'], async (args) => {
      const query = text(args, 'window');
      if (!query) return { content: '需要 window。' };
      if (SCREEN_QUERY.test(query)) {
        const current = await observe({ box: null, hwnd: 0, pid: null, processName: 'screen', title: '整个屏幕' });
        return { compact: compactObservation(current), content: formatObservation(current) };
      }
      ({ active, windows } = await deps.observeWindows());
      const window = resolveLoopWindow(query, windows);
      if (!window) return { content: `没有找到窗口「${query}」。用 list_windows 看看有哪些，或 launch_app 打开它。` };
      const current = await observe(window);
      return { compact: compactObservation(current), content: formatObservation(current) };
    }),
    ...(deps.look ? [tool('look', '用视觉模型看当前窗口的截图（慢，几秒）。只在清单里找不到目标、目标是纯图标、或需要理解画面内容时用。找到的图标会加进清单并给出编号。', {
      question: { description: '想知道什么，例如“设置按钮（齿轮图标）在哪”', type: 'string' },
    }, ['question'], async (args) => {
      const question = text(args, 'question');
      await ensureWindows();
      if (!observation) {
        const fallback = active && !OWN_WINDOW.test(active.title) && active.box ? active : null;
        await observe(fallback ?? { box: null, hwnd: 0, pid: null, processName: 'screen', title: '整个屏幕' });
      }
      const current = observation as LoopWindowObservation | null;
      if (!current || !deps.look) return { content: '现在没有可以查看的窗口。' };
      const seen = await deps.look(current, question)
        .catch((error: unknown) => ({ answer: `视觉查看失败：${error instanceof Error ? error.message : String(error)}`, elements: current.elements }));
      observation = { ...current, elements: seen.elements };
      return { compact: `（看过画面）${seen.answer.slice(0, 120)}`, content: seen.answer };
    })] : []),
    tool('launch_app', '启动电脑上的应用（没有运行时）。启动后返回新出现的窗口和它的界面清单。', {
      name: { description: '应用名，例如“QQ音乐”“记事本”', type: 'string' },
    }, ['name'], async (args) => {
      const name = text(args, 'name');
      if (!name) return { content: '需要 name。' };
      const key = name.normalize('NFKC').replace(/\s+/gu, '').toLowerCase();
      if (launched.has(key)) return { content: '这次已经启动过它了；它可能在托盘或还在加载。用 wait 等窗口出现，或 list_windows 看看。' };
      const action: LoopAction = { action: 'launch_app', name };
      const refusal = await authorize(action, undefined);
      if (refusal) return { content: refusal };
      await ensureWindows();
      const outcome = await deps.executeLoop(action, { elements: [], focus, windows });
      if (outcome.ok) launched.add(key);
      return afterAction(action, outcome);
    }),
    tool('open_url', '用默认浏览器打开网址（每次都会请用户确认）。搜索东西时直接打开搜索结果页最快，例如 https://www.bing.com/search?q=关键词，比在浏览器里点输入框、打字、回车稳得多。返回打开后的浏览器窗口清单。', {
      url: { description: '完整网址，以 http:// 或 https:// 开头', type: 'string' },
    }, ['url'], async (args) => {
      const url = text(args, 'url');
      if (!/^https?:\/\//iu.test(url)) return { content: '需要以 http:// 或 https:// 开头的完整网址。' };
      const action: LoopAction = { action: 'launch_app', name: url };
      const refusal = await authorize(action, undefined, { reason: '打开网址每次都需要确认', risk: 'confirm', title: `打开网址：${readableUrl(url)}` });
      if (refusal) return { content: refusal };
      const error = await deps.openUrl(url);
      if (error) return { content: `打开失败：${error}` };
      await deps.sleep(1500);
      const opened = await deps.observeWindows();
      const browser = opened.active && !OWN_WINDOW.test(opened.active.title) ? opened.active : null;
      return afterAction({ action: 'focus_window', window: url }, { detail: `已在浏览器打开 ${url.length > 80 ? `${url.slice(0, 80)}…` : url}。`, focusWindow: browser, ok: true });
    }),
    tool('focus_window', '把一个已经打开的窗口切到前台，并返回它的界面清单。', {
      window: { description: '窗口标题、进程名或 hwnd', type: 'string' },
    }, ['window'], async (args) => {
      const query = text(args, 'window');
      const action: LoopAction = { action: 'focus_window', window: query };
      const refusal = await authorize(action, undefined);
      if (refusal) return { content: refusal };
      ({ active, windows } = await deps.observeWindows());
      return afterAction(action, await deps.executeLoop(action, { elements: [], focus, windows }));
    }),
    tool('click', '点击。target 用最新清单里的元素编号；清单里没有、但知道位置时可以用屏幕坐标。返回点击后的变化和新清单。文件改名、移动、复制、新建文件夹不要在资源管理器里点，用 files 工具。', {
      button: { description: 'left（默认）、double（双击）或 right（右键）', enum: ['left', 'double', 'right'], type: 'string' },
      target: targetProperty('点哪里'),
    }, ['target'], async (args) => {
      const target = resolveTarget(text(args, 'target'));
      if (target.error || !target.point) return { content: target.error ?? '需要 target。' };
      const button = text(args, 'button');
      const kind = button === 'double' ? 'double_click' : button === 'right' ? 'right_click' : 'click';
      const action: LoopAction = { action: kind, element: target.element?.id ?? 0 };
      const refusal = await authorize(action, target.element?.label);
      if (refusal) return { content: refusal };
      ({ active, windows } = await deps.observeWindows());
      // A context menu or popup in front: click into it as is. Bringing the main window
      // forward first (what an element click does) would close the menu.
      // Menus often have no capture bounds; then the same process as the window we work in decides.
      const popup = active && focus && active.hwnd !== focus.hwnd && !OWN_WINDOW.test(active.title)
        && (inside(target.point, active) || (!active.box && Boolean(active.processName) && active.processName === focus.processName))
        ? active
        : null;
      if (popup) {
        const error = await deps.input({ action: kind, coordinateSpace: 'native-screen', ...target.point, expectedForegroundHwnd: popup.hwnd });
        return afterAction(action, error
          ? { detail: `点击失败：${error}`, ok: false }
          : { detail: `已在弹出的「${popup.title || '菜单'}」里点击${target.element ? `「${target.element.label}」` : ` ${target.point.x},${target.point.y}`}。`, ok: true });
      }
      if (target.element) return afterAction(action, await deps.executeLoop(action, { elements: observation?.elements ?? [], focus, windows }));
      if (focus && inside(target.point, focus)) await deps.focusWindow(focus);
      const error = await deps.input({ action: kind, coordinateSpace: 'native-screen', ...target.point, ...guardFor(target.point) });
      return afterAction(action, error ? { detail: `点击失败：${error}`, ok: false } : { detail: `已${kind === 'click' ? '点击' : kind === 'double_click' ? '双击' : '右键'}坐标 ${target.point.x},${target.point.y}。`, ok: true });
    }),
    tool('type_text', '输入文字（每次都会请用户确认）。可以先指定输入框编号，会先点它再输入。只输入，不会按回车；要发送或确认再用 press_keys。', {
      target: targetProperty('先点击的输入框（可选）'),
      text: { description: '要输入的文字', type: 'string' },
    }, ['text'], async (args) => {
      const value = typeof args.text === 'string' ? args.text : '';
      if (!value) return { content: '需要 text。' };
      const rawTarget = text(args, 'target');
      const target = rawTarget ? resolveTarget(rawTarget) : null;
      if (target?.error) return { content: target.error };
      if (!focus) return { content: '还不知道往哪个窗口输入，先 read_window。' };
      const action: LoopAction = { action: 'type_text', text: value, ...(target?.element ? { element: target.element.id } : {}) };
      const refusal = await authorize(action, target?.element?.label);
      if (refusal) return { content: refusal };
      await ensureWindows();
      if (target?.point && !target.element) {
        await deps.focusWindow(focus);
        const clickError = await deps.input({ action: 'click', coordinateSpace: 'native-screen', ...target.point, ...guardFor(target.point) });
        if (clickError) return afterAction(action, { detail: `点击输入框失败：${clickError}`, ok: false });
      }
      return afterAction(action, await deps.executeLoop(action, { elements: observation?.elements ?? [], focus, windows }));
    }),
    tool('press_keys', '在当前窗口按键或快捷键，SendKeys 格式：{ENTER} 回车、{TAB}、{ESC}、{PGDN}、^a 是 Ctrl+A、%{F4} 是 Alt+F4、^c / ^v 复制粘贴。很多事用快捷键比找按钮更稳。', {
      keys: { description: '例如 "{ENTER}"、"^f"、"%{TAB}"', type: 'string' },
    }, ['keys'], async (args) => {
      const keys = text(args, 'keys');
      if (!keys) return { content: '需要 keys。' };
      if (!focus) return { content: '还不知道在哪个窗口按键，先 read_window 或 focus_window。' };
      const action: LoopAction = { action: 'press_keys', keys };
      const refusal = await authorize(action, undefined);
      if (refusal) return { content: refusal };
      await ensureWindows();
      return afterAction(action, await deps.executeLoop(action, { elements: observation?.elements ?? [], focus, windows }));
    }),
    tool('scroll', '用鼠标滚轮滚动。target 是要滚动的区域（元素编号或坐标），不写就在当前窗口中间滚。amount 是滚几格（默认 5）。', {
      amount: { description: '滚几格，1-30，默认 5', type: 'number' },
      direction: { enum: ['up', 'down', 'left', 'right'], type: 'string' },
      target: targetProperty('在哪里滚（可选）'),
    }, ['direction'], async (args) => {
      const direction = text(args, 'direction') || 'down';
      const amount = Math.min(30, Math.max(1, Math.round(Number(args.amount) || 5)));
      const rawTarget = text(args, 'target');
      const target = rawTarget ? resolveTarget(rawTarget) : null;
      if (target?.error) return { content: target.error };
      const box = focus?.box;
      const point = target?.point ?? (box ? { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) } : null);
      if (!point) return { content: '不知道在哪里滚动，先 read_window，或给出 target。' };
      const action: LoopAction = { action: 'click', element: target?.element?.id ?? 0 };
      const refusal = await authorize(action, undefined, { reason: '任务范围内的滚动', risk: 'scope' });
      if (refusal) return { content: refusal };
      await ensureWindows();
      if (focus && inside(point, focus)) await deps.focusWindow(focus);
      const notches = direction === 'up' || direction === 'right' ? amount : -amount;
      const error = await deps.input({
        action: 'scroll', coordinateSpace: 'native-screen', horizontal: direction === 'left' || direction === 'right', notches, ...point, ...guardFor(point),
      });
      return afterAction({ action: 'press_keys', keys: `scroll:${direction}` }, error ? { detail: `滚动失败：${error}`, ok: false } : { detail: `已向${{ down: '下', left: '左', right: '右', up: '上' }[direction] ?? '下'}滚动 ${amount} 格。`, ok: true });
    }),
    tool('drag', [
      '按住鼠标从 from 拖到 to 再松开：拖文件、拖窗口标题栏、拖滑块、游戏里拖物品都用它。',
      'from / to 可以是最新清单里的编号，也可以是屏幕坐标 "x,y"；跨窗口拖动时，先读来源窗口记下坐标，再读目标窗口。',
    ].join(''), {
      from: targetProperty('从哪里开始拖'),
      to: targetProperty('拖到哪里'),
    }, ['from', 'to'], async (args) => {
      const from = resolveTarget(text(args, 'from'));
      const to = resolveTarget(text(args, 'to'));
      if (from.error || !from.point) return { content: from.error ?? '需要 from。' };
      if (to.error || !to.point) return { content: to.error ?? '需要 to。' };
      const fromLabel = from.element?.label ?? `${from.point.x},${from.point.y}`;
      const toLabel = to.element?.label ?? `${to.point.x},${to.point.y}`;
      const action: LoopAction = { action: 'click', element: from.element?.id ?? 0 };
      const intoTrash = TRASH_LABEL.test(toLabel);
      const refusal = await authorize(action, `${fromLabel} → ${toLabel}`, intoTrash
        ? { reason: '拖进回收站会删除文件', risk: 'confirm' }
        : { reason: '任务范围内的拖动', risk: 'scope' });
      if (refusal) return { content: refusal };
      await ensureWindows();
      if (focus && inside(from.point, focus)) await deps.focusWindow(focus);
      const error = await deps.input({
        action: 'drag', coordinateSpace: 'native-screen',
        fromX: from.point.x, fromY: from.point.y, toX: to.point.x, toY: to.point.y,
        steps: 24, ...guardFor(from.point, to.point),
      });
      return afterAction({ action: 'press_keys', keys: 'drag' }, error ? { detail: `拖动失败：${error}`, ok: false } : { detail: `已把「${fromLabel}」拖到「${toLabel}」。`, ok: true });
    }),
    tool('wait', '等待加载、启动或窗口出现（1-10 秒）。until 写要等的窗口标题或文字，出现就提前结束。返回等待后的变化和新清单。', {
      seconds: { description: '1-10', type: 'number' },
      until: { description: '要等的窗口标题或文字（可选）', type: 'string' },
    }, [], async (args) => {
      const seconds = Math.min(10, Math.max(1, Math.round(Number(args.seconds) || 2)));
      const until = text(args, 'until').normalize('NFKC').toLowerCase();
      await ensureWindows();
      const before = { active, observation, windows };
      const known = new Set(windows.map((window) => window.hwnd));
      for (let waited = 0; waited < seconds; waited += 1) {
        await deps.sleep(1000);
        ({ active, windows } = await deps.observeWindows());
        if (until && windows.some((window) => `${window.title} ${window.processName}`.toLowerCase().includes(until))) break;
        if (windows.some((window) => !known.has(window.hwnd) && !OWN_WINDOW.test(window.title))) break;
      }
      focus = followReplacedWindow(focus, windows, active);
      const current = focus ? await observe(focus) : null;
      const change = compareLoopState({ after: { active, observation, windows }, before }).summary;
      return current
        ? { compact: `等待后：${change}\n${compactObservation(current)}`, content: `等待后：${change}\n${formatObservation(current)}` }
        : { content: `等待后：${change}` };
    }),
  ];
  return { tools };
}
