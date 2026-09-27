import { type AgentRuntimeContinuation } from '../../agent';
import { type ChatAgentApproval, type ChatAgentRun } from '../../types';

type ChatAgentRuntimeRecord = Pick<
  ChatAgentApproval | ChatAgentRun,
  'agentRuntime' | 'agentSessionV2'
>;

export function resolveChatAgentRuntimeContinuation(
  record: ChatAgentRuntimeRecord | null | undefined,
): AgentRuntimeContinuation | null {
  return record?.agentRuntime ?? record?.agentSessionV2 ?? null;
}
