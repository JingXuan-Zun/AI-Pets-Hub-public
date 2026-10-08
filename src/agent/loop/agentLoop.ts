import { type PetConfig } from '../../types';
import { describeLoopAction, parseLoopDecision, type LoopAction, type LoopDecision } from './loopActions';
import {
  classifyLoopActionRisk,
  createActionApprovalRequest,
  createTaskScopeApprovalRequest,
  type LoopApprovalHandler,
} from './loopApproval';
import { executeLoopAction, resolveLoopWindow, type LoopActionOutcome } from './loopExecutor';
import { buildLoopStepPrompt, LOOP_SYSTEM_INSTRUCTION, type LoopStepRecord } from './loopPrompt';
import { compareLoopState, isRepeatedNoChange } from './loopVerification';
import { lookAtLoopWindow } from './loopVision';
import { observeLoopScreen, observeLoopWindowElements, observeLoopWindows, type LoopWindow, type LoopWindowObservation } from './observationTiers';

// One loop, one decider: observe → decide → act → verify. The runtime only executes, checks
// safety and keeps the budget; it never adds observations or retries on its own.

export interface AgentLoopBudget {
  maxDurationMs: number;
  maxSteps: number;
  maxVisionCalls: number;
}

export const AGENT_LOOP_DEFAULT_BUDGET: AgentLoopBudget = { maxDurationMs: 5 * 60_000, maxSteps: 30, maxVisionCalls: 8 };

export interface AgentLoopDependencies {
  callModel: (prompt: string, system: string) => Promise<string>;
  execute: (action: LoopAction, context: { elements: LoopWindowObservation['elements']; focus: LoopWindow | null; windows: LoopWindow[] }) => Promise<LoopActionOutcome>;
  look: (observation: LoopWindowObservation, question: string) => Promise<{ answer: string; elements: LoopWindowObservation['elements'] }>;
  observeElements: (window: LoopWindow) => Promise<LoopWindowObservation>;
  observeScreen: () => Promise<LoopWindowObservation>;
  observeWindows: () => Promise<{ active: LoopWindow | null; windows: LoopWindow[] }>;
  sleep: (ms: number) => Promise<void>;
}

export type AgentLoopEvent =
  | { index: number; text: string; thought?: string; type: 'step-started' }
  | { changed: boolean | null; index: number; result: string; type: 'step-finished' };

export interface AgentLoopResult {
  metrics: { durationMs: number; modelCalls: number; steps: number; visionCalls: number };
  status: 'done' | 'needs-user' | 'failed' | 'cancelled' | 'budget';
  steps: LoopStepRecord[];
  summary: string;
}

const SETTLE_MS = 600;
const SCREEN_QUERY = /^(?:屏幕|整个屏幕|全屏|桌面|screen)$/iu;
const EXECUTING_ACTIONS = new Set(['launch_app', 'focus_window', 'click', 'double_click', 'right_click', 'type_text', 'press_keys']);

function defaultDependencies(settings: PetConfig['settings'], signal: AbortSignal | null): AgentLoopDependencies {
  return {
    callModel: async (prompt, system) => {
      const { getAgentPlannerResponse } = await import('../../services/geminiService');
      return getAgentPlannerResponse(prompt, system, settings, signal);
    },
    execute: executeLoopAction,
    look: (observation, question) => lookAtLoopWindow({ observation, question, settings }),
    observeElements: observeLoopWindowElements,
    observeScreen: observeLoopScreen,
    observeWindows: observeLoopWindows,
    sleep: (ms) => new Promise((resolve) => { globalThis.setTimeout(resolve, ms); }),
  };
}

/** A login or splash window replaced by the app's next window keeps the same title or process. */
function followReplacedWindow(focus: LoopWindow | null, windows: LoopWindow[], active: LoopWindow | null) {
  if (!focus || focus.hwnd === 0 || windows.some((window) => window.hwnd === focus.hwnd)) return focus;
  return windows.find((window) => window.title && window.title === focus.title && window.box)
    ?? windows.find((window) => window.processName && window.processName === focus.processName && window.box)
    ?? (active && !/^AI Desktop Pet\b/iu.test(active.title) ? active : null);
}

export async function runAgentLoop(options: {
  budget?: Partial<AgentLoopBudget>;
  dependencies?: Partial<AgentLoopDependencies>;
  goal: string;
  onEvent?: (event: AgentLoopEvent) => void;
  requestApproval: LoopApprovalHandler;
  settings: PetConfig['settings'];
  signal?: AbortSignal | null;
}): Promise<AgentLoopResult> {
  const budget = { ...AGENT_LOOP_DEFAULT_BUDGET, ...options.budget };
  const deps = { ...defaultDependencies(options.settings, options.signal ?? null), ...options.dependencies };
  const started = Date.now();
  const steps: LoopStepRecord[] = [];
  const history: Array<{ changed: boolean | null; signature: string }> = [];
  let { active, windows } = await deps.observeWindows();
  let focus: LoopWindow | null = null;
  let observation: LoopWindowObservation | null = null;
  let scopeApproved = false;
  let approvalWaitMs = 0;
  let modelCalls = 0;
  let visionCalls = 0;
  let lastNote: string | null = null;
  let previousAction: LoopAction | null = null;

  const finish = (status: AgentLoopResult['status'], summary: string): AgentLoopResult => ({
    metrics: { durationMs: Date.now() - started, modelCalls, steps: steps.length, visionCalls },
    status,
    steps,
    summary,
  });
  const record = (index: number, action: string, result: string, changed: boolean | null) => {
    steps.push({ action, changed, index, result });
    options.onEvent?.({ changed, index, result, type: 'step-finished' });
  };
  const approve = async (request: Parameters<LoopApprovalHandler>[0]) => {
    const asked = Date.now();
    const granted = await options.requestApproval(request);
    approvalWaitMs += Date.now() - asked;
    return granted;
  };
  const refresh = async () => {
    ({ active, windows } = await deps.observeWindows());
    focus = followReplacedWindow(focus, windows, active);
    observation = !focus ? null : focus.hwnd === 0 ? await deps.observeScreen() : await deps.observeElements(focus);
  };
  const launchedApps = new Set<string>();

  for (let index = 1; index <= budget.maxSteps; index += 1) {
    if (options.signal?.aborted) return finish('cancelled', '任务已取消。');
    if (Date.now() - started - approvalWaitMs > budget.maxDurationMs) return finish('budget', `超过时间预算（${Math.round(budget.maxDurationMs / 1000)} 秒）。`);
    const budgetNote = `第 ${index}/${budget.maxSteps} 步，视觉剩余 ${budget.maxVisionCalls - visionCalls} 次`;
    const prompt = buildLoopStepPrompt({ active, budgetNote, goal: options.goal, lastNote, observation, steps, windows });
    lastNote = null;
    let reply = await deps.callModel(prompt, LOOP_SYSTEM_INSTRUCTION);
    modelCalls += 1;
    let parsed = parseLoopDecision(reply);
    if ('error' in parsed) {
      reply = await deps.callModel(`${prompt}\n\n上一次回复无效：${parsed.error} 只输出一个 JSON 对象。`, LOOP_SYSTEM_INSTRUCTION);
      modelCalls += 1;
      parsed = parseLoopDecision(reply);
    }
    if ('error' in parsed) {
      record(index, '（无效回复）', parsed.error, null);
      continue;
    }
    const decision: LoopDecision = parsed.decision;
    const element = 'element' in decision && decision.element ? observation?.elements.find((item) => item.id === decision.element) : undefined;
    const text = describeLoopAction(decision, element?.label);
    options.onEvent?.({ index, text, thought: decision.thought, type: 'step-started' });

    if (decision.action === 'done') {
      record(index, text, '完成', null);
      return finish('done', decision.summary);
    }
    if (decision.action === 'ask_user') {
      record(index, text, '等待用户', null);
      return finish('needs-user', decision.question);
    }
    if (decision.action === 'observe' && SCREEN_QUERY.test(decision.window.trim())) {
      observation = await deps.observeScreen();
      focus = observation.window;
      record(index, text, `读到 ${observation.elements.length} 个屏幕文字元素`, null);
      continue;
    }
    if (decision.action === 'observe') {
      const window = resolveLoopWindow(decision.window, windows);
      if (!window) {
        record(index, text, `没有找到窗口「${decision.window}」`, null);
        continue;
      }
      focus = window;
      observation = await deps.observeElements(window);
      record(index, text, `读到 ${observation.elements.length} 个元素`, null);
      continue;
    }
    if (decision.action === 'look') {
      if (visionCalls >= budget.maxVisionCalls) {
        record(index, text, '视觉调用次数已用完，请用元素清单或 ask_user', null);
        continue;
      }
      if (!observation) {
        // No window chosen yet (or it vanished): look at the foreground window, else the screen.
        const fallback = active && !/^AI Desktop Pet/iu.test(active.title) && active.box ? active : null;
        observation = fallback ? await deps.observeElements(fallback) : await deps.observeScreen();
        focus = observation.window;
      }
      const current = observation;
      visionCalls += 1;
      const seen: { answer: string; elements: LoopWindowObservation['elements'] } = await deps.look(current, decision.question)
        .catch((error: unknown) => ({ answer: `视觉查看失败：${error instanceof Error ? error.message : String(error)}`, elements: current.elements }));
      observation = { ...current, elements: seen.elements };
      record(index, text, seen.answer, null);
      continue;
    }
    if (decision.action === 'wait') {
      const until = decision.until?.normalize('NFKC').toLowerCase();
      const knownWindows = new Set(windows.map((window) => window.hwnd));
      // Stop early when the awaited text shows up or any new window opens (a launched app's
      // title often differs from its Chinese name, e.g. 英雄联盟 → "League of Legends").
      for (let waited = 0; waited < decision.seconds; waited += 1) {
        await deps.sleep(1000);
        ({ active, windows } = await deps.observeWindows());
        if (until && windows.some((window) => `${window.title} ${window.processName}`.toLowerCase().includes(until))) break;
        if (windows.some((window) => !knownWindows.has(window.hwnd) && !/^AI Desktop Pet/iu.test(window.title))) break;
      }
      const before = { active, observation, windows };
      await refresh();
      const verification = compareLoopState({ after: { active, observation, windows }, before });
      record(index, text, verification.summary, verification.changed);
      continue;
    }
    if (!EXECUTING_ACTIONS.has(decision.action)) continue;
    const launchKey = decision.action === 'launch_app' ? decision.name.normalize('NFKC').replace(/\s+/gu, '').toLowerCase() : '';
    if (launchKey && launchedApps.has(launchKey)) {
      // Launchers hide to the tray after starting a game; relaunching only restarts the wait.
      record(index, text, '本任务已经启动过这个应用，它可能已隐藏到托盘，没有重复启动', null);
      lastNote = '不要重复启动同一个应用；用 wait 等待目标窗口出现，或 observe 屏幕 / look 查看当前画面。';
      continue;
    }

    const { reason, risk } = classifyLoopActionRisk(decision, { elementLabel: element?.label, previousAction });
    if (risk === 'scope' && !scopeApproved) {
      if (!await approve(createTaskScopeApprovalRequest(options.goal))) {
        record(index, text, '用户没有批准这个任务', null);
        return finish('needs-user', '你没有批准执行这个任务。');
      }
      scopeApproved = true;
    }
    if (risk === 'confirm' && !await approve(createActionApprovalRequest(decision, reason, element?.label))) {
      record(index, text, '用户拒绝了这一步', null);
      lastNote = '用户拒绝了上一步，换一个方法或用 ask_user 说明情况。';
      continue;
    }
    const before = { active, observation, windows };
    const outcome = await deps.execute(decision, { elements: observation?.elements ?? [], focus, windows });
    if (outcome.focusWindow) focus = outcome.focusWindow;
    if (launchKey && outcome.ok) launchedApps.add(launchKey);
    previousAction = decision;
    if (decision.action !== 'launch_app') await deps.sleep(SETTLE_MS);
    await refresh();
    const verification = outcome.ok ? compareLoopState({ after: { active, observation, windows }, before }) : { changed: false, summary: '' };
    const signature = `${decision.action}:${element?.label ?? ('window' in decision ? decision.window : '')}`;
    record(index, text, [outcome.detail, verification.summary].filter(Boolean).join('；'), outcome.ok ? verification.changed : false);
    if (isRepeatedNoChange(history, signature) && !verification.changed) {
      lastNote = '同一个动作连续两次没有效果，必须换方法（换元素、look 看画面、wait、或 ask_user）。';
    }
    history.push({ changed: outcome.ok ? verification.changed : false, signature });
  }
  return finish('budget', `已用完 ${budget.maxSteps} 步预算。`);
}
