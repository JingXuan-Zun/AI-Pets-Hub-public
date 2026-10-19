import {
  cancelExternalAgentMcpToolCall,
  callExternalAgentMcpTool,
  listExternalAgentMcpRegistry,
  loadExternalAgentMcpConfig,
} from './agentExternalMcpBridge';
import {
  parseAgentMcpPolicyConfig,
  resolveAgentMcpPolicy,
} from './agentMcpPolicy';
import { executeMcpCallWithPolicy } from './agentMcpPolicyRuntime';
import { summarizeAgentMcpToolRisk } from './agentMcpRiskSummary';
import {
  type AgentMcpToolCallRequest,
  type AgentMcpToolCallResult,
} from './agentMcpTypes';

function parseMcpArguments(value?: string | null): Record<string, unknown> {
  if (!value?.trim()) {
    return {};
  }
  if (new TextEncoder().encode(value).byteLength > 64 * 1024) {
    throw new Error('MCP tool argumentsJson exceeds the 64 KiB limit.');
  }

  const parsedValue = JSON.parse(value) as unknown;
  if (!parsedValue || typeof parsedValue !== 'object' || Array.isArray(parsedValue)) {
    throw new Error('MCP tool argumentsJson must decode to a JSON object.');
  }

  return parsedValue as Record<string, unknown>;
}

// MCP tools come from the servers the user configured. (A built-in "platform" server that
// exposed the old built-in skills over MCP was removed with them.)

export async function listAvailableAgentMcpServers() {
  return (await listExternalAgentMcpRegistry()).servers;
}

// Tools the server itself declares read-only (readOnlyHint, not destructive), remembered when
// tools are listed, so calling them does not ask for confirmation each time.
const declaredReadOnlyTools = new Set<string>();

export function isDeclaredReadOnlyMcpTool(serverId: string, toolName: string) {
  return declaredReadOnlyTools.has(`${serverId}/${toolName}`);
}

export async function listAvailableAgentMcpTools(serverId?: string | null) {
  const tools = (await listExternalAgentMcpRegistry(serverId?.trim() || null)).tools;
  tools.forEach((tool) => {
    const key = `${tool.serverId}/${tool.name}`;
    const risk = summarizeAgentMcpToolRisk(tool);
    if (risk.risk === 'read' && risk.schemaSignals.includes('annotation:read-only')) declaredReadOnlyTools.add(key);
    else declaredReadOnlyTools.delete(key);
  });
  return tools;
}

export async function callAvailableAgentMcpTool(
  request: AgentMcpToolCallRequest,
): Promise<AgentMcpToolCallResult> {
  let input: Record<string, unknown>;
  try {
    input = parseMcpArguments(request.argumentsJson);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid MCP argumentsJson.';
    return {
      content: [{ text: message, type: 'text' }],
      isError: true,
      structuredContent: null,
    };
  }

  const policyConfig = parseAgentMcpPolicyConfig(await loadExternalAgentMcpConfig());
  const policy = resolveAgentMcpPolicy(policyConfig, {
    serverId: request.serverId,
    toolName: request.name,
  });

  const requestId = request.requestId?.trim() || '';
  return executeMcpCallWithPolicy(policy, () => callExternalAgentMcpTool({
    name: request.name,
    serverId: request.serverId,
  }, input, { requestId }), {
    onTimeout: requestId ? () => {
      void cancelExternalAgentMcpToolCall(requestId);
    } : undefined,
  });
}
