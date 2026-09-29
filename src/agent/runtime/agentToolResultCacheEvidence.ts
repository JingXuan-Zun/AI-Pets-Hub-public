import { type AgentChatCommandResult } from '../agentChatCommand';

export const AGENT_TOOL_RESULT_CACHE_HIT_PREFIX = 'AgentRuntime cache hit';

function isAgentCacheHitEvidenceLine(line: string) {
  return line.startsWith(AGENT_TOOL_RESULT_CACHE_HIT_PREFIX)
    || /^[A-Za-z][A-Za-z0-9_-]*\s+cache hit\b/u.test(line);
}

export function isAgentCachedToolResult(result: AgentChatCommandResult) {
  return Boolean(
    result.observations?.some(isAgentCacheHitEvidenceLine)
    || result.receipt?.evidenceLines?.some(isAgentCacheHitEvidenceLine)
    || result.stateSummary?.observedState?.some(isAgentCacheHitEvidenceLine),
  );
}
