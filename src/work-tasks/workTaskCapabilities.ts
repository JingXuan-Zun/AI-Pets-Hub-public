import { stringArg } from '../platform-capabilities/platformCapabilityArgs';
import type { PlatformCapability, PlatformCapabilityContext } from '../platform-capabilities/platformCapabilityTypes';
import { formatWorkTaskCard } from './workTaskPrompt';
import {
  createWorkId,
  MAX_RECENT_TASKS,
  MAX_TASK_DECIDED,
  MAX_WORK_DECISIONS,
  normalizeWorkTaskSettings,
  projectDecisions,
  type WorkTaskSettings,
} from './workTaskSettings';

// The progress card and decision log as character tools. They only touch the user's own task
// notes and are easy to undo, so they run without a confirmation card (risk "personal").

const GROUP = '进度卡';

function read(context: PlatformCapabilityContext) {
  return normalizeWorkTaskSettings(context.configRef.current.settings.workTasks);
}

function write(context: PlatformCapabilityContext, workTasks: WorkTaskSettings) {
  const config = context.configRef.current;
  const next = { ...config, settings: { ...config.settings, workTasks } };
  // Set the ref right away so two calls in one round don't overwrite each other.
  context.configRef.current = next;
  context.onUpdateConfig(next, { persist: true });
}

function splitLines(value: string) {
  return value.split(/\r?\n/u).map((line) => line.replace(/^\s*(?:[-*•]|\d+[.、)])\s*/u, '').trim()).filter(Boolean);
}

/** Adds decisions to the project log, skipping ones already there. */
function withDecisions(settings: WorkTaskSettings, project: string, texts: string[], now: number) {
  const known = new Set(projectDecisions(settings, project).map((item) => item.text));
  const added = texts.filter((item) => !known.has(item));
  return {
    added,
    decisions: [...settings.decisions, ...added.map((item) => ({ createdAt: now, id: createWorkId('decision'), project, text: item }))].slice(-MAX_WORK_DECISIONS),
  };
}

const startTask: PlatformCapability = {
  args: [
    { description: '这件事的简短名字，例如“战斗系统的翻滚”', key: 'title', required: true, type: 'string' },
    { description: '这次要达到什么', key: 'goal', type: 'string' },
    { description: '属于哪个项目，例如“动作游戏”；不清楚就沿用上一个任务的项目', key: 'project', type: 'string' },
  ],
  description: 'Open a progress card (目标、已定下的事、做到哪、下一步) whenever the user starts working on something — “开始吧”“开工”“今天做战斗系统的翻滚”“开始写第二章剧情” — even when the first step is small, before doing the work. Replaces the current card; the old one is kept as finished.',
  describe: (args) => `开始任务：${stringArg(args, 'title')}`,
  group: GROUP,
  id: 'work.start_task',
  risk: 'personal',
  run: (context, args) => {
    const title = stringArg(args, 'title').trim();
    if (!title) return { ok: false, text: '需要任务的名字。' };
    const settings = read(context);
    const now = Date.now();
    const previous = settings.activeTask;
    const project = stringArg(args, 'project').trim() || previous?.project || settings.recentTasks[0]?.project || '';
    const task = {
      agentSessions: {}, decided: [], finishedAt: null, goal: stringArg(args, 'goal').trim(), id: createWorkId('task'),
      next: '', progress: '', project, startedAt: now, title, updatedAt: now,
    };
    const recentTasks = previous
      ? [{ ...previous, finishedAt: now, updatedAt: now }, ...settings.recentTasks].slice(0, MAX_RECENT_TASKS)
      : settings.recentTasks;
    write(context, { ...settings, activeTask: task, recentTasks });
    return { ok: true, text: `进度卡已建好：\n${formatWorkTaskCard(task)}${previous ? `\n（上一个任务“${previous.title}”已收起。）` : ''}` };
  },
  title: '开始任务',
};

const updateTask: PlatformCapability = {
  args: [
    { description: '做到哪了（覆盖原来的）', key: 'progress', type: 'string' },
    { description: '下一步做什么（覆盖原来的）', key: 'next', type: 'string' },
    { description: '这次新定下的事；多条时每行一条。也会记进项目的决定日志', key: 'decided', type: 'string' },
    { description: '目标有变时填新的目标', key: 'goal', type: 'string' },
  ],
  description: 'Update the open progress card: progress, next step, newly settled points (also logged as project decisions).',
  describe: () => '更新进度卡',
  group: GROUP,
  id: 'work.update_task',
  risk: 'personal',
  run: (context, args) => {
    const settings = read(context);
    const task = settings.activeTask;
    if (!task) return { ok: false, text: '现在没有打开的进度卡，先用 work.start_task 建一张。' };
    const now = Date.now();
    const decidedLines = splitLines(stringArg(args, 'decided'));
    const { added, decisions } = withDecisions(settings, task.project, decidedLines, now);
    const next = {
      ...task,
      decided: [...task.decided, ...decidedLines.filter((item) => !task.decided.includes(item))].slice(-MAX_TASK_DECIDED),
      goal: stringArg(args, 'goal').trim() || task.goal,
      next: stringArg(args, 'next').trim() || task.next,
      progress: stringArg(args, 'progress').trim() || task.progress,
      updatedAt: now,
    };
    write(context, { ...settings, activeTask: next, decisions });
    return { ok: true, text: `进度卡已更新${added.length ? `，记下 ${added.length} 条决定` : ''}：\n${formatWorkTaskCard(next)}` };
  },
  title: '更新进度卡',
};

const finishTask: PlatformCapability = {
  args: [{ description: '最后做到了什么（可选）', key: 'summary', type: 'string' }],
  description: 'Close the progress card when the user is done or stops for now (“今天就到这”“翻滚做完了”).',
  describe: () => '收起进度卡',
  group: GROUP,
  id: 'work.finish_task',
  risk: 'personal',
  run: (context, args) => {
    const settings = read(context);
    const task = settings.activeTask;
    if (!task) return { ok: true, text: '现在没有打开的进度卡。' };
    const now = Date.now();
    const summary = stringArg(args, 'summary').trim();
    const finished = { ...task, finishedAt: now, progress: summary || task.progress, updatedAt: now };
    write(context, { ...settings, activeTask: null, recentTasks: [finished, ...settings.recentTasks].slice(0, MAX_RECENT_TASKS) });
    return { ok: true, text: `任务“${task.title}”已收起${summary ? `：${summary}` : ''}。下次可以从“${finished.next || finished.progress || task.title}”接着做。` };
  },
  title: '收起进度卡',
};

const showTask: PlatformCapability = {
  args: [],
  description: 'Show the open progress card and the last finished tasks (“我们做到哪了”“上次做到哪”).',
  describe: () => '查看进度卡',
  group: GROUP,
  id: 'work.show_task',
  risk: 'read',
  run: (context) => {
    const settings = read(context);
    const recent = settings.recentTasks.slice(0, 3).map((task) => `- ${task.title}：${task.progress || '（没写进度）'}${task.next ? `；下一步 ${task.next}` : ''}`);
    return {
      ok: true,
      text: [
        settings.activeTask ? `当前进度卡：\n${formatWorkTaskCard(settings.activeTask)}` : '现在没有打开的进度卡。',
        recent.length ? `最近收起的任务：\n${recent.join('\n')}` : '',
      ].filter(Boolean).join('\n\n'),
    };
  },
  title: '查看进度卡',
};

const logDecision: PlatformCapability = {
  args: [
    { description: '定下的事；多条时每行一条，例如“翻滚无敌 0.3 秒”', key: 'text', required: true, type: 'string' },
    { description: '属于哪个项目；不填就用当前进度卡的项目', key: 'project', type: 'string' },
  ],
  description: 'Record a settled decision in the project log (“就这么定了”“翻滚无敌改成 0.3 秒”), even without an open task.',
  describe: (args) => `记下决定：${stringArg(args, 'text')}`,
  group: GROUP,
  id: 'work.log_decision',
  risk: 'personal',
  run: (context, args) => {
    const settings = read(context);
    const project = stringArg(args, 'project').trim() || settings.activeTask?.project || '';
    const lines = splitLines(stringArg(args, 'text'));
    if (!lines.length) return { ok: false, text: '需要决定的内容。' };
    const { added, decisions } = withDecisions(settings, project, lines, Date.now());
    write(context, { ...settings, decisions });
    return { ok: true, text: added.length ? `已记下${project ? `（${project}）` : ''}：${added.join('；')}` : '这些之前已经记过了。' };
  },
  title: '记下决定',
};

const listDecisions: PlatformCapability = {
  args: [
    { description: '只看哪个项目；不填就用当前进度卡的项目', key: 'project', type: 'string' },
    { description: '只看包含这个词的', key: 'keyword', type: 'string' },
  ],
  description: 'List settled decisions of a project, optionally filtered by a keyword (“翻滚之前怎么定的”).',
  describe: () => '查看决定日志',
  group: GROUP,
  id: 'work.list_decisions',
  risk: 'read',
  run: (context, args) => {
    const settings = read(context);
    const project = stringArg(args, 'project').trim() || settings.activeTask?.project || '';
    const keyword = stringArg(args, 'keyword').trim();
    const items = projectDecisions(settings, project).filter((item) => !keyword || item.text.includes(keyword));
    return { ok: true, text: items.length ? items.map((item, index) => `${index + 1}. ${item.text}`).join('\n') : '还没有记下相关的决定。' };
  },
  title: '查看决定日志',
};

const removeDecision: PlatformCapability = {
  args: [{ description: '要删的那条：序号（按 work.list_decisions 的顺序）或关键词', key: 'match', required: true, type: 'string' }],
  description: 'Remove a decision that was recorded by mistake or has been overturned.',
  describe: (args) => `删除决定：${stringArg(args, 'match')}`,
  group: GROUP,
  id: 'work.remove_decision',
  risk: 'personal',
  run: (context, args) => {
    const settings = read(context);
    const project = settings.activeTask?.project || '';
    const items = projectDecisions(settings, project);
    const match = stringArg(args, 'match').trim();
    const number = /^\d+$/u.test(match) ? Number(match) : NaN;
    const target = Number.isInteger(number) ? items[number - 1] : items.find((item) => item.text.includes(match));
    if (!target) return { ok: false, text: '没找到这条决定。' };
    write(context, { ...settings, decisions: settings.decisions.filter((item) => item.id !== target.id) });
    return { ok: true, text: `已删掉决定“${target.text}”。` };
  },
  title: '删除决定',
};

export const WORK_TASK_CAPABILITIES: PlatformCapability[] = [
  startTask,
  updateTask,
  finishTask,
  showTask,
  logDecision,
  listDecisions,
  removeDecision,
];
