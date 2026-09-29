import { desktopPetShellRuntime } from '../desktopShellRuntime';
import {
  type AgentMcpContentType,
  type AgentMcpServerDefinition,
  type AgentMcpToolAnnotations,
  type AgentMcpToolCallResult,
  type AgentMcpToolDefinition,
} from './agentMcpTypes';

interface ExternalMcpToolListResult {
  ok?: boolean;
  servers?: unknown[];
  tools?: unknown[];
}

interface ExternalMcpRuntime {
  callMcpTool: (request?: {
    arguments?: Record<string, unknown>;
    name?: string;
    requestId?: string;
    serverId?: string;
  }) => Promise<unknown>;
  cancelMcpToolCall?: (request?: { requestId?: string }) => Promise<unknown>;
  loadMcpConfig?: () => Promise<DesktopPetMcpConfigResultLike>;
  listMcpTools: (request?: { serverId?: string | null }) => Promise<ExternalMcpToolListResult>;
}

export interface AgentExternalMcpRegistrySnapshot {
  servers: AgentMcpServerDefinition[];
  tools: AgentMcpToolDefinition[];
}

let runtimeOverride: ExternalMcpRuntime | null = null;

function normalizeRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function normalizeContentType(value: unknown): AgentMcpContentType {
  return value === 'json' ? 'json' : 'text';
}

function normalizeToolAnnotations(value: unknown): AgentMcpToolAnnotations | undefined {
  const annotations = normalizeRecord(value);
  const normalized: AgentMcpToolAnnotations = {
    ...(typeof annotations.destructiveHint === 'boolean' ? { destructiveHint: annotations.destructiveHint } : {}),
    ...(typeof annotations.idempotentHint === 'boolean' ? { idempotentHint: annotations.idempotentHint } : {}),
    ...(typeof annotations.openWorldHint === 'boolean' ? { openWorldHint: annotations.openWorldHint } : {}),
    ...(typeof annotations.readOnlyHint === 'boolean' ? { readOnlyHint: annotations.readOnlyHint } : {}),
    ...(typeof annotations.title === 'string' && annotations.title.trim() ? { title: annotations.title.trim() } : {}),
  };
  return Object.keys(normalized).length ? normalized : undefined;
}

function getExternalMcpRuntime(): ExternalMcpRuntime | null {
  if (runtimeOverride) {
    return runtimeOverride;
  }

  if (typeof window === 'undefined' || !window.desktopPetShell?.desktopMode) {
    return null;
  }

  return desktopPetShellRuntime as ExternalMcpRuntime;
}

function normalizeExternalTool(rawTool: unknown): AgentMcpToolDefinition | null {
  const tool = normalizeRecord(rawTool);
  const name = typeof tool.name === 'string' ? tool.name.trim() : '';
  const serverId = typeof tool.serverId === 'string' ? tool.serverId.trim() : '';
  if (!name || !serverId) {
    return null;
  }
  const annotations = normalizeToolAnnotations(tool.annotations);

  return {
    ...(annotations ? { annotations } : {}),
    description: typeof tool.description === 'string' ? tool.description : '',
    inputSchema: normalizeRecord(tool.inputSchema),
    name,
    serverId,
    title: typeof tool.title === 'string' && tool.title.trim() ? tool.title.trim() : name,
  };
}

function normalizeExternalServers(rawServers: unknown[], tools: AgentMcpToolDefinition[]) {
  const serverById = new Map<string, Omit<AgentMcpServerDefinition, 'tools'>>();
  for (const rawServer of rawServers) {
    const server = normalizeRecord(rawServer);
    const id = typeof server.id === 'string' ? server.id.trim() : '';
    if (id) {
      serverById.set(id, {
        description: typeof server.description === 'string' ? server.description : '',
        id,
        title: typeof server.title === 'string' && server.title.trim() ? server.title.trim() : id,
      });
    }
  }

  for (const tool of tools) {
    if (!serverById.has(tool.serverId)) {
      serverById.set(tool.serverId, { description: '', id: tool.serverId, title: tool.serverId });
    }
  }

  return [...serverById.values()].map((server) => ({
    ...server,
    tools: tools.filter((tool) => tool.serverId === server.id),
  }));
}

function normalizeExternalCallResult(rawResult: unknown): AgentMcpToolCallResult {
  const result = normalizeRecord(rawResult);
  const contentItems = Array.isArray(result.content) ? result.content : [];
  const content = contentItems.map((item) => {
    const record = normalizeRecord(item);
    return {
      text: typeof record.text === 'string' ? record.text : JSON.stringify(item ?? null),
      type: normalizeContentType(record.type),
    };
  });

  return {
    content: content.length ? content : [{ text: JSON.stringify(rawResult ?? {}), type: 'json' }],
    isError: Boolean(result.isError),
    structuredContent: normalizeRecord(result.structuredContent),
  };
}

export function setAgentExternalMcpRuntimeOverride(runtime: ExternalMcpRuntime | null) {
  runtimeOverride = runtime;
}

export async function listExternalAgentMcpRegistry(
  serverId?: string | null,
): Promise<AgentExternalMcpRegistrySnapshot> {
  const runtime = getExternalMcpRuntime();
  if (!runtime) {
    return { servers: [], tools: [] };
  }

  const result = await runtime.listMcpTools({ serverId });
  if (result?.ok === false) {
    return { servers: [], tools: [] };
  }

  const tools = (Array.isArray(result?.tools) ? result.tools : [])
    .map(normalizeExternalTool)
    .filter((tool): tool is AgentMcpToolDefinition => Boolean(tool));

  return {
    servers: normalizeExternalServers(Array.isArray(result?.servers) ? result.servers : [], tools),
    tools,
  };
}

export async function callExternalAgentMcpTool(
  request: { name: string; serverId: string },
  input: Record<string, unknown>,
  options: { requestId?: string | null } = {},
): Promise<AgentMcpToolCallResult> {
  const runtime = getExternalMcpRuntime();
  if (!runtime) {
    return {
      content: [{ text: 'External MCP runtime is not available.', type: 'text' }],
      isError: true,
      structuredContent: null,
    };
  }

  try {
    return normalizeExternalCallResult(await runtime.callMcpTool({
      arguments: input,
      name: request.name,
      requestId: options.requestId?.trim() || undefined,
      serverId: request.serverId,
    }));
  } catch (error) {
    return {
      content: [{ text: error instanceof Error ? error.message : String(error), type: 'text' }],
      isError: true,
      structuredContent: null,
    };
  }
}

export async function cancelExternalAgentMcpToolCall(requestId: string) {
  const runtime = getExternalMcpRuntime();
  if (!runtime?.cancelMcpToolCall) {
    return { cancelled: false, ok: false, requestId };
  }

  try {
    return await runtime.cancelMcpToolCall({ requestId });
  } catch (error) {
    return {
      cancelled: false,
      error: error instanceof Error ? error.message : String(error),
      ok: false,
      requestId,
    };
  }
}

export async function loadExternalAgentMcpConfig(): Promise<Record<string, unknown>> {
  const runtime = getExternalMcpRuntime();
  if (!runtime?.loadMcpConfig) {
    return {};
  }

  try {
    const result = await runtime.loadMcpConfig();
    return result.ok && result.config && typeof result.config === 'object'
      ? result.config
      : {};
  } catch {
    return {};
  }
}
