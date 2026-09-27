import { useCallback, useRef } from 'react';
import { desktopPetChatStore } from '../../chatStore';
import type { DesktopPetChatSendOptions, GroupUserAttentionDecision } from '../../chatState';
import type { ChatAgentApprovalDecision } from '../../types';
import { resolveAgentApprovalRequest } from './agentRunController';
import {
  executePetChatMessageSend,
  type PetChatMessageSenderContext,
} from './petChatMessageSendExecution';
import {
  continueActiveGroupTaskConversation,
  createGroupTaskLifecycleCallbacks,
} from './group/task/groupTaskSenderLifecycle';
import type { UsePetChatMessageSenderOptions } from './petChatMessageSenderTypes';

export function usePetChatMessageSender(options: UsePetChatMessageSenderOptions) {
  const contextRef = useRef<PetChatMessageSenderContext>(null!);
  contextRef.current = {
    ...options,
    groupTaskLifecycle: createGroupTaskLifecycleCallbacks(options.activeGroupRuntimeRef),
  };

  const sendMessage = useCallback(async (
    textOverride?: string,
    sendOptions?: DesktopPetChatSendOptions,
  ) => {
    if (desktopPetChatStore.getState().groupUserAttention) {
      desktopPetChatStore.resolveGroupUserAttention();
      contextRef.current.activeGroupRuntimeRef.cancel();
      contextRef.current.groupChatContinuationEnabledRef.current = false;
      desktopPetChatStore.setGroupChatRunning(false);
    }
    await executePetChatMessageSend(contextRef.current, textOverride, sendOptions);
  }, []);

  const resolveAgentApproval = useCallback(async (
    messageId: string,
    decision: ChatAgentApprovalDecision,
  ) => {
    await resolveAgentApprovalRequest({
      ...contextRef.current,
      decision,
      messageId,
    });
    await continueActiveGroupTaskConversation(contextRef.current);
  }, []);

  const resolveGroupUserAttention = useCallback(async (
    decision: GroupUserAttentionDecision,
    text?: string,
  ) => {
    if (!desktopPetChatStore.getState().groupUserAttention) {
      return;
    }
    desktopPetChatStore.resolveGroupUserAttention();
    if (decision === 'continue') {
      await continueActiveGroupTaskConversation(contextRef.current);
      return;
    }
    contextRef.current.activeGroupRuntimeRef.cancel();
    contextRef.current.groupChatContinuationEnabledRef.current = false;
    desktopPetChatStore.setGroupChatRunning(false);
    if (text?.trim()) {
      await executePetChatMessageSend(contextRef.current, text.trim());
    }
  }, []);

  return { resolveAgentApproval, resolveGroupUserAttention, sendMessage };
}
