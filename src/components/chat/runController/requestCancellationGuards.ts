import { isStoppedAgentRunMessage } from '../agentRunStopPolicy';
import type { PreparedChatSendRequest } from '../chatMessageSendFlowTypes';

type RequestOptions = { activeChatRequestTokenRef: { current: number }; messageId: string | null };
type InitialOptions = RequestOptions & { preparedRequest: PreparedChatSendRequest };
type ApprovedOptions = RequestOptions & { abortController: AbortController; requestToken: number };

export function createInitialAgentRunCancellationGuard({ abortController, preparedRequest, activeChatRequestTokenRef, messageId }: InitialOptions & { abortController: AbortController }) {
  return () => (
    abortController.signal.aborted
    || preparedRequest.requestToken !== activeChatRequestTokenRef.current
    || isStoppedAgentRunMessage(messageId)
  );
}

export function isInitialAgentRequestStale({ preparedRequest, activeChatRequestTokenRef, messageId }: InitialOptions) {
  return preparedRequest.requestToken !== activeChatRequestTokenRef.current || isStoppedAgentRunMessage(messageId);
}

export function isApprovedAgentRequestCancelled({ abortController, requestToken, activeChatRequestTokenRef, messageId }: ApprovedOptions) {
  return abortController.signal.aborted || requestToken !== activeChatRequestTokenRef.current || isStoppedAgentRunMessage(messageId);
}

export function createApprovedAgentRunCancellationGuard({ abortController, requestToken, activeChatRequestTokenRef, messageId }: ApprovedOptions) {
  return () => isApprovedAgentRequestCancelled({ abortController, requestToken, activeChatRequestTokenRef, messageId });
}
