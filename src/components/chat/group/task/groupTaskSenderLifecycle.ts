import type { PreparedChatSendRequest } from '../../chatMessageSendFlowTypes';
import type { UsePetChatMessageSenderOptions } from '../../petChatMessageSenderTypes';
import { desktopPetChatStore } from '../../../../chatStore';
import { continueGroupChatConversation } from '../../chatGroupContinuation';
import { waitForNextGroupChatTurn } from '../../chatSessionControlUtils';
import { resolveChatTargetSlots } from '../../multiPetChat';
import type { ActiveGroupRuntimeRef } from '../runtime/activeGroupRuntimeRef';
import { captureGroupRelationshipTurnArtifacts } from '../relationship/groupRelationshipCandidateCapture';
import {
  beginGroupTaskExplanation,
  completeGroupTaskExplanation,
  resumeGroupRuntimeFromTaskEvent,
  startGroupTaskRuntime,
} from './groupTaskRuntimeLifecycle';

export function startPreparedGroupTaskRuntime(
  activeGroupRuntimeRef: ActiveGroupRuntimeRef,
  preparedRequest: PreparedChatSendRequest,
) {
  const candidate = preparedRequest.groupTaskCandidate;
  if (!candidate) {
    return null;
  }
  return startGroupTaskRuntime({
    activeGroupRuntimeRef,
    activeRoleIds: preparedRequest.targetSlots.map((slot) => slot.id),
    candidate,
    mode: preparedRequest.currentChatState.groupChatContinuationMode,
  });
}

export function createGroupTaskLifecycleCallbacks(activeGroupRuntimeRef: ActiveGroupRuntimeRef) {
  return {
    onEvent: (event: import('../../../../types').ChatGroupTaskEvent) => {
      resumeGroupRuntimeFromTaskEvent(activeGroupRuntimeRef, event);
    },
    onExplanationStart: (event: import('../../../../types').ChatGroupTaskEvent, roleId: string) => {
      beginGroupTaskExplanation(activeGroupRuntimeRef, event, roleId);
    },
    onExplanationComplete: (event: import('../../../../types').ChatGroupTaskEvent, roleId: string) => {
      completeGroupTaskExplanation(activeGroupRuntimeRef, event, roleId);
    },
  };
}

export async function continueActiveGroupTaskConversation(
  context: Pick<
    UsePetChatMessageSenderOptions,
    'activeGroupRuntimeRef' | 'activeChatRequestTokenRef' | 'configRef' | 'getPlaybackToken'
    | 'groupChatContinuationEnabledRef' | 'onUpdateConfig' | 'runPetResponseTurn'
  >,
  preparedRequest?: PreparedChatSendRequest,
) {
  const runtime = context.activeGroupRuntimeRef.get();
  const snapshot = runtime?.controller.getSnapshot();
  if (!runtime || snapshot?.mode !== 'infinite' || snapshot.status !== 'waiting-next-speaker') {
    return false;
  }
  const state = desktopPetChatStore.getState();
  const targetSlots = preparedRequest?.targetSlots ?? resolveChatTargetSlots(
    context.configRef.current,
    state.chatMode,
    state.activePetId,
  );
  const requestToken = preparedRequest?.requestToken ?? context.activeChatRequestTokenRef.current;
  let pausedForUser = false;
  context.groupChatContinuationEnabledRef.current = true;
  desktopPetChatStore.setGroupChatRunning(true);
  try {
    const continuationResult = await continueGroupChatConversation({
      canContinue: () => Boolean(
        context.groupChatContinuationEnabledRef.current
        && runtime.canContinue()
      ),
      directedRelationshipRepository: context.configRef.current.directedRelationshipRepository,
      groupMemoryRepository: context.configRef.current.groupMemoryRepository,
      participantNames: targetSlots.map((slot) => slot.personality.name),
      onRelationshipTurnComplete: (input) => captureGroupRelationshipTurnArtifacts({
        configRef: context.configRef, input, onUpdateConfig: context.onUpdateConfig, targetSlots,
      }),
      playbackToken: preparedRequest?.playbackToken ?? context.getPlaybackToken(),
      requestToken,
      runtime,
      runPetResponseTurn: context.runPetResponseTurn,
      targetSlots,
      userDisplayName: context.configRef.current.settings?.chatUserDisplayName,
      waitForNextGroupChatTurn: () => waitForNextGroupChatTurn(
        context.configRef.current.settings.groupChatTurnDelayMs,
      ),
    });
    pausedForUser = continuationResult === 'paused-for-user';
  } finally {
    context.groupChatContinuationEnabledRef.current = false;
    desktopPetChatStore.setGroupChatRunning(false);
    if (!pausedForUser) {
      context.activeGroupRuntimeRef.clear(runtime);
    }
  }
  return true;
}
