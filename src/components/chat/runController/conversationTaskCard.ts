import { delegatedScopeFields } from './chatDelegation';
import { describeConversationStep } from '../../../agent/conversation/conversationStepLabels';
import { type ConversationTaskProgress } from '../../../agent/conversation/conversationTools';
import { desktopPetChatStore } from '../../../chatStore';
import { createChatMessageId } from '../multiPetChat';
import { type ChatAgentLoopRun, type ChatMessage } from '../../../types';
import { resolveAgentLoopApproval, waitForAgentLoopDecision } from './agentLoopApprovalRegistry';

// One card per task in the chat, like the old agent card: which steps the task took, which
// one runs now and whether each finished — in plain words, without the internal trace.
// Confirmations are answered on this card (button, typed or spoken "同意"/"拒绝") instead
// of stacking a separate card per step. The card's text is a short record of the task, so
// the conversation history also knows what was done.

type TaskStatus = ChatAgentLoopRun['status'];

/** Stop handlers of the task cards still running, by card message id. */
const runningTasks = new Map<string, () => void>();

const ACTIVE_STATUSES: ReadonlyArray<ChatAgentLoopRun['status']> = ['running', 'needs-user'];

function markInterrupted(message: ChatMessage): ChatMessage {
  const run = message.agentLoopRun;
  if (!run) return message;
  return {
    ...message,
    agentLoopRun: {
      ...run,
      pendingApproval: null,
      status: 'cancelled',
      steps: run.steps.map((step) => (step.status === 'running' || step.status === 'waiting' ? { ...step, result: '已中断', status: 'failed' } : step)),
    },
  };
}

/**
 * The card's 终止 button: answers a waiting question with no and stops the remaining steps.
 * A card whose task no longer runs (the app was reloaded or closed mid-task) still showed
 * 进行中 and ignored 终止; it is marked interrupted instead.
 */
export function stopConversationTask(messageId: string) {
  const stop = runningTasks.get(messageId);
  if (stop) {
    stop();
    return true;
  }
  const message = desktopPetChatStore.getState().messages.find((item) => item.id === messageId);
  if (!message?.agentLoopRun || !ACTIVE_STATUSES.includes(message.agentLoopRun.status)) return false;
  desktopPetChatStore.updateMessage(messageId, markInterrupted);
  return true;
}

/** Cards left 进行中 by a previous run of the app (only the window that runs tasks calls this). */
export function settleOrphanedTaskCards() {
  desktopPetChatStore.getState().messages
    .filter((message) => message.id && message.agentLoopRun && ACTIVE_STATUSES.includes(message.agentLoopRun.status) && !runningTasks.has(message.id))
    .forEach((message) => desktopPetChatStore.updateMessage(message.id!, markInterrupted));
}

const STATUS_TEXT: Record<TaskStatus, string> = {
  budget: '步骤太多，先停下了', cancelled: '已终止', done: '已完成', failed: '没有完成', 'needs-user': '等你确认', running: '进行中',
};

export function createConversationTaskCard(options: {
  chatMode: ChatMessage['chatMode'];
  goal: string;
  targetSlot: { id: string; personality: { name: string } };
}) {
  const controller = new AbortController();
  let messageId: string | null = null;
  let run: ChatAgentLoopRun = { goal: options.goal, pendingApproval: null, startedAt: Date.now(), status: 'running', steps: [] };

  const record = () => {
    const done = run.steps.filter((step) => step.status === 'done').map((step) => step.text);
    const failed = run.steps.filter((step) => step.status === 'failed').map((step) => step.text);
    return [
      `【任务记录】${run.goal}：${STATUS_TEXT[run.status]}`,
      done.length ? `做了：${done.join('、')}` : '',
      failed.length ? `没成功：${failed.join('、')}` : '',
    ].filter(Boolean).join('；');
  };

  const write = (next: ChatAgentLoopRun) => {
    run = next;
    if (!messageId) {
      messageId = createChatMessageId('agent-task');
      runningTasks.set(messageId, () => {
        controller.abort();
        if (run.pendingApproval) resolveAgentLoopApproval(run.pendingApproval.id, 'deny');
        // Shown as stopped at once; a long step (a look at the screen takes up to half a
        // minute) still finishes in the background, but nothing runs after it.
        write({ ...run, pendingApproval: null, status: 'cancelled' });
      });
      desktopPetChatStore.addMessage({
        agentLoopRun: run,
        chatMode: options.chatMode,
        createdAt: Date.now(),
        id: messageId,
        petId: options.targetSlot.id,
        petName: options.targetSlot.personality.name,
        ...delegatedScopeFields(options.targetSlot.id),
        role: 'model',
        text: record(),
      });
      return;
    }
    const text = record();
    desktopPetChatStore.updateMessage(messageId, (message) => ({ ...message, agentLoopRun: run, text }));
  };

  const updateStep = (key: string, patch: Partial<ChatAgentLoopRun['steps'][number]>) => {
    write({ ...run, steps: run.steps.map((step) => (step.key === key ? { ...step, ...patch } : step)) });
  };

  const progress: ConversationTaskProgress = {
    finish: (status) => {
      if (!messageId) return;
      runningTasks.delete(messageId);
      write({
        ...run,
        durationMs: Date.now() - (run.startedAt ?? Date.now()),
        pendingApproval: null,
        status,
        steps: run.steps.map((step) => (step.status === 'running' || step.status === 'waiting' ? { ...step, status: 'failed' } : step)),
      });
    },
    stepFinished: (key, ok) => {
      if (run.steps.some((step) => step.key === key)) updateStep(key, { status: ok ? 'done' : 'failed' });
    },
    stepStarted: (key, name, args) => {
      if (name === 'update_todos') return;
      write({ ...run, steps: [...run.steps, { changed: null, index: run.steps.length + 1, key, status: 'running', text: describeConversationStep(name, args) }] });
    },
  };

  // "这次都允许": the rest of this task runs without asking; the next task asks again.
  let allowedForTask = false;

  /** Asks on this card; the step that is running shows "等你确认" until answered. */
  const requestApproval = async ({ detail, title }: { detail: string; title: string }) => {
    if (allowedForTask) return !controller.signal.aborted;
    const approvalId = createChatMessageId('agent-loop-approval');
    const running = [...run.steps].reverse().find((step) => step.status === 'running');
    // Registered before the card shows the question, so anything that reacts to the card
    // (the microphone, a spoken or typed answer) already finds it waiting.
    const answer = waitForAgentLoopDecision(approvalId, null).then((decision) => {
      if (decision === 'approve-task') allowedForTask = true;
      return decision !== 'deny';
    });
    write({
      ...run,
      pendingApproval: { detail, id: approvalId, title },
      status: 'needs-user',
      steps: running ? run.steps.map((step) => (step === running ? { ...step, status: 'waiting' } : step)) : run.steps,
    });
    const approved = await answer;
    write({
      ...run,
      pendingApproval: null,
      status: controller.signal.aborted ? 'cancelled' : 'running',
      steps: run.steps.map((step) => (step.status === 'waiting' ? { ...step, result: approved ? null : '你没有同意', status: approved ? 'running' : 'failed' } : step)),
    });
    return approved;
  };

  return { isAllowedForTask: () => allowedForTask, progress, requestApproval, signal: controller.signal };
}
