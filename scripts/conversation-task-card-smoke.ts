import assert from 'node:assert/strict';
import { describeConversationStep } from '../src/agent/conversation/conversationStepLabels';
import { desktopPetChatStore } from '../src/chatStore';
import { resolvePendingApprovalByVoice } from '../src/components/chat/voiceApproval';
import { createConversationTaskCard, settleOrphanedTaskCards, stopConversationTask } from '../src/components/chat/runController/conversationTaskCard';

// One card per task: plain step labels, statuses, the question answered on the card, a
// history record in the text, and the stop button.
assert.equal(describeConversationStep('launch_app', { name: 'WeGame' }), '启动「WeGame」');
assert.equal(describeConversationStep('click', { target: '3' }), '点击界面上的按钮');
assert.equal(describeConversationStep('click', { target: '快捷安全登录' }), '点击「快捷安全登录」');
assert.equal(describeConversationStep('files', { action: 'rename' }), '重命名文件');
assert.equal(describeConversationStep('no_such_tool', {}), '处理中');

const slot = { id: 'primary', personality: { name: '测试角色' } };
const cardOf = () => desktopPetChatStore.getState().messages.find((message) => message.agentLoopRun);
const before = desktopPetChatStore.getState().messages.length;

const card = createConversationTaskCard({ chatMode: 'single', goal: '打开 WeGame', targetSlot: slot });
assert.equal(desktopPetChatStore.getState().messages.length, before, 'no card until a step runs');
card.progress.stepStarted('a', 'launch_app', { name: 'WeGame' });
card.progress.stepFinished('a', true);
card.progress.stepStarted('b', 'run_command', { command: 'Start-Process x' });
const answer = card.requestApproval({ detail: '运行命令：Start-Process x', title: '运行命令：Start-Process x' });
let run = cardOf()?.agentLoopRun;
assert.equal(run?.status, 'needs-user');
assert.equal(run?.pendingApproval?.title, '运行命令：Start-Process x');
assert.deepEqual(run?.steps.map((step) => step.status), ['done', 'waiting']);
assert.equal(resolvePendingApprovalByVoice('同意'), 'approve');
assert.equal(await answer, true);
card.progress.stepFinished('b', true);
card.progress.finish('done');
run = cardOf()?.agentLoopRun;
assert.equal(run?.status, 'done');
assert.equal(run?.pendingApproval, null);
assert.deepEqual(run?.steps.map((step) => step.text), ['启动「WeGame」', '运行命令']);
assert.match(cardOf()?.text ?? '', /【任务记录】打开 WeGame：已完成；做了：启动「WeGame」、运行命令/u);

// Stop: the waiting question gets a no and the task's signal is aborted.
const second = createConversationTaskCard({ chatMode: 'single', goal: '第二个任务', targetSlot: slot });
second.progress.stepStarted('c', 'click', { target: '登录' });
const pending = second.requestApproval({ detail: 'x', title: '点一下' });
const secondId = desktopPetChatStore.getState().messages.at(-1)?.id ?? '';
assert.equal(stopConversationTask(secondId), true);
assert.equal(await pending, false);
assert.equal(second.signal.aborted, true);
second.progress.stepFinished('c', false);
second.progress.finish('cancelled');
assert.equal(stopConversationTask(secondId), false, 'a finished task cannot be stopped again');
// A card left 进行中 by a task that no longer runs (app reloaded mid-task): 终止 marks it
// interrupted instead of doing nothing, and startup settles the rest.
desktopPetChatStore.addMessage({ agentLoopRun: { goal: '旧任务', status: 'running', steps: [{ changed: null, index: 1, status: 'running', text: '看一眼画面' }] }, id: 'agent-task-orphan', role: 'model', text: '' });
assert.equal(stopConversationTask('agent-task-orphan'), true);
const orphan = desktopPetChatStore.getState().messages.find((message) => message.id === 'agent-task-orphan')?.agentLoopRun;
assert.equal(orphan?.status, 'cancelled');
assert.equal(orphan?.steps[0].status, 'failed');
desktopPetChatStore.addMessage({ agentLoopRun: { goal: '另一个旧任务', pendingApproval: { detail: 'x', id: 'gone', title: 'x' }, status: 'needs-user', steps: [] }, id: 'agent-task-orphan-2', role: 'model', text: '' });
const live = createConversationTaskCard({ chatMode: 'single', goal: '正在跑的任务', targetSlot: slot });
live.progress.stepStarted('z', 'wait', {});
settleOrphanedTaskCards();
const states = desktopPetChatStore.getState().messages.filter((message) => message.agentLoopRun).map((message) => [message.agentLoopRun!.goal, message.agentLoopRun!.status]);
assert.deepEqual(states.filter(([goal]) => goal === '另一个旧任务' || goal === '正在跑的任务'), [['另一个旧任务', 'cancelled'], ['正在跑的任务', 'running']], 'only cards without a running task are settled');
console.log('conversation task card smoke ok');
