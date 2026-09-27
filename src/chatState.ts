import {
  type ChatAgentApprovalDecision,
  type ChatAgentFollowUpAction,
  type ChatMessage,
  type ChatMessageImageAttachment,
  type DesktopPetChatMode,
} from './types';
import type { StoryDefinition, StorySessionState } from './components/chat/story/storyTypes';

export const DEFAULT_CHAT_ACTIVE_PET_ID = 'primary';
export const DEFAULT_CHAT_MODE: DesktopPetChatMode = 'single';
export type DesktopPetGroupChatContinuationMode = 'single-round' | 'infinite';
export type GroupUserAttentionDecision = 'continue' | 'interject';
export type GroupUserAttention = {
  createdAt: number;
  promptText: string;
  roleId: string;
  roleName: string;
  sourceMessageKey: string;
};
export type DesktopPetChatBrowserSearchMode = 'allow' | 'block' | 'force';
export type DesktopPetSpeechExpressionAction = 'EATING' | 'HAPPY' | 'SAD' | 'SLEEPING';
export type DesktopPetChatSendOptions = {
  agentFollowUpAction?: ChatAgentFollowUpAction;
  agentMode?: boolean;
  attachments?: ChatMessageImageAttachment[];
  browserSearchMode?: DesktopPetChatBrowserSearchMode;
  storyDefinition?: StoryDefinition;
};

export type DesktopPetAnimationToolTriggerScheduleItem = {
  animationId: string;
  delayMs: number;
};

export type DesktopPetAnimationToolTriggerAudio = {
  durationMs?: number;
  offsetMs?: number;
  playbackUrl?: string;
  source: 'audio' | 'metadata' | 'music' | 'song';
  sourceRef: string;
  startDelayMs?: number;
};

export type DesktopPetAnimationToolAudioPlaybackStatus =
  | 'cancelled'
  | 'ended'
  | 'failed'
  | 'paused'
  | 'pending'
  | 'playing'
  | 'skipped';

export type DesktopPetAnimationToolTriggerControl = 'pause' | 'play' | 'resume' | 'seek' | 'stop';

export type DesktopPetAnimationToolAudioPlaybackState = {
  durationMs?: number;
  errorMessage?: string;
  petId: string;
  playbackPositionMs?: number;
  playbackUrl?: string;
  resumeSupported?: boolean;
  resumeUnsupportedReason?: string;
  scheduledDelayMs: number;
  source: DesktopPetAnimationToolTriggerAudio['source'];
  sourceRef: string;
  status: DesktopPetAnimationToolAudioPlaybackStatus;
  syncOffsetMs?: number;
  token: number;
  updatedAt: number;
};

export type DesktopPetAnimationToolPerformanceStatus =
  | 'cancelled'
  | 'ended'
  | 'paused'
  | 'playing';

export type DesktopPetAnimationToolPerformanceTriggerKind = 'direct' | 'scheduled';

export type DesktopPetAnimationToolPerformanceState = {
  itemCount: number;
  petId: string;
  status: DesktopPetAnimationToolPerformanceStatus;
  token: number;
  triggerKind?: DesktopPetAnimationToolPerformanceTriggerKind;
  updatedAt: number;
};

export type DesktopPetAnimationToolTrigger = {
  audio?: DesktopPetAnimationToolTriggerAudio;
  animationIds: string[];
  control?: DesktopPetAnimationToolTriggerControl;
  schedule?: DesktopPetAnimationToolTriggerScheduleItem[];
  seekPositionMs?: number;
  source: 'agent-skill' | 'model-expression' | 'model-tool' | 'user-direct' | 'user-semantic';
  token: number;
};

export type DesktopPetChatState = {
  activePetId: string;
  animationToolAudioPlaybackByPetId: Record<string, DesktopPetAnimationToolAudioPlaybackState | undefined>;
  animationToolPerformanceByPetId: Record<string, DesktopPetAnimationToolPerformanceState | undefined>;
  animationToolTriggersByPetId: Record<string, DesktopPetAnimationToolTrigger | undefined>;
  chatMode: DesktopPetChatMode;
  groupChatContinuationMode: DesktopPetGroupChatContinuationMode;
  groupPetAliasesById: Record<string, string[]>;
  groupUserAttention: GroupUserAttention | null;
  groupUserAttentionHandledMessageKey: string | null;
  inputValue: string;
  isGroupChatRunning: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  isTyping: boolean;
  lastReplayableAnimationToolTriggersByPetId: Record<string, DesktopPetAnimationToolTrigger | undefined>;
  latestPetMessage: string;
  latestPetMessages: Record<string, string>;
  messages: ChatMessage[];
  storyLibrary: StoryDefinition[];
  speakingPetId: string | null;
  speechExpressionActionByPetId: Record<string, DesktopPetSpeechExpressionAction | undefined>;
  statusMessage: string;
  storySession: StorySessionState | null;
  typingPetId: string | null;
  webSearchStatusMessage: string;
};

export interface DesktopPetChatController {
  sendMessage: (
    textOverride?: string,
    options?: DesktopPetChatSendOptions,
  ) => Promise<void>;
  playMessageVoice: (text: string) => Promise<void>;
  resolveAgentApproval: (messageId: string, decision: ChatAgentApprovalDecision) => Promise<void>;
  resolveGroupUserAttention: (decision: GroupUserAttentionDecision, text?: string) => Promise<void>;
  setActivePetId: (petId: string) => void;
  setChatMode: (mode: DesktopPetChatMode) => void;
  setGroupChatContinuationMode: (mode: DesktopPetGroupChatContinuationMode) => void;
  setInputValue: (value: string) => void;
  stopAgentRun: (messageId?: string | null) => void;
  stopGroupChat: () => void;
  stopPetSpeech: () => void;
  toggleVoiceEnabled: () => void;
  toggleVoiceInput: () => void;
}

export const DEFAULT_DESKTOP_PET_CHAT_STATE: DesktopPetChatState = {
  activePetId: DEFAULT_CHAT_ACTIVE_PET_ID,
  animationToolAudioPlaybackByPetId: {},
  animationToolPerformanceByPetId: {},
  animationToolTriggersByPetId: {},
  chatMode: DEFAULT_CHAT_MODE,
  groupChatContinuationMode: 'single-round',
  groupPetAliasesById: {},
  groupUserAttention: null,
  groupUserAttentionHandledMessageKey: null,
  inputValue: '',
  isGroupChatRunning: false,
  isListening: false,
  isSpeaking: false,
  isTyping: false,
  lastReplayableAnimationToolTriggersByPetId: {},
  latestPetMessage: '',
  latestPetMessages: {},
  messages: [],
  storyLibrary: [],
  speakingPetId: null,
  speechExpressionActionByPetId: {},
  statusMessage: '',
  storySession: null,
  typingPetId: null,
  webSearchStatusMessage: '',
};
