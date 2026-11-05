import { cancelBackgroundTasks, listBackgroundTasks } from '../agent/background/backgroundTasks';
import type { PlatformCapability } from './platformCapabilityTypes';

// What she is doing in the background (a drawing…), and stopping it when the user says
// “不画了” or wants something else drawn instead. Stopping needs no card: the user asked.

const GROUP = '后台任务';

const status: PlatformCapability = {
  args: [],
  description: 'What you are doing in the background right now (e.g. a drawing) and for how long.',
  describe: () => '查看后台在做的事',
  group: GROUP,
  id: 'tasks.background_status',
  risk: 'read',
  run: () => {
    const tasks = listBackgroundTasks();
    if (!tasks.length) return { ok: true, text: '后台没有在做的事。' };
    const now = Date.now();
    return { ok: true, text: tasks.map((task) => `${task.title}：已经 ${Math.round((now - task.startedAt) / 1000)} 秒`).join('\n') };
  },
  title: '后台任务进度',
};

const cancel: PlatformCapability = {
  args: [{ description: 'Which one, by its title words (e.g. “画图”); omitted = everything in the background.', key: 'which', type: 'string' }],
  description: 'Stop something running in the background when the user wants it stopped or changed (“不画了”“换成画猫”: stop, then start the new one).',
  describe: () => '停掉后台在做的事',
  group: GROUP,
  id: 'tasks.background_cancel',
  risk: 'personal',
  run: (_context, args) => {
    const which = typeof args.which === 'string' ? args.which.trim() : '';
    const target = which ? listBackgroundTasks().find((task) => task.title.includes(which) || which.includes(task.kind) || (which.includes('画') && task.kind === 'drawing')) : null;
    if (which && !target) return { ok: false, text: '后台没有对得上的事在做。' };
    const stopped = cancelBackgroundTasks(target ? { id: target.id } : {});
    return stopped.length ? { ok: true, text: `已经停掉：${stopped.join('、')}。` } : { ok: true, text: '后台本来就没有在做的事。' };
  },
  title: '停掉后台任务',
};

export const BACKGROUND_TASK_CAPABILITIES: PlatformCapability[] = [status, cancel];
