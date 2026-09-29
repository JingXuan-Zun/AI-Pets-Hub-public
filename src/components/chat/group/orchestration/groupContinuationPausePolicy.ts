import { desktopPetChatStore } from '../../../../chatStore';
import type { DesktopPetSlot } from '../../../../multiPetRoster';
import { rankGroupAttention } from '../attention/attentionPolicy';
import {
  createBatchFailureUserAttention,
  createDirectorUserAttention,
  createProgressUserAttention,
} from '../attention/groupUserAttentionPolicy';
import type { GroupChatRuntime } from '../runtime/groupChatRuntime';
import { analyzeGroupConversationProgress } from '../topic/groupConversationProgressPolicy';
import { hasGroupBatchMajorityFailed } from './groupBatchHealth';
import { planGroupDialogueTurn } from './groupDialogueDirector';

function latestGroupModelMessage() {
  return [...desktopPetChatStore.getState().messages].reverse().find((message) => (
    message.role === 'model' && message.chatMode === 'group'
  ));
}

export function pauseGroupForDirectorIfNeeded(options: {
  runtime: GroupChatRuntime;
  targetSlots: DesktopPetSlot[];
}) {
  const state = desktopPetChatStore.getState();
  const snapshot = options.runtime.controller.getSnapshot();
  const progress = analyzeGroupConversationProgress(state.messages);
  const decision = planGroupDialogueTurn({
    attentionCandidates: rankGroupAttention({ candidateSlots: options.targetSlots, messages: state.messages }),
    messages: state.messages, progress, record: snapshot,
  });
  if (decision.action !== 'ask-user') return false;
  const latest = latestGroupModelMessage();
  const attention = decision.reason === 'topic-waiting-information'
    ? createDirectorUserAttention(latest, 'waiting-information')
    : createProgressUserAttention(latest, { ...progress, action: 'ask-user', reason: decision.reason });
  if (!attention) return false;
  desktopPetChatStore.setGroupUserAttention(attention);
  desktopPetChatStore.setGroupChatRunning(false);
  return true;
}

export function pauseGroupForBatchFailureIfNeeded(runtime: GroupChatRuntime) {
  if (!hasGroupBatchMajorityFailed(runtime.controller.getSnapshot().generationBatch)) return false;
  const attention = createBatchFailureUserAttention(desktopPetChatStore.getState().messages.at(-1));
  if (!attention) return false;
  desktopPetChatStore.setGroupUserAttention(attention);
  desktopPetChatStore.setGroupChatRunning(false);
  return true;
}
