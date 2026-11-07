import type { DesktopPetSlot } from '../../../../multiPetRoster';
import type { ChatMessage } from '../../../../types';
import type { createGroupChatSpeakerQueue } from '../../chatGroupInteractionPlanner';
import type { GroupChatRuntime } from '../runtime/groupChatRuntime';
import type { planGroupDialogueTurn } from './groupDialogueDirector';

// Two steps of preparing the next group-chat turn (split out of chatGroupContinuation.ts to keep
// its functions short).

/** The roles the director wants next: the user's topic first, then its own picks, then the queue. */
export function resolvePreferredSpeakerSlots(
  targetSlots: DesktopPetSlot[],
  decision: ReturnType<typeof planGroupDialogueTurn>,
  queuedRoleIds: string[],
  userTopicRoleIds: string[],
) {
  const preferredRoleIds = decision.action === 'answer-user'
    ? userTopicRoleIds
    : ('candidateRoleIds' in decision && decision.candidateRoleIds.length > 0 ? decision.candidateRoleIds : queuedRoleIds);
  const slotsById = new Map(targetSlots.map((slot) => [slot.id, slot]));
  const preferredSlots = preferredRoleIds.flatMap((roleId) => {
    const slot = slotsById.get(roleId);
    return slot ? [slot] : [];
  });
  return preferredSlots.length > 0 ? preferredSlots : undefined;
}

/** A new generation batch starts when none is running. */
export function ensureGenerationBatch(
  requestToken: string | number,
  runtime: GroupChatRuntime,
  messages: ChatMessage[],
  speakerQueue: ReturnType<typeof createGroupChatSpeakerQueue>,
  snapshotUpdatedAt: number,
) {
  const activeBatch = runtime.controller.getSnapshot().generationBatch;
  if (activeBatch && activeBatch.status !== 'completed' && activeBatch.status !== 'cancelled') return;
  const latestUserMessage = [...messages].reverse().find((message) => (
    message.role === 'user' && message.chatMode === 'group'
  ));
  runtime.controller.beginGenerationBatch({
    batchId: `${requestToken}-batch-${messages.length}`,
    candidateRoleIds: speakerQueue.map((plan) => plan.targetSlot.id),
    contextVersion: `${messages.length}:${snapshotUpdatedAt}`,
    sourceMessageId: latestUserMessage?.id ?? null,
  });
}
