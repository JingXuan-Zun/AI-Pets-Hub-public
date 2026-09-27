import {
  createAgentMcpToolPolicyKey,
  parseAgentMcpPolicyConfig,
  type AgentMcpPolicyMode,
} from '../../agent/agentMcpPolicy';

export type SettingsMcpToolPolicyModeDraft = 'inherit' | AgentMcpPolicyMode;

export interface SettingsMcpToolPolicyDraft {
  mode: SettingsMcpToolPolicyModeDraft;
  retryCountText: string;
  timeoutMsText: string;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function getMcpPolicyText(configText: string) {
  try {
    const config = JSON.parse(configText || '{}') as unknown;
    return JSON.stringify(asRecord(asRecord(config).policies), null, 2);
  } catch {
    return '{}';
  }
}

export function applyMcpPolicyTextToConfigText(
  configText: string,
  policyText: string,
): { error: string | null; rawText: string } {
  let config: Record<string, unknown>;
  let policies: unknown;
  try {
    config = asRecord(JSON.parse(configText || '{"servers":[]}') as unknown);
    policies = JSON.parse(policyText || '{}') as unknown;
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Invalid MCP policy JSON.', rawText: configText };
  }

  if (!policies || typeof policies !== 'object' || Array.isArray(policies)) {
    return { error: 'MCP policies must be a JSON object.', rawText: configText };
  }

  parseAgentMcpPolicyConfig({ policies });
  return {
    error: null,
    rawText: `${JSON.stringify({ ...config, policies }, null, 2)}\n`,
  };
}

function getToolRule(config: Record<string, unknown>, serverId: string, toolName: string) {
  const policies = asRecord(config.policies);
  const tools = asRecord(policies.tools);
  return asRecord(tools[createAgentMcpToolPolicyKey(serverId, toolName)]);
}

function normalizePolicyNumberText(value: unknown) {
  return Number.isFinite(Number(value)) ? String(Math.round(Number(value))) : '';
}

export function getMcpToolPolicyDraft(
  configText: string,
  tool: { name: string; serverId: string },
): SettingsMcpToolPolicyDraft {
  try {
    const config = asRecord(JSON.parse(configText || '{}') as unknown);
    const rule = getToolRule(config, tool.serverId, tool.name);
    const mode = rule.mode === 'allow' || rule.mode === 'deny' ? rule.mode : 'inherit';
    return {
      mode,
      retryCountText: normalizePolicyNumberText(rule.retryCount ?? rule.retries),
      timeoutMsText: normalizePolicyNumberText(rule.timeoutMs),
    };
  } catch {
    return { mode: 'inherit', retryCountText: '', timeoutMsText: '' };
  }
}

function parseOptionalInteger(text: string, label: string, min: number, max: number) {
  if (!text.trim()) {
    return { value: null };
  }

  const value = Number(text);
  if (!Number.isFinite(value)) {
    return { error: `${label} must be a number.`, value: null };
  }

  return { value: Math.max(min, Math.min(max, Math.round(value))) };
}

function createToolPolicyRule(draft: SettingsMcpToolPolicyDraft) {
  const timeout = parseOptionalInteger(draft.timeoutMsText, 'timeoutMs', 1000, 120_000);
  if (timeout.error) {
    return { error: timeout.error, rule: {} };
  }

  const retry = parseOptionalInteger(draft.retryCountText, 'retryCount', 0, 3);
  if (retry.error) {
    return { error: retry.error, rule: {} };
  }

  return {
    error: null,
    rule: {
      ...(draft.mode === 'inherit' ? {} : { mode: draft.mode }),
      ...(retry.value == null ? {} : { retryCount: retry.value }),
      ...(timeout.value == null ? {} : { timeoutMs: timeout.value }),
    },
  };
}

export function applyMcpToolPolicyDraftToConfigText(
  configText: string,
  tool: { name: string; serverId: string },
  draft: SettingsMcpToolPolicyDraft,
): { error: string | null; rawText: string } {
  let config: Record<string, unknown>;
  try {
    config = asRecord(JSON.parse(configText || '{"servers":[]}') as unknown);
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Invalid MCP config JSON.', rawText: configText };
  }

  const result = createToolPolicyRule(draft);
  if (result.error) {
    return { error: result.error, rawText: configText };
  }

  const policies = asRecord(config.policies);
  const tools = { ...asRecord(policies.tools) };
  const key = createAgentMcpToolPolicyKey(tool.serverId, tool.name);
  if (Object.keys(result.rule).length) {
    tools[key] = result.rule;
  } else {
    delete tools[key];
  }

  return {
    error: null,
    rawText: `${JSON.stringify({ ...config, policies: { ...policies, tools } }, null, 2)}\n`,
  };
}
