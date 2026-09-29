import { continuePreparedGroupChat } from './chatPreparedGroupContinuation';
import { runPreparedTargetResponses } from './chatPreparedTargetResponses';
import type { RunPreparedChatSendRequestOptions } from './chatMessageSendFlowTypes';

export async function runPreparedChatSendRequest(
  options: RunPreparedChatSendRequestOptions,
) {
  const targetResponseResult = await runPreparedTargetResponses(options);
  if (!targetResponseResult.completed || !options.preparedRequest.isGroupMode) {
    options.activeGroupRuntimeRef?.clear(targetResponseResult.groupRuntime ?? undefined);
    return;
  }
  if (!targetResponseResult.groupRuntime) return;
  const continuationResult = await continuePreparedGroupChat({
    groupRuntime: targetResponseResult.groupRuntime,
    request: options,
  });
  if (continuationResult !== 'paused-for-user') {
    options.activeGroupRuntimeRef?.clear(targetResponseResult.groupRuntime);
  }
}
