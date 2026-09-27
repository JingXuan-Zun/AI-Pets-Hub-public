import { useCallback, useRef, type MutableRefObject } from 'react';
import { desktopPetChatStore } from '../../chatStore';
import { pushFrontendRuntimeLog } from '../../frontendRuntimeLogger';
import { type ChatMessageImageAttachment, type DesktopPetChatMode, type PetConfig } from '../../types';
import { expressionLibraryBridge } from '../../expression/expressionLibraryBridge';
import { resolveExpressionReplyWithSemantics } from '../../expression/reply/expressionReplySemantics';
import { isPetModelExpressionBinding } from '../../pet-runtime/content/petModelMotionBindingKinds';
import {
  createSpeechBracketFilterState,
  filterSpeechBracketContentChunk,
} from '../../voice/speechText';
import {
  buildVisibleCharacterReplyText,
  extractCharacterToolInvocations,
} from './characterToolProtocol';
import {
  resolveCharacterAnimationToolOptionId,
  resolveDirectCharacterAnimationTriggerMatches,
} from './characterAnimationToolProtocol';
import {
  resolveSemanticCharacterAnimationTriggerDecision,
} from './characterAnimationSemanticResolver';
import {
  buildChatScopedPersonality,
  buildScopedChatHistory,
  createChatMessageId,
  resolveChatTargetSlots,
} from './multiPetChat';
import { resolvePetModelMotionBindingsForModel } from '../../pet-runtime/content/petModelMotionBindings';
import {
  finalizeStreamingReplyMessage,
  flushStreamingReplySpeechTail,
  requestPetResponseStream,
  syncStreamingReplyMessage,
} from './chatResponseTurnUtils';
import { type GroupChatInteractionPlan } from './chatGroupInteractionPlanner';
import { ChatRequestScopeRegistry, createChatRequestScope } from './chatRequestScope';
import { parseGroupRoleTurnOutput } from './group/role/groupRoleTurnOutputProtocol';
import {
  extractGroupTopicSignal,
} from './group/role/groupTopicSignalProtocol';
import { extractGroupRelationshipSignal } from './group/relationship/groupRelationshipSignalProtocol';
import { extractGroupContributionSignal } from './group/role/groupContributionSignalProtocol';
import { stripGroupRoleSignalMarkers } from './group/role/groupRoleSignalProtocol';
import { normalizeStoryCharacterResponse } from './story/storyCharacterText';
import {
  beginReplyTextMouthActivity,
  endReplyTextMouthActivity,
  writeReplyTextMouthActivity,
} from '../../pet-runtime/performance/replyMouthSignalRuntime';

async function queueModelAnimationTriggers(options: {
  config: PetConfig;
  finalResponse: string;
  targetSlot: ReturnType<typeof resolveChatTargetSlots>[number];
  toolInvocations: ReturnType<typeof extractCharacterToolInvocations>;
  userAnimationIntentText?: string;
}) {
  const {
    config,
    finalResponse,
    targetSlot,
    toolInvocations,
    userAnimationIntentText = '',
  } = options;
  const motionBindings = resolvePetModelMotionBindingsForModel(
    targetSlot.modelType,
    targetSlot.modelUrl,
    config.customModelPresets,
  );
  if (motionBindings.length === 0) {
    return;
  }

  const explicitAnimationIds = Array.from(new Set(
    toolInvocations
      .filter((invocation) => invocation.kind === 'animation')
      .map((invocation) => resolveCharacterAnimationToolOptionId(invocation.animationId, motionBindings))
      .filter((animationId): animationId is string => Boolean(animationId)),
  )).slice(0, 3);
  if (explicitAnimationIds.length > 0) {
    desktopPetChatStore.queueAnimationToolTrigger(
      targetSlot.id,
      explicitAnimationIds,
      'model-tool',
    );
    pushFrontendRuntimeLog('character-animation', 'model animation tool trigger', {
      animationIds: explicitAnimationIds,
      petId: targetSlot.id,
      petName: targetSlot.personality.name,
    });
    return;
  }

  const visibleText = buildVisibleCharacterReplyText(
    finalResponse,
    targetSlot.personality.systemInstruction,
  );
  const expressionBindings = motionBindings.filter(isPetModelExpressionBinding);
  const directMatches = expressionBindings.length > 0
    ? resolveDirectCharacterAnimationTriggerMatches(
      visibleText,
      expressionBindings,
    )
    : [];
  if (directMatches.length > 0) {
    desktopPetChatStore.queueAnimationToolTrigger(
      targetSlot.id,
      directMatches.map((match) => match.animationId),
      'model-expression',
    );
    pushFrontendRuntimeLog('character-animation', 'model direct animation trigger', {
      animationIds: directMatches.map((match) => match.animationId),
      matchedAliases: directMatches.map((match) => match.matchedAlias),
      petId: targetSlot.id,
      petName: targetSlot.personality.name,
    });
    return;
  }

  const semanticIntentText = userAnimationIntentText.trim();
  if (!semanticIntentText) {
    return;
  }

  try {
    const semanticDecision = await resolveSemanticCharacterAnimationTriggerDecision({
      bindings: motionBindings,
      settings: config.settings,
      userInput: semanticIntentText,
    });
    if (semanticDecision.animationIds.length === 0) {
      pushFrontendRuntimeLog('character-animation', 'model semantic animation resolver skipped', {
        confidence: semanticDecision.confidence,
        petId: targetSlot.id,
        petName: targetSlot.personality.name,
        reason: semanticDecision.reason,
      });
      return;
    }

    desktopPetChatStore.queueAnimationToolTrigger(
      targetSlot.id,
      semanticDecision.animationIds,
      'user-semantic',
    );
    pushFrontendRuntimeLog('character-animation', 'model semantic animation trigger', {
      animationIds: semanticDecision.animationIds,
      confidence: semanticDecision.confidence,
      petId: targetSlot.id,
      petName: targetSlot.personality.name,
      reason: semanticDecision.reason,
    });
  } catch (error) {
    pushFrontendRuntimeLog('character-animation', 'model semantic animation resolver failed', {
      error: error instanceof Error ? error.message : String(error),
      petId: targetSlot.id,
      petName: targetSlot.personality.name,
    });
  }
}

async function attachExpressionReplyContent(options: {
  chatMode: DesktopPetChatMode;
  historyMessages: import('../../types').ChatMessage[];
  messageId: string;
  petId: string;
  replyText: string;
  settings: PetConfig['settings']['expressionReply'];
  modelSettings: PetConfig['settings'];
  isCurrentRequest: () => boolean;
}) {
  if (!options.settings.enabled) return;
  try {
    const result = await expressionLibraryBridge.getReplyCatalog();
    if (!options.isCurrentRequest()) return;
    if (!result.ok || !result.catalog) {
      pushFrontendRuntimeLog('expression-reply', 'expression catalog unavailable', { error: result.error });
      return;
    }
    const recentHistory = options.historyMessages
      .filter((message) => message.role === 'model' && (message.petId ?? options.petId) === options.petId)
      .flatMap((message) => message.content ?? [])
      .flatMap((segment) => segment.kind === 'expression'
        ? [{ expressionId: segment.expressionId }]
        : []);
    let content = await resolveExpressionReplyWithSemantics({
      catalog: result.catalog,
      conversationId: `${options.chatMode}:${options.petId}`,
      petId: options.petId,
      recentHistory,
      replySettings: options.settings,
      replyText: options.replyText,
    }, async ({ userInput, systemInstruction }) => {
      const { getConfiguredCognitionResponse } = await import('../../services/geminiService');
      return getConfiguredCognitionResponse(userInput, systemInstruction, options.modelSettings, {
        task: 'understanding', timeoutMs: 15000, maxTokensOverride: 1024,
      });
    }, (error) => pushFrontendRuntimeLog('expression-reply', 'semantic classification unavailable; using local fallback', {
      error: error instanceof Error ? error.message : String(error), petId: options.petId,
    }));
    if (!options.isCurrentRequest()) return;
    if (content.some((segment) => segment.kind === 'expression' && segment.expressionKind === 'image')) {
      const latest = await expressionLibraryBridge.getReplyCatalog();
      if (!options.isCurrentRequest()) return;
      content = content.filter((segment) => segment.kind !== 'expression' || segment.expressionKind !== 'image'
        || (latest.ok && latest.catalog?.roots.some((root) => root.enabledForReply
          && root.id === segment.rootSnapshot?.id && root.assets.some((asset) => asset.assetId === segment.assetId
            && asset.categoryId === segment.categorySnapshot?.id)
          && root.categories.some((category) => category.id === segment.categorySnapshot?.id
            && category.semanticVersion === segment.categorySnapshot?.semanticVersion))));
    }
    pushFrontendRuntimeLog('expression-reply', 'expression reply resolved', {
      petId: options.petId,
      imageCount: content.filter((segment) => segment.kind === 'expression' && segment.expressionKind === 'image').length,
      candidateCount: result.catalog.roots.reduce((count, root) => count + root.assets.length, 0),
    });
    if (content.some((segment) => segment.kind === 'expression')) {
      desktopPetChatStore.updateMessage(options.messageId, (message) => ({ ...message, content }));
    }
  } catch (error) {
    pushFrontendRuntimeLog('expression-reply', 'expression content resolution failed', {
      error: error instanceof Error ? error.message : String(error),
      petId: options.petId,
    });
  }
}

interface UsePetChatResponseTurnOptions {
  activeChatRequestTokenRef: MutableRefObject<number>;
  configRef: MutableRefObject<PetConfig>;
  enqueueReplyVoiceSegment: (text: string, playbackToken: number, targetPetId: string | null) => void;
  extractStreamingSpeech: (buffer: string, hasQueuedSpeechSegment: boolean) => {
    remaining: string;
    segments: string[];
  };
  onPetMessage?: (text: string) => void;
}

function resolveVisibleCharacterResponse(
  text: string,
  chatMode: DesktopPetChatMode,
  systemInstruction: string,
) {
  const visibleText = buildVisibleCharacterReplyText(text, systemInstruction);
  return chatMode === 'story' ? normalizeStoryCharacterResponse(visibleText) : visibleText;
}

// The streaming service exposes provider failures as a fallback text so the
// normal chat UI can show them. In group turns that text must not become a
// character message: the runtime needs to classify the turn as failed and
// continue with the other speakers.
function isReasoningOnlyFailureText(text: string) {
  return text.includes('模型只输出了内部推理，没有生成最终回复。');
}

export function usePetChatResponseTurn({
  activeChatRequestTokenRef,
  configRef,
  enqueueReplyVoiceSegment,
  extractStreamingSpeech,
  onPetMessage,
}: UsePetChatResponseTurnOptions) {
  const scopedRequestsRef = useRef(new ChatRequestScopeRegistry());
  return useCallback(async (
    targetSlot: ReturnType<typeof resolveChatTargetSlots>[number],
    options: {
      chatMode: DesktopPetChatMode;
      historyMessages: import('../../types').ChatMessage[];
      participantNames: string[];
      promptText: string;
      shouldAutoSpeakReply: boolean;
      playbackToken: number;
      requestToken: number;
      browserSearchMode?: 'allow' | 'block' | 'force';
      outputMessageId?: string | null;
      userAttachments?: ChatMessageImageAttachment[];
      userAnimationIntentText?: string;
      groupInteractionPlan?: GroupChatInteractionPlan;
    },
  ) => {
    const {
      chatMode: currentChatMode,
      historyMessages,
      participantNames,
      promptText,
      shouldAutoSpeakReply,
      playbackToken,
      requestToken,
      groupInteractionPlan,
      outputMessageId = null,
    } = options;
    const requestScope = createChatRequestScope(currentChatMode, targetSlot.id);
    const scopedRequestToken = scopedRequestsRef.current.begin(requestScope);
    const isCurrentRequest = () => scopedRequestsRef.current.isCurrent(requestScope, scopedRequestToken);

    if (!isCurrentRequest()) {
      return { cancelled: true, finalResponse: '' };
    }

    desktopPetChatStore.setTyping(true);
    desktopPetChatStore.setTypingPetId(targetSlot.id);
    const mouthTextSourceId = `reply-text:${targetSlot.id}:${requestToken}`;
    beginReplyTextMouthActivity(targetSlot.id, mouthTextSourceId);

    try {
      const responseStream = await requestPetResponseStream({
        isCurrentRequest,
        // Group and infinite-group turns must never trigger external browser
        // search. Search is only available in a private chat when the user
        // explicitly enables it.
        browserSearchMode: currentChatMode === 'group'
          ? 'block'
          : (options.browserSearchMode ?? 'block'),
        chatMode: currentChatMode,
        config: configRef.current,
        historyMessages,
        participantNames,
        promptText,
        targetSlot,
        userAttachments: options.userAttachments ?? [],
      });

      if (!isCurrentRequest()) {
        return { cancelled: true, finalResponse: '' };
      }

      const modelMessageId = outputMessageId || createChatMessageId(`model-${targetSlot.id}`);
      let responseText = '';
      let pendingSpeechBuffer = '';
      let hasModelMessage = Boolean(outputMessageId);
      let hasQueuedSpeechSegment = false;
      const speechBracketFilterState = createSpeechBracketFilterState();
      const cancelStreamingReply = (partialResponse: string) => {
        const visiblePartialResponse = resolveVisibleCharacterResponse(
          partialResponse.trim(),
          currentChatMode,
          targetSlot.personality.systemInstruction,
        );

        if (hasModelMessage && visiblePartialResponse) {
          const currentMessage = desktopPetChatStore.getState().messages.find(
            (item) => item.id === modelMessageId,
          );
          const lastSyncedText = currentChatMode === 'group'
            ? stripGroupRoleSignalMarkers(partialResponse)
            : partialResponse;
          if (currentMessage && currentMessage.text === lastSyncedText) {
            desktopPetChatStore.updateMessageText(modelMessageId, visiblePartialResponse);
          }
        }

        pushFrontendRuntimeLog('chat', 'pet streaming reply cancelled by newer request', {
          petId: targetSlot.id,
          petName: targetSlot.personality.name,
          textLength: visiblePartialResponse.length,
        });

        return {
          cancelled: true,
          finalResponse: visiblePartialResponse,
        };
      };

      for await (const chunk of responseStream) {
        if (!isCurrentRequest()) {
          return cancelStreamingReply(responseText);
        }

        const nextChunk = typeof chunk === 'string' ? chunk : '';
        if (!nextChunk) {
          continue;
        }

        responseText += nextChunk;
        writeReplyTextMouthActivity(targetSlot.id, mouthTextSourceId, nextChunk);

        hasModelMessage = syncStreamingReplyMessage({
          chatMode: currentChatMode,
          groupInteractionPlan,
          hasModelMessage,
          modelMessageId,
          nextChunk,
          responseText,
          targetSlot,
        });

        if (!shouldAutoSpeakReply) {
          continue;
        }

        const nextSpeechChunk = configRef.current.settings.speechSkipBracketContent
          ? filterSpeechBracketContentChunk(nextChunk, speechBracketFilterState)
          : nextChunk;
        if (!nextSpeechChunk) {
          continue;
        }

        const speechExtraction = extractStreamingSpeech(
          `${pendingSpeechBuffer}${nextSpeechChunk}`,
          hasQueuedSpeechSegment,
        );
        pendingSpeechBuffer = speechExtraction.remaining;
        speechExtraction.segments.forEach((segment) => {
          enqueueReplyVoiceSegment(segment, playbackToken, targetSlot.id);
          hasQueuedSpeechSegment = true;
        });
      }

      if (!isCurrentRequest()) {
        return cancelStreamingReply(responseText);
      }

      let finalResponse = responseText.trim();
      const initialTopicSignal = currentChatMode === 'group'
        ? extractGroupTopicSignal(finalResponse)
        : undefined;
      const toolInvocations = extractCharacterToolInvocations(finalResponse);
      let visibleFinalResponse = resolveVisibleCharacterResponse(
        finalResponse,
        currentChatMode,
        targetSlot.personality.systemInstruction,
      );

      toolInvocations
        .filter((invocation) => invocation.kind === 'action')
        .forEach((invocation) => {
          pushFrontendRuntimeLog('角色工具', `角色触发动作：${invocation.action}`, {
            petId: targetSlot.id,
            petName: targetSlot.personality.name,
            marker: invocation.raw,
          });
        });

      const webSearchInvocation = toolInvocations.find((invocation) => invocation.kind === 'web-search');
      if (webSearchInvocation && isCurrentRequest()) {
        const { buildExternalWebSearchInstruction, buildWebSearchQuery } = await import('../../services/geminiService');
        const refinedSearchQuery = buildWebSearchQuery(webSearchInvocation.query);
        pushFrontendRuntimeLog('角色工具', `角色请求网页查询：${refinedSearchQuery}`, {
          petId: targetSlot.id,
          petName: targetSlot.personality.name,
          marker: webSearchInvocation.raw,
          rawQuery: webSearchInvocation.query,
        });

        const searchInstruction = await buildExternalWebSearchInstruction(
          webSearchInvocation.query,
          targetSlot.personality,
          configRef.current.settings,
          options.browserSearchMode ?? 'allow',
          'tool',
        );

        if (!isCurrentRequest()) {
          return cancelStreamingReply(visibleFinalResponse);
        }

        pushFrontendRuntimeLog('角色工具', `网页查询完成：${refinedSearchQuery}`, {
          petId: targetSlot.id,
          petName: targetSlot.personality.name,
          resultLength: searchInstruction.length,
          rawQuery: webSearchInvocation.query,
        });

        const toolPrompt = [
          '这是你刚刚通过角色工具请求的网页查询结果。',
          '请继续保持当前角色人格、口吻、称呼、关系和用户在人格提示词里指定的回复格式。',
          '不要提到系统提示、工具协议或内部标记；直接把可用查询结果融入角色回复。',
          `查询词：${refinedSearchQuery}`,
          searchInstruction || '查询没有返回可用结果。请用角色口吻自然说明不确定或没有查到。',
        ].join('\n\n');
        const toolHistory = [
          ...buildScopedChatHistory(
            historyMessages,
            currentChatMode,
            targetSlot.id,
          ),
          {
            role: 'model' as const,
            text: visibleFinalResponse,
            chatMode: currentChatMode,
            petId: targetSlot.id,
            petName: targetSlot.personality.name,
            replyToPetId: groupInteractionPlan?.replyToPetId ?? null,
            replyToPetName: groupInteractionPlan?.replyToPetName ?? null,
            replyToPetIds: groupInteractionPlan?.replyToPetIds ?? [],
            replyToPetNames: groupInteractionPlan?.replyToPetNames ?? [],
            groupInteractionKind: groupInteractionPlan?.groupInteractionKind,
          },
        ];
        const toolSettings: PetConfig['settings'] = {
          ...configRef.current.settings,
          webSearchEnabled: false,
        };
        let toolResponseText = '';

        const toolResponseStream = await requestPetResponseStream({
          isCurrentRequest,
          browserSearchMode: 'block',
          chatMode: currentChatMode,
          config: { ...configRef.current, settings: toolSettings },
          historyMessages: toolHistory,
          participantNames,
          promptText: toolPrompt,
          targetSlot,
        });
        for await (const chunk of toolResponseStream) {
          if (!isCurrentRequest()) {
            return cancelStreamingReply(toolResponseText.trim() || visibleFinalResponse);
          }

          const nextChunk = typeof chunk === 'string' ? chunk : '';
          if (!nextChunk) {
            continue;
          }

          toolResponseText += nextChunk;
          writeReplyTextMouthActivity(targetSlot.id, mouthTextSourceId, nextChunk);
          desktopPetChatStore.updateMessageText(
            modelMessageId,
            resolveVisibleCharacterResponse(
              toolResponseText,
              currentChatMode,
              targetSlot.personality.systemInstruction,
            ),
          );
        }

        if (!isCurrentRequest()) {
          return cancelStreamingReply(toolResponseText.trim() || visibleFinalResponse);
        }

        if (toolResponseText.trim()) {
          finalResponse = toolResponseText.trim();
          visibleFinalResponse = resolveVisibleCharacterResponse(
            finalResponse,
            currentChatMode,
            targetSlot.personality.systemInstruction,
          );
        }
      }

      if (!isCurrentRequest()) {
        return cancelStreamingReply(visibleFinalResponse);
      }

      if (isReasoningOnlyFailureText(finalResponse)) {
        if (hasModelMessage) {
          desktopPetChatStore.removeMessage(modelMessageId);
        }
        throw new Error('模型只输出了内部推理，没有生成最终回复。');
      }

      finalizeStreamingReplyMessage({
        chatMode: currentChatMode,
        finalResponse: visibleFinalResponse,
        groupInteractionPlan,
        hasModelMessage,
        modelMessageId,
        responseText,
        targetSlot,
      });

      const expressionReplyCompletion = attachExpressionReplyContent({
        chatMode: currentChatMode,
        historyMessages,
        messageId: modelMessageId,
        petId: targetSlot.id,
        replyText: visibleFinalResponse,
        settings: configRef.current.settings.expressionReply,
        modelSettings: configRef.current.settings,
        isCurrentRequest,
      });

      if (!isCurrentRequest()) {
        return cancelStreamingReply(visibleFinalResponse);
      }

      await queueModelAnimationTriggers({
        config: configRef.current,
        finalResponse,
        targetSlot,
        toolInvocations,
        userAnimationIntentText: options.userAnimationIntentText,
      });

      if (!isCurrentRequest()) {
        return cancelStreamingReply(visibleFinalResponse);
      }

      if (shouldAutoSpeakReply) {
        flushStreamingReplySpeechTail({
          enqueueReplyVoiceSegment,
          pendingSpeechBuffer,
          playbackToken,
          targetPetId: targetSlot.id,
        });
      }

      if (isCurrentRequest()) {
        onPetMessage?.(stripGroupRoleSignalMarkers(finalResponse));
      }

      await expressionReplyCompletion;
      if (!isCurrentRequest()) return cancelStreamingReply(visibleFinalResponse);

      if (currentChatMode === 'group') {
        const contributionSignal = extractGroupContributionSignal(finalResponse);
        const currentMessage = desktopPetChatStore.getState().messages.find((message) => message.id === modelMessageId);
        if (currentMessage && contributionSignal) {
          desktopPetChatStore.updateMessage(modelMessageId, (message) => ({
            ...message, groupContributionSignal: contributionSignal,
          }));
        }
      }

      pushFrontendRuntimeLog('chat', 'pet streaming reply completed', {
        petId: targetSlot.id,
        petName: targetSlot.personality.name,
        textLength: visibleFinalResponse.length,
        toolInvocationCount: toolInvocations.length,
      });

      return {
        cancelled: false,
        finalResponse: stripGroupRoleSignalMarkers(finalResponse),
        groupRoleTurnOutput: currentChatMode === 'group'
          ? parseGroupRoleTurnOutput({
              text: stripGroupRoleSignalMarkers(visibleFinalResponse),
              relationshipSignal: extractGroupRelationshipSignal(finalResponse),
              contributionSignal: extractGroupContributionSignal(finalResponse),
              topicSignal: extractGroupTopicSignal(finalResponse) ?? initialTopicSignal,
            }) ?? undefined
          : undefined,
      };
    } finally {
      endReplyTextMouthActivity(targetSlot.id, mouthTextSourceId);
      if (isCurrentRequest()) {
        desktopPetChatStore.setTyping(false);
        desktopPetChatStore.setTypingPetId(null);
      }
    }
  }, [activeChatRequestTokenRef, configRef, enqueueReplyVoiceSegment, extractStreamingSpeech, onPetMessage]);
}
