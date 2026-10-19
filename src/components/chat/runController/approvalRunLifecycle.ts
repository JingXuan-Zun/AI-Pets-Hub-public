import { desktopPetChatStore } from '../../../chatStore';
import type { ChatAgentApprovalDecision } from '../../../types';
import { resolveAgentLoopApproval } from './agentLoopApprovalRegistry';

const RETIRED_APPROVAL_TEXT = '这张确认卡来自旧版办事流程，已经接不上了。直接再跟我说一次就好。';

/**
 * The user answered an approval card (button or typed "允许"/"拒绝"). Cards come from the
 * conversation loop, which is waiting on them; cards left over from the retired Agent runtime
 * (before 2026-10-10) can no longer continue and are closed with a note.
 */
export async function resolveAgentApprovalRequest({ decision, messageId }: {
  decision: ChatAgentApprovalDecision;
  messageId: string;
}) {
  if (resolveAgentLoopApproval(messageId, decision)) return;
  desktopPetChatStore.updateMessage(messageId, (message) => (message.agentApproval
    ? { ...message, agentApproval: { ...message.agentApproval, errorText: RETIRED_APPROVAL_TEXT, followUpAction: null, followUpActions: null, status: 'failed' }, text: RETIRED_APPROVAL_TEXT }
    : message));
}
