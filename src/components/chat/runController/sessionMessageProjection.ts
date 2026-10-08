import { type AgentChatCommand, type AgentExecutionPlan, type AgentRuntimeProgressEvent } from '../../../agent';
import { type ChatMessage } from '../../../types';
import { type PreparedChatSendRequest } from '../chatMessageSendFlowUtils';
import { createChatMessageId } from '../multiPetChat';
import { updateAgentProgressMessage } from '../agentProgressMessageProjection';
import { createAgentProductionSessionInitialVisibleText, createAgentProductionSessionProgressVisibleText } from './sessionVisibleText';
import { createAgentWorkStages } from './workStageCreation';
import { createAgentRunTrace } from './runTraceCreation';

export function createAgentProductionSessionPlaceholderCommand(
  instruction: string,
  sourceText: string,
): AgentChatCommand {
  return {
    instruction,
    kind: 'tool-call',
    sourceText,
  };
}

export function createAgentProductionSessionDisplayPlan(
  instruction: string,
  sourceText: string,
): AgentExecutionPlan {
  return {
    commandKind: 'tool-call',
    goal: instruction,
    instruction: sourceText,
    steps: [
      {
        action: {
          kind: 'observe-windows-and-apps',
          label: 'Agent runtime progress',
          risk: 'read',
        },
        decision: {
          allowed: true,
          mode: 'silent',
          reason: 'Agent runtime will report model and tool progress as it executes.',
        },
        details: ['Live progress container for the current Agent run.'],
        id: 'agent-runtime-progress',
        summary: 'Agent runtime progress',
      },
    ],
  };
}

export function createInitialAgentProductionSessionState(
  instruction: string,
  sourceText: string,
): NonNullable<ChatMessage['agentRun']>['agentRuntime'] {
  return {
    historyLines: [],
    sourceText,
    steps: [],
    traceEvents: [],
    toolResults: [],
    userGoal: instruction,
  };
}

export function createAgentProductionSessionRunMessage(options: {
  instruction: string;
  preparedRequest: PreparedChatSendRequest;
}): ChatMessage {
  const { instruction, preparedRequest } = options;
  const sourceText = preparedRequest.outgoingText;
  const targetSlot = resolvePreparedAgentTargetSlot(preparedRequest);
  const messageId = createChatMessageId('agent-v2-run');
  const plan = createAgentProductionSessionDisplayPlan(instruction, sourceText);

  return {
    id: messageId,
    role: 'model',
    text: createAgentProductionSessionInitialVisibleText(),
    agentRun: {
      agentRuntime: createInitialAgentProductionSessionState(instruction, sourceText),
      command: createAgentProductionSessionPlaceholderCommand(instruction, sourceText),
      id: messageId,
      plan,
      stages: createAgentWorkStages(plan, {
        status: 'running',
      }),
      status: 'running',
      trace: createAgentRunTrace(plan, {
        status: 'running',
      }),
    },
    chatMode: preparedRequest.currentChatState.chatMode,
    petId: targetSlot?.id ?? null,
    petName: targetSlot?.personality.name ?? null,
  };
}

export function resolvePreparedAgentTargetSlot(preparedRequest: PreparedChatSendRequest) {
  const candidate = preparedRequest.groupTaskCandidate;
  const taskRoleId = candidate?.collaborationPlan?.executorRoleId ?? candidate?.sourceRoleIds[0];
  return preparedRequest.targetSlots.find((slot) => slot.id === taskRoleId)
    ?? preparedRequest.targetSlots[0]
    ?? null;
}

export function updateAgentProductionSessionProgressMessage(
  messageId: string | null,
  event: AgentRuntimeProgressEvent,
) {
  updateAgentProgressMessage({
    event,
    messageId,
    visibleText: createAgentProductionSessionProgressVisibleText(event),
  });
}
