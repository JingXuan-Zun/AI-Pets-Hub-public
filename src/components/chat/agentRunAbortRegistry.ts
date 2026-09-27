const activeAgentRunAbortControllers = new Map<string, AbortController>();

export function registerAgentRunAbortController(
  messageId: string | null,
  controller: AbortController,
) {
  if (!messageId) return () => undefined;
  activeAgentRunAbortControllers.set(messageId, controller);
  return () => {
    if (activeAgentRunAbortControllers.get(messageId) === controller) {
      activeAgentRunAbortControllers.delete(messageId);
    }
  };
}

export function abortAgentRunController(messageId: string) {
  const controller = activeAgentRunAbortControllers.get(messageId);
  if (!controller || controller.signal.aborted) return false;
  controller.abort();
  return true;
}
