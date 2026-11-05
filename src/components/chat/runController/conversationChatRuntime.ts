import { delegatedScopeFields } from './chatDelegation';
import { isDailyApprovalActive, isIrreversibleApproval } from '../../../agent/approval/dailyApproval';
import { announceBackgroundOutcome } from '../../../agent/background/announceBackgroundOutcome';
import { startBackgroundTask } from '../../../agent/background/backgroundTasks';
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
  const requestApproval: ConversationToolRuntime['requestApproval'] = async (input) => {
    // Sending, deleting, paying, closing… ask every time; everything else is covered by
    // "今天都允许" earlier today (or in this task): go ahead without asking.
    const request = { ...input, irreversible: input.irreversible ?? isIrreversibleApproval(`${input.title}
${input.detail}`) };
    if (!request.irreversible && (taskCard.isAllowedForTask() || isDailyApprovalActive())) return !taskCard.signal.aborted;
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
  // A long job (a drawing) runs on after this reply ends; when it is done its pictures are
  // shown and she says how it went, in this same chat.
  const runInBackground: ConversationToolRuntime['runInBackground'] = (job) => {
    let images: Parameters<NonNullable<typeof presentImages>>[0] | undefined;
    const started = startBackgroundTask({
      kind: job.kind,
      onEnd: async ({ ok, status, text }) => {
        if (status === 'cancelled') return;
        if (ok && images?.length) presentImages(images, '');
        await announceBackgroundOutcome({
          chatMode, config: configRef.current, outcome: { ok, text }, petId: targetSlot.id, petName: targetSlot.personality.name, title: job.title,
        });
      },
      petId: targetSlot.id,
      run: async (signal) => {
        const result = await job.run(signal);
        images = result.images;
        return { ok: result.ok, text: result.text };
      },
      title: job.title,
    });
    if ('busy' in started) {
      const seconds = Math.round((Date.now() - started.busy.startedAt) / 1000);
      return { ok: false, text: `还在做上一件：${started.busy.title}（已经 ${seconds} 秒）。一次只做一件；要换的话先停掉它，再重新开始。` };
    }
    return { ok: true, text: `已经在后台开始了：${job.title}。要等一会儿（画图一般 1～3 分钟），好了会自动发出来，你到时再告诉用户。现在照常聊天就好。` };
  };
  return {
    configRef,
    desktop: createConversationDesktopSession({ goal: sourceText, requestApproval, settings: configRef.current.settings }),
    executeAgentCommand,
    onUpdateConfig,
    petId: targetSlot.id,
    presentImages,
    progress: taskCard.progress,
    runInBackground,
    requestApproval,
    signal: taskCard.signal,
  };
}
