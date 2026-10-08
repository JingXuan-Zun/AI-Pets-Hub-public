import { type ChatAgentApprovalDecision } from '../../../types';

// Approval cards posted by the desktop agent loop. The chat window's 允许/拒绝 reaches the main
// renderer as resolveAgentApproval(messageId, decision); ids registered here are answered by
// resolving the loop's pending promise instead of the older approval pipeline.

const pending = new Map<string, (approved: boolean) => void>();

export function waitForAgentLoopApproval(messageId: string, signal?: AbortSignal | null) {
  return new Promise<boolean>((resolve) => {
    const settle = (approved: boolean) => {
      pending.delete(messageId);
      signal?.removeEventListener('abort', onAbort);
      resolve(approved);
    };
    const onAbort = () => settle(false);
    pending.set(messageId, settle);
    if (signal?.aborted) settle(false);
    else signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/** True when the message belonged to the loop (and is now answered). */
export function resolveAgentLoopApproval(messageId: string, decision: ChatAgentApprovalDecision) {
  const settle = pending.get(messageId);
  if (!settle) return false;
  settle(decision === 'approve');
  return true;
}
