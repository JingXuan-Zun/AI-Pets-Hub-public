import { desktopPetChatStore } from '../../../chatStore';
import { resolveActiveChatSlot } from '../multiPetChat';
import { beginApprovedAgentRunPresentation } from './approvalEntryPresentation';
import type { ResolveAgentApprovalRequestOptions } from './controllerOptions';

type ActivationOptions = Pick<ResolveAgentApprovalRequestOptions,
  'activeChatRequestTokenRef' | 'configRef' | 'groupChatContinuationEnabledRef' | 'messageId' | 'stopGroupChat' | 'stopPetSpeech'>
  & Pick<Parameters<typeof beginApprovedAgentRunPresentation>[0], 'approval' | 'approvalMessage' | 'approvalRuntime'>;

export function activateApprovedAgentRequest({ activeChatRequestTokenRef, configRef, groupChatContinuationEnabledRef,
  approval, approvalMessage, approvalRuntime, messageId, stopGroupChat, stopPetSpeech }: ActivationOptions) {
  const currentChatState = desktopPetChatStore.getState();
  const targetSlot = resolveActiveChatSlot(
    configRef.current,
    approvalMessage.petId ?? currentChatState.activePetId,
  );
  const requestToken = activeChatRequestTokenRef.current + 1;
  activeChatRequestTokenRef.current = requestToken;
  groupChatContinuationEnabledRef.current = false;
  beginApprovedAgentRunPresentation({ approval, approvalMessage, approvalRuntime, targetSlot, messageId, stopGroupChat, stopPetSpeech });
  return { currentChatState, targetSlot, requestToken };
}
