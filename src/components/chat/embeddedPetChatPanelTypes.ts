import { type PointerEvent as ReactPointerEvent } from 'react';
import { type DesktopPetChatSendOptions, type DesktopPetGroupChatContinuationMode, type GroupUserAttention, type GroupUserAttentionDecision } from '../../chatState';
import { type ChatAgentApprovalDecision, type ChatMessage, type DesktopPetChatMode, type PetConfig, type PetConfigUpdateHandler } from '../../types';
import { type ChatMemorySaveHandler } from './chatMemorySaveUtils';
import { type ChatTargetOption } from './multiPetChat';

export type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export type EmbeddedPetChatPanelDragHandler = (
  event: ReactPointerEvent<HTMLElement>,
  options?: { allowControl?: boolean },
) => void;

export type EmbeddedPetChatPanelResizeHandler = (
  event: ReactPointerEvent<HTMLDivElement>,
  direction: ResizeDirection,
) => void;

export interface EmbeddedPetChatPanelOffset {
  x: number;
  y: number;
}

export interface EmbeddedPetChatPanelPosition {
  x: number;
  y: number;
}

export interface EmbeddedPetChatPanelSize {
  width: number;
  height: number;
}

export interface EmbeddedPetChatPanelProps {
  activePetId: string;
  chatBracketOuterTextColor: string;
  chatMode: DesktopPetChatMode;
  dragDisabled: boolean;
  config: PetConfig;
  greeting: string;
  groupChatContinuationMode: DesktopPetGroupChatContinuationMode;
  groupUserAttention: GroupUserAttention | null;
  inputValue: string;
  isDragging: boolean;
  isInteractiveDialogue: boolean;
  isGroupChatRunning: boolean;
  isListening: boolean;
  isOpen: boolean;
  isSpeaking: boolean;
  isTyping: boolean;
  messages: ChatMessage[];
  offset: EmbeddedPetChatPanelOffset;
  petOptions: ChatTargetOption[];
  personalityName: string;
  position: EmbeddedPetChatPanelPosition;
  size: EmbeddedPetChatPanelSize;
  speakingPetId: string | null;
  typingPetName?: string | null;
  voiceEnabled: boolean;
  voiceInputEnabled: boolean;
  onClose: () => void;
  onActivePetChange: (petId: string) => void;
  onChatModeChange: (mode: DesktopPetChatMode) => void;
  onInputChange: (value: string) => void;
  onPlayMessageVoice: (text: string) => Promise<void>;
  onResolveAgentApproval: (messageId: string, decision: ChatAgentApprovalDecision) => void | Promise<void>;
  onResolveGroupUserAttention: (decision: GroupUserAttentionDecision, text?: string) => void | Promise<void>;
  onSaveMessageToMemory?: ChatMemorySaveHandler;
  onSendMessage: (
    textOverride?: string,
    options?: DesktopPetChatSendOptions,
  ) => void;
  onStopAgentRun: (messageId?: string | null) => void;
  onStopGroupChat: () => void;
  onGroupChatContinuationModeChange: (mode: DesktopPetGroupChatContinuationMode) => void;
  onStartDrag: EmbeddedPetChatPanelDragHandler;
  onStartResize: EmbeddedPetChatPanelResizeHandler;
  onUpdateConfig?: PetConfigUpdateHandler;
  onToggleVoiceEnabled: () => void;
  onToggleVoiceInput: () => void;
}
