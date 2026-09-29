import {
  type AgentMcpToolRisk,
  summarizeAgentMcpToolRisk,
} from '../../agent/agentMcpRiskSummary';
import {
  type AgentChatCommand,
  type AgentExecutionPlan,
} from '../../agent';
import { listAvailableAgentMcpTools } from '../../agent/agentMcpRegistry';
import { type ChatAgentApprovalSummary } from '../../types';

const MCP_ARGUMENT_PREVIEW_LIMIT = 180;
const MCP_SECRET_KEY_PATTERN = /(?:api[_-]?key|authorization|bearer|credential|password|secret|token)/iu;

function getStringInput(input: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = input[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

function compactMcpArgumentText(value: string, limit = MCP_ARGUMENT_PREVIEW_LIMIT) {
  const text = value.replace(/\s+/gu, ' ').trim();
  return text.length > limit ? `${text.slice(0, limit - 3)}...` : text;
}

function redactMcpArgumentValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.slice(0, 8).map(redactMcpArgumentValue);
  }

  if (!value || typeof value !== 'object') {
    return typeof value === 'string' ? compactMcpArgumentText(value, 96) : value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .slice(0, 20)
      .map(([key, childValue]) => [
        key,
        MCP_SECRET_KEY_PATTERN.test(key) ? '[redacted]' : redactMcpArgumentValue(childValue),
      ]),
  );
}

function readMcpArguments(input: Record<string, unknown>) {
  const argumentsJson = getStringInput(input, ['argumentsJson']);
  if (argumentsJson) {
    try {
      return JSON.parse(argumentsJson) as unknown;
    } catch {
      return argumentsJson;
    }
  }

  return input.arguments ?? input.args ?? input.input ?? {};
}

function formatMcpArguments(input: Record<string, unknown>) {
  const args = readMcpArguments(input);
  const text = typeof args === 'string'
    ? args
    : JSON.stringify(redactMcpArgumentValue(args));
  return compactMcpArgumentText(text || '{}');
}

function formatMcpApprovalRisk(source: 'external' | 'platform', risk: AgentMcpToolRisk) {
  const sourceText = source === 'platform' ? 'platform' : 'external';
  const riskText = risk === 'read'
    ? 'read-only'
    : risk === 'destructive-like'
      ? 'destructive-like'
      : 'reversible-write';
  return `${sourceText}, ${riskText}`;
}

async function resolveMcpApprovalToolDefinition(serverId: string, toolName: string) {
  try {
    const tools = await listAvailableAgentMcpTools(serverId);
    return tools.find((tool) => tool.serverId === serverId && tool.name === toolName) ?? null;
  } catch {
    return null;
  }
}

function createMcpApprovalSignalLine(schemaSignals: string[]) {
  return schemaSignals.length
    ? `schema signals: ${schemaSignals.slice(0, 4).join(', ')}`
    : 'schema signals: unavailable';
}

function createMcpApprovalSummaryFromRisk(options: {
  includeSchemaSignals: boolean;
  input: Record<string, unknown>;
  plan: AgentExecutionPlan,
  serverId: string;
  summary: ReturnType<typeof summarizeAgentMcpToolRisk>;
  toolName: string;
}): ChatAgentApprovalSummary {
  const { includeSchemaSignals, input, plan, serverId, summary, toolName } = options;
  const schemaSignalLine = includeSchemaSignals
    ? [createMcpApprovalSignalLine(summary.schemaSignals)]
    : [];

  return {
    lines: [
      `tool: ${serverId}/${toolName}`,
      `source/risk: ${formatMcpApprovalRisk(summary.source, summary.risk)}`,
      `risk reason: ${summary.riskReason}`,
      ...schemaSignalLine,
      `approval: ${summary.approvalMode === 'silent' ? 'silent' : 'user confirmation required'}`,
      `arguments: ${formatMcpArguments(input)}`,
      `goal: ${plan.goal}`,
    ],
    title: summary.source === 'external'
      ? 'Confirm external MCP tool call'
      : 'Confirm platform MCP tool call',
    warning: summary.source === 'external'
      ? 'External MCP tools run outside the built-in platform bridge. Approve only if this server and arguments are expected.'
      : null,
  };
}

export function createAgentMcpApprovalSummary(
  command: AgentChatCommand,
  plan: AgentExecutionPlan,
): ChatAgentApprovalSummary | null {
  if (command.toolCall?.name !== 'call_mcp_tool') {
    return null;
  }

  const input = command.toolCall.input ?? {};
  const serverId = getStringInput(input, ['serverId']) || 'unknown-server';
  const toolName = getStringInput(input, ['name', 'toolName']) || 'unknown-tool';
  const summary = summarizeAgentMcpToolRisk({ name: toolName, serverId });
  return createMcpApprovalSummaryFromRisk({
    includeSchemaSignals: false,
    input,
    plan,
    serverId,
    summary,
    toolName,
  });
}

export async function createAgentMcpApprovalSummaryWithSchema(
  command: AgentChatCommand,
  plan: AgentExecutionPlan,
): Promise<ChatAgentApprovalSummary | null> {
  if (command.toolCall?.name !== 'call_mcp_tool') {
    return null;
  }

  const input = command.toolCall.input ?? {};
  const serverId = getStringInput(input, ['serverId']) || 'unknown-server';
  const toolName = getStringInput(input, ['name', 'toolName']) || 'unknown-tool';
  const tool = await resolveMcpApprovalToolDefinition(serverId, toolName);
  const summary = summarizeAgentMcpToolRisk(tool ?? { name: toolName, serverId });
  return createMcpApprovalSummaryFromRisk({
    includeSchemaSignals: true,
    input,
    plan,
    serverId,
    summary,
    toolName,
  });
}
