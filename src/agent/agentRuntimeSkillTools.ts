import { type AgentChatCommandResult, type AgentToolCallCommand } from './agentChatCommand';
import { desktopPetShellRuntime } from '../desktopShellRuntime';
import { type PetConfig } from '../types';
import {
  callAvailableAgentMcpTool,
  isDeclaredReadOnlyMcpTool,
  listAvailableAgentMcpServers,
  listAvailableAgentMcpTools,
} from './agentMcpRegistry';
import { parseAgentMcpPolicyConfig, resolveAgentMcpPolicy } from './agentMcpPolicy';
import { loadExternalAgentMcpConfig } from './agentExternalMcpBridge';
import { createAgentMcpExecutionReceipt } from './agentMcpExecutionReceipt';
import {
  createAgentMcpToolPolicyRiskLine,
  createAgentMcpToolRiskLine,
} from './agentMcpRiskSummary';
import {
  getToolNumberInput,
  getToolStringInput,
} from './agentRuntimeToolPreparation';
import { createAgentRuntimeResult } from './agentRuntimeToolResult';
import {
  describeAgentImportedSkill,
  loadEnabledAgentImportedSkills,
  matchesAgentImportedSkillQuery,
  resolveAgentImportedSkillInstructions,
  type AgentImportedSkillScope,
} from './agentImportedSkillRuntime';

interface AgentSkillRuntimeContext extends AgentImportedSkillScope {
  configRef: { current: PetConfig };
  signal?: AbortSignal | null;
}

function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function createSkillResult(lines: string[], observations: string[]): AgentChatCommandResult {
  return createAgentRuntimeResult({
    observations,
    ok: true,
    responseText: lines.join('\n'),
    verification: 'Skill/MCP foundation tool completed inside the local Agent registry.',
  });
}

function createMcpRequestId(serverId: string, toolName: string) {
  const safeRef = `${serverId}-${toolName}`.replace(/[^a-z0-9_-]+/giu, '-').slice(0, 64);
  return `agent-mcp-${safeRef}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function registerMcpAbortCancel(signal: AbortSignal | null | undefined, requestId: string) {
  if (!signal) {
    return null;
  }

  const cancelMcpToolCall = () => {
    void desktopPetShellRuntime.cancelMcpToolCall({ requestId });
  };
  signal.addEventListener('abort', cancelMcpToolCall, { once: true });
  return () => signal.removeEventListener('abort', cancelMcpToolCall);
}

// Skills are the ones the user imported and turned on for the character: instruction documents
// the character reads and then follows with its normal tools. (The old built-in "skills" only
// named tools the conversation loop now offers directly, and were removed.)
export function executeListAgentSkills(toolCall: AgentToolCallCommand, scope: AgentImportedSkillScope = {}) {
  const query = getToolStringInput(toolCall, ['query']);
  const limit = Math.max(1, Math.min(100, Math.round(getToolNumberInput(toolCall, 'limit') ?? 100)));
  const skills = loadEnabledAgentImportedSkills(scope)
    .filter((skill) => matchesAgentImportedSkillQuery(skill, query))
    .slice(0, limit);
  if (!skills.length) {
    return createSkillResult(
      [query ? `没有找到和“${query}”相关的技能。` : '这个角色还没有启用技能，可以在设置的技能页导入并给角色启用。'],
      ['Listed Agent skills: none'],
    );
  }
  return createSkillResult(
    [`找到 ${skills.length} 个技能：`, ...skills.map((skill) => `- ${skill.id}：${describeAgentImportedSkill(skill)}`)],
    [`Listed Agent skills: ${skills.map((skill) => skill.id).join(', ')}`],
  );
}

export async function executeAgentSkill(
  runtime: AgentSkillRuntimeContext,
  toolCall: AgentToolCallCommand,
) {
  const skillInput = {
    inputJson: getToolStringInput(toolCall, ['inputJson']),
    intent: getToolStringInput(toolCall, ['intent']),
    skillId: getToolStringInput(toolCall, ['skillId']),
  };
  const importedResult = resolveAgentImportedSkillInstructions(runtime, skillInput);
  if (importedResult) return createAgentRuntimeResult(importedResult);
  const message = `没有找到技能“${skillInput.skillId}”，或它没有给这个角色启用。先用 list 看看有哪些。`;
  return createAgentRuntimeResult({ errorText: message, observations: [], ok: false, responseText: message, verification: null });
}

// One short line per tool, grouped by server, so a long list still fits what the character reads:
// name(parameters, * = required), read-only or asks first, and a trimmed description.
function describeMcpToolParameters(inputSchema: Record<string, unknown>) {
  const properties = inputSchema.properties && typeof inputSchema.properties === 'object' ? Object.keys(inputSchema.properties as object) : [];
  const required = new Set(Array.isArray(inputSchema.required) ? inputSchema.required.filter((key): key is string => typeof key === 'string') : []);
  return properties.slice(0, 8).map((key) => `${key}${required.has(key) ? '*' : ''}`).join(', ');
}

export async function executeListMcpTools(toolCall: AgentToolCallCommand) {
  const serverId = getToolStringInput(toolCall, ['serverId']);
  const tools = await listAvailableAgentMcpTools(serverId || null);
  const servers = await listAvailableAgentMcpServers();
  const mcpConfig = await loadExternalAgentMcpConfig();
  const policyConfig = parseAgentMcpPolicyConfig(mcpConfig);
  const shownServers = servers.filter((server) => !serverId || server.id === serverId);
  const lines = shownServers.flatMap((server) => {
    const serverTools = tools.filter((tool) => tool.serverId === server.id);
    if (!serverTools.length) return [`【${server.id}】没有可用的工具（可能没启动成功）`];
    return [`【${server.id}】`, ...serverTools.map((tool) => {
      const access = !resolveAgentMcpPolicy(policyConfig, { serverId: tool.serverId, toolName: tool.name }).allowed
        ? '已禁用'
        : isDeclaredReadOnlyMcpTool(tool.serverId, tool.name) ? '只读' : '需确认';
      const description = (tool.description || tool.title || '').replace(/\s+/gu, ' ').trim().slice(0, 80);
      return `- ${tool.name}(${describeMcpToolParameters(tool.inputSchema ?? {})}) ${access}${description ? ` — ${description}` : ''}`;
    })];
  });

  return createSkillResult(
    [`找到 ${tools.length} 个 MCP 工具（${serverId || '全部扩展'}）。调用时 server_id 用【】里的名字，tool_name 用工具名。`, ...lines],
    [
      `MCP servers: ${servers.map((server) => server.id).join(', ')}`,
      `MCP tools listed: ${tools.map((tool) => `${tool.serverId}/${tool.name}`).join(', ') || 'none'}`,
      `MCP tool risk: ${tools.map(createAgentMcpToolRiskLine).join('; ') || 'none'}`,
      `MCP tool policy: ${tools.map((tool) => createAgentMcpToolPolicyRiskLine(tool, mcpConfig)).join('; ') || 'none'}`,
    ],
  );
}

export async function executeCallMcpTool(
  runtimeOrToolCall: Pick<AgentSkillRuntimeContext, 'signal'> | AgentToolCallCommand,
  maybeToolCall?: AgentToolCallCommand,
) {
  const runtime = maybeToolCall ? runtimeOrToolCall as Pick<AgentSkillRuntimeContext, 'signal'> : {};
  const toolCall = maybeToolCall ?? runtimeOrToolCall as AgentToolCallCommand;
  const serverId = getToolStringInput(toolCall, ['serverId']);
  const name = getToolStringInput(toolCall, ['name', 'toolName']);
  const requestId = createMcpRequestId(serverId, name);
  const startedAt = Date.now();
  const removeAbortListener = registerMcpAbortCancel(runtime.signal, requestId);
  const result = await callAvailableAgentMcpTool({
    argumentsJson: getToolStringInput(toolCall, ['argumentsJson']),
    name,
    requestId,
    serverId,
  }).finally(() => {
    removeAbortListener?.();
  });
  const elapsedMs = Date.now() - startedAt;
  const text = result.content.map((item) => item.text).join('\n');
  const responseText = result.structuredContent
    ? `${text}\n\nstructuredContent:\n${formatJson(result.structuredContent)}`
    : text;
  const receipt = createAgentMcpExecutionReceipt({
    elapsedMs,
    result,
    serverId,
    toolName: name,
  });

  return createAgentRuntimeResult({
    errorText: result.isError ? text : null,
    observations: [
      `Called MCP tool: ${serverId}/${name}`,
      `MCP tool result: ${result.isError ? 'error' : 'success'} in ${elapsedMs}ms`,
    ],
    ok: !result.isError,
    receipt,
    responseText,
    verification: receipt.verification,
  });
}
