import type { GroupChatRuntime } from '../runtime/groupChatRuntime';

export function continueGroupBatchAfterRoleFailure(options: {
  failedRoleId: string;
  remainingRoleIds: string[];
  runtime: GroupChatRuntime;
}) {
  options.runtime.controller.markBatchRoleFailed(options.failedRoleId);
  options.runtime.waitForNextSpeaker(options.remainingRoleIds);
}
