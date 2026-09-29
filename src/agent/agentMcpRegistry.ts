import {
  listAgentSkills,
  resolveAgentSkillExecution,
} from './agentSkillRegistry';
import { createAgentSkillAuthoringScaffold } from './agentSkillAuthoringScaffold';
import { createAgentSkillManifest } from './agentSkillManifest';
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
import {
  type AgentMcpServerDefinition,
  type AgentMcpToolCallRequest,
  type AgentMcpToolCallResult,
  type AgentMcpToolDefinition,
} from './agentMcpTypes';

function createJsonText(value: unknown) {
  return JSON.stringify(value, null, 2);
}

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

function createMcpTool(
  serverId: string,
  name: string,
  title: string,
  description: string,
  inputSchema: Record<string, unknown>,
): AgentMcpToolDefinition {
  return {
    description,
    inputSchema,
    name,
    serverId,
    title,
  };
}

const PLATFORM_SERVER_ID = 'platform';
const PLATFORM_SKILL_MANIFEST_TOOL_NAME = 'skills.manifest';
const PLATFORM_SKILL_SCAFFOLD_TOOL_NAME = 'skills.scaffold';

const AGENT_MCP_SERVERS: AgentMcpServerDefinition[] = [
  {
    description: 'Local platform MCP facade for Agent skill discovery and skill execution.',
    id: PLATFORM_SERVER_ID,
    title: 'AI Desktop Pet Platform',
    tools: [
      createMcpTool(
        PLATFORM_SERVER_ID,
        'skills.list',
        'List Agent Skills',
        'List platform skills without executing them.',
        {
          properties: {
            limit: { type: 'number' },
            query: { type: 'string' },
          },
          type: 'object',
        },
      ),
      createMcpTool(
        PLATFORM_SERVER_ID,
        'skills.execute',
        'Execute Agent Skill',
        'Resolve one platform skill into a safe tool route or dry-run marker.',
        {
          properties: {
            dryRun: { type: 'boolean' },
            inputJson: { type: 'string' },
            intent: { type: 'string' },
            skillId: { type: 'string' },
            target: { type: 'string' },
          },
          required: ['skillId'],
          type: 'object',
        },
      ),
      createMcpTool(
        PLATFORM_SERVER_ID,
        PLATFORM_SKILL_MANIFEST_TOOL_NAME,
        'Agent Skill Manifest',
        'Export skill metadata, route summaries, input keys, and stage/risk counts without executing skills.',
        {
          properties: {},
          type: 'object',
        },
      ),
      createMcpTool(
        PLATFORM_SERVER_ID,
        PLATFORM_SKILL_SCAFFOLD_TOOL_NAME,
        'Agent Skill Scaffold',
        'Export a JSON authoring scaffold for one registered Skill without installing or executing it.',
        {
          properties: {
            skillId: { type: 'string' },
          },
          required: ['skillId'],
          type: 'object',
        },
      ),
    ],
  },
];

const AGENT_MCP_SERVER_BY_ID = new Map(
  AGENT_MCP_SERVERS.map((server) => [server.id, server]),
);

function isPlatformMcpServer(serverId: string) {
  return serverId === PLATFORM_SERVER_ID;
}

function getMcpTool(serverId: string, toolName: string) {
  return AGENT_MCP_SERVER_BY_ID.get(serverId)?.tools.find((tool) => tool.name === toolName) ?? null;
}

function callPlatformMcpTool(toolName: string, input: Record<string, unknown>): AgentMcpToolCallResult {
  if (toolName === 'skills.list') {
    const skills = listAgentSkills({
      limit: typeof input.limit === 'number' ? input.limit : null,
      query: typeof input.query === 'string' ? input.query : null,
    });
    return {
      content: [{ text: createJsonText(skills), type: 'json' }],
      structuredContent: { skills },
    };
  }

  if (toolName === 'skills.execute') {
    const result = resolveAgentSkillExecution({
      dryRun: typeof input.dryRun === 'boolean' ? input.dryRun : null,
      inputJson: typeof input.inputJson === 'string' ? input.inputJson : null,
      intent: typeof input.intent === 'string' ? input.intent : null,
      skillId: typeof input.skillId === 'string' ? input.skillId : '',
      target: typeof input.target === 'string' ? input.target : null,
    });
    return {
      content: [{ text: createJsonText(result), type: 'json' }],
      isError: !result.ok,
      structuredContent: { result },
    };
  }

  if (toolName === PLATFORM_SKILL_MANIFEST_TOOL_NAME) {
    const manifest = createAgentSkillManifest();
    return {
      content: [{ text: createJsonText(manifest), type: 'json' }],
      structuredContent: { manifest },
    };
  }

  if (toolName === PLATFORM_SKILL_SCAFFOLD_TOOL_NAME) {
    const skillId = typeof input.skillId === 'string' ? input.skillId : '';
    const scaffold = createAgentSkillAuthoringScaffold(skillId);
    return scaffold
      ? {
          content: [{ text: createJsonText(scaffold), type: 'json' }],
          structuredContent: { scaffold },
        }
      : {
          content: [{ text: `Unknown Agent skill: ${skillId || '(missing)'}`, type: 'text' }],
          isError: true,
          structuredContent: null,
        };
  }

  return {
    content: [{ text: `Unknown platform MCP tool: ${toolName}`, type: 'text' }],
    isError: true,
    structuredContent: null,
  };
}

export function listAgentMcpServers() {
  return AGENT_MCP_SERVERS;
}

export function listAgentMcpTools(serverId?: string | null) {
  const servers = serverId?.trim()
    ? AGENT_MCP_SERVERS.filter((server) => server.id === serverId.trim())
    : AGENT_MCP_SERVERS;

  return servers.flatMap((server) => server.tools);
}

export async function listAvailableAgentMcpServers() {
  const externalRegistry = await listExternalAgentMcpRegistry();
  return [...AGENT_MCP_SERVERS, ...externalRegistry.servers];
}

export async function listAvailableAgentMcpTools(serverId?: string | null) {
  const normalizedServerId = serverId?.trim() || null;
  const localTools = listAgentMcpTools(normalizedServerId);
  if (normalizedServerId && isPlatformMcpServer(normalizedServerId)) {
    return localTools;
  }

  const externalRegistry = await listExternalAgentMcpRegistry(normalizedServerId);
  return [...localTools, ...externalRegistry.tools];
}

export function callAgentMcpTool(request: AgentMcpToolCallRequest): AgentMcpToolCallResult {
  const tool = getMcpTool(request.serverId, request.name);
  if (!tool) {
    return {
      content: [{ text: `Unknown MCP tool: ${request.serverId}/${request.name}`, type: 'text' }],
      isError: true,
      structuredContent: null,
    };
  }

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

  if (isPlatformMcpServer(request.serverId)) {
    return callPlatformMcpTool(request.name, input);
  }

  return {
    content: [{ text: `MCP server is registered but has no caller: ${request.serverId}`, type: 'text' }],
    isError: true,
    structuredContent: null,
  };
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

  if (isPlatformMcpServer(request.serverId)) {
    return callPlatformMcpTool(request.name, input);
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
