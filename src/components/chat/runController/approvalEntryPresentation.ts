import { assessAgentCommandResult } from '../../../agent';
import type { ChatMessage } from '../../../types';
import { desktopPetChatStore } from '../../../chatStore';
import { pushFrontendRuntimeLog } from '../../../frontendRuntimeLogger';
import { updateAgentApprovalMessage } from '../agentApprovalMessageStore';
import type { resolveActiveChatSlot } from '../multiPetChat';
import type { resolveChatAgentRuntimeContinuation } from '../chatAgentRuntimeCompatibility';
import type { ResolveAgentApprovalRequestOptions } from './controllerOptions';
import { projectAgentApprovalAccepted } from './approvalDecisionProjection';
import { projectAgentUnsupportedApproval } from './approvalResultProjection';

type ApprovalEntryOptions = {
  approval: NonNullable<ChatMessage['agentApproval']>;
  messageId: string;
};

export function beginApprovedAgentRunPresentation({ approval, approvalMessage, approvalRuntime, targetSlot, messageId, stopGroupChat, stopPetSpeech }: ApprovalEntryOptions & {
  approvalMessage: ChatMessage;
  approvalRuntime: ReturnType<typeof resolveChatAgentRuntimeContinuation>;
  targetSlot: ReturnType<typeof resolveActiveChatSlot>;
} & Pick<ResolveAgentApprovalRequestOptions, 'stopGroupChat' | 'stopPetSpeech'>) {
  if (!(approval.groupTaskEvent ?? approvalMessage.groupTaskEvent)) {
    stopGroupChat({ immediate: true, cancelActiveRequest: false });
  }
  stopPetSpeech();

  desktopPetChatStore.setTyping(true);
  desktopPetChatStore.setTypingPetId(targetSlot?.id ?? null);
  updateAgentApprovalMessage(messageId, (message) => projectAgentApprovalAccepted(message, { approvalRuntime }));
  pushFrontendRuntimeLog('agent-run', 'approval accepted', {
    goal: approval.plan.goal,
  });
}

export function presentUnsupportedAgentApproval({ approval, messageId }: ApprovalEntryOptions) {
  const result = assessAgentCommandResult(approval.command, {
    errorText: 'Legacy Agent approval is no longer supported by the active entry path.',
    ok: false,
    responseText: 'Legacy Agent approval is no longer supported by the active entry path.',
  });
  updateAgentApprovalMessage(messageId, (message) => projectAgentUnsupportedApproval(message, { result, approval }));
}
