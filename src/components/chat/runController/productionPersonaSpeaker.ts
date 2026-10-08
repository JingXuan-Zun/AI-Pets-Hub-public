import { type PreparedChatSendRequest } from '../chatMessageSendFlowUtils';
import { type AgentProductionSessionResult } from '../../../agent';
import { type ChatSendTargetSlot } from '../chatMessageSendUtils';
import { pushFrontendRuntimeLog } from '../../../frontendRuntimeLogger';
import { desktopPetChatStore } from '../../../chatStore';
import { createChatMessageId } from '../multiPetChat';
import { type AgentPlayVoiceText, type AgentRunPetResponseTurn } from './controllerTypes';
import { createAgentSafeVisibleFallbackText } from './personaText';
import { playDeferredAgentPersonaVoice } from './personaVoice';
import { runAgentPersonaResponseTurnWithStyleRetry } from './personaReplyTurn';
import { buildAgentProductionSessionPersonaPrompt, createAgentProductionSessionFallbackVisibleReply } from './productionPersonaPrompt';

export async function speakAgentProductionSessionResult(options: {
  compactReplyIntoMessageId?: string | null;
  instruction: string;
  participantNames: string[];
  playVoiceText: AgentPlayVoiceText;
  preparedRequest: PreparedChatSendRequest;
  result: AgentProductionSessionResult;
  runPetResponseTurn: AgentRunPetResponseTurn;
  shouldAutoSpeakReply: boolean;
  targetSlot: ChatSendTargetSlot | null;
}) {
  const {
    compactReplyIntoMessageId = null,
    instruction,
    participantNames,
    playVoiceText,
    preparedRequest,
    result,
    runPetResponseTurn,
    shouldAutoSpeakReply,
    targetSlot,
  } = options;
  if (!targetSlot) {
    return;
  }
  const acceptedRuntimeReply = createAgentSafeVisibleFallbackText(result.finalAnswer, 900);
  if (acceptedRuntimeReply) {
    pushFrontendRuntimeLog('agent-run', 'displaying accepted runtime final answer without a second model call', {
      replyLength: acceptedRuntimeReply.length,
      status: result.status,
    });
    if (compactReplyIntoMessageId) {
      desktopPetChatStore.updateMessage(compactReplyIntoMessageId, (message) => ({
        ...message,
        text: acceptedRuntimeReply,
      }));
    } else {
      desktopPetChatStore.addMessage({
        id: createChatMessageId(`model-${targetSlot.id}`),
        role: 'model',
        text: acceptedRuntimeReply,
        chatMode: preparedRequest.currentChatState.chatMode,
        petId: targetSlot.id,
        petName: targetSlot.personality.name,
      });
    }
    playDeferredAgentPersonaVoice({
      playVoiceText,
      shouldAutoSpeakReply,
      targetSlot,
      text: acceptedRuntimeReply,
    });
    return;
  }

  let response: Awaited<ReturnType<typeof runAgentPersonaResponseTurnWithStyleRetry>>;
  try {
    response = await runAgentPersonaResponseTurnWithStyleRetry({
      chatMode: preparedRequest.currentChatState.chatMode,
      compactReplyIntoMessageId,
      historyMessages: preparedRequest.promptHistoryMessages,
      participantNames,
      playVoiceText,
      promptText: buildAgentProductionSessionPersonaPrompt(instruction, result),
      playbackToken: preparedRequest.playbackToken,
      requestToken: preparedRequest.requestToken,
      runPetResponseTurn,
      shouldAutoSpeakReply,
      targetSlot,
      browserSearchMode: 'block',
    });
  } catch (error) {
    const fallbackText = createAgentProductionSessionFallbackVisibleReply(result);
    pushFrontendRuntimeLog('agent-run', 'persona reply failed; displaying verified session result', {
      error: error instanceof Error ? error.message : String(error),
      fallbackLength: fallbackText.length,
      status: result.status,
    });
    if (compactReplyIntoMessageId) {
      desktopPetChatStore.updateMessage(compactReplyIntoMessageId, (message) => ({
        ...message,
        text: fallbackText,
      }));
    } else {
      desktopPetChatStore.addMessage({
        id: createChatMessageId(`model-${targetSlot.id}`),
        role: 'model',
        text: fallbackText,
        chatMode: preparedRequest.currentChatState.chatMode,
        petId: targetSlot.id,
        petName: targetSlot.personality.name,
      });
    }
    return;
  }

  if (response.cancelled) {
    return;
  }

  if (!response.finalResponse.trim()) {
    const fallbackText = createAgentProductionSessionFallbackVisibleReply(result);
    if (compactReplyIntoMessageId) {
      desktopPetChatStore.updateMessage(compactReplyIntoMessageId, (message) => ({
        ...message,
        text: fallbackText,
      }));
    } else {
      desktopPetChatStore.addMessage({
        id: createChatMessageId(`model-${targetSlot.id}`),
        role: 'model',
        text: fallbackText,
        chatMode: preparedRequest.currentChatState.chatMode,
        petId: targetSlot.id,
        petName: targetSlot.personality.name,
      });
    }
  }
}
