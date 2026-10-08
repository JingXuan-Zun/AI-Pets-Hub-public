import { type DesktopPetChatMode, type ChatMessage } from '../../../types';
import { type ChatSendTargetSlot } from '../chatMessageSendUtils';
import { desktopPetChatStore } from '../../../chatStore';
import { pushFrontendRuntimeLog } from '../../../frontendRuntimeLogger';
import { type AgentPlayVoiceText, type AgentRunPetResponseTurn } from './controllerTypes';
import { snapshotChatMessageIds, findNewTargetModelMessageId, moveAgentPersonaReplyIntoExistingMessage } from './personaMessages';
import { findAgentPersonaReplyStyleIssues, buildAgentPersonaReplyRewritePrompt } from './personaReplyStyle';
import { playDeferredAgentPersonaVoice } from './personaVoice';

export async function runAgentPersonaResponseTurnWithStyleRetry(options: {
  browserSearchMode?: 'allow' | 'block' | 'force';
  chatMode: DesktopPetChatMode;
  compactReplyIntoMessageId?: string | null;
  historyMessages: ChatMessage[];
  participantNames: string[];
  playbackToken: number;
  playVoiceText: AgentPlayVoiceText;
  promptText: string;
  requestToken: number;
  runPetResponseTurn: AgentRunPetResponseTurn;
  shouldAutoSpeakReply: boolean;
  targetSlot: ChatSendTargetSlot;
}) {
  const {
    browserSearchMode = 'block',
    chatMode,
    compactReplyIntoMessageId = null,
    historyMessages,
    participantNames,
    playbackToken,
    playVoiceText,
    promptText,
    requestToken,
    runPetResponseTurn,
    shouldAutoSpeakReply,
    targetSlot,
  } = options;

  const beforeFirstMessageIds = snapshotChatMessageIds();
  const firstResponse = await runPetResponseTurn(targetSlot, {
    chatMode,
    historyMessages,
    participantNames,
    promptText,
    shouldAutoSpeakReply: false,
    playbackToken,
    requestToken,
    browserSearchMode,
    outputMessageId: compactReplyIntoMessageId,
  });
  const firstModelMessageId = findNewTargetModelMessageId(beforeFirstMessageIds, targetSlot, chatMode);

  if (firstResponse.cancelled) {
    return firstResponse;
  }

  const styleIssues = findAgentPersonaReplyStyleIssues(firstResponse.finalResponse);
  if (styleIssues.length === 0) {
    const replyText = moveAgentPersonaReplyIntoExistingMessage({
      compactReplyIntoMessageId,
      finalResponse: firstResponse.finalResponse,
      generatedMessageId: firstModelMessageId,
    });
    playDeferredAgentPersonaVoice({
      playVoiceText,
      shouldAutoSpeakReply,
      targetSlot,
      text: replyText,
    });
    return firstResponse;
  }

  if (firstModelMessageId) {
    desktopPetChatStore.removeMessage(firstModelMessageId);
  }

  pushFrontendRuntimeLog('agent-run', 'persona result reply retried for character voice', {
    issues: styleIssues,
    petId: targetSlot.id,
    petName: targetSlot.personality.name,
  });

  const beforeRetryMessageIds = snapshotChatMessageIds();
  const retryResponse = await runPetResponseTurn(targetSlot, {
    chatMode,
    historyMessages,
    participantNames,
    promptText: buildAgentPersonaReplyRewritePrompt({
      basePrompt: promptText,
      issues: styleIssues,
      previousReply: firstResponse.finalResponse,
    }),
    shouldAutoSpeakReply: false,
    playbackToken,
    requestToken,
    browserSearchMode,
    outputMessageId: compactReplyIntoMessageId,
  });

  if (!retryResponse.cancelled && retryResponse.finalResponse.trim()) {
    const retryModelMessageId = findNewTargetModelMessageId(beforeRetryMessageIds, targetSlot, chatMode);
    const replyText = moveAgentPersonaReplyIntoExistingMessage({
      compactReplyIntoMessageId,
      finalResponse: retryResponse.finalResponse,
      generatedMessageId: retryModelMessageId,
    });
    playDeferredAgentPersonaVoice({
      playVoiceText,
      shouldAutoSpeakReply,
      targetSlot,
      text: replyText,
    });
  }

  return retryResponse;
}
