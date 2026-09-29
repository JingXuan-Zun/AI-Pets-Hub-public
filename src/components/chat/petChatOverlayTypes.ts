import { type DesktopPetChatSendOptions, type DesktopPetGroupChatContinuationMode, type GroupUserAttention, type GroupUserAttentionDecision } from '../../chatState';
import { type ChatAgentApprovalDecision, type ChatMessage, type DesktopPetChatMode, type PetConfig, type PetConfigUpdateHandler } from '../../types';
import { type ChatMemorySaveHandler } from './chatMemorySaveUtils';
import {
  type EmbeddedPetChatPanelDragHandler,
  type EmbeddedPetChatPanelOffset,
  type EmbeddedPetChatPanelPosition,
  type EmbeddedPetChatPanelResizeHandler,
  type EmbeddedPetChatPanelSize,
} from './embeddedPetChatPanelTypes';
import { type ChatTargetOption } from './multiPetChat';

export interface PetChatOverlayBubbleProps {
  chatBracketOuterTextColor: string;
  chatBubbleEnabled: boolean;
  isPrimaryTyping: boolean;
  latestPetMessage: string;
  petAnchorPosition: { x: number; y: number };
  petVisualBounds: { top: number };
  webSearchStatusMessage?: string;
}

export interface PetChatOverlayProps {
  activePetId: string;
  chatBracketOuterTextColor: string;
  chatBubbleEnabled: boolean;
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
  isPrimaryTyping: boolean;
  latestPetMessage: string;
  messages: ChatMessage[];
  panelOffset: EmbeddedPetChatPanelOffset;
  panelPosition: EmbeddedPetChatPanelPosition;
  panelSize: EmbeddedPetChatPanelSize;
  petAnchorPosition: { x: number; y: number };
  petVisualBounds: { top: number };
  petOptions: ChatTargetOption[];
  personalityName: string;
  showEmbeddedPanel: boolean;
  speakingPetId: string | null;
  typingPetName?: string | null;
  webSearchStatusMessage?: string;
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
