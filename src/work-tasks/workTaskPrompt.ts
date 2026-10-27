import { normalizeWorkTaskSettings, projectDecisions, type WorkTask } from './workTaskSettings';

// The progress card and the project's decisions, sent with every reply while a task is open,
// so the conversation keeps its goal and does not contradict what was settled.

const MAX_PROMPT_DECISIONS = 20;

export function formatWorkTaskCard(task: WorkTask) {
  return [
    `任务：${task.title}${task.project ? `（项目：${task.project}）` : ''}`,
    task.goal ? `目标：${task.goal}` : '',
    task.decided.length ? `这次已定下：\n${task.decided.map((item) => `- ${item}`).join('\n')}` : '',
    task.progress ? `做到：${task.progress}` : '',
    task.next ? `下一步：${task.next}` : '',
  ].filter(Boolean).join('\n');
}

export function buildWorkTaskInstruction(rawSettings: unknown) {
  const settings = normalizeWorkTaskSettings(rawSettings);
  const task = settings.activeTask;
  if (!task) return '';
  const decisions = projectDecisions(settings, task.project).slice(-MAX_PROMPT_DECISIONS);
  return [
    '【当前进度卡】用户正在做的事（所有角色共用这一张）：',
    formatWorkTaskCard(task),
    decisions.length
      ? `【${task.project || '这个项目'}已定下的事】（最近 ${decisions.length} 条）：\n${decisions.map((item) => `- ${item.text}`).join('\n')}`
      : '',
    '和任务有关的回答要围绕这张卡，不要说出和已定下的事相反的话；觉得某条该改，就明说是建议。',
    '有了进展、定下了新的事，用 work 工具更新进度卡或记下决定；用户聊别的也可以正常聊，进度卡会一直留着。',
  ].filter(Boolean).join('\n');
}
