import { createAgentWorkingMemorySnapshot } from '../../../agent';
import { type PreparedChatSendRequest } from '../chatMessageSendFlowUtils';
import type { resolvePreparedAgentTargetSlot } from './sessionMessageProjection';
import { resolveAgentFollowUpContinuationCommand } from '../../../agent/agentFollowUpContinuation';
import { loadEnabledAgentImportedSkills } from '../../../agent/agentImportedSkillRuntime';

export function createAgentRunRequestContext(preparedRequest: PreparedChatSendRequest, targetSlot: NonNullable<ReturnType<typeof resolvePreparedAgentTargetSlot>>) {
  const participantNames = preparedRequest.targetSlots.map((slot) => slot.personality.name);
  const shouldAutoSpeakReply = !preparedRequest.isGroupMode;
  const workingMemory = createAgentWorkingMemorySnapshot(preparedRequest.promptHistoryMessages);
  const initialCommand = resolveAgentFollowUpContinuationCommand(preparedRequest.outgoingText, preparedRequest.promptHistoryMessages);
  const importedSkills = loadEnabledAgentImportedSkills({ petId: targetSlot.id });
  return { participantNames, shouldAutoSpeakReply, workingMemory, initialCommand, importedSkills };
}
