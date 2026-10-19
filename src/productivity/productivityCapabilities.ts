import { numberArg, stringArg } from '../platform-capabilities/platformCapabilityArgs';
import type { PlatformCapability, PlatformCapabilityContext } from '../platform-capabilities/platformCapabilityTypes';
import {
  createProductivityId,
  MAX_REMINDERS,
  MAX_TODOS,
  normalizeProductivitySettings,
} from './productivitySettings';
import { formatDueTime, formatLocalNow, localDateKey, parseLocalTime, REPEAT_LABELS } from './productivityTime';
import type { ProductivitySettings, ReminderRepeat } from './productivityTypes';

// The reminder / pomodoro / todo plugin, declared like every other platform capability.
// Changes only touch the user's own lists and timer and are easy to undo, so they run
// without a confirmation card (risk "personal").

const GROUP = '提醒和待办';
const REPEATS: ReminderRepeat[] = ['none', 'daily', 'weekdays', 'weekly'];

function read(context: PlatformCapabilityContext) {
  return normalizeProductivitySettings(context.configRef.current.settings.productivity);
}

function write(context: PlatformCapabilityContext, productivity: ProductivitySettings) {
  const config = context.configRef.current;
  const next = { ...config, settings: { ...config.settings, productivity } };
  // Set the ref right away: two calls in one round (e.g. two reminders) must not overwrite
  // each other before React re-renders.
  context.configRef.current = next;
  context.onUpdateConfig(next, { persist: true });
}

/** "2" → second item of the list as shown; otherwise the first item whose text contains it. */
function findIndex<T extends { text: string }>(items: T[], match: string) {
  const wanted = match.trim();
  if (!wanted) return -1;
  const number = /^\d+$/u.test(wanted) ? Number(wanted) : NaN;
  if (Number.isInteger(number) && number >= 1 && number <= items.length) return number - 1;
  return items.findIndex((item) => item.text.includes(wanted) || wanted.includes(item.text));
}

function reminderLines(settings: ProductivitySettings, now: number) {
  return settings.reminders
    .slice()
    .sort((left, right) => left.dueAt - right.dueAt)
    .map((item, index) => `${index + 1}. ${formatDueTime(item.dueAt, now)}${item.repeat !== 'none' ? `（${REPEAT_LABELS[item.repeat]}）` : ''} ${item.text}`);
}

function sortedReminders(settings: ProductivitySettings) {
  return settings.reminders.slice().sort((left, right) => left.dueAt - right.dueAt);
}

function todoLines(settings: ProductivitySettings) {
  return settings.todos.map((item, index) => `${index + 1}. ${item.done ? '[x]' : '[ ]'} ${item.text}`);
}

function pomodoroLine(settings: ProductivitySettings, now: number) {
  const state = settings.pomodoro;
  if (state.phase === 'idle' || !state.phaseEndsAt) return `番茄钟没在计时（默认专注 ${state.focusMinutes} 分钟、休息 ${state.breakMinutes} 分钟）。`;
  const left = Math.max(0, Math.ceil((state.phaseEndsAt - now) / 60_000));
  return `${state.phase === 'focus' ? '专注中' : '休息中'}${state.task ? `：${state.task}` : ''}，还剩约 ${left} 分钟。`;
}

const addReminder: PlatformCapability = {
  args: [
    { description: '提醒的内容，例如“喝水”“给妈妈打电话”', key: 'text', required: true, type: 'string' },
    { description: '本地时间："HH:mm"（今天，已过就明天）或 "YYYY-MM-DD HH:mm"。按工具规则里给的“现在”换算“明天/下午三点”等说法。', key: 'at', type: 'string' },
    { description: '多少分钟后提醒（和 at 二选一）', key: 'in_minutes', type: 'number' },
    { description: '重复：none 不重复，daily 每天，weekdays 工作日，weekly 每周', enumValues: REPEATS, key: 'repeat', type: 'string' },
  ],
  description: 'Set a reminder (“三点提醒我喝水”“半小时后叫我”“每天早上八点提醒我吃药”). At the time the current character tells the user.',
  describe: (args) => `添加提醒：${stringArg(args, 'text')}`,
  group: GROUP,
  id: 'reminders.add',
  risk: 'personal',
  run: (context, args) => {
    const text = stringArg(args, 'text');
    if (!text) return { ok: false, text: '需要提醒的内容。' };
    const now = Date.now();
    const inMinutes = numberArg(args, 'in_minutes');
    const at = stringArg(args, 'at');
    const dueAt = inMinutes !== null && inMinutes > 0
      ? now + Math.round(inMinutes * 60_000)
      : at ? parseLocalTime(at, now) : null;
    if (!dueAt) return { ok: false, text: `看不懂时间“${at}”。用 "HH:mm" 或 "YYYY-MM-DD HH:mm"，或给 in_minutes。现在是 ${formatLocalNow(now)}。` };
    if (dueAt <= now) return { ok: false, text: `这个时间已经过了（现在是 ${formatLocalNow(now)}）。` };
    const settings = read(context);
    if (settings.reminders.length >= MAX_REMINDERS) return { ok: false, text: `提醒已经有 ${MAX_REMINDERS} 条了，先删掉一些。` };
    const repeat = REPEATS.includes(stringArg(args, 'repeat') as ReminderRepeat) ? stringArg(args, 'repeat') as ReminderRepeat : 'none';
    write(context, { ...settings, reminders: [...settings.reminders, { createdAt: now, dueAt, id: createProductivityId('reminder'), repeat, text }] });
    return { ok: true, text: `好了：${formatDueTime(dueAt, now)}${repeat !== 'none' ? `（${REPEAT_LABELS[repeat]}）` : ''} 提醒“${text}”。` };
  },
  title: '添加提醒',
};

const listReminders: PlatformCapability = {
  args: [],
  description: 'List upcoming reminders.',
  describe: () => '查看提醒',
  group: GROUP,
  id: 'reminders.list',
  risk: 'read',
  run: (context) => {
    const now = Date.now();
    const lines = reminderLines(read(context), now);
    return { ok: true, text: [`现在是 ${formatLocalNow(now)}。`, lines.length ? lines.join('\n') : '没有待提醒的事。'].join('\n') };
  },
  title: '查看提醒',
};

const removeReminder: PlatformCapability = {
  args: [{ description: '要取消的提醒：列表里的序号，或内容里的关键词', key: 'match', required: true, type: 'string' }],
  description: 'Cancel a reminder (“不用提醒我喝水了”).',
  describe: (args) => `取消提醒：${stringArg(args, 'match')}`,
  group: GROUP,
  id: 'reminders.remove',
  risk: 'personal',
  run: (context, args) => {
    const settings = read(context);
    const sorted = sortedReminders(settings);
    const index = findIndex(sorted, stringArg(args, 'match'));
    if (index < 0) return { ok: false, text: `没找到这条提醒。现在的提醒：\n${reminderLines(settings, Date.now()).join('\n') || '（没有）'}` };
    const removed = sorted[index];
    write(context, { ...settings, reminders: settings.reminders.filter((item) => item.id !== removed.id) });
    return { ok: true, text: `已取消提醒“${removed.text}”。` };
  },
  title: '取消提醒',
};

const addTodo: PlatformCapability = {
  args: [{ description: '待办内容；一次加多条时每行一条', key: 'text', required: true, type: 'string' }],
  description: 'Add one or more items to the todo list (“把买牛奶加到待办”).',
  describe: (args) => `添加待办：${stringArg(args, 'text')}`,
  group: GROUP,
  id: 'todos.add',
  risk: 'personal',
  run: (context, args) => {
    const items = stringArg(args, 'text').split(/\r?\n/u).map((line) => line.replace(/^\s*(?:[-*•]|\d+[.、)])\s*/u, '').trim()).filter(Boolean);
    if (!items.length) return { ok: false, text: '需要待办的内容。' };
    const settings = read(context);
    if (settings.todos.length + items.length > MAX_TODOS) return { ok: false, text: `待办最多 ${MAX_TODOS} 条，先清掉一些做完的。` };
    const now = Date.now();
    write(context, { ...settings, todos: [...settings.todos, ...items.map((text) => ({ createdAt: now, done: false, doneAt: null, id: createProductivityId('todo'), text }))] });
    return { ok: true, text: `已加到待办：${items.join('、')}。` };
  },
  title: '添加待办',
};

const listTodos: PlatformCapability = {
  args: [],
  description: 'Show the todo list.',
  describe: () => '查看待办',
  group: GROUP,
  id: 'todos.list',
  risk: 'read',
  run: (context) => {
    const lines = todoLines(read(context));
    return { ok: true, text: lines.length ? lines.join('\n') : '待办清单是空的。' };
  },
  title: '查看待办',
};

const completeTodo: PlatformCapability = {
  args: [{ description: '做完的那项：列表里的序号，或内容里的关键词', key: 'match', required: true, type: 'string' }],
  description: 'Mark a todo as done (“牛奶买好了”).',
  describe: (args) => `完成待办：${stringArg(args, 'match')}`,
  group: GROUP,
  id: 'todos.complete',
  risk: 'personal',
  run: (context, args) => {
    const settings = read(context);
    const index = findIndex(settings.todos, stringArg(args, 'match'));
    if (index < 0) return { ok: false, text: `没找到这项待办。现在的待办：\n${todoLines(settings).join('\n') || '（没有）'}` };
    const todos = settings.todos.map((item, position) => (position === index ? { ...item, done: true, doneAt: Date.now() } : item));
    write(context, { ...settings, todos });
    const left = todos.filter((item) => !item.done).length;
    return { ok: true, text: `“${settings.todos[index].text}”打勾了，还剩 ${left} 项。` };
  },
  title: '完成待办',
};

const removeTodo: PlatformCapability = {
  args: [{ description: '要删掉的那项：序号或关键词；写“已完成”清掉所有做完的', key: 'match', required: true, type: 'string' }],
  description: 'Remove a todo, or clear all finished ones with match “已完成”.',
  describe: (args) => `删除待办：${stringArg(args, 'match')}`,
  group: GROUP,
  id: 'todos.remove',
  risk: 'personal',
  run: (context, args) => {
    const settings = read(context);
    const match = stringArg(args, 'match');
    if (/^(?:已完成|做完的|完成的|done)$/iu.test(match)) {
      const left = settings.todos.filter((item) => !item.done);
      write(context, { ...settings, todos: left });
      return { ok: true, text: `清掉了 ${settings.todos.length - left.length} 项做完的待办。` };
    }
    const index = findIndex(settings.todos, match);
    if (index < 0) return { ok: false, text: `没找到这项待办。现在的待办：\n${todoLines(settings).join('\n') || '（没有）'}` };
    write(context, { ...settings, todos: settings.todos.filter((_, position) => position !== index) });
    return { ok: true, text: `已删掉待办“${settings.todos[index].text}”。` };
  },
  title: '删除待办',
};

const startPomodoro: PlatformCapability = {
  args: [
    { description: '专注多少分钟（默认 25，或用户上次设的）', key: 'focus_minutes', type: 'number' },
    { description: '休息多少分钟（默认 5）', key: 'break_minutes', type: 'number' },
    { description: '这次专注做什么（可选）', key: 'task', type: 'string' },
  ],
  description: 'Start a pomodoro: focus, then a break; the character speaks when each phase ends (“开个番茄钟”“专注 50 分钟”).',
  describe: (args) => `开始番茄钟${stringArg(args, 'task') ? `：${stringArg(args, 'task')}` : ''}`,
  group: GROUP,
  id: 'pomodoro.start',
  risk: 'personal',
  run: (context, args) => {
    const settings = read(context);
    const clamp = (value: number | null, fallback: number) => (value && value >= 1 && value <= 240 ? Math.round(value) : fallback);
    const focusMinutes = clamp(numberArg(args, 'focus_minutes'), settings.pomodoro.focusMinutes);
    const breakMinutes = clamp(numberArg(args, 'break_minutes'), settings.pomodoro.breakMinutes);
    const now = Date.now();
    const today = localDateKey(now);
    write(context, {
      ...settings,
      pomodoro: {
        ...settings.pomodoro,
        breakMinutes,
        completedToday: settings.pomodoro.completedTodayDate === today ? settings.pomodoro.completedToday : 0,
        completedTodayDate: today,
        focusMinutes,
        phase: 'focus',
        phaseEndsAt: now + focusMinutes * 60_000,
        task: stringArg(args, 'task'),
      },
    });
    return { ok: true, text: `番茄钟开始：专注 ${focusMinutes} 分钟${stringArg(args, 'task') ? `（${stringArg(args, 'task')}）` : ''}，到 ${formatDueTime(now + focusMinutes * 60_000, now)} 叫你休息 ${breakMinutes} 分钟。` };
  },
  title: '开始番茄钟',
};

const stopPomodoro: PlatformCapability = {
  args: [],
  description: 'Stop the running pomodoro.',
  describe: () => '停止番茄钟',
  group: GROUP,
  id: 'pomodoro.stop',
  risk: 'personal',
  run: (context) => {
    const settings = read(context);
    if (settings.pomodoro.phase === 'idle') return { ok: true, text: '番茄钟本来就没在计时。' };
    write(context, { ...settings, pomodoro: { ...settings.pomodoro, phase: 'idle', phaseEndsAt: null, task: '' } });
    return { ok: true, text: '番茄钟停了。' };
  },
  title: '停止番茄钟',
};

const pomodoroStatus: PlatformCapability = {
  args: [],
  description: 'How much time is left on the pomodoro, and how many focus sessions today.',
  describe: () => '查看番茄钟',
  group: GROUP,
  id: 'pomodoro.status',
  risk: 'read',
  run: (context) => {
    const settings = read(context);
    const now = Date.now();
    const today = settings.pomodoro.completedTodayDate === localDateKey(now) ? settings.pomodoro.completedToday : 0;
    return { ok: true, text: `${pomodoroLine(settings, now)}今天完成了 ${today} 个番茄。` };
  },
  title: '查看番茄钟',
};

export const PRODUCTIVITY_CAPABILITIES: PlatformCapability[] = [
  addReminder,
  listReminders,
  removeReminder,
  addTodo,
  listTodos,
  completeTodo,
  removeTodo,
  startPomodoro,
  stopPomodoro,
  pomodoroStatus,
];
