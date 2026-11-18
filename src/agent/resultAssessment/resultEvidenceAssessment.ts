

import { type AgentChatCommandResult } from '../agentChatCommand';
export function resolveAgentResultFollowUpActions(result: AgentChatCommandResult) {
  return result.followUpActions?.length
    ? result.followUpActions
    : result.followUpAction
      ? [result.followUpAction]
      : [];
}
