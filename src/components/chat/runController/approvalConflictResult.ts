import { type AgentChatCommand, type AgentChatCommandResult, createAgentStaleOuterApprovalSkippedResult, createAgentDuplicateApprovalBlockedResult } from '../../../agent';
import { formatAgentCommandResultForTrace } from './executionReceipt';

export function createSkippedStaleOuterApprovalResult(command: AgentChatCommand): AgentChatCommandResult {
  const responseText = [
    '已跳过重复的外层桌面动作。',
    '同一次任务里已经有桌面执行证据，后续又回流到刚批准过的打开或聚焦请求。',
    '这通常是旧外层动作没有消费最新证据，不应再次要求用户批准，也不应重复执行打开/聚焦。',
  ].join(' ');

  return createAgentStaleOuterApprovalSkippedResult({
    command,
    responseText,
  });
}

export function createRepeatedApprovalLoopResult(
  command: AgentChatCommand,
  executedResult?: AgentChatCommandResult | null,
): AgentChatCommandResult {
  const toolName = command.toolCall?.name ?? command.kind;
  const executedSummary = executedResult
    ? formatAgentCommandResultForTrace(executedResult)
    : null;
  const responseText = [
    '已停止重复的批准请求。',
    `刚刚批准的本机动作已经执行过：${toolName}，后续流程又请求了完全相同的批准。`,
    '不会让你继续反复点允许；当前应查看上一次执行证据，判断是输入无效、目标未确认，还是验证没有消费结果。',
    executedSummary ? `上一次执行结果：${executedSummary}` : '',
  ].filter(Boolean).join(' ');

  return createAgentDuplicateApprovalBlockedResult({
    command,
    previousExecutionResult: executedResult,
    previousExecutionSummary: executedSummary,
    responseText,
  });
}
