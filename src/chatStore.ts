import { useSyncExternalStore } from 'react';
import {
  cloneReplayableAnimationToolTrigger,
  isReplayableAnimationToolTrigger,
} from './animationToolTriggerReplay';
import {
  DEFAULT_CHAT_ACTIVE_PET_ID,
  DEFAULT_DESKTOP_PET_CHAT_STATE,
  type DesktopPetAnimationToolTrigger,
  type DesktopPetAnimationToolTriggerAudio,
  type DesktopPetAnimationToolPerformanceState,
  type DesktopPetAnimationToolAudioPlaybackState,
  type DesktopPetAnimationToolTriggerScheduleItem,
  type DesktopPetGroupChatContinuationMode,
  type DesktopPetSpeechExpressionAction,
  type DesktopPetChatState,
} from './chatState';
import {
  normalizeAnimationToolTriggerIds,
  normalizeAnimationToolTriggerSchedule,
} from './components/pet/animationToolTriggerSchedule';
import { normalizeAnimationToolTriggerAudio } from './components/pet/animationToolTriggerAudio';
import { type ChatMessage, type ChatMessageContentSegment, type ChatMessageImageAttachment, type DesktopPetChatMode } from './types';
import { createStorySession, restoreStorySession } from './components/chat/story/storyDefaults';
import { applyStoryTurnPlan } from './components/chat/story/storyCastState';
import type { StoryDefinition, StorySessionState, StoryTurnPlan } from './components/chat/story/storyTypes';
import {
  deleteStoryFromLibrary,
  loadStoryLibrary,
  loadStorySessionSnapshot,
  saveStorySessionSnapshot,
  saveStoryToLibrary,
} from './components/chat/story/storyLibrary';

type Listener = () => void;

function normalizeChatImageAttachment(attachment: ChatMessageImageAttachment): ChatMessageImageAttachment | null {
  if (
    attachment?.kind !== 'image'
    || typeof attachment.dataUrl !== 'string'
    || !attachment.dataUrl.startsWith('data:image/')
  ) {
    return null;
  }

  return {
    dataUrl: attachment.dataUrl,
    height: Number.isFinite(Number(attachment.height)) ? Math.max(1, Math.round(Number(attachment.height))) : undefined,
    id: typeof attachment.id === 'string' && attachment.id.trim()
      ? attachment.id.trim()
      : `chat-image-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    kind: 'image',
    mimeType: typeof attachment.mimeType === 'string' && attachment.mimeType.trim()
      ? attachment.mimeType.trim()
      : 'image/png',
    name: typeof attachment.name === 'string' && attachment.name.trim()
      ? attachment.name.trim()
      : 'image',
    sizeBytes: Number.isFinite(Number(attachment.sizeBytes)) ? Math.max(0, Math.round(Number(attachment.sizeBytes))) : undefined,
    width: Number.isFinite(Number(attachment.width)) ? Math.max(1, Math.round(Number(attachment.width))) : undefined,
  };
}

function normalizeChatImageAttachments(attachments: ChatMessage['attachments']) {
  return (Array.isArray(attachments) ? attachments : [])
    .map((attachment) => normalizeChatImageAttachment(attachment))
    .filter((attachment): attachment is ChatMessageImageAttachment => attachment !== null);
}

function normalizeChatContent(content: ChatMessage['content']): ChatMessageContentSegment[] {
  const normalized: ChatMessageContentSegment[] = [];
  for (const segment of Array.isArray(content) ? content : []) {
    if (segment?.kind === 'text' && typeof segment.text === 'string') {
      normalized.push({ kind: 'text', text: segment.text });
      continue;
    }
    if (
      segment?.kind !== 'expression'
      || typeof segment.expressionId !== 'string'
      || !['emoji', 'image', 'kaomoji'].includes(segment.expressionKind)
    ) continue;
    if (segment.expressionKind === 'image' && typeof segment.assetId !== 'string') continue;
    if (segment.expressionKind !== 'image' && typeof segment.value !== 'string') continue;
    normalized.push({ ...segment });
  }
  return normalized;
}

function normalizeChatMessage(message: ChatMessage, fallbackTimestamp = Date.now()): ChatMessage {
  const createdAt = Number.isFinite(message.createdAt)
    ? Math.max(0, Math.trunc(Number(message.createdAt)))
    : fallbackTimestamp;
  const attachments = normalizeChatImageAttachments(message.attachments);
  const content = normalizeChatContent(message.content);

  return {
    ...message,
    attachments: attachments.length > 0 ? attachments : undefined,
    content: content.length > 0 ? content : undefined,
    createdAt,
  };
}

// Old messages are never dropped by age; they move to the chat archive once the
// role's conversation summary covers them (see src/character-memory).
function normalizeChatMessages(messages: ChatMessage[], now = Date.now()) {
  return messages.map((message) => normalizeChatMessage(message, now));
}

function resolveModelMessagePetId(message: ChatMessage) {
  if (message.storyMessageKind === 'narration') {
    return null;
  }

  return message.petId ?? DEFAULT_CHAT_ACTIVE_PET_ID;
}

function deriveLatestPetMessages(messages: ChatMessage[]) {
  return messages.reduce<Record<string, string>>((latestMessages, message) => {
    if (message.role !== 'model') {
      return latestMessages;
    }

    const petId = resolveModelMessagePetId(message);
    if (petId) {
      latestMessages[petId] = message.text;
    }
    return latestMessages;
  }, {});
}

function deriveLatestPetMessage(
  messages: ChatMessage[],
  activePetId: string,
  latestPetMessages = deriveLatestPetMessages(messages),
) {
  if (latestPetMessages[activePetId]) {
    return latestPetMessages[activePetId];
  }

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === 'model') {
      return messages[index]?.text ?? '';
    }
  }

  return '';
}

function createDesktopPetChatStore() {
  let state: DesktopPetChatState = {
    ...DEFAULT_DESKTOP_PET_CHAT_STATE,
    storyLibrary: loadStoryLibrary(),
  };
  let animationToolTriggerToken = 0;
  const listeners = new Set<Listener>();

  const emitChange = () => {
    listeners.forEach((listener) => listener());
  };

  const setState = (
    nextStateOrUpdater:
      | DesktopPetChatState
      | ((currentState: DesktopPetChatState) => DesktopPetChatState),
  ) => {
    const nextState = typeof nextStateOrUpdater === 'function'
      ? nextStateOrUpdater(state)
      : nextStateOrUpdater;

    if (nextState === state) {
      return;
    }

    state = nextState;
    emitChange();
  };

  const queueAnimationToolControlTrigger = (
    petId: string,
    control: DesktopPetAnimationToolTrigger['control'],
    status?: DesktopPetAnimationToolPerformanceState['status'],
    seekPositionMs?: number,
  ) => {
    if (!petId || !control) {
      return;
    }

    animationToolTriggerToken += 1;
    setState((currentState) => ({
      ...currentState,
      ...(status ? {
        animationToolPerformanceByPetId: {
          ...currentState.animationToolPerformanceByPetId,
          [petId]: {
            itemCount: control === 'stop'
              ? 0
              : currentState.animationToolPerformanceByPetId[petId]?.itemCount ?? 0,
            petId,
            status,
            token: animationToolTriggerToken,
            triggerKind: currentState.animationToolPerformanceByPetId[petId]?.triggerKind,
            updatedAt: Date.now(),
          },
        },
      } : {}),
      animationToolTriggersByPetId: {
        ...currentState.animationToolTriggersByPetId,
        [petId]: {
          animationIds: [],
          control,
          ...(control === 'seek' && Number.isFinite(Number(seekPositionMs))
            ? { seekPositionMs: Math.max(0, Math.round(Number(seekPositionMs))) }
            : {}),
          source: 'user-direct',
          token: animationToolTriggerToken,
        },
      },
    }));
  };

  return {
    subscribe(listener: Listener) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
    getState() {
      return state;
    },
    reset() {
      setState(DEFAULT_DESKTOP_PET_CHAT_STATE);
    },
    setInputValue(inputValue: string) {
      setState((currentState) => (
        currentState.inputValue === inputValue
          ? currentState
          : { ...currentState, inputValue }
      ));
    },
    setGroupChatRunning(isGroupChatRunning: boolean) {
      setState((currentState) => (
        currentState.isGroupChatRunning === isGroupChatRunning
          ? currentState
          : { ...currentState, isGroupChatRunning }
      ));
    },
    setGroupUserAttention(groupUserAttention: DesktopPetChatState['groupUserAttention']) {
      setState((currentState) => (
        currentState.groupUserAttention === groupUserAttention
          ? currentState
          : { ...currentState, groupUserAttention }
      ));
    },
    resolveGroupUserAttention() {
      setState((currentState) => {
        const attention = currentState.groupUserAttention;
        if (!attention) {
          return currentState;
        }
        return {
          ...currentState,
          groupUserAttention: null,
          groupUserAttentionHandledMessageKey: attention.sourceMessageKey,
        };
      });
    },
    setGroupChatContinuationMode(groupChatContinuationMode: DesktopPetGroupChatContinuationMode) {
      setState((currentState) => (
        currentState.groupChatContinuationMode === groupChatContinuationMode
          ? currentState
          : { ...currentState, groupChatContinuationMode }
      ));
    },
    rememberGroupPetAliases(aliasesById: Record<string, string[]>) {
      setState((currentState) => {
        const nextAliasesById = { ...currentState.groupPetAliasesById };
        let changed = false;
        Object.entries(aliasesById).forEach(([petId, aliases]) => {
          const currentAliases = nextAliasesById[petId] ?? [];
          const nextAliases = Array.from(new Set([
            ...currentAliases,
            ...aliases.map((alias) => alias.trim()).filter((alias) => alias.length >= 2),
          ])).slice(-8);
          if (nextAliases.length !== currentAliases.length || nextAliases.some((alias, index) => alias !== currentAliases[index])) {
            nextAliasesById[petId] = nextAliases;
            changed = true;
          }
        });
        return changed ? { ...currentState, groupPetAliasesById: nextAliasesById } : currentState;
      });
    },
    setListening(isListening: boolean) {
      setState((currentState) => (
        currentState.isListening === isListening
          ? currentState
          : { ...currentState, isListening }
      ));
    },
    setSpeaking(isSpeaking: boolean) {
      setState((currentState) => (
        currentState.isSpeaking === isSpeaking
          ? currentState
          : { ...currentState, isSpeaking }
      ));
    },
    setSpeakingPetId(speakingPetId: string | null) {
      setState((currentState) => (
        currentState.speakingPetId === speakingPetId
          ? currentState
          : { ...currentState, speakingPetId }
      ));
    },
    setSpeechExpressionAction(
      petId: string | null | undefined,
      action: DesktopPetSpeechExpressionAction | null | undefined,
    ) {
      const normalizedPetId = petId?.trim();
      if (!normalizedPetId) {
        return;
      }

      setState((currentState) => {
        const currentAction = currentState.speechExpressionActionByPetId[normalizedPetId] ?? null;
        const nextAction = action ?? null;
        if (currentAction === nextAction) {
          return currentState;
        }

        return {
          ...currentState,
          speechExpressionActionByPetId: {
            ...currentState.speechExpressionActionByPetId,
            [normalizedPetId]: nextAction ?? undefined,
          },
        };
      });
    },
    setTyping(isTyping: boolean) {
      setState((currentState) => (
        currentState.isTyping === isTyping
          ? currentState
          : { ...currentState, isTyping }
      ));
    },
    setTypingPetId(typingPetId: string | null) {
      setState((currentState) => (
        currentState.typingPetId === typingPetId
          ? currentState
          : { ...currentState, typingPetId }
      ));
    },
    setChatMode(chatMode: DesktopPetChatMode) {
      setState((currentState) => (
        currentState.chatMode === chatMode
          ? currentState
          : { ...currentState, chatMode }
      ));
    },
    setStorySession(storySession: StorySessionState | null) {
      if (storySession) saveStorySessionSnapshot(storySession);
      setState((currentState) => ({ ...currentState, storySession }));
    },
    startStorySession(definition: StoryDefinition) {
      const storedSession = loadStorySessionSnapshot(definition.id);
      const storySession = restoreStorySession(definition, storedSession);
      saveStorySessionSnapshot(storySession);
      setState((currentState) => {
        const storyLibrary = saveStoryToLibrary(currentState.storyLibrary, definition);
        return {
          ...currentState,
          storyLibrary,
          storySession,
        };
      });
    },
    deleteStory(storyId: string) {
      if (!storyId.trim()) return;
      setState((currentState) => {
        const nextMessages = currentState.messages.filter((message) => message.storyId !== storyId);
        const nextLatestPetMessages = deriveLatestPetMessages(nextMessages);
        return {
          ...currentState,
          latestPetMessage: deriveLatestPetMessage(
            nextMessages,
            currentState.activePetId,
            nextLatestPetMessages,
          ),
          latestPetMessages: nextLatestPetMessages,
          messages: nextMessages,
          storyLibrary: deleteStoryFromLibrary(currentState.storyLibrary, storyId),
          storySession: currentState.storySession?.definition.id === storyId
            ? null : currentState.storySession,
        };
      });
    },
    updateStoryScene(currentScene: string) {
      setState((currentState) => {
        if (!currentState.storySession || !currentScene.trim()) return currentState;
        return {
          ...currentState,
          storySession: {
            ...currentState.storySession,
            currentScene: currentScene.trim().slice(0, 2400),
          },
        };
      });
    },
    advanceStoryTurn(eventText = '') {
      setState((currentState) => {
        const session = currentState.storySession;
        if (!session || session.status !== 'active') return currentState;
        const recentEvents = eventText.trim()
          ? [...session.recentEvents, eventText.trim()].slice(-12)
          : session.recentEvents;
        const nextSession = {
          ...session,
          currentTurn: session.currentTurn + 1,
          recentEvents,
        };
        saveStorySessionSnapshot(nextSession);
        return {
          ...currentState,
          storySession: nextSession,
        };
      });
    },
    applyStoryTurnPlan(plan: StoryTurnPlan) {
      setState((currentState) => {
        const session = currentState.storySession;
        if (!session || session.status !== 'active') return currentState;
        const nextSession = applyStoryTurnPlan(session, plan);
        saveStorySessionSnapshot(nextSession);
        return { ...currentState, storySession: nextSession };
      });
    },
    setActivePetId(activePetId: string) {
      setState((currentState) => {
        if (currentState.activePetId === activePetId) {
          return currentState;
        }

        return {
          ...currentState,
          activePetId,
          latestPetMessage: deriveLatestPetMessage(
            currentState.messages,
            activePetId,
            currentState.latestPetMessages,
          ),
        };
      });
    },
    removePetRuntimeState(petId: string, fallbackPetId = DEFAULT_CHAT_ACTIVE_PET_ID) {
      if (!petId || petId === DEFAULT_CHAT_ACTIVE_PET_ID) {
        return;
      }

      setState((currentState) => {
        const removeKey = <T,>(values: Record<string, T | undefined>) => {
          if (!(petId in values)) return values;
          const nextValues = { ...values };
          delete nextValues[petId];
          return nextValues;
        };
        const speakingPetId = currentState.speakingPetId === petId ? null : currentState.speakingPetId;
        const typingPetId = currentState.typingPetId === petId ? null : currentState.typingPetId;
        const groupUserAttention = currentState.groupUserAttention?.roleId === petId
          ? null : currentState.groupUserAttention;
        const activePetId = currentState.activePetId === petId
          ? fallbackPetId : currentState.activePetId;

        return {
          ...currentState,
          activePetId,
          animationToolAudioPlaybackByPetId: removeKey(currentState.animationToolAudioPlaybackByPetId),
          animationToolPerformanceByPetId: removeKey(currentState.animationToolPerformanceByPetId),
          animationToolTriggersByPetId: removeKey(currentState.animationToolTriggersByPetId),
          groupPetAliasesById: removeKey(currentState.groupPetAliasesById),
          groupUserAttention,
          isGroupChatRunning: groupUserAttention ? currentState.isGroupChatRunning : false,
          isSpeaking: speakingPetId ? currentState.isSpeaking : false,
          isTyping: typingPetId ? currentState.isTyping : false,
          lastReplayableAnimationToolTriggersByPetId: removeKey(currentState.lastReplayableAnimationToolTriggersByPetId),
          latestPetMessage: deriveLatestPetMessage(currentState.messages, activePetId, removeKey(currentState.latestPetMessages)),
          latestPetMessages: removeKey(currentState.latestPetMessages),
          speakingPetId,
          speechExpressionActionByPetId: removeKey(currentState.speechExpressionActionByPetId),
          typingPetId,
        };
      });
    },
    setStatusMessage(statusMessage: string) {
      setState((currentState) => (
        currentState.statusMessage === statusMessage
          ? currentState
          : { ...currentState, statusMessage }
      ));
    },
    setWebSearchStatusMessage(webSearchStatusMessage: string) {
      setState((currentState) => (
        currentState.webSearchStatusMessage === webSearchStatusMessage
          ? currentState
          : { ...currentState, webSearchStatusMessage }
      ));
    },
    setAnimationToolAudioPlaybackState(
      petId: string,
      playbackState: DesktopPetAnimationToolAudioPlaybackState | null,
    ) {
      if (!petId) {
        return;
      }

      setState((currentState) => ({
        ...currentState,
        animationToolAudioPlaybackByPetId: {
          ...currentState.animationToolAudioPlaybackByPetId,
          [petId]: playbackState ?? undefined,
        },
      }));
    },
    setAnimationToolPerformanceState(
      petId: string,
      performanceState: DesktopPetAnimationToolPerformanceState | null,
    ) {
      if (!petId) {
        return;
      }

      setState((currentState) => ({
        ...currentState,
        animationToolPerformanceByPetId: {
          ...currentState.animationToolPerformanceByPetId,
          [petId]: performanceState ?? undefined,
        },
      }));
    },
    queueAnimationToolTrigger(
      petId: string,
      animationIds: string[],
      source: DesktopPetAnimationToolTrigger['source'] = 'user-direct',
      schedule?: DesktopPetAnimationToolTriggerScheduleItem[] | null,
      audio?: DesktopPetAnimationToolTriggerAudio | null,
    ) {
      const nextAnimationIds = normalizeAnimationToolTriggerIds(animationIds);
      if (!petId || nextAnimationIds.length === 0) {
        return;
      }
      const nextSchedule = normalizeAnimationToolTriggerSchedule(nextAnimationIds, schedule);
      const nextAudio = normalizeAnimationToolTriggerAudio(audio);

      animationToolTriggerToken += 1;
      const nextTrigger: DesktopPetAnimationToolTrigger = {
        ...(nextAudio ? { audio: nextAudio } : {}),
        animationIds: nextAnimationIds,
        ...(nextSchedule ? { schedule: nextSchedule } : {}),
        source,
        token: animationToolTriggerToken,
      };
      setState((currentState) => ({
        ...currentState,
        animationToolTriggersByPetId: {
          ...currentState.animationToolTriggersByPetId,
          [petId]: nextTrigger,
        },
        lastReplayableAnimationToolTriggersByPetId: {
          ...currentState.lastReplayableAnimationToolTriggersByPetId,
          [petId]: nextTrigger,
        },
      }));
    },
    replayAnimationToolTrigger(petId: string) {
      const replayableTrigger = state.lastReplayableAnimationToolTriggersByPetId[petId];
      if (!petId || !isReplayableAnimationToolTrigger(replayableTrigger)) {
        return;
      }

      animationToolTriggerToken += 1;
      const nextTrigger = cloneReplayableAnimationToolTrigger(
        replayableTrigger,
        animationToolTriggerToken,
      );
      setState((currentState) => ({
        ...currentState,
        animationToolTriggersByPetId: {
          ...currentState.animationToolTriggersByPetId,
          [petId]: nextTrigger,
        },
        lastReplayableAnimationToolTriggersByPetId: {
          ...currentState.lastReplayableAnimationToolTriggersByPetId,
          [petId]: nextTrigger,
        },
      }));
    },
    stopAnimationToolTrigger(petId: string) {
      queueAnimationToolControlTrigger(petId, 'stop', 'cancelled');
    },
    pauseAnimationToolTrigger(petId: string) {
      queueAnimationToolControlTrigger(petId, 'pause');
    },
    seekAnimationToolTrigger(petId: string, positionMs: number) {
      queueAnimationToolControlTrigger(
        petId,
        'seek',
        undefined,
        Math.max(0, Math.round(Number(positionMs) || 0)),
      );
    },
    resumeAnimationToolTrigger(petId: string) {
      queueAnimationToolControlTrigger(petId, 'resume');
    },
    addMessage(message: ChatMessage) {
      setState((currentState) => {
        const now = Date.now();
        const normalizedMessage = normalizeChatMessage(message, now);
        const nextMessages = [
          ...normalizeChatMessages(currentState.messages, now),
          normalizedMessage,
        ];
        const nextLatestPetMessages = deriveLatestPetMessages(nextMessages);

        return {
          ...currentState,
          messages: nextMessages,
          latestPetMessages: nextLatestPetMessages,
          latestPetMessage: deriveLatestPetMessage(
            nextMessages,
            currentState.activePetId,
            nextLatestPetMessages,
          ),
        };
      });
    },
    updateMessageText(messageId: string, text: string) {
      setState((currentState) => {
        const targetIndex = currentState.messages.findIndex((message) => message.id === messageId);
        if (targetIndex < 0) {
          return currentState;
        }

        const currentMessage = currentState.messages[targetIndex];
        if (!currentMessage || currentMessage.text === text) {
          return currentState;
        }

        const nextMessages = [...currentState.messages];
        nextMessages[targetIndex] = {
          ...currentMessage,
          text,
        };

        const modelPetId = currentMessage.role === 'model'
          ? resolveModelMessagePetId(currentMessage)
          : null;
        let nextLatestPetMessages = currentState.latestPetMessages;
        if (modelPetId) {
          let latestModelIndex = -1;
          for (let index = nextMessages.length - 1; index >= 0; index -= 1) {
            const candidate = nextMessages[index];
            if (
              candidate.role === 'model'
              && resolveModelMessagePetId(candidate) === modelPetId
            ) {
              latestModelIndex = index;
              break;
            }
          }
          if (latestModelIndex === targetIndex) {
            nextLatestPetMessages = {
              ...currentState.latestPetMessages,
              [modelPetId]: text,
            };
          }
        }

        return {
          ...currentState,
          messages: nextMessages,
          latestPetMessages: nextLatestPetMessages,
          latestPetMessage: deriveLatestPetMessage(
            nextMessages,
            currentState.activePetId,
            nextLatestPetMessages,
          ),
        };
      });
    },
    updateMessage(messageId: string, updater: (message: ChatMessage) => ChatMessage) {
      setState((currentState) => {
        const targetIndex = currentState.messages.findIndex((message) => message.id === messageId);
        if (targetIndex < 0) {
          return currentState;
        }

        const currentMessage = currentState.messages[targetIndex];
        if (!currentMessage) {
          return currentState;
        }

        const nextMessage = normalizeChatMessage(updater(currentMessage), currentMessage.createdAt ?? Date.now());
        if (nextMessage === currentMessage) {
          return currentState;
        }

        const nextMessages = [...currentState.messages];
        nextMessages[targetIndex] = nextMessage;
        const nextLatestPetMessages = deriveLatestPetMessages(nextMessages);

        return {
          ...currentState,
          messages: nextMessages,
          latestPetMessages: nextLatestPetMessages,
          latestPetMessage: deriveLatestPetMessage(
            nextMessages,
            currentState.activePetId,
            nextLatestPetMessages,
          ),
        };
      });
    },
    removeMessage(messageId: string) {
      setState((currentState) => {
        const nextMessages = currentState.messages.filter((message) => message.id !== messageId);
        if (nextMessages.length === currentState.messages.length) {
          return currentState;
        }

        const nextLatestPetMessages = deriveLatestPetMessages(nextMessages);

        return {
          ...currentState,
          messages: nextMessages,
          latestPetMessages: nextLatestPetMessages,
          latestPetMessage: deriveLatestPetMessage(
            nextMessages,
            currentState.activePetId,
            nextLatestPetMessages,
          ),
        };
      });
    },
    replaceMessages(messages: ChatMessage[]) {
      const nextMessages = Array.isArray(messages)
        ? normalizeChatMessages(messages)
        : [];
      const nextLatestPetMessages = deriveLatestPetMessages(nextMessages);

      setState((currentState) => ({
        ...currentState,
        messages: nextMessages,
        latestPetMessages: nextLatestPetMessages,
        latestPetMessage: deriveLatestPetMessage(
          nextMessages,
          currentState.activePetId,
          nextLatestPetMessages,
        ),
      }));
    },
  };
}

export const desktopPetChatStore = createDesktopPetChatStore();

export function useDesktopPetChatStore() {
  return useSyncExternalStore(
    desktopPetChatStore.subscribe,
    desktopPetChatStore.getState,
    desktopPetChatStore.getState,
  );
}
