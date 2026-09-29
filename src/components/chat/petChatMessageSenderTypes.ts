import type { MutableRefObject } from 'react';
import type { AgentChatCommandHandler } from '../../agent';
import type { PetConfig, PetConfigUpdateHandler } from '../../types';
import type { VoiceInputSession } from '../../voice/types';
import type { PlayVoiceTextOptions } from './chatVoicePlaybackTypes';
import type { PrivateChatResetScope } from './chatSessionControlUtils';
import type { ChatSendTargetSlot } from './chatMessageSendUtils';
import type { ActiveGroupRuntimeRef } from './group/runtime/activeGroupRuntimeRef';
import type { GroupRoleTurnOutput } from './group/role/groupRoleTurnOutput';
import type { GroupChatInteractionPlan } from './chatGroupInteractionPlanner';

export interface UsePetChatMessageSenderOptions {
  activeGroupRuntimeRef: ActiveGroupRuntimeRef;
  activeChatRequestTokenRef: MutableRefObject<number>;
  configRef: MutableRefObject<PetConfig>;
  getPlaybackToken: () => number;
  groupChatContinuationEnabledRef: MutableRefObject<boolean>;
  onUpdateConfig: PetConfigUpdateHandler;
  playVoiceText: (text: string, options?: PlayVoiceTextOptions) => Promise<void>;
  resetChatSession: (scope: PrivateChatResetScope) => void;
  runPetResponseTurn: (
    targetSlot: ChatSendTargetSlot,
    options: {
      chatMode: import('../../types').DesktopPetChatMode;
      historyMessages: import('../../types').ChatMessage[];
      participantNames: string[];
      promptText: string;
      shouldAutoSpeakReply: boolean;
      playbackToken: number;
      requestToken: number;
      browserSearchMode?: 'allow' | 'block' | 'force';
      groupInteractionPlan?: GroupChatInteractionPlan;
    },
  ) => Promise<{ cancelled: boolean; finalResponse: string; groupRoleTurnOutput?: GroupRoleTurnOutput }>;
  stopGroupChat: (options?: { immediate?: boolean; announce?: boolean }) => void;
  stopPetSpeech: () => void;
  onAgentChatCommand?: AgentChatCommandHandler;
  voiceInputSessionRef: MutableRefObject<VoiceInputSession | null>;
  voiceTranscriptRef: MutableRefObject<string>;
  warmLocalReplyVoice: (settings: PetConfig['settings']) => void;
}
