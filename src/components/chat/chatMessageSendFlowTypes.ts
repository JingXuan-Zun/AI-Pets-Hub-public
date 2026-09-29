import { type DesktopPetChatState } from '../../chatState';
import {
  type ChatMessage,
  type ChatMessageImageAttachment,
  type PetConfig,
  type PetConfigUpdateHandler,
} from '../../types';
import { type GroupChatInteractionPlan } from './chatGroupInteractionPlanner';
import type { ActiveGroupRuntimeRef } from './group/runtime/activeGroupRuntimeRef';
import type { GroupRoleTurnOutput } from './group/role/groupRoleTurnOutput';
import type { GroupTaskCandidate } from './group/task/groupTaskBridge';
import type { GroupTaskResultReceipt } from './group/task/groupTaskResultReceipt';
import type { GroupTaskConversationEvent } from './group/task/groupTaskConversationEvent';
import { type ChatSendTargetSlot } from './chatMessageSendUtils';
import type { StoryDefinition } from './story/storyTypes';

export interface PrepareChatSendRequestOptions {
  activeChatRequestTokenRef: { current: number };
  configRef: { current: PetConfig };
  currentChatState: DesktopPetChatState;
  getPlaybackToken: () => number;
  groupChatContinuationEnabledRef: { current: boolean };
  isGroupMode: boolean;
  outgoingText: string;
  outgoingAttachments?: ChatMessageImageAttachment[];
  browserSearchMode?: 'allow' | 'block' | 'force';
  storyDefinition?: StoryDefinition;
  stopGroupChat: (options?: { immediate?: boolean; announce?: boolean }) => void;
  stopPetSpeech: () => void;
  voiceInputSessionRef: { current: { stop: () => void } | null };
  voiceTranscriptRef: { current: string };
}

export interface PreparedChatSendRequest {
  groupTaskCandidate?: GroupTaskCandidate;
  groupTaskResultReceipt?: GroupTaskResultReceipt;
  groupTaskConversationEvent?: GroupTaskConversationEvent;
  currentConfig: PetConfig;
  currentChatState: DesktopPetChatState;
  isGroupMode: boolean;
  promptHistoryMessages: ChatMessage[];
  userMessage: ChatMessage;
  outgoingText: string;
  playbackToken: number;
  requestToken: number;
  browserSearchMode?: 'allow' | 'block' | 'force';
  targetSlots: ChatSendTargetSlot[];
}

export interface RunPreparedChatSendRequestOptions {
  activeGroupRuntimeRef?: ActiveGroupRuntimeRef;
  activeChatRequestTokenRef: { current: number };
  configRef: { current: PetConfig };
  groupChatContinuationEnabledRef: { current: boolean };
  onUpdateConfig: PetConfigUpdateHandler;
  preparedRequest: PreparedChatSendRequest;
  runPetResponseTurn: (
    targetSlot: ChatSendTargetSlot,
    options: {
      chatMode: import('../../types').DesktopPetChatMode;
      historyMessages: ChatMessage[];
      participantNames: string[];
      promptText: string;
      shouldAutoSpeakReply: boolean;
      playbackToken: number;
      requestToken: number;
      userAttachments?: ChatMessageImageAttachment[];
      userAnimationIntentText?: string;
      browserSearchMode?: 'allow' | 'block' | 'force';
      groupInteractionPlan?: GroupChatInteractionPlan;
    },
  ) => Promise<{
    cancelled: boolean;
    finalResponse: string;
    groupRoleTurnOutput?: GroupRoleTurnOutput;
  }>;
  warmLocalReplyVoice: (settings: PetConfig['settings']) => void;
}
