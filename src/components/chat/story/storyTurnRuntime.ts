import { desktopPetChatStore } from '../../../chatStore';
import { pushFrontendRuntimeLog } from '../../../frontendRuntimeLogger';
import type { PreparedChatSendRequest } from '../chatMessageSendFlowTypes';
import type { ChatSendTargetSlot } from '../chatMessageSendUtils';
import { createChatMessageId } from '../chatTargetResolutionUtils';
import {
  createSafeStoryTurnPlan,
  generateStoryTurnPlan,
} from './storyTurnDirector';
import {
  buildFallbackStoryNarration,
  generateStoryNarration,
  type StoryNarratorParticipantProfile,
} from './storyNarrator';
import type { StoryParticipantOption, StorySessionState, StoryTurnPlan } from './storyTypes';

function createParticipantOptions(targetSlots: ChatSendTargetSlot[]): StoryParticipantOption[] {
  return targetSlots.map((slot) => ({ id: slot.id, name: slot.personality.name }));
}

function createNarratorProfiles(targetSlots: ChatSendTargetSlot[]): StoryNarratorParticipantProfile[] {
  return targetSlots.map((slot) => ({
    id: slot.id,
    name: slot.personality.name,
    systemInstruction: slot.personality.systemInstruction,
    traits: slot.personality.traits,
  }));
}

function logDirectorFallback(session: StorySessionState, error: unknown) {
  pushFrontendRuntimeLog('chat', 'story director failed; using safe single-speaker plan', {
    error: error instanceof Error ? error.message : String(error),
    storyId: session.definition.id,
  });
}

async function resolveStoryPlan(options: {
  historyMessages: PreparedChatSendRequest['currentChatState']['messages'];
  participants: StoryParticipantOption[];
  session: StorySessionState;
  settings: PreparedChatSendRequest['currentConfig']['settings'];
  userInput: string;
}) {
  try {
    return await generateStoryTurnPlan(options);
  } catch (error) {
    logDirectorFallback(options.session, error);
    return createSafeStoryTurnPlan(options.session, options.userInput);
  }
}

export async function prepareStoryTurnRuntime(options: {
  activeChatRequestTokenRef: { current: number };
  preparedRequest: PreparedChatSendRequest;
  targetSlots: ChatSendTargetSlot[];
}) {
  const session = desktopPetChatStore.getState().storySession;
  if (!session) {
    pushFrontendRuntimeLog('chat', 'story turn skipped: missing active session', {
      requestToken: options.preparedRequest.requestToken,
      storyMode: options.preparedRequest.currentChatState.chatMode === 'story',
    });
    return null;
  }
  if (options.preparedRequest.currentChatState.chatMode !== 'story') return null;
  if (options.preparedRequest.requestToken !== options.activeChatRequestTokenRef.current) return null;
  const plan = await resolveStoryPlan({
    historyMessages: desktopPetChatStore.getState().messages,
    participants: createParticipantOptions(options.targetSlots),
    session,
    settings: options.preparedRequest.currentConfig.settings,
    userInput: options.preparedRequest.outgoingText,
  });
  if (options.preparedRequest.requestToken !== options.activeChatRequestTokenRef.current) return null;
  desktopPetChatStore.applyStoryTurnPlan(plan);
  return {
    participants: createNarratorProfiles(options.targetSlots),
    plan,
    session: desktopPetChatStore.getState().storySession ?? session,
  };
}

function addNarrationMessage(session: StorySessionState, narrationText: string, messageId = createChatMessageId('story-narration')) {
  desktopPetChatStore.addMessage({
    chatMode: 'story',
    id: messageId,
    petId: null,
    petName: '旁白',
    role: 'model',
    storyId: session.definition.id,
    storyMessageKind: 'narration',
    text: narrationText,
  });
}

function createNarrationPublisher(options: {
  activeChatRequestTokenRef: { current: number };
  controller: AbortController;
  messageId: string;
  narrationState: { published: boolean; text: string };
  preparedRequest: PreparedChatSendRequest;
  session: StorySessionState;
}) {
  const isCurrent = () => options.preparedRequest.requestToken === options.activeChatRequestTokenRef.current
    && desktopPetChatStore.getState().storySession?.definition.id === options.session.definition.id;
  const publish = (text: string) => {
    if (!isCurrent() || !text.trim()) return;
    options.narrationState.text = text;
    if (options.narrationState.published) desktopPetChatStore.updateMessageText(options.messageId, text);
    else { addNarrationMessage(options.session, text, options.messageId); options.narrationState.published = true; }
  };
  const poll = setInterval(() => { if (!isCurrent()) options.controller.abort(); }, 100);
  return { isCurrent, poll, publish };
}

export async function runStoryNarratorTurn(options: {
  activeChatRequestTokenRef: { current: number };
  participants: StoryNarratorParticipantProfile[];
  plan: StoryTurnPlan;
  preparedRequest: PreparedChatSendRequest;
  session: StorySessionState;
}) {
  if (options.preparedRequest.requestToken !== options.activeChatRequestTokenRef.current) return false;
  const narrationState = { published: false, text: '' };
  const messageId = createChatMessageId('story-narration');
  const controller = new AbortController();
  const { isCurrent, poll, publish } = createNarrationPublisher({
    activeChatRequestTokenRef: options.activeChatRequestTokenRef,
    controller, messageId, narrationState, preparedRequest: options.preparedRequest, session: options.session,
  });
  try {
    narrationState.text = await generateStoryNarration({
      historyMessages: desktopPetChatStore.getState().messages,
      participants: options.participants,
      session: options.session,
      settings: options.preparedRequest.currentConfig.settings,
      turnPlan: options.plan,
      userInput: options.preparedRequest.outgoingText,
      signal: controller.signal,
      onText: publish,
    });
  } catch (error) {
    pushFrontendRuntimeLog('chat', 'story narration failed; continuing character turn', {
      error: error instanceof Error ? error.message : String(error),
      storyId: options.session.definition.id,
    });
    if (narrationState.published && isCurrent()) publish(`${narrationState.text}\n\n（本次生成中断，已保留收到的内容，请重试。）`);
  } finally { clearInterval(poll); controller.abort(); }
  if (!isCurrent()) return false;
  const visibleText = narrationState.text.trim() || buildFallbackStoryNarration(
    options.plan,
    options.session,
    {
      participants: options.participants,
      userInput: options.preparedRequest.outgoingText,
    },
  );
  publish(visibleText);
  return true;
}
