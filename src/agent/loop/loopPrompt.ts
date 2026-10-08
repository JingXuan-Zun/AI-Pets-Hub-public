import { formatElementMarks, type LoopElement } from './elementMarks';
import { LOOP_ACTION_GUIDE } from './loopActions';
import { type LoopWindow, type LoopWindowObservation } from './observationTiers';

const RECENT_DETAILED_STEPS = 8;
const MAX_WINDOWS_LISTED = 15;
const MAX_ELEMENT_LINES = 90;

export interface LoopStepRecord {
  action: string;
  changed: boolean | null;
  index: number;
  result: string;
}

export const LOOP_SYSTEM_INSTRUCTION = [
  '你是桌面操作 Agent 的决策者。每一步只选一个动作，用 JSON 回复，不要输出其他文字。',
  '格式：{"thought": "一句话说明判断", "action": "动作名", ...参数}',
  '可用动作：',
  LOOP_ACTION_GUIDE,
  '规则：',
  '1. 点击只能用"当前窗口元素"清单里的编号；清单里没有目标时，先 observe 正确的窗口、wait 加载，或用 look 让视觉模型看。',
  '2. 每一步先看上一步的结果：画面没有变化就不要重复同一个动作，换一个方法。',
  '3. 登录页如果账号已经填好、只有"登录/快捷登录/继续"按钮，直接点击它；需要密码、验证码、扫码时用 ask_user。',
  '4. 应用启动、登录、切换页面后先 wait 或 observe 确认新画面，再进行下一步。刚启动或刚切换页面时，元素清单为空或缺少目标，多半是还在加载：先 wait 2-3 秒再看清单，连续两次仍没有才用 look（look 很慢）。',
  '5. 只有看到任务完成的证据才用 done，summary 里写出证据。"启动/打开某应用"类任务：该应用的新窗口出现在窗口列表里就算完成，不需要等它加载完，也不需要 look 确认。',
  '8. 只做用户要求的事：达到要求的结果后立即 done，不要额外点击（例如游戏启动器里的"进入游戏"、弹窗里的活动按钮），除非任务里明确要求。',
  '6. 不要操作 "AI Desktop Pet" 自身的窗口。',
  '7. 启动器（如游戏平台）拉起目标后常会自己隐藏到托盘，这是正常的；先检查窗口列表里是否已出现目标的新窗口，不要重新启动启动器。',
].join('\n');

/** Recent steps in detail, older ones folded into one line so long tasks keep a small prompt. */
export function formatLoopStepLog(steps: LoopStepRecord[]) {
  if (!steps.length) return '（还没有执行任何步骤）';
  const older = steps.slice(0, -RECENT_DETAILED_STEPS);
  const recent = steps.slice(-RECENT_DETAILED_STEPS);
  const lines = recent.map((step) => {
    const change = step.changed === null ? '' : step.changed ? ' ｜ 画面有变化' : ' ｜ 画面无变化';
    return `${step.index}. ${step.action} → ${step.result}${change}`;
  });
  return older.length
    ? [`（前 ${older.length} 步：${older.map((step) => step.action).join('；').slice(0, 300)}）`, ...lines].join('\n')
    : lines.join('\n');
}

function formatWindow(window: LoopWindow) {
  return `${window.title || '(无标题)'}｜${window.processName}｜hwnd=${window.hwnd}${window.box ? '' : '｜最小化/不可见'}`;
}

export function formatLoopWindows(windows: LoopWindow[], active: LoopWindow | null) {
  const visible = windows.filter((window) => !/^AI Desktop Pet\b/iu.test(window.title)).slice(0, MAX_WINDOWS_LISTED);
  return [
    `前台窗口：${active ? formatWindow(active) : '未知'}`,
    ...visible.map((window) => `- ${formatWindow(window)}`),
  ].join('\n');
}

function formatElements(elements: LoopElement[]) {
  if (!elements.length) return '（没有读到可用元素）';
  const lines = formatElementMarks(elements).split('\n');
  return lines.length > MAX_ELEMENT_LINES
    ? [...lines.slice(0, MAX_ELEMENT_LINES), `（还有 ${lines.length - MAX_ELEMENT_LINES} 个元素未列出）`].join('\n')
    : lines.join('\n');
}

function formatObservationStatus(observation: LoopWindowObservation) {
  if (observation.captureStatus === 'not-capturable') return '窗口最小化或不可见，先 focus_window。';
  if (observation.captureStatus === 'failed') return '截图失败，只有控件信息。';
  if (observation.ocrStatus !== 'ok') return '文字识别不可用，只有控件信息；需要时用 look。';
  return '';
}

export function buildLoopStepPrompt(options: {
  active: LoopWindow | null;
  budgetNote: string;
  goal: string;
  lastNote?: string | null;
  observation: LoopWindowObservation | null;
  steps: LoopStepRecord[];
  windows: LoopWindow[];
}) {
  const observation = options.observation;
  return [
    `任务：${options.goal}`,
    `预算：${options.budgetNote}`,
    '',
    '已执行步骤：',
    formatLoopStepLog(options.steps),
    '',
    '打开的窗口：',
    formatLoopWindows(options.windows, options.active),
    '',
    observation
      ? [`当前窗口：${formatWindow(observation.window)}`, formatObservationStatus(observation), '当前窗口元素（编号 / 类型 / 文字 / 坐标）：', formatElements(observation.elements)]
        .filter(Boolean).join('\n')
      : '当前窗口：还没有选择窗口（用 observe 或 launch_app）。',
    options.lastNote ? `\n注意：${options.lastNote}` : '',
    '\n请选择下一步动作（只输出 JSON）。',
  ].filter((line) => line !== '').join('\n');
}
