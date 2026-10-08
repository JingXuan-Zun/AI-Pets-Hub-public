import { runAgentLoop, type AgentLoopResult } from '../../../agent/loop/agentLoop';
import { type LoopApprovalRequest } from '../../../agent/loop/loopApproval';
import { desktopPetChatStore } from '../../../chatStore';
import { pushFrontendRuntimeLog } from '../../../frontendRuntimeLogger';
import { type ChatAgentLoopRun, type ChatMessage } from '../../../types';
import { registerAgentRunAbortController } from '../agentRunAbortRegistry';
import { createChatMessageId } from '../multiPetChat';
import { waitForAgentLoopApproval } from './agentLoopApprovalRegistry';
import { type RunPreparedAgentProductionSessionOptions } from './controllerOptions';
import { runAgentPersonaResponseTurnWithStyleRetry } from './personaReplyTurn';
import { createAgentProductionSessionDisplayPlan, createAgentProductionSessionPlaceholderCommand, resolvePreparedAgentTargetSlot } from './sessionMessageProjection';

// Chat front end for the desktop agent loop: one progress message updated step by step,
// approval cards answered through the shared approval UI, and a character reply at the end.

type TargetSlot = NonNullable<ReturnType<typeof resolvePreparedAgentTargetSlot>>;

const STATUS_TEXT: Record<AgentLoopResult['status'], string> = {
  budget: '没有在预算内完成',
  cancelled: '已取消',
  done: '已完成',
  failed: '执行失败',
  'needs-user': '需要你处理',
};

function createApprovalMessage(options: { instruction: string; request: LoopApprovalRequest; sourceText: string; targetSlot: TargetSlot; chatMode: ChatMessage['chatMode'] }): ChatMessage {
  const id = createChatMessageId('agent-loop-approval');
  // No placeholder plan steps: the card shows only the request; the loop's steps live in its own panel.
  const plan = { ...createAgentProductionSessionDisplayPlan(options.instruction, options.sourceText), goal: options.request.title, steps: [] };
  return {
    agentApproval: {
      agentRuntime: null,
      approvalSummary: { lines: options.request.detail.split('\n'), title: options.request.title },
      command: createAgentProductionSessionPlaceholderCommand(options.instruction, options.sourceText),
      corePlanSummary: null,
      groupTaskEvent: null,
      id,
      plan,
      // No stage/trace progress: the loop shows its steps in its own panel.
      stages: [],
      status: 'pending',
      trace: [],
    },
    chatMode: options.chatMode,
    id,
    petId: options.targetSlot.id,
    petName: options.targetSlot.personality.name,
    role: 'model',
    text: options.request.title,
  };
}

function buildResultPrompt(instruction: string, result: AgentLoopResult) {
  return [
    `你刚刚在电脑上帮用户执行了任务：${instruction}`,
    `结果：${STATUS_TEXT[result.status]}。${result.summary}`,
    `执行过程（${result.steps.length} 步）：`,
    ...result.steps.slice(-8).map((step) => `${step.index}. ${step.action} → ${step.result.slice(0, 120)}`),
    '请用你的角色口吻，简短告诉用户结果；没完成时说明卡在哪里、需要用户做什么。不要编造没有发生的事情。',
  ].join('\n');
}

export async function runAgentLoopChatSession(options: RunPreparedAgentProductionSessionOptions & { targetSlot: TargetSlot }) {
  const { instruction, playVoiceText, preparedRequest, runPetResponseTurn, targetSlot } = options;
  const chatMode = preparedRequest.currentChatState.chatMode;
  const messageId = createChatMessageId('agent-loop');
  const steps: ChatAgentLoopRun['steps'] = [];
  const publish = (patch: Partial<ChatAgentLoopRun> = {}) => desktopPetChatStore.updateMessage(messageId, (message) => ({
    ...message,
    agentLoopRun: { goal: instruction, status: 'running', ...message.agentLoopRun, steps: [...steps], ...patch },
  }));
  desktopPetChatStore.addMessage({
    agentLoopRun: { goal: instruction, status: 'running', steps: [] },
    chatMode, id: messageId, petId: targetSlot.id, petName: targetSlot.personality.name, role: 'model', text: '',
  });

  const abortController = new AbortController();
  const unregister = registerAgentRunAbortController(messageId, abortController);
  let result: AgentLoopResult;
  try {
    result = await runAgentLoop({
      goal: instruction,
      onEvent: (event) => {
        if (event.type === 'step-started') {
          steps.push({ changed: null, index: event.index, text: event.text });
        } else {
          const step = steps.find((item) => item.index === event.index);
          if (step) Object.assign(step, { changed: event.changed, result: event.result.slice(0, 300) });
        }
        publish();
      },
      requestApproval: async (request) => {
        const approval = createApprovalMessage({ chatMode, instruction, request, sourceText: preparedRequest.outgoingText, targetSlot });
        desktopPetChatStore.addMessage(approval);
        const approved = await waitForAgentLoopApproval(approval.id, abortController.signal);
        desktopPetChatStore.updateMessage(approval.id, (message) => ({
          ...message,
          agentApproval: message.agentApproval ? { ...message.agentApproval, status: approved ? 'approved' : 'denied' } : message.agentApproval,
        }));
        return approved;
      },
      settings: preparedRequest.currentConfig.settings,
      signal: abortController.signal,
    });
  } catch (error) {
    result = { metrics: { durationMs: 0, modelCalls: 0, steps: steps.length, visionCalls: 0 }, status: 'failed', steps: [], summary: error instanceof Error ? error.message : String(error) };
  } finally {
    unregister();
  }
  pushFrontendRuntimeLog('agent-loop', 'desktop agent loop finished', { goal: instruction, status: result.status, ...result.metrics });
  publish({ durationMs: result.metrics.durationMs, status: result.status, summary: result.summary });
  if (result.status === 'cancelled') return;

  const replyId = createChatMessageId('agent-loop-reply');
  desktopPetChatStore.addMessage({ chatMode, id: replyId, petId: targetSlot.id, petName: targetSlot.personality.name, role: 'model', text: '' });
  try {
    await runAgentPersonaResponseTurnWithStyleRetry({
      browserSearchMode: 'block',
      chatMode,
      compactReplyIntoMessageId: replyId,
      historyMessages: preparedRequest.promptHistoryMessages,
      participantNames: preparedRequest.targetSlots.map((slot) => slot.personality.name),
      playbackToken: preparedRequest.playbackToken,
      playVoiceText,
      promptText: buildResultPrompt(instruction, result),
      requestToken: preparedRequest.requestToken,
      runPetResponseTurn,
      shouldAutoSpeakReply: !preparedRequest.isGroupMode,
      targetSlot,
    });
  } catch {
    desktopPetChatStore.updateMessageText(replyId, `${STATUS_TEXT[result.status]}：${result.summary}`);
  }
}
