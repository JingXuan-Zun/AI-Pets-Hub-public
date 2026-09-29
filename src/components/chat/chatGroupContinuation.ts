import { desktopPetChatStore } from '../../chatStore';
import { type ChatMessage, type DesktopPetChatMode, type PetConfig } from '../../types';
import {
  createGroupChatSpeakerQueue,
  createGroupChatSpeakerPlan,
  markGroupChatSpeakerPlanUserTopicPriority,
  type GroupChatInteractionPlan,
} from './chatGroupInteractionPlanner';
import { createGroupTurnContext } from './chatGroupTurnContext';
import { buildAutonomousGroupChatPrompt, resolveChatTargetSlots } from './multiPetChat';
import { GroupChatRuntime } from './group/runtime/groupChatRuntime';
import { resolveRepeatedGroupReplyCount } from './group/topic/topicContinuationSignals';
import type { GroupRoleTurnOutput } from './group/role/groupRoleTurnOutput';
import { detectLatestGroupUserAttention } from './group/attention/groupUserAttention';
import { applyGroupRoleTopicSignal } from './group/topic/groupTopicSignal';
import { analyzeGroupConversationProgress } from './group/topic/groupConversationProgressPolicy';
import { planGroupDialogueTurn } from './group/orchestration/groupDialogueDirector';
import { rankGroupAttention } from './group/attention/attentionPolicy';
import type { GroupRelationshipTurnCaptureInput } from './group/relationship/groupRelationshipCandidateCapture';
import { continueGroupBatchAfterRoleFailure } from './group/orchestration/groupBatchFailureContinuation';
import { pauseGroupForBatchFailureIfNeeded, pauseGroupForDirectorIfNeeded } from './group/orchestration/groupContinuationPausePolicy';
interface ContinueGroupChatConversationOptions {
  canContinue: () => boolean;
  directedRelationshipRepository?: PetConfig['directedRelationshipRepository'];
  groupMemoryRepository: PetConfig['groupMemoryRepository'];
  playbackToken: number;
  participantNames: string[];
  onTopicSnapshotChanged?: (runtime: GroupChatRuntime) => void;
  onRelationshipTurnComplete?: (input: GroupRelationshipTurnCaptureInput) => void;
  requestToken: number;
  runtime?: GroupChatRuntime;
  runPetResponseTurn: (
    targetSlot: ReturnType<typeof resolveChatTargetSlots>[number],
    options: {
      chatMode: DesktopPetChatMode;
      historyMessages: ChatMessage[];
      participantNames: string[];
      promptText: string;
      shouldAutoSpeakReply: boolean;
      playbackToken: number;
      requestToken: number;
      groupInteractionPlan?: GroupChatInteractionPlan;
    },
  ) => Promise<{
    cancelled: boolean;
    finalResponse: string;
    groupRoleTurnOutput?: GroupRoleTurnOutput;
  }>;
  targetSlots: ReturnType<typeof resolveChatTargetSlots>;
  userDisplayName?: string;
  waitForNextGroupChatTurn: () => Promise<void>;
}

export type ContinueGroupChatConversationResult = 'completed' | 'paused-for-user';
function pauseForUserIfNeeded(options: ContinueGroupChatConversationOptions) {
  const state = desktopPetChatStore.getState();
  const attention = detectLatestGroupUserAttention(state.messages, {
    handledMessageKey: state.groupUserAttentionHandledMessageKey,
    participantNames: options.participantNames,
    userDisplayName: options.userDisplayName,
  });
  if (!attention) return false;
  desktopPetChatStore.setGroupUserAttention(attention);
  desktopPetChatStore.setGroupChatRunning(false);
  return true;
}

function prepareNextGroupTurn(
  options: ContinueGroupChatConversationOptions,
  runtime: GroupChatRuntime,
) {
  runtime.beginPlanning();
  const messages = desktopPetChatStore.getState().messages;
  const snapshot = runtime.controller.getSnapshot();
  const decision = planGroupDialogueTurn({
    attentionCandidates: rankGroupAttention({ candidateSlots: options.targetSlots, messages }),
    messages,
    progress: analyzeGroupConversationProgress(messages),
    record: snapshot,
  });
  if (decision.action === 'wait-task' || decision.action === 'close-topic') return null;
  const queuedRoleIds = snapshot.turnQueue;
  const userTopicRoleIds = snapshot.groupUserTopicState?.remainingRoleIds ?? [];
  const preferredRoleIds = decision.action === 'answer-user'
    ? userTopicRoleIds
    : (decision.candidateRoleIds.length > 0 ? decision.candidateRoleIds : queuedRoleIds);
  const slotsById = new Map(options.targetSlots.map((slot) => [slot.id, slot]));
  const preferredSlots = preferredRoleIds.flatMap((roleId) => {
    const slot = slotsById.get(roleId);
    return slot ? [slot] : [];
  });
  const candidateTargetSlots = preferredSlots.length > 0 ? preferredSlots : undefined;
  const speakerQueue = createGroupChatSpeakerQueue({
    candidateTargetSlots,
    messages,
    targetSlots: options.targetSlots,
    topicStatus: runtime.controller.getSnapshot().topicStatus,
  });
  if (speakerQueue.length === 0) {
    return null;
  }
  const activeBatch = runtime.controller.getSnapshot().generationBatch;
  if (!activeBatch || activeBatch.status === 'completed' || activeBatch.status === 'cancelled') {
    const latestUserMessage = [...messages].reverse().find((message) => (
      message.role === 'user' && message.chatMode === 'group'
    ));
    runtime.controller.beginGenerationBatch({
      batchId: `${options.requestToken}-batch-${messages.length}`,
      candidateRoleIds: speakerQueue.map((plan) => plan.targetSlot.id),
      contextVersion: `${messages.length}:${snapshot.updatedAt}`,
      sourceMessageId: latestUserMessage?.id ?? null,
    });
  }
  const selectedPlan = decision.action === 'summarize-topic'
    ? createGroupChatSpeakerPlan({
      interactionPlan: speakerQueue[0], intent: 'summarize-topic', targetSlot: speakerQueue[0].targetSlot,
    })
    : speakerQueue[0];
  const { targetSlot, ...baseInteractionPlan } = selectedPlan;
  const groupInteractionPlan = userTopicRoleIds.length > 0 && decision.action === 'answer-user'
    ? markGroupChatSpeakerPlanUserTopicPriority(speakerQueue[0])
    : baseInteractionPlan;
  const groupTurnContext = createGroupTurnContext({
    activeRoleIds: options.targetSlots.map((slot) => slot.id),
    directedRelationshipRepository: options.directedRelationshipRepository,
    groupInteractionPlan,
    groupMemoryRepository: options.groupMemoryRepository,
    messages,
    participantNames: options.participantNames,
    targetSlot,
  });
  const turnId = `${options.requestToken}-${messages.length}`;
  return { decision, groupInteractionPlan, groupTurnContext, messages, speakerQueue, targetSlot, turnId };
}


async function executeNextGroupTurn(
  options: ContinueGroupChatConversationOptions,
  runtime: GroupChatRuntime,
  turn: NonNullable<ReturnType<typeof prepareNextGroupTurn>>,
) {
  const { groupInteractionPlan, groupTurnContext, messages, targetSlot, turnId } = turn;
  return runtime.runTurn({
    continueOnError: true,
    speakerId: targetSlot.id,
    turnId,
    replyTargetIds: groupInteractionPlan.replyToPetIds,
    execute: () => options.runPetResponseTurn(targetSlot, {
      chatMode: 'group', historyMessages: groupTurnContext.historyMessages,
      participantNames: options.participantNames,
      promptText: buildAutonomousGroupChatPrompt(
        targetSlot, options.participantNames, messages, groupInteractionPlan, groupTurnContext,
      ),
      shouldAutoSpeakReply: false,
      playbackToken: options.playbackToken,
      requestToken: options.requestToken,
      groupInteractionPlan,
    }),
  });
}

function completeNextGroupTurn(
  runtime: GroupChatRuntime,
  turn: NonNullable<ReturnType<typeof prepareNextGroupTurn>>,
  result: Awaited<ReturnType<typeof executeNextGroupTurn>>,
  onTopicSnapshotChanged?: (runtime: GroupChatRuntime) => void,
  onRelationshipTurnComplete?: (input: GroupRelationshipTurnCaptureInput) => void,
) {
  const turnSnapshot = runtime.controller.getSnapshot();
  const handledTopicSignal = applyGroupRoleTopicSignal(runtime, result.groupRoleTurnOutput, {
    roleId: turn.targetSlot.id,
    turnId: turn.turnId,
  });
  runtime.controller.markUserTopicRoleAnswered(turn.targetSlot.id);
  runtime.controller.markBatchRolePublished(turn.targetSlot.id);
  if (turn.decision.action === 'summarize-topic') {
    runtime.controller.updateTopic({ hasStageConclusion: true }, {
      reason: turn.decision.reason, source: 'inactivity',
    });
  } else if (!handledTopicSignal) {
    const repeatedReplyCount = resolveRepeatedGroupReplyCount(desktopPetChatStore.getState().messages);
    runtime.controller.updateTopic({
      hasNewInformation: repeatedReplyCount === 0,
      repeatedReplyCount,
    });
  }
  onRelationshipTurnComplete?.({
    addressedRoleIds: turn.groupInteractionPlan.conversationTurnPlan?.addressedCharacterIds ?? [],
    behaviorTargetRoleIds: turn.groupTurnContext.roleRuntimeSnapshot
      .relationshipBehaviorPolicies.map((policy) => policy.targetRoleId),
    groupSessionId: turnSnapshot.groupSessionId,
    groupRoleTurnOutput: result.groupRoleTurnOutput,
    sourceMessageId: turn.turnId,
    sourceRoleId: turn.targetSlot.id,
    sourceRoleName: turn.targetSlot.personality.name,
    topicId: turnSnapshot.currentTopicId,
  });
  runtime.waitForNextSpeaker(
    turn.speakerQueue.slice(1).map((speakerPlan) => speakerPlan.targetSlot.id),
  );
  onTopicSnapshotChanged?.(runtime);
}
async function runGroupContinuationLoop(
  options: ContinueGroupChatConversationOptions,
  runtime: GroupChatRuntime,
): Promise<ContinueGroupChatConversationResult> {
  while (options.canContinue()) {
    if (pauseForUserIfNeeded(options)) return 'paused-for-user';
    // Infinite mode is autonomous: a director "ask-user" decision must not
    // stop the loop. The user can still stop it explicitly or send an input.
    if (runtime.controller.getSnapshot().mode !== 'infinite'
      && pauseGroupForDirectorIfNeeded({ runtime, targetSlots: options.targetSlots })) return 'paused-for-user';
    await options.waitForNextGroupChatTurn();
    if (pauseForUserIfNeeded(options)) return 'paused-for-user';
    if (runtime.controller.getSnapshot().mode !== 'infinite'
      && pauseGroupForDirectorIfNeeded({ runtime, targetSlots: options.targetSlots })) return 'paused-for-user';
    if (!options.canContinue()) {
      runtime.complete();
      return 'completed';
    }
    const turn = prepareNextGroupTurn(options, runtime);
    if (!turn) {
      runtime.complete();
      return 'completed';
    }
    const result = await executeNextGroupTurn(options, runtime, turn);
    if (result === undefined) {
      continueGroupBatchAfterRoleFailure({
        failedRoleId: turn.targetSlot.id,
        remainingRoleIds: turn.speakerQueue.slice(1).map((plan) => plan.targetSlot.id),
        runtime,
      });
      options.onTopicSnapshotChanged?.(runtime);
      if (pauseGroupForBatchFailureIfNeeded(runtime)) return 'paused-for-user';
      continue;
    }
    if (result.cancelled) {
      runtime.controller.markBatchRoleFailed(turn.targetSlot.id);
      runtime.cancel();
      return 'completed';
    }
    completeNextGroupTurn(
      runtime, turn, result, options.onTopicSnapshotChanged, options.onRelationshipTurnComplete,
    );
    if (runtime.controller.getSnapshot().mode !== 'infinite'
      && pauseGroupForDirectorIfNeeded({ runtime, targetSlots: options.targetSlots })) {
      return 'paused-for-user';
    }
  }
  runtime.complete();
  return 'completed';
}

export async function continueGroupChatConversation({
  canContinue,
  directedRelationshipRepository,
  groupMemoryRepository,
  playbackToken,
  participantNames,
  onTopicSnapshotChanged,
  onRelationshipTurnComplete,
  requestToken,
  runtime: optionsRuntime,
  runPetResponseTurn,
  targetSlots,
  userDisplayName,
  waitForNextGroupChatTurn,
}: ContinueGroupChatConversationOptions): Promise<ContinueGroupChatConversationResult> {
  const options = {
    canContinue, directedRelationshipRepository, groupMemoryRepository, playbackToken, participantNames, requestToken, runPetResponseTurn,
    targetSlots, userDisplayName, waitForNextGroupChatTurn,
    onTopicSnapshotChanged, onRelationshipTurnComplete,
  };
  const runtime = optionsRuntime ?? new GroupChatRuntime({
    activeRoleIds: targetSlots.map((slot) => slot.id),
    groupSessionId: `group-${requestToken}`,
    mode: 'infinite',
  });

  return runGroupContinuationLoop(options, runtime);
}
