import { type AgentRuntimeToolResultEntry, type AgentProductionSessionResult, type AgentChatCommandHandler } from '../../../agent';
import { type GroupTaskLifecycleCallbacks } from '../group/task/groupTaskApprovalLifecycle';
import { type AgentPlayVoiceText, type AgentRunPetResponseTurn } from './controllerTypes';
import { type PreparedChatSendRequest } from '../chatMessageSendFlowUtils';
import { type PetConfig, type ChatAgentApprovalDecision } from '../../../types';

export interface RunPreparedAgentProductionSessionOptions {
  activeChatRequestTokenRef: {
    current: number;
  };
  approvedToolResult?: AgentRuntimeToolResultEntry | null;
  instruction: string;
  groupTaskLifecycle?: GroupTaskLifecycleCallbacks;
  onRuntimeResult?: (event: {
    implementation: import('../../../agent/runtime/agentRuntimeContract').AgentRuntimeImplementation;
    result: AgentProductionSessionResult;
  }) => void;
  onAgentChatCommand?: AgentChatCommandHandler;
  playVoiceText: AgentPlayVoiceText;
  preparedRequest: PreparedChatSendRequest;
  runPetResponseTurn: AgentRunPetResponseTurn;
  warmLocalReplyVoice: (settings: PetConfig['settings']) => void;
}

export interface ResolveAgentApprovalRequestOptions {
  activeChatRequestTokenRef: {
    current: number;
  };
  configRef: {
    current: PetConfig;
  };
  decision: ChatAgentApprovalDecision;
  getPlaybackToken: () => number;
  groupTaskLifecycle?: GroupTaskLifecycleCallbacks;
  groupChatContinuationEnabledRef: {
    current: boolean;
  };
  messageId: string;
  onAgentChatCommand?: AgentChatCommandHandler;
  playVoiceText: AgentPlayVoiceText;
  runPetResponseTurn: AgentRunPetResponseTurn;
  stopGroupChat: (options?: {
    immediate?: boolean;
    announce?: boolean;
    cancelActiveRequest?: boolean;
  }) => void;
  stopPetSpeech: () => void;
  warmLocalReplyVoice: (settings: PetConfig['settings']) => void;
}
