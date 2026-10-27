import { type ChatAgentApprovalDecision } from '../../../types';

// Approval cards posted by the desktop agent loop. The chat window's 允许/拒绝 reaches the main
// renderer as resolveAgentApproval(messageId, decision); ids registered here are answered by
// resolving the loop's pending promise instead of the older approval pipeline.

const pending = new Map<string, (decision: ChatAgentApprovalDecision) => void>();
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

/**
 * Called whenever a question starts or stops waiting. The hands-free microphone decides
 * whether to listen from this; without it a question registered just after the last chat
 * update never woke the paused microphone.
 */
export function subscribeAgentLoopApprovals(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Waits for the answer itself, including "allow the rest of this task" ('approve-task'). */
export function waitForAgentLoopDecision(messageId: string, signal?: AbortSignal | null) {
  return new Promise<ChatAgentApprovalDecision>((resolve) => {
    const settle = (decision: ChatAgentApprovalDecision) => {
      pending.delete(messageId);
      signal?.removeEventListener('abort', onAbort);
      resolve(decision);
      notify();
    };
    const onAbort = () => settle('deny');
    pending.set(messageId, settle);
    notify();
    if (signal?.aborted) settle('deny');
    else signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export function waitForAgentLoopApproval(messageId: string, signal?: AbortSignal | null) {
  return waitForAgentLoopDecision(messageId, signal).then((decision) => decision !== 'deny');
}

/** True when the message belonged to the loop (and is now answered). */
export function resolveAgentLoopApproval(messageId: string, decision: ChatAgentApprovalDecision) {
  const settle = pending.get(messageId);
  if (!settle) return false;
  settle(decision);
  return true;
}

/** The approval card asked most recently that is still waiting, if any. */
export function latestPendingAgentLoopApprovalId() {
  return [...pending.keys()].at(-1) ?? null;
}
