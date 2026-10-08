import type { AgentRuntimeContinuation } from '../../../agent';
import { speakGroupTaskProductionResult } from './groupPersonaSpeaker';

type GroupOptions = Parameters<typeof speakGroupTaskProductionResult>[0];
type SpeakOptions = GroupOptions['speakOptions'];
type CommonOptions = Pick<SpeakOptions, 'playVoiceText' | 'preparedRequest' | 'result' | 'runPetResponseTurn' | 'targetSlot'> & {
  groupTaskLifecycle?: GroupOptions['groupTaskLifecycle'];
  messageId: string | null;
};

export function speakInitialAgentResultReply({ groupTaskLifecycle, instruction, participantNames, playVoiceText, preparedRequest, messageId, result, runPetResponseTurn, shouldAutoSpeakReply, targetSlot }: CommonOptions & Pick<SpeakOptions, 'instruction' | 'participantNames' | 'shouldAutoSpeakReply'>) {
  return speakGroupTaskProductionResult({
    groupTaskLifecycle,
    speakOptions: {
      instruction,
      participantNames,
      playVoiceText,
      preparedRequest,
      compactReplyIntoMessageId: messageId,
      result,
      runPetResponseTurn,
      shouldAutoSpeakReply,
      targetSlot,
    },
  });
}

export function speakApprovedAgentResultReply({ groupTaskLifecycle, approvalRuntime, playVoiceText, preparedRequest, messageId, result, runPetResponseTurn, targetSlot }: CommonOptions & { approvalRuntime: AgentRuntimeContinuation }) {
  return speakGroupTaskProductionResult({
    groupTaskLifecycle,
    speakOptions: {
      instruction: approvalRuntime.userGoal,
      participantNames: preparedRequest.targetSlots.map((slot) => slot.personality.name),
      playVoiceText,
      preparedRequest,
      compactReplyIntoMessageId: messageId,
      result,
      runPetResponseTurn,
      shouldAutoSpeakReply: !preparedRequest.isGroupMode,
      targetSlot,
    },
  });
}
