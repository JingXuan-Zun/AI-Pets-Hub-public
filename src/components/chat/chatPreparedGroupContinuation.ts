import { buildGroupTopicKey } from '../../group-topic';
import { continueGroupChatConversation } from './chatGroupContinuation';
import { waitForNextGroupChatTurn } from './chatSessionControlUtils';
import type { RunPreparedChatSendRequestOptions } from './chatMessageSendFlowTypes';
import type { GroupChatRuntime } from './group/runtime/groupChatRuntime';
import { commitGroupTopicRuntimeSnapshot } from './group/topic/groupTopicPersistence';
import { captureGroupRelationshipTurnArtifacts } from './group/relationship/groupRelationshipCandidateCapture';

export async function continuePreparedGroupChat(options: {
  groupRuntime: GroupChatRuntime;
  request: RunPreparedChatSendRequestOptions;
}) {
  const { preparedRequest } = options.request;
  const { playbackToken, requestToken, targetSlots } = preparedRequest;
  const groupTopicKey = buildGroupTopicKey(targetSlots.map((slot) => slot.id));
  return continueGroupChatConversation({
    canContinue: () => (
      options.groupRuntime.canContinue()
    ),
    directedRelationshipRepository: preparedRequest.currentConfig.directedRelationshipRepository,
    groupMemoryRepository: preparedRequest.currentConfig.groupMemoryRepository,
    playbackToken,
    participantNames: targetSlots.map((slot) => slot.personality.name),
    onTopicSnapshotChanged: (runtime) => commitGroupTopicRuntimeSnapshot({
      configRef: options.request.configRef,
      groupKey: groupTopicKey,
      onUpdateConfig: options.request.onUpdateConfig,
      runtime,
    }),
    onRelationshipTurnComplete: (input) => captureGroupRelationshipTurnArtifacts({
      configRef: options.request.configRef,
      input,
      onUpdateConfig: options.request.onUpdateConfig,
      targetSlots,
    }),
    requestToken,
    runtime: options.groupRuntime,
    runPetResponseTurn: options.request.runPetResponseTurn,
    targetSlots,
    userDisplayName: preparedRequest.currentConfig.settings.chatUserDisplayName,
    waitForNextGroupChatTurn: () => waitForNextGroupChatTurn(
      options.request.configRef.current.settings.groupChatTurnDelayMs,
    ),
  });
}
