import { booleanArg, stringArg } from '../platform-capabilities/platformCapabilityArgs';
import type { PlatformCapability, PlatformCapabilityContext } from '../platform-capabilities/platformCapabilityTypes';
import { buildWorkTaskInstruction } from '../work-tasks/workTaskPrompt';
import { agentSessionKey, normalizeWorkTaskSettings } from '../work-tasks/workTaskSettings';
import { resolveCompatibleBlocker, resolveDevAgentLaunch } from './devAgentProviders';
import { normalizeDevAgentSettings, resolveDevAgentWorkspace } from './devAgentSettings';

// The character hands coding work to the development assistant (Claude Code) and then tells
// the user what was done, in her own voice. It edits files in the user's project, so every
// task is confirmed first (risk "change"). Hand-offs under the same progress card continue one
// session, so the assistant remembers what it already read and changed.

const MAX_RESULT_CHARS = 2500;

/** Stores the session on the progress card it was made for (if that card is still the open one). */
function rememberSession(context: PlatformCapabilityContext, taskId: string, key: string, sessionId: string) {
  const config = context.configRef.current;
  const workTasks = normalizeWorkTaskSettings(config.settings.workTasks);
  if (!workTasks.activeTask || workTasks.activeTask.id !== taskId) return;
  const activeTask = { ...workTasks.activeTask, agentSessions: { ...workTasks.activeTask.agentSessions, [key]: sessionId } };
  const next = { ...config, settings: { ...config.settings, workTasks: { ...workTasks, activeTask } } };
  context.configRef.current = next;
  context.onUpdateConfig(next, { persist: true });
}

/** The task plus the open progress card and settled decisions, so the assistant keeps to them. */
export function buildDevAgentPrompt(task: string, workTasks: unknown, allowedCommands: string[] = []) {
  const card = buildWorkTaskInstruction(workTasks);
  return [
    task.trim(),
    card ? `\n背景（用户当前的进度卡和已定下的事，改动不要违背它们；有冲突就停下来说明）：\n${card}` : '',
    allowedCommands.length
      ? `\n你可以运行这些命令检查自己的改动：${allowedCommands.join('；')}。改完先跑一遍，没通过就修到通过（或说明卡在哪）；其他命令运行不了，不要尝试。`
      : '',
    `\n做完后用中文简短说明：改了哪些文件、做了什么、${allowedCommands.length ? '检查命令的结果、' : ''}有什么需要用户自己检查或决定的。`,
  ].filter(Boolean).join('\n');
}

export const DEV_AGENT_CAPABILITIES: PlatformCapability[] = [{
  args: [
    { description: '要开发助手做的事，写清楚具体要求，例如“把翻滚的无敌时间改成 0.3 秒”', key: 'task', required: true, type: 'string' },
    { description: '在哪个项目里做（设置里列出的项目名）；不填就用第一个', key: 'project', type: 'string' },
    { description: 'true = 不接着这张进度卡上次的会话，重新开始（用户说“重新来”“换个思路”时）', key: 'fresh', type: 'boolean' },
  ],
  description: 'Hand a coding / project-file task to the development assistant (Claude Code) working in one of the user\'s project folders (“帮我把翻滚无敌改成 0.3 秒”“给牛头怪加一个狂化阶段的代码”). Use it for writing or changing code, edits across several files, or any change you are not sure how to make; a one-line edit of a known file can be done with your own file tools. Takes minutes; afterwards tell the user what was done in your own voice and update the progress card.',
  describe: (args) => `交给开发助手：${stringArg(args, 'task')}${stringArg(args, 'project') ? `（${stringArg(args, 'project')}）` : ''}`,
  group: '开发助手',
  id: 'dev.delegate',
  risk: 'change',
  run: async (context, args) => {
    const config = context.configRef.current;
    const settings = normalizeDevAgentSettings(config.settings.devAgent);
    if (!settings.enabled) return { ok: false, text: '开发助手没有开启（设置 → 扩展 → 开发助手）。' };
    const bridge = typeof window !== 'undefined' ? window.desktopPetShell?.devAgent : undefined;
    if (!bridge) return { ok: false, text: '只能在桌面版里使用开发助手。' };
    const task = stringArg(args, 'task').trim();
    if (!task) return { ok: false, text: '需要具体的任务内容。' };
    const workspace = resolveDevAgentWorkspace(settings, stringArg(args, 'project'));
    if (!workspace) {
      const names = settings.workspaces.map((item) => item.name).join('、');
      return { ok: false, text: names ? `没有叫这个名字的项目。可以用的项目：${names}` : '还没有设置项目文件夹（设置 → 扩展 → 开发助手）。' };
    }
    const apiKey = config.settings.devAgentApiKey ?? '';
    const blocker = resolveCompatibleBlocker(settings, apiKey);
    if (blocker) return { ok: false, text: `开发助手的服务还没配好：${blocker}（设置 → 扩展 → 开发助手）` };
    const launch = resolveDevAgentLaunch(settings, apiKey);
    const activeTask = normalizeWorkTaskSettings(config.settings.workTasks).activeTask;
    const sessionKey = agentSessionKey(settings.provider, workspace.path);
    const resumeSessionId = booleanArg(args, 'fresh') === true ? undefined : activeTask?.agentSessions[sessionKey];
    const result = await bridge.run({
      allowedCommands: workspace.allowedCommands,
      env: launch.env,
      executablePath: settings.executablePath,
      model: launch.model,
      prompt: buildDevAgentPrompt(task, config.settings.workTasks, workspace.allowedCommands),
      resumeSessionId,
      timeoutMs: settings.timeoutMinutes * 60_000,
      workspacePath: workspace.path,
    });
    if (activeTask && result.sessionId) rememberSession(context, activeTask.id, sessionKey, result.sessionId);
    const minutes = result.durationMs ? Math.max(1, Math.round(result.durationMs / 60_000)) : null;
    if (!result.ok) {
      return { ok: false, text: `开发助手没做成${minutes ? `（用了约 ${minutes} 分钟）` : ''}：${result.error ?? '未知原因'}` };
    }
    const report = (result.result ?? '').trim();
    const continuity = result.resumed
      ? '（接着这张进度卡上次的会话做的，它记得之前改过什么）'
      : result.resumeLost ? '（上次的会话找不到了，这次是重新开始的）' : '';
    return {
      ok: true,
      text: [
        `开发助手在“${workspace.name}”里做完了${minutes ? `（约 ${minutes} 分钟）` : ''}${result.deniedCount ? `，有 ${result.deniedCount} 个操作因为没有权限被跳过` : ''}${continuity}。它的说明：`,
        report.length > MAX_RESULT_CHARS ? `${report.slice(0, MAX_RESULT_CHARS)}…（后面省略）` : report || '（没有说明）',
        '请用你自己的口吻告诉用户做了什么、哪些要用户自己检查；有新定下的事，用 work.update_task 记下。',
      ].join('\n'),
    };
  },
  title: '交给开发助手',
}];
