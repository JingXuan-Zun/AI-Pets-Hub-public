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

// chrome-devtools marks these two "not read-only" only because they can save to a file
// (filePath). Without filePath they just look at the page in her own browser.
const VIEW_ONLY_WITHOUT_FILE = new Set(['take_snapshot', 'take_screenshot']);

/** Read-only as declared, or a known look-only call; such calls run without a card. */
export function isReadOnlyMcpCall(serverId: string, toolName: string, argumentsJson: string, isChromeDevtools: boolean) {
  if (isDeclaredReadOnlyMcpTool(serverId, toolName)) return true;
  if (!isChromeDevtools || !VIEW_ONLY_WITHOUT_FILE.has(toolName)) return false;
  try {
    const input = argumentsJson.trim() ? JSON.parse(argumentsJson) as Record<string, unknown> : {};
    return !input || typeof input !== 'object' || !('filePath' in input);
  } catch {
    return false;
  }
}

const listedServers = new Map<string, Promise<void>>();
const toolSchemas = new Map<string, unknown>();

function schemaTypes(schema: unknown): string[] {
  const type = schema && typeof schema === 'object' ? (schema as Record<string, unknown>).type : undefined;
  return Array.isArray(type) ? type.filter((item): item is string => typeof item === 'string') : typeof type === 'string' ? [type] : [];
}

/**
 * Fixes the value types models often get wrong against the tool's own input schema:
 * "1" for a number (chrome-devtools navigate_page failed on pageId "1", benchmark 2026-11-05),
 * "true" for a boolean, 3 for a string. Anything else is passed on unchanged.
 */
export function coerceMcpArguments(schema: unknown, input: Record<string, unknown>) {
  const properties = schema && typeof schema === 'object' ? (schema as Record<string, unknown>).properties : null;
  if (!properties || typeof properties !== 'object') return input;
  const out: Record<string, unknown> = { ...input };
  for (const [key, value] of Object.entries(input)) {
    const types = schemaTypes((properties as Record<string, unknown>)[key]);
    if (!types.length || types.includes(typeof value === 'number' ? (Number.isInteger(value) ? 'integer' : 'number') : typeof value)) continue;
    if (typeof value === 'string' && (types.includes('number') || types.includes('integer')) && /^-?\d+(?:\.\d+)?$/u.test(value.trim())) {
      out[key] = Number(value.trim());
    } else if (typeof value === 'string' && types.includes('boolean') && /^(?:true|false)$/iu.test(value.trim())) {
      out[key] = value.trim().toLowerCase() === 'true';
    } else if ((typeof value === 'number' || typeof value === 'boolean') && types.includes('string')) {
      out[key] = String(value);
    }
  }
  return out;
}

/**
 * Lists a server's tools once before its first call, so the read-only check knows them. She
 * often calls a tool straight away without listing (time/get_current_time asked for a card).
 */
export function ensureMcpToolsListed(serverId: string) {
  const id = serverId.trim();
  if (!id) return Promise.resolve();
  let pending = listedServers.get(id);
  if (!pending) {
    pending = listAvailableAgentMcpTools(id).then(() => undefined, () => { listedServers.delete(id); });
    listedServers.set(id, pending);
  }
  return pending;
}

export async function listAvailableAgentMcpTools(serverId?: string | null) {
  const tools = (await listExternalAgentMcpRegistry(serverId?.trim() || null)).tools;
  tools.forEach((tool) => listedServers.set(tool.serverId, listedServers.get(tool.serverId) ?? Promise.resolve()));
  tools.forEach((tool) => {
    const key = `${tool.serverId}/${tool.name}`;
    toolSchemas.set(key, tool.inputSchema);
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

  await ensureMcpToolsListed(request.serverId);
  input = coerceMcpArguments(toolSchemas.get(`${request.serverId}/${request.name}`), input);

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
