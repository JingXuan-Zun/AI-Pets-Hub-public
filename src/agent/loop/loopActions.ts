// The only actions the loop's model may choose, and the single place their JSON is parsed.

export type LoopAction =
  | { action: 'observe'; window: string }
  | { action: 'look'; question: string }
  | { action: 'launch_app'; name: string }
  | { action: 'focus_window'; window: string }
  | { action: 'click' | 'double_click' | 'right_click'; element: number }
  | { action: 'type_text'; element?: number; text: string }
  | { action: 'press_keys'; keys: string }
  | { action: 'wait'; seconds: number; until?: string }
  | { action: 'ask_user'; question: string }
  | { action: 'done'; summary: string };

export type LoopDecision = LoopAction & { thought?: string };

export const LOOP_ACTION_GUIDE = [
  'observe {"window": "<窗口标题或进程名或hwnd>"}：切换到某个窗口并读取它的编号元素清单；window 写 "屏幕" 时读取整个主屏幕。',
  'look {"question": "..."}：用视觉模型看当前窗口截图（慢，只在清单里没有目标、目标是纯图标、或需要理解画面时用）。',
  'launch_app {"name": "..."}：启动本机应用（未运行时）。',
  'focus_window {"window": "..."}：把已打开的窗口切到前台。',
  'click / double_click / right_click {"element": 编号}：点击清单里的元素。只能用清单里的编号。',
  'type_text {"text": "...", "element": 编号(可选，先点击该输入框)}：输入文字。',
  'press_keys {"keys": "{ENTER}"}：按键，SendKeys 格式，例如 {ENTER}、{TAB}、{PGDN}、^a。',
  'wait {"seconds": 1-10, "until": "等待出现的文字或窗口(可选)"}：等待加载、启动或窗口出现。',
  'ask_user {"question": "..."}：需要用户处理（验证码、扫码、密码、无法判断）时使用。',
  'done {"summary": "..."}：任务已完成，summary 写明看到的完成证据。',
].join('\n');

const NUMBER_FIELDS = new Set(['element', 'seconds']);

function extractJsonObject(text: string) {
  const cleaned = text.replace(/```(?:json)?/giu, '').trim();
  const start = cleaned.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  for (let index = start; index < cleaned.length; index += 1) {
    const char = cleaned[index];
    if (inString) {
      if (char === '\\') index += 1;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === '{') depth += 1;
    else if (char === '}' && --depth === 0) return cleaned.slice(start, index + 1);
  }
  return null;
}

function stringField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '';
}

function numberField(record: Record<string, unknown>, key: string) {
  const value = Number(record[key]);
  return Number.isFinite(value) ? value : NaN;
}

/** Parses the model reply. Accepts flat args or {"action": "...", "args": {...}}. */
export function parseLoopDecision(text: string): { decision: LoopDecision } | { error: string } {
  const json = extractJsonObject(text);
  if (!json) return { error: '没有找到 JSON 对象。' };
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(json) as Record<string, unknown>;
  } catch {
    return { error: 'JSON 格式错误。' };
  }
  const args = raw.args && typeof raw.args === 'object' && !Array.isArray(raw.args)
    ? { ...raw, ...(raw.args as Record<string, unknown>) }
    : raw;
  for (const key of NUMBER_FIELDS) {
    if (typeof args[key] === 'string') args[key] = Number(String(args[key]).replace(/[^\d.]/gu, ''));
  }
  const action = stringField(args, 'action').toLowerCase();
  const thought = stringField(args, 'thought') || undefined;
  const withThought = <T extends LoopAction>(decision: T): { decision: LoopDecision } => ({ decision: { ...decision, thought } });
  switch (action) {
    case 'observe':
    case 'focus_window': {
      const window = stringField(args, 'window') || stringField(args, 'title') || stringField(args, 'hwnd');
      return window ? withThought({ action, window }) : { error: `${action} 需要 window。` };
    }
    case 'look': {
      const question = stringField(args, 'question');
      return question ? withThought({ action, question }) : { error: 'look 需要 question。' };
    }
    case 'launch_app': {
      const name = stringField(args, 'name') || stringField(args, 'app');
      return name ? withThought({ action, name }) : { error: 'launch_app 需要 name。' };
    }
    case 'click':
    case 'double_click':
    case 'right_click': {
      const element = numberField(args, 'element');
      return element > 0 ? withThought({ action, element: Math.round(element) }) : { error: `${action} 需要清单里的 element 编号。` };
    }
    case 'type_text': {
      const text = typeof args.text === 'string' ? args.text : '';
      const element = numberField(args, 'element');
      return text ? withThought({ action, text, ...(element > 0 ? { element: Math.round(element) } : {}) }) : { error: 'type_text 需要 text。' };
    }
    case 'press_keys': {
      const keys = stringField(args, 'keys');
      return keys ? withThought({ action, keys }) : { error: 'press_keys 需要 keys。' };
    }
    case 'wait': {
      const seconds = Math.min(10, Math.max(1, numberField(args, 'seconds') || 2));
      const until = stringField(args, 'until') || undefined;
      return withThought({ action, seconds, ...(until ? { until } : {}) });
    }
    case 'ask_user': {
      const question = stringField(args, 'question') || stringField(args, 'summary');
      return question ? withThought({ action, question }) : { error: 'ask_user 需要 question。' };
    }
    case 'done':
      return withThought({ action, summary: stringField(args, 'summary') || '任务完成。' });
    default:
      return { error: `未知动作 "${action}"。` };
  }
}

/** One short log line per action, reused by the task log and approval text. */
export function describeLoopAction(action: LoopAction, elementLabel?: string) {
  switch (action.action) {
    case 'observe': return `读取窗口「${action.window}」`;
    case 'look': return `视觉查看：${action.question}`;
    case 'launch_app': return `启动「${action.name}」`;
    case 'focus_window': return `切换到「${action.window}」`;
    case 'click': return `点击 [${action.element}]${elementLabel ? `「${elementLabel}」` : ''}`;
    case 'double_click': return `双击 [${action.element}]${elementLabel ? `「${elementLabel}」` : ''}`;
    case 'right_click': return `右键 [${action.element}]${elementLabel ? `「${elementLabel}」` : ''}`;
    case 'type_text': return `输入「${action.text.length > 30 ? `${action.text.slice(0, 30)}…` : action.text}」`;
    case 'press_keys': return `按键 ${action.keys}`;
    case 'wait': return `等待 ${action.seconds} 秒${action.until ? `（直到出现「${action.until}」）` : ''}`;
    case 'ask_user': return `询问用户：${action.question}`;
    case 'done': return `完成：${action.summary}`;
  }
}
