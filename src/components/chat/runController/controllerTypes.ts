import { type ChatSendTargetSlot } from '../chatMessageSendUtils';
import { type PlayVoiceTextOptions } from '../chatVoicePlaybackTypes';
import { type AgentChatFollowUpAction, type AgentChatCommandResult } from '../../../agent/agentChatCommand';
import { type AgentExecutionPlan } from '../../../agent/planning/agentPlanShared';

export type AgentRunPetResponseTurn = (
  targetSlot: ChatSendTargetSlot,
  options: {
    chatMode: import('../../../types').DesktopPetChatMode;
    historyMessages: import('../../../types').ChatMessage[];
    participantNames: string[];
    promptText: string;
    shouldAutoSpeakReply: boolean;
    playbackToken: number;
    requestToken: number;
    browserSearchMode?: 'allow' | 'block' | 'force';
    outputMessageId?: string | null;
  },
) => Promise<{ cancelled: boolean; finalResponse: string }>;

export type AgentPlayVoiceText = (text: string, options?: PlayVoiceTextOptions) => Promise<void>;

export type AgentRunControllerAutoContinuationStartEvent = {
  action: Extract<AgentChatFollowUpAction, { kind: 'run-command' }>;
  initialResult: AgentChatCommandResult;
  plan: AgentExecutionPlan;
};
