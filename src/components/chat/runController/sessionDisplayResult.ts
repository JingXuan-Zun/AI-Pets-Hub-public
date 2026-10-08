import { type AgentProductionSessionResult, type AgentChatCommand, type AgentChatCommandResult, assessAgentCommandResult } from '../../../agent';

export function createAgentProductionSessionDisplayResult(
  sessionResult: AgentProductionSessionResult,
  fallbackCommand: AgentChatCommand,
): {
  command: AgentChatCommand;
  result: AgentChatCommandResult;
} {
  if (sessionResult.status !== 'completed') {
    const incompleteToolResult = [...sessionResult.toolResults].reverse().find((entry) => (
      entry.result.ok === false
      || entry.result.receipt?.status === 'failed'
      || entry.result.receipt?.status === 'blocked'
      || entry.result.receipt?.status === 'unverified'
      || entry.result.assessment?.status === 'failed'
      || entry.result.assessment?.status === 'unverified'
      || Boolean(entry.result.stateSummary?.missingEvidence?.length)
    ));
    if (incompleteToolResult) {
      return incompleteToolResult;
    }
  }

  const latestToolResult = sessionResult.toolResults[sessionResult.toolResults.length - 1] ?? null;
  if (latestToolResult) {
    return latestToolResult;
  }

  return {
    command: fallbackCommand,
    result: assessAgentCommandResult(fallbackCommand, {
      ok: sessionResult.status !== 'failed',
      responseText: sessionResult.finalAnswer,
      verification: sessionResult.status === 'completed'
        ? '已经得到最终回复，没有额外工具结果。'
        : null,
    }),
  };
}
