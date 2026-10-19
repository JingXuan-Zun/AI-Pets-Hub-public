import { delegatedScopeFields } from './chatDelegation';
import { createConversationDesktopSession } from '../../../agent/conversation/conversationDesktopTools';
import type { ConversationToolRuntime } from '../../../agent/conversation/conversationTools';
import { desktopPetChatStore } from '../../../chatStore';
import { publishAgentRuntimeWorldProgress } from '../../../runtime-world/agentRuntimeWorldBridge';
import { resolveUserAddressedGroupChatSlot } from '../chatGroupUserAddressing';
import type { PetConfig, PetConfigUpdateHandler } from '../../../types';
import { createChatMessageId } from '../multiPetChat';
import { announceApprovalRequest, APPROVAL_REMINDER_DELAY_MS, waitForSilence } from './approvalAnnouncement';
import { createConversationTaskCard } from './conversationTaskCard';
import type { PreparedChatSendRequest } from '../chatMessageSendFlowTypes';
import type { ChatSendTargetSlot } from '../chatMessageSendUtils';

/**
 * Who may use tools for this message. In a group, the character the user named does the
 * work; when nobody is named, the first character to reply does (decided 2026-10-10). The
 * others only chat. Private chat: the one character replying.
 */
export function createConversationToolActorGate(preparedRequest: PreparedChatSendRequest) {
  const namedSlotId = preparedRequest.isGroupMode
    ? resolveUserAddressedGroupChatSlot(
      preparedRequest.outgoingText,
      preparedRequest.targetSlots,
      desktopPetChatStore.getState().groupPetAliasesById,
    )?.id ?? null
    : null;
  let claimed = false;
  return (slotId: string) => {
    if (claimed || (namedSlotId && slotId !== namedSlotId)) return false;
    claimed = true;
    return true;
  };
}

/** What the tools of one reply can reach: config, approval cards, the desktop and the runtime. */
export function createConversationChatRuntime(options: {
  configRef: { current: PetConfig };
  executeAgentCommand?: ConversationToolRuntime['executeAgentCommand'];
  onUpdateConfig: PetConfigUpdateHandler;
  preparedRequest: PreparedChatSendRequest;
  targetSlot: ChatSendTargetSlot;
}): ConversationToolRuntime {
  const { configRef, executeAgentCommand, onUpdateConfig, preparedRequest, targetSlot } = options;
  const chatMode = preparedRequest.currentChatState.chatMode;
  const sourceText = preparedRequest.outgoingText;
  // One card per task: its steps, which one runs, and the confirmations, all in one place.
  const taskCard = createConversationTaskCard({ chatMode, goal: sourceText.trim().slice(0, 80) || '帮你办一件事', targetSlot });
  let askedInThisTask = false;
  const requestApproval: ConversationToolRuntime['requestApproval'] = async (request) => {
    publishAgentRuntimeWorldProgress({ continuation: { taskState: { phase: 'approval' } }, stepIndex: 0, taskPhase: 'approval', type: 'model-decision' });
    // One clear order, so nobody talks over anyone: she finishes what she is saying, asks out
    // loud, and only then does the question appear on the card and the microphone listen for
    // the answer. (The card used to show the question while she was still talking.) After a
    // while without an answer she asks again and the chat window shakes.
    const spoken = configRef.current.settings.lifeCompanion?.approvalVoicePromptEnabled !== false;
    const brief = askedInThisTask;
    askedInThisTask = true;
    let waiting = true;
    const announce = (reminder: boolean) => announceApprovalRequest({
      brief: brief && !reminder, chatMode, config: configRef.current, isStillWaiting: () => waiting && !taskCard.signal.aborted, reminder, request: request.title, slot: targetSlot,
    }).catch(() => undefined);
    if (spoken) await announce(false);
    else await waitForSilence();
    if (taskCard.signal.aborted) return false;
    const reminderTimer = globalThis.setTimeout(() => { if (waiting && spoken) void announce(true); }, APPROVAL_REMINDER_DELAY_MS);
    try {
      return await taskCard.requestApproval(request);
    } finally {
      waiting = false;
      globalThis.clearTimeout(reminderTimer);
    }
  };
  const presentImages: ConversationToolRuntime['presentImages'] = (images, caption) => {
    desktopPetChatStore.addMessage({
      attachments: images.map((image, index) => ({
        dataUrl: image.dataUrl,
        id: createChatMessageId(`image-${index}`),
        kind: 'image',
        mimeType: image.mimeType,
        name: image.name,
        sizeBytes: image.sizeBytes,
      })),
      chatMode,
      createdAt: Date.now(),
      id: createChatMessageId('agent-image'),
      petId: targetSlot.id,
      petName: targetSlot.personality.name,
      ...delegatedScopeFields(targetSlot.id),
      role: 'model',
      text: caption,
    });
  };
  return {
    configRef,
    desktop: createConversationDesktopSession({ goal: sourceText, requestApproval, settings: configRef.current.settings }),
    executeAgentCommand,
    onUpdateConfig,
    petId: targetSlot.id,
    presentImages,
    progress: taskCard.progress,
    requestApproval,
    signal: taskCard.signal,
  };
}
