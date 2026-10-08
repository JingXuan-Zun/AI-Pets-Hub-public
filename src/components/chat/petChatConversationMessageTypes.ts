import { type RefObject } from 'react';
import { type DesktopPetChatSendOptions } from '../../chatState';
import { type ChatAgentApprovalDecision, type ChatMessage, type DesktopPetChatMode, type PetConfig } from '../../types';
import { type ChatMemorySaveHandler } from './chatMemorySaveUtils';
import { type ChatTargetOption } from './multiPetChat';
import type { StorySessionState } from './story/storyTypes';

export interface PetChatConversationMessagesProps {
  activePetId: string;
  activePetName: string;
  chatMode: DesktopPetChatMode;
  chatBracketOuterTextColor: string;
  isInteractiveDialogue?: boolean;
  /** The host window paints the chat background behind all chrome; skip it here. */
  hoistBackground?: boolean;
  config: PetConfig;
  greeting: string;
  isListening: boolean;
  isSpeaking: boolean;
  isTyping: boolean;
  messages: ChatMessage[];
  onPlayMessageVoice?: (text: string) => void | Promise<void>;
  onResolveAgentApproval?: (messageId: string, decision: ChatAgentApprovalDecision) => void | Promise<void>;
  onSaveMessageToMemory?: ChatMemorySaveHandler;
  onChooseStoryAction: (action: string) => void;
  onSendMessage: (
    textOverride?: string,
    options?: DesktopPetChatSendOptions,
  ) => void | Promise<void>;
  onStopAgentRun?: (messageId?: string | null) => void;
  petOptions: ChatTargetOption[];
  scrollRegionRef: RefObject<HTMLDivElement | null>;
  showStatusMessage: boolean;
  speakingPetId: string | null;
  storySession: StorySessionState | null;
  statusMessage: string;
  typingPetName?: string | null;
}
