import { type AgentChatCommandResult, type AgentToolCallCommand } from './agentChatCommand';
import { desktopPetShellRuntime } from '../desktopShellRuntime';
import { type PetConfig } from '../types';
import {
  mergeCharacterAnimationSkillResult,
  runCharacterAnimationSkill,
} from './agentCharacterSkillRuntime';
import {
  callAvailableAgentMcpTool,
  listAvailableAgentMcpServers,
  listAvailableAgentMcpTools,
} from './agentMcpRegistry';
import { loadExternalAgentMcpConfig } from './agentExternalMcpBridge';
import { createAgentMcpExecutionReceipt } from './agentMcpExecutionReceipt';
import {
  createAgentMcpToolPolicyRiskLine,
  createAgentMcpToolRiskLine,
} from './agentMcpRiskSummary';
import {
  listAgentSkills,
  resolveAgentSkillExecution,
} from './agentSkillRegistry';
import {
  getToolBooleanInput,
  getToolNumberInput,
  getToolStringInput,
} from './agentRuntimeToolPreparation';
import { createAgentRuntimeResult } from './agentRuntimeToolResult';
import { loadEnabledAgentImportedSkills, matchesAgentImportedSkillQuery, resolveAgentImportedSkillInstructions, type AgentImportedSkillScope } from './agentImportedSkillRuntime';

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

export function executeListAgentSkills(toolCall: AgentToolCallCommand, scope: AgentImportedSkillScope = {}) {
  const query = getToolStringInput(toolCall, ['query']);
  const limit = Math.max(1, Math.min(100, Math.round(getToolNumberInput(toolCall, 'limit') ?? 100)));
  const skills = [
    ...listAgentSkills({ query }),
    ...loadEnabledAgentImportedSkills(scope).filter((skill) => matchesAgentImportedSkillQuery(skill, query))
      .map((skill) => ({ ...skill, stage: 'imported' })),
  ].slice(0, limit);
  const lines = skills.map((skill) => (
    `- ${skill.id}: ${skill.title} (${skill.stage}, ${skill.risk})`
  ));

  return createSkillResult(
    [`找到 ${skills.length} 个 Agent Skill。`, ...lines],
    [`Listed Agent skills: ${skills.map((skill) => skill.id).join(', ') || 'none'}`],
  );
}

function createAgentSkillInput(toolCall: AgentToolCallCommand) {
  return {
    dryRun: getToolBooleanInput(toolCall, 'dryRun') ?? true,
    inputJson: getToolStringInput(toolCall, ['inputJson']),
    intent: getToolStringInput(toolCall, ['intent']),
    skillId: getToolStringInput(toolCall, ['skillId']),
    target: getToolStringInput(toolCall, ['target']),
  };
}

async function resolveRuntimeCharacterMotionBindings() {
  const module = await import('../pet-runtime/content/petModelMotionBindings');
  return module.resolvePetModelMotionBindingsForModel;
}

export async function executeAgentSkill(
  runtime: AgentSkillRuntimeContext,
  toolCall: AgentToolCallCommand,
) {
  const skillInput = createAgentSkillInput(toolCall);
  const importedResult = resolveAgentImportedSkillInstructions(runtime, skillInput);
  if (importedResult) return createAgentRuntimeResult(importedResult);
  const baseResult = resolveAgentSkillExecution(skillInput);
  const resolveMotionBindings = baseResult.ok && baseResult.skill?.id === 'character.animation'
    ? await resolveRuntimeCharacterMotionBindings()
    : null;
  const result = baseResult.ok && baseResult.skill?.id === 'character.animation'
    ? mergeCharacterAnimationSkillResult(
        baseResult,
        runCharacterAnimationSkill({
          config: runtime.configRef.current,
          dryRun: skillInput.dryRun,
          input: baseResult.input,
          intent: skillInput.intent,
          resolveMotionBindings: ({ customModelPresets, modelType, modelUrl }) => (
            resolveMotionBindings?.(modelType, modelUrl, customModelPresets) ?? []
          ),
          target: skillInput.target,
        }),
      )
    : baseResult;
  const lines = [
    result.ok ? `Skill 已解析：${result.skill?.id}` : result.summary,
    result.marker ? `标记：${result.marker}` : '',
    `推荐工具：${result.preferredToolNames.length ? result.preferredToolNames.join(', ') : '暂无'}`,
    `输入：${formatJson(result.input)}`,
  ].filter(Boolean);

  return createAgentRuntimeResult({
    errorText: result.ok ? null : result.summary,
    observations: result.observations,
    ok: result.ok,
    responseText: lines.join('\n'),
    verification: result.ok
      ? 'Skill execution was resolved locally; character.animation can queue existing animation triggers when dryRun is false.'
      : null,
  });
}

export async function executeListMcpTools(toolCall: AgentToolCallCommand) {
  const serverId = getToolStringInput(toolCall, ['serverId']);
  const tools = await listAvailableAgentMcpTools(serverId || null);
  const servers = await listAvailableAgentMcpServers();
  const mcpConfig = await loadExternalAgentMcpConfig();
  const serverText = serverId || 'all servers';
  const lines = tools.map((tool) => (
    `- ${tool.serverId}/${tool.name}: ${tool.title} [${createAgentMcpToolPolicyRiskLine(tool, mcpConfig)}]`
  ));

  return createSkillResult(
    [`找到 ${tools.length} 个 MCP 工具（${serverText}）。`, ...lines],
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
