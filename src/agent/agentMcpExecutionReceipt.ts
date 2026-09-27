import { type AgentChatExecutionReceipt } from './agentChatCommand';
import { type AgentMcpToolCallResult } from './agentMcpTypes';

const MCP_RECEIPT_PREVIEW_LIMIT = 240;
const MCP_RECEIPT_SECRET_KEY_PATTERN = /(?:api[_-]?key|authorization|bearer|credential|password|secret|token)/iu;

export interface AgentMcpExecutionReceiptOptions {
  elapsedMs: number;
  result: AgentMcpToolCallResult;
  serverId: string;
  toolName: string;
}

function compactReceiptText(value: string, limit = MCP_RECEIPT_PREVIEW_LIMIT) {
  const text = value.replace(/\s+/gu, ' ').trim();
  return text.length > limit ? `${text.slice(0, limit - 3)}...` : text;
}

function redactReceiptValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.slice(0, 8).map(redactReceiptValue);
  }

  if (!value || typeof value !== 'object') {
    return typeof value === 'string' ? compactReceiptText(value, 96) : value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .slice(0, 20)
      .map(([key, childValue]) => [
        key,
        MCP_RECEIPT_SECRET_KEY_PATTERN.test(key) ? '[redacted]' : redactReceiptValue(childValue),
      ]),
  );
}

function summarizeReceiptStructuredContent(value: Record<string, unknown> | null | undefined) {
  if (!value) {
    return '';
  }

  return compactReceiptText(JSON.stringify(redactReceiptValue(value)));
}

function summarizeReceiptTextContent(result: AgentMcpToolCallResult) {
  return compactReceiptText(result.content.map((item) => item.text).filter(Boolean).join('\n'));
}

function summarizePolicyRetry(value: Record<string, unknown> | null | undefined) {
  const retry = value?.policyRetry;
  const policy = value?.policy;
  const retryCount = Number(
    retry && typeof retry === 'object' && !Array.isArray(retry)
      ? (retry as Record<string, unknown>).retryCount
      : policy && typeof policy === 'object' && !Array.isArray(policy)
        ? (policy as Record<string, unknown>).retryCount
        : 0,
  );
  const failedAttempts = retry && typeof retry === 'object' && !Array.isArray(retry)
    ? (retry as Record<string, unknown>).failedAttempts
    : policy && typeof policy === 'object' && !Array.isArray(policy)
      ? (policy as Record<string, unknown>).failedAttempts
      : null;

  if (!retryCount && !Array.isArray(failedAttempts)) {
    return '';
  }

  const attemptCount = Array.isArray(failedAttempts) ? failedAttempts.length : 0;
  return `retryCount ${Number.isFinite(retryCount) ? retryCount : 0}, failedAttempts ${attemptCount}`;
}

export function createAgentMcpExecutionReceipt(
  options: AgentMcpExecutionReceiptOptions,
): AgentChatExecutionReceipt {
  const toolRef = `${options.serverId || 'unknown-server'}/${options.toolName || 'unknown-tool'}`;
  const textSummary = summarizeReceiptTextContent(options.result);
  const structuredSummary = summarizeReceiptStructuredContent(options.result.structuredContent);
  const policyRetrySummary = summarizePolicyRetry(options.result.structuredContent);
  const status = options.result.isError ? 'failed' : 'success';
  const summaryLines = [
    `tool: ${toolRef}`,
    `result: ${status}`,
    `elapsedMs: ${Math.max(0, Math.round(options.elapsedMs))}`,
    `contentItems: ${options.result.content.length}`,
    policyRetrySummary ? `policyRetry: ${policyRetrySummary}` : '',
    textSummary ? `textContent: ${textSummary}` : '',
    structuredSummary ? `structuredContent: ${structuredSummary}` : '',
  ].filter(Boolean);

  return {
    evidenceLines: [
      textSummary ? `content: ${textSummary}` : '',
      policyRetrySummary ? `policyRetry: ${policyRetrySummary}` : '',
      structuredSummary ? `structuredContent: ${structuredSummary}` : '',
    ].filter(Boolean),
    status,
    summaryLines,
    title: options.result.isError ? 'MCP execution failed' : 'MCP execution receipt',
    toolName: toolRef,
    verification: options.result.isError
      ? `MCP tool ${toolRef} returned an error through the Agent MCP facade.`
      : `MCP tool ${toolRef} completed through the Agent MCP facade.`,
  };
}
