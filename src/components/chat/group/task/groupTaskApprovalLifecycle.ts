import type { ChatGroupTaskEvent } from '../../../../types';
import type { PreparedChatSendRequest } from '../../chatMessageSendFlowTypes';
import { updateGroupTaskConversationEvent } from './groupTaskConversationEvent';

export interface GroupTaskLifecycleCallbacks {
  onEvent?: (event: ChatGroupTaskEvent) => void;
  onExplanationStart?: (event: ChatGroupTaskEvent, roleId: string) => void;
  onExplanationComplete?: (event: ChatGroupTaskEvent, roleId: string) => void;
}

export function publishGroupTaskEvent(
  callbacks: GroupTaskLifecycleCallbacks | undefined,
  event: ChatGroupTaskEvent | null | undefined,
) {
  if (event) callbacks?.onEvent?.(event);
  return event ?? null;
}

export function publishPreparedGroupTaskEvent(
  callbacks: GroupTaskLifecycleCallbacks | undefined,
  preparedRequest: PreparedChatSendRequest,
) {
  return publishGroupTaskEvent(callbacks, preparedRequest.groupTaskConversationEvent);
}

export function updatePreparedGroupTaskEvent(options: {
  callbacks?: GroupTaskLifecycleCallbacks;
  event?: ChatGroupTaskEvent | null;
  outcome: 'completed' | 'pending-approval' | 'failed';
  preparedRequest: PreparedChatSendRequest;
  summary: string;
}) {
  const event = updateGroupTaskConversationEvent(options);
  options.preparedRequest.groupTaskConversationEvent = event ?? undefined;
  publishGroupTaskEvent(options.callbacks, event);
  return event;
}

export function completeGroupTaskMessageLifecycle(
  callbacks: GroupTaskLifecycleCallbacks | undefined,
  event: ChatGroupTaskEvent | null | undefined,
  roleId: string | null | undefined,
) {
  if (!event || !roleId) return;
  callbacks?.onExplanationStart?.(event, roleId);
  callbacks?.onExplanationComplete?.(event, roleId);
}

export async function runGroupTaskExplanationLifecycle(options: {
  callbacks?: GroupTaskLifecycleCallbacks;
  event?: ChatGroupTaskEvent | null;
  execute: () => Promise<void>;
  roleId?: string | null;
}) {
  if (!options.event || !options.roleId) {
    await options.execute();
    return;
  }
  options.callbacks?.onExplanationStart?.(options.event, options.roleId);
  try {
    await options.execute();
  } finally {
    options.callbacks?.onExplanationComplete?.(options.event, options.roleId);
  }
}
