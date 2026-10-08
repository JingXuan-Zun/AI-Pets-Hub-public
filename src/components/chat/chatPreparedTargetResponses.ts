import { desktopPetChatStore } from '../../chatStore';
import {
  createGroupChatSpeakerPlan,
  selectSingleRoundGroupChatParticipants,
  type GroupChatInteractionPlan,
  type GroupChatSpeakerPlan,
} from './chatGroupInteractionPlanner';
import {
  resolveUnansweredGroupUserTopicSlots,
  resolveUserAddressedGroupChatSlots,
  resolveTemporaryGroupPetAliases,
} from './chatGroupUserAddressing';
import { resolveGroupRelationshipBehaviorTargetIds } from './chatGroupTurnContext';
import type { RunPreparedChatSendRequestOptions } from './chatMessageSendFlowTypes';
import type { ChatSendTargetSlot } from './chatMessageSendUtils';
import { createSingleRoundGroupSpeakerPlan } from './chatSingleRoundSpeakerPlanning';
import { executeGroupTurn } from './group/orchestration/groupTurnExecution';
import { GroupChatRuntime } from './group/runtime/groupChatRuntime';
import { applyGroupRoleTopicSignal } from './group/topic/groupTopicSignal';
import { captureGroupRelationshipTurnArtifacts } from './group/relationship/groupRelationshipCandidateCapture';
import {
  commitGroupTopicRuntimeSnapshot,
  restoreGroupTopicRuntime,
} from './group/topic/groupTopicPersistence';
import { prepareStoryTurnRuntime, runStoryNarratorTurn } from './story/storyTurnRuntime';
import type { StorySessionState } from './story/storyTypes';
import { resolvePetVoiceSettings } from '../../voice/petVoiceSettings';

type TargetResponseOptions = Pick<
  RunPreparedChatSendRequestOptions,
  'activeChatRequestTokenRef' | 'activeGroupRuntimeRef' | 'configRef' | 'onUpdateConfig'
  | 'preparedRequest' | 'runPetResponseTurn' | 'warmLocalReplyVoice'
>;

type TargetResponseContext = ReturnType<typeof createTargetResponseContext>;

function createSingleChatTurns(options: TargetResponseOptions) {
  return options.preparedRequest.targetSlots.map((targetSlot) => createGroupChatSpeakerPlan({
    intent: 'answer-user',
    interactionPlan: {
      groupInteractionKind: 'direct', pullInPetId: null, pullInPetName: null,
      replyToPetId: null, replyToPetName: null, replyToPetIds: [], replyToPetNames: [],
    } satisfies GroupChatInteractionPlan,
    targetSlot,
  }));
}

function createTargetResponseContext(options: TargetResponseOptions) {
  const request = options.preparedRequest;
  const currentChatState = desktopPetChatStore.getState();
  const temporaryAliasesById = request.isGroupMode
    ? resolveTemporaryGroupPetAliases(
      request.outgoingText,
      request.targetSlots,
      currentChatState.groupPetAliasesById,
    )
    : {};
  if (Object.keys(temporaryAliasesById).length > 0) {
    desktopPetChatStore.rememberGroupPetAliases(temporaryAliasesById);
  }
  const resolvedTemporaryAliasesById = {
    ...currentChatState.groupPetAliasesById,
    ...Object.fromEntries(Object.entries(temporaryAliasesById).map(([petId, aliases]) => ([
      petId,
      [...(currentChatState.groupPetAliasesById[petId] ?? []), ...aliases],
    ]))),
  };
  const addressedSlots = request.isGroupMode
    ? resolveUserAddressedGroupChatSlots(
      request.outgoingText,
      request.targetSlots,
      resolvedTemporaryAliasesById,
    ) : [];
  const currentMessages = desktopPetChatStore.getState().messages;
  const unansweredSlots = request.isGroupMode
    ? resolveUnansweredGroupUserTopicSlots(currentMessages, request.userMessage.id, request.targetSlots)
    : [];
  const candidateTargetSlots = unansweredSlots.length > 0 ? unansweredSlots : request.targetSlots;
  const speakerSlots = request.isGroupMode ? selectSingleRoundGroupChatParticipants({
    addressedTargetSlots: addressedSlots,
    candidateTargetSlots,
    messages: currentMessages,
    targetSlots: request.targetSlots,
  }) : [];
  const runtime = request.isGroupMode ? new GroupChatRuntime({
    activeRoleIds: request.targetSlots.map((slot) => slot.id),
    groupSessionId: `group-${request.requestToken}`,
    mode: request.currentChatState.groupChatContinuationMode,
  }) : null;
  const topicKey = runtime ? restoreGroupTopicRuntime({
    config: options.configRef.current, roleIds: request.targetSlots.map((slot) => slot.id), runtime,
  }) : '';
  return {
    addressedSlots, options, runtime, speakerSlots, topicKey,
    participantNames: request.targetSlots.map((slot) => slot.personality.name),
    singleChatTurns: createSingleChatTurns(options),
    spokenPetIds: new Set<string>(),
    storySession: null as StorySessionState | null,
    storySpeakerSlots: [] as ChatSendTargetSlot[],
  };
}

function commitTopicSnapshot(context: TargetResponseContext) {
  if (!context.runtime) return;
  commitGroupTopicRuntimeSnapshot({
    configRef: context.options.configRef,
    groupKey: context.topicKey,
    onUpdateConfig: context.options.onUpdateConfig,
    runtime: context.runtime,
  });
}

function initializeGroupRuntime(context: TargetResponseContext) {
  if (!context.runtime) return;
  context.options.activeGroupRuntimeRef?.set(context.runtime);
  context.runtime.controller.beginUserTopic({
    addressedRoleIds: context.addressedSlots.map((slot) => slot.id),
    roleIds: context.options.preparedRequest.targetSlots.map((slot) => slot.id),
    sourceMessageId: context.options.preparedRequest.userMessage.id,
    topicId: context.options.preparedRequest.userMessage.id,
  });
  commitTopicSnapshot(context);
}

function resolvePlannedTurn(context: TargetResponseContext, turnIndex: number) {
  const request = context.options.preparedRequest;
  if (request.currentChatState.chatMode === 'story') {
    const speaker = context.storySpeakerSlots[turnIndex];
    return speaker ? context.singleChatTurns.find((turn) => turn.targetSlot.id === speaker.id) : undefined;
  }
  if (!request.isGroupMode) return context.singleChatTurns[turnIndex];
  return createSingleRoundGroupSpeakerPlan({
    addressedTargetSlots: context.addressedSlots,
    messages: desktopPetChatStore.getState().messages,
    speakerTargetSlots: context.speakerSlots,
    spokenPetIds: context.spokenPetIds,
    targetSlots: request.targetSlots,
    topicStatus: context.runtime?.controller.getSnapshot().topicStatus,
    userTopicPriority: request.isGroupMode,
  });
}

async function executeResponseTurn(
  context: TargetResponseContext,
  plan: GroupChatSpeakerPlan,
  turnIndex: number,
) {
  const request = context.options.preparedRequest;
  const isStoryMode = request.currentChatState.chatMode === 'story';
  const messages = request.isGroupMode || isStoryMode
    ? desktopPetChatStore.getState().messages : request.promptHistoryMessages;
  const execute = () => executeGroupTurn({
    browserSearchMode: request.browserSearchMode,
    historyMessages: isStoryMode ? messages : request.promptHistoryMessages,
    messages,
    outgoingText: request.outgoingText,
    participantNames: context.participantNames,
    plan,
    preparedRequest: request,
    runPetResponseTurn: context.options.runPetResponseTurn,
    shouldAutoSpeakReply: !request.isGroupMode,
    storySession: context.storySession,
  });
  const turnId = `${request.requestToken}-${turnIndex}`;
  const result = context.runtime ? await context.runtime.runTurn({
    speakerId: plan.targetSlot.id, turnId,
    replyTargetIds: plan.replyToPetIds, execute,
  }) : await execute();
  return { result, turnId };
}

function completeGroupTurn(
  context: TargetResponseContext,
  plan: GroupChatSpeakerPlan,
  result: Awaited<ReturnType<typeof executeResponseTurn>>,
  turnIndex: number,
  maxTurns: number,
) {
  if (!context.runtime) return true;
  const turnSnapshot = context.runtime.controller.getSnapshot();
  applyGroupRoleTopicSignal(context.runtime, result.result.groupRoleTurnOutput, {
    roleId: plan.targetSlot.id,
    turnId: result.turnId,
  });
  context.runtime.controller.markUserTopicRoleAnswered(plan.targetSlot.id);
  captureGroupRelationshipTurnArtifacts({
    configRef: context.options.configRef,
    input: {
      addressedRoleIds: plan.conversationTurnPlan.addressedCharacterIds,
      behaviorTargetRoleIds: resolveGroupRelationshipBehaviorTargetIds(
        context.options.preparedRequest.targetSlots.map((slot) => slot.id),
        plan,
      ) ?? [],
      groupSessionId: turnSnapshot.groupSessionId,
      groupRoleTurnOutput: result.result.groupRoleTurnOutput,
      sourceMessageId: result.turnId,
      sourceRoleId: plan.targetSlot.id,
      sourceRoleName: plan.targetSlot.personality.name,
      topicId: turnSnapshot.currentTopicId,
    },
    onUpdateConfig: context.options.onUpdateConfig,
    targetSlots: context.options.preparedRequest.targetSlots,
  });
  commitTopicSnapshot(context);
  if (!context.runtime.canContinue()) return false;
  if (turnIndex < maxTurns - 1) {
    context.runtime.waitForNextSpeaker(context.speakerSlots
      .filter((slot) => !context.spokenPetIds.has(slot.id))
      .map((slot) => slot.id));
  }
  return true;
}

async function runTargetResponseTurns(context: TargetResponseContext) {
  const request = context.options.preparedRequest;
  const maxTurns = request.isGroupMode
    ? context.speakerSlots.length
    : request.currentChatState.chatMode === 'story'
      ? context.storySpeakerSlots.length
      : context.singleChatTurns.length;
  for (let turnIndex = 0; turnIndex < maxTurns; turnIndex += 1) {
    context.runtime?.beginPlanning();
    const plan = resolvePlannedTurn(context, turnIndex);
    if (!plan) {
      context.runtime?.complete();
      break;
    }
  if (request.isGroupMode) context.spokenPetIds.add(plan.targetSlot.id);
    const result = await executeResponseTurn(context, plan, turnIndex);
    if (result.result.cancelled || request.requestToken !== context.options.activeChatRequestTokenRef.current) {
      context.runtime?.cancel();
      return false;
    }
    if (!completeGroupTurn(context, plan, result, turnIndex, maxTurns)) break;
  }
  return true;
}

function finalizeTargetResponses(context: TargetResponseContext) {
  if (
    context.runtime
    && context.options.preparedRequest.currentChatState.groupChatContinuationMode === 'infinite'
  ) {
    context.runtime.waitForNextSpeaker([]);
  } else {
    context.runtime?.complete();
  }
}

export async function runPreparedTargetResponses(options: TargetResponseOptions) {
  const context = createTargetResponseContext(options);
  if (!options.preparedRequest.isGroupMode) {
    const { currentConfig, targetSlots } = options.preparedRequest;
    options.warmLocalReplyVoice(resolvePetVoiceSettings(currentConfig, targetSlots[0]?.id));
  }
  initializeGroupRuntime(context);
  const storyTurnRuntime = await prepareStoryTurnRuntime({
    activeChatRequestTokenRef: options.activeChatRequestTokenRef,
    preparedRequest: options.preparedRequest,
    targetSlots: options.preparedRequest.targetSlots,
  });
  if (options.preparedRequest.currentChatState.chatMode === 'story' && !storyTurnRuntime) {
    context.runtime?.cancel();
    return { completed: false, groupRuntime: context.runtime };
  }
  if (storyTurnRuntime) {
    context.storySession = storyTurnRuntime.session;
    const speakerIds = new Set(storyTurnRuntime.plan.activeSpeakerIds);
    context.storySpeakerSlots = options.preparedRequest.targetSlots
      .filter((slot) => speakerIds.has(slot.id));
  }
  const narrationCompleted = storyTurnRuntime
    ? await runStoryNarratorTurn({
      activeChatRequestTokenRef: options.activeChatRequestTokenRef,
      participants: storyTurnRuntime.participants,
      plan: storyTurnRuntime.plan,
      preparedRequest: options.preparedRequest,
      session: storyTurnRuntime.session,
    })
    : true;
  if (!narrationCompleted) {
    context.runtime?.cancel();
    return { completed: false, groupRuntime: context.runtime };
  }
  if (storyTurnRuntime) {
    finalizeTargetResponses(context);
    return { completed: true, groupRuntime: context.runtime };
  }
  const completed = await runTargetResponseTurns(context);
  if (completed) finalizeTargetResponses(context);
  return { completed, groupRuntime: context.runtime };
}
