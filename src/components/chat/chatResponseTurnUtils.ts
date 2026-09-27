import { desktopPetChatStore } from '../../chatStore';
import { pushFrontendRuntimeLog } from '../../frontendRuntimeLogger';
import { type ChatMessage, type ChatMessageImageAttachment, type DesktopPetChatMode, type PetConfig } from '../../types';
import { resolvePetModelMotionBindingsForModel } from '../../pet-runtime/content/petModelMotionBindings';
import {
  buildChatScopedPersonality,
  buildScopedChatHistory,
  resolveChatTargetSlots,
} from './multiPetChat';
import { buildCharacterAnimationToolInstruction } from './characterAnimationToolProtocol';
import { type GroupChatInteractionPlan } from './chatGroupInteractionPlanner';
import { stripGroupRoleSignalMarkers } from './group/role/groupRoleSignalProtocol';
import { extractReadySpeechSegments } from './streamingSpeechSegmentationUtils';
import { loadSingleChatNeuralContext } from './neuralPersonaSingleChatContext';
import { resolveChatInputPersonality } from '../../services/neuralPersonaChatContextAssembly';
import {
  createNeuralPersonaConfiguredModelDataPolicy,
  createNeuralPersonaConfiguredModelProviders,
} from '../../services/neuralPersonaConfiguredModelProvider';

async function resolveSingleChatNeuralContribution(options: {
  chatMode: DesktopPetChatMode;
  featureEnabled: boolean;
  promptText: string;
  roleId: string;
  settings: PetConfig['settings'];
}) {
  const requestId = `single-chat:${options.roleId}:${Date.now()}`;
  const semantic = options.settings.neuralPersonaSemanticRetrievalEnabled
    ? {
      dataPolicy: createNeuralPersonaConfiguredModelDataPolicy(
        options.settings.neuralPersonaPrivateProviderDataConsent,
      ),
      provider: createNeuralPersonaConfiguredModelProviders({
        dataEgressConsent: options.settings.neuralPersonaProviderDataEgressConsent,
        settings: options.settings,
        timeoutMs: options.settings.neuralPersonaProviderTimeoutMs,
      }).semanticProvider,
    } : undefined;
  const result = await loadSingleChatNeuralContext({
    ...options,
    requestId,
    semantic,
  });
  pushFrontendRuntimeLog('神经人格', `单角色上下文：${result.status}`, {
    reason: result.status === 'neural' ? null : result.reason,
    roleId: options.roleId,
    semanticStatus: result.status === 'neural' ? result.semantic?.status ?? 'keyword' : null,
    selectedNodeCount: result.status === 'neural' ? result.trace.selectedNodeIds.length : 0,
  });
  return result.status === 'neural' ? result.contribution : null;
}

export type ChatResponseTargetSlot = ReturnType<typeof resolveChatTargetSlots>[number];

export async function requestPetResponseStream(options: {
  isCurrentRequest?: () => boolean;
  chatMode: import('../../types').DesktopPetChatMode;
  browserSearchMode?: 'allow' | 'block' | 'force';
  config: PetConfig;
  historyMessages: ChatMessage[];
  participantNames: string[];
  promptText: string;
  targetSlot: ChatResponseTargetSlot;
  userAttachments?: ChatMessageImageAttachment[];
}) {
  const { getPetResponseStream, resolveRoleKnowledgeAttachment } = await import('../../services/geminiService');
  const {
    browserSearchMode,
    chatMode,
    config,
    historyMessages,
    participantNames,
    promptText,
    targetSlot,
    userAttachments = [],
  } = options;
  const neuralContextContribution = await resolveSingleChatNeuralContribution({
    chatMode,
    featureEnabled: targetSlot.personality.neuralPersonaChatEnabled === true,
    promptText,
    roleId: targetSlot.id,
    settings: config.settings,
  });
  const inputPersonality = resolveChatInputPersonality(
    targetSlot.personality,
    neuralContextContribution,
  );
  const baseScopedPersonality = buildChatScopedPersonality(inputPersonality, chatMode, participantNames);
  const animationToolInstruction = buildCharacterAnimationToolInstruction(
    resolvePetModelMotionBindingsForModel(
      targetSlot.modelType,
      targetSlot.modelUrl,
      config.customModelPresets,
    ),
  );
  const scopedPersonality = animationToolInstruction
    ? {
        ...baseScopedPersonality,
        systemInstruction: [
          baseScopedPersonality.systemInstruction.trim(),
          animationToolInstruction,
        ].filter(Boolean).join('\n\n'),
      }
    : baseScopedPersonality;
  const roleKnowledgeAttachment = resolveRoleKnowledgeAttachment(scopedPersonality, promptText);

  pushFrontendRuntimeLog('角色知识库', roleKnowledgeAttachment
    ? `当前角色知识库已挂接：${roleKnowledgeAttachment.triggerReason}`
    : '当前角色知识库未挂接', {
    petId: targetSlot.id,
    petName: targetSlot.personality.name,
    chatMode,
    knowledgeBaseLength: targetSlot.personality.knowledgeBase.trim().length,
    matchCount: roleKnowledgeAttachment?.matchCount ?? 0,
    strongMatchCount: roleKnowledgeAttachment?.strongMatchCount ?? 0,
    selectedChunkCount: roleKnowledgeAttachment?.selectedChunkCount ?? 0,
    totalContentLength: roleKnowledgeAttachment?.totalContentLength ?? targetSlot.personality.knowledgeBase.trim().length,
  });

  return (async function* () {
    const controller = new AbortController();
    const timer = setInterval(() => {
      if (options.isCurrentRequest && !options.isCurrentRequest()) controller.abort();
    }, 100);
    try {
    yield* getPetResponseStream(
    buildScopedChatHistory(
      historyMessages,
      chatMode,
      targetSlot.id,
    ),
    promptText,
    scopedPersonality,
    config.settings,
    browserSearchMode,
    userAttachments,
    controller.signal,
  );
    } finally { clearInterval(timer); controller.abort(); }
  })();
}

export function syncStreamingReplyMessage(options: {
  chatMode: DesktopPetChatMode;
  groupInteractionPlan?: GroupChatInteractionPlan;
  hasModelMessage: boolean;
  modelMessageId: string;
  nextChunk: string;
  responseText: string;
  targetSlot: ChatResponseTargetSlot;
}) {
  const {
    chatMode,
    groupInteractionPlan,
    hasModelMessage,
    modelMessageId,
    nextChunk,
    responseText,
    targetSlot,
  } = options;
  const visibleResponseText = chatMode === 'group'
    ? stripGroupRoleSignalMarkers(responseText)
    : responseText;

  if (!hasModelMessage) {
    desktopPetChatStore.addMessage({
      id: modelMessageId,
      role: 'model',
      text: visibleResponseText,
      chatMode,
      petId: targetSlot.id,
      petName: targetSlot.personality.name,
      replyToPetId: groupInteractionPlan?.replyToPetId ?? null,
      replyToPetName: groupInteractionPlan?.replyToPetName ?? null,
      replyToPetIds: groupInteractionPlan?.replyToPetIds ?? [],
      replyToPetNames: groupInteractionPlan?.replyToPetNames ?? [],
      groupInteractionKind: groupInteractionPlan?.groupInteractionKind,
      storyId: chatMode === 'story'
        ? desktopPetChatStore.getState().storySession?.definition.id ?? null
        : null,
    });
    pushFrontendRuntimeLog('chat', 'pet streaming reply started', {
      petId: targetSlot.id,
      petName: targetSlot.personality.name,
      chunkLength: nextChunk.length,
      totalLength: responseText.length,
    });
    return true;
  }

  desktopPetChatStore.updateMessageText(modelMessageId, visibleResponseText);
  pushFrontendRuntimeLog('chat', 'pet streaming reply updated', {
    petId: targetSlot.id,
    petName: targetSlot.personality.name,
    chunkLength: nextChunk.length,
    totalLength: responseText.length,
  });
  return hasModelMessage;
}

export function finalizeStreamingReplyMessage(options: {
  chatMode: DesktopPetChatMode;
  finalResponse: string;
  groupInteractionPlan?: GroupChatInteractionPlan;
  hasModelMessage: boolean;
  modelMessageId: string;
  responseText: string;
  targetSlot: ChatResponseTargetSlot;
}) {
  const {
    chatMode,
    finalResponse,
    groupInteractionPlan,
    hasModelMessage,
    modelMessageId,
    responseText,
    targetSlot,
  } = options;

  if (!hasModelMessage && finalResponse) {
    desktopPetChatStore.addMessage({
      id: modelMessageId,
      role: 'model',
      text: finalResponse,
      chatMode,
      petId: targetSlot.id,
      petName: targetSlot.personality.name,
      replyToPetId: groupInteractionPlan?.replyToPetId ?? null,
      replyToPetName: groupInteractionPlan?.replyToPetName ?? null,
      replyToPetIds: groupInteractionPlan?.replyToPetIds ?? [],
      replyToPetNames: groupInteractionPlan?.replyToPetNames ?? [],
      groupInteractionKind: groupInteractionPlan?.groupInteractionKind,
      storyId: chatMode === 'story'
        ? desktopPetChatStore.getState().storySession?.definition.id ?? null
        : null,
    });
    return;
  }

  if (hasModelMessage && finalResponse !== responseText) {
    desktopPetChatStore.updateMessageText(modelMessageId, finalResponse);
  }
}

export function flushStreamingReplySpeechTail(options: {
  enqueueReplyVoiceSegment: (text: string, playbackToken: number, targetPetId: string | null) => void;
  pendingSpeechBuffer: string;
  playbackToken: number;
  targetPetId: string;
}) {
  const {
    enqueueReplyVoiceSegment,
    pendingSpeechBuffer,
    playbackToken,
    targetPetId,
  } = options;

  const finalSpeechExtraction = extractReadySpeechSegments(pendingSpeechBuffer, {
    flushAll: true,
  });

  finalSpeechExtraction.segments.forEach((segment) => {
    enqueueReplyVoiceSegment(segment, playbackToken, targetPetId);
  });

  const remainingTail = finalSpeechExtraction.remaining.trim();
  if (remainingTail) {
    enqueueReplyVoiceSegment(remainingTail, playbackToken, targetPetId);
  }
}
