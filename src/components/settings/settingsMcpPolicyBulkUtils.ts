import {
  createAgentMcpToolPolicyKey,
  parseAgentMcpPolicyConfig,
} from '../../agent/agentMcpPolicy';
import { summarizeAgentMcpToolRisk } from '../../agent/agentMcpRiskSummary';

export type SettingsMcpPolicyPresetId = 'allow-listed' | 'deny-high-risk' | 'short-timeout';

type SettingsMcpPolicyTool = {
  annotations?: DesktopPetMcpToolLike['annotations'];
  description?: string;
  inputSchema?: Record<string, unknown>;
  name: string;
  serverId: string;
  title?: string;
};

export const SETTINGS_MCP_POLICY_PRESETS: Array<{
  description: string;
  id: SettingsMcpPolicyPresetId;
  label: string;
}> = [
  {
    description: 'Set listed tools to allow while preserving retry and timeout fields.',
    id: 'allow-listed',
    label: 'Allow listed',
  },
  {
    description: 'Deny destructive-like tools and allow the rest of the selected scope.',
    id: 'deny-high-risk',
    label: 'Deny high risk',
  },
  {
    description: 'Apply 10s timeout and zero retries to selected tools.',
    id: 'short-timeout',
    label: '10s timeout',
  },
];

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function parseConfigText(configText: string) {
  try {
    return { config: asRecord(JSON.parse(configText || '{"servers":[]}') as unknown), error: null };
  } catch (error) {
    return {
      config: null,
      error: error instanceof Error ? error.message : 'Invalid MCP config JSON.',
    };
  }
}

function getScopedPolicyTools(tools: SettingsMcpPolicyTool[], serverId?: string | null) {
  const normalizedServerId = serverId?.trim() || '';
  const scopedTools = normalizedServerId
    ? tools.filter((tool) => tool.serverId === normalizedServerId)
    : tools;
  return [...new Map(scopedTools.map((tool) => [
    createAgentMcpToolPolicyKey(tool.serverId, tool.name),
    tool,
  ])).values()];
}

function createPresetToolRule(
  presetId: SettingsMcpPolicyPresetId,
  tool: SettingsMcpPolicyTool,
  existingRule: Record<string, unknown>,
) {
  if (presetId === 'allow-listed') {
    return { ...existingRule, mode: 'allow' };
  }

  if (presetId === 'short-timeout') {
    return { ...existingRule, retryCount: 0, timeoutMs: 10_000 };
  }

  const risk = summarizeAgentMcpToolRisk(tool).risk;
  return { ...existingRule, mode: risk === 'destructive-like' ? 'deny' : 'allow' };
}

function writePolicyTools(config: Record<string, unknown>, tools: Record<string, unknown>) {
  const policies = asRecord(config.policies);
  parseAgentMcpPolicyConfig({ policies: { ...policies, tools } });
  return `${JSON.stringify({ ...config, policies: { ...policies, tools } }, null, 2)}\n`;
}

export function applyMcpPolicyPresetToConfigText(
  configText: string,
  tools: SettingsMcpPolicyTool[],
  presetId: SettingsMcpPolicyPresetId,
  serverId?: string | null,
): { changedCount: number; error: string | null; rawText: string } {
  const parsed = parseConfigText(configText);
  if (parsed.error || !parsed.config) {
    return { changedCount: 0, error: parsed.error, rawText: configText };
  }

  if (!SETTINGS_MCP_POLICY_PRESETS.some((preset) => preset.id === presetId)) {
    return { changedCount: 0, error: 'Unknown MCP policy preset.', rawText: configText };
  }

  const scopedTools = getScopedPolicyTools(tools, serverId);
  const policyTools = { ...asRecord(asRecord(parsed.config.policies).tools) };
  for (const tool of scopedTools) {
    const key = createAgentMcpToolPolicyKey(tool.serverId, tool.name);
    policyTools[key] = createPresetToolRule(presetId, tool, asRecord(policyTools[key]));
  }

  return {
    changedCount: scopedTools.length,
    error: null,
    rawText: writePolicyTools(parsed.config, policyTools),
  };
}

export function clearMcpToolPoliciesInConfigText(
  configText: string,
  tools: Array<{ name: string; serverId: string }>,
  serverId?: string | null,
): { changedCount: number; error: string | null; rawText: string } {
  const parsed = parseConfigText(configText);
  if (parsed.error || !parsed.config) {
    return { changedCount: 0, error: parsed.error, rawText: configText };
  }

  const scopedTools = getScopedPolicyTools(tools, serverId);
  const policyTools = { ...asRecord(asRecord(parsed.config.policies).tools) };
  for (const tool of scopedTools) {
    delete policyTools[createAgentMcpToolPolicyKey(tool.serverId, tool.name)];
  }

  return {
    changedCount: scopedTools.length,
    error: null,
    rawText: writePolicyTools(parsed.config, policyTools),
  };
}
