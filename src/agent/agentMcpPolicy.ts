export type AgentMcpPolicyMode = 'allow' | 'deny';
export type AgentMcpPolicySource = 'default' | 'implicit' | 'server' | 'tool';

export interface AgentMcpPolicyRule {
  mode?: AgentMcpPolicyMode;
  retryCount?: number | null;
  timeoutMs?: number | null;
}

export interface AgentMcpPolicyConfig {
  defaultRule: AgentMcpPolicyRule;
  serverRules: Record<string, AgentMcpPolicyRule>;
  toolRules: Record<string, AgentMcpPolicyRule>;
}

export interface AgentMcpPolicyDecision {
  allowed: boolean;
  mode: AgentMcpPolicyMode;
  reason: string;
  retryCount: number;
  source: AgentMcpPolicySource;
  timeoutMs: number | null;
}

const DEFAULT_POLICY: AgentMcpPolicyRule = { mode: 'allow', retryCount: 0, timeoutMs: null };

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function normalizeMode(value: unknown): AgentMcpPolicyMode | undefined {
  if (value === 'allow' || value === 'deny') {
    return value;
  }

  if (typeof value === 'boolean') {
    return value ? 'allow' : 'deny';
  }

  return undefined;
}

function normalizeBoundedInteger(value: unknown, min: number, max: number) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    return null;
  }

  return Math.max(min, Math.min(max, Math.round(numberValue)));
}

function normalizeRule(value: unknown): AgentMcpPolicyRule {
  const record = asRecord(value);
  const mode = normalizeMode(record.mode ?? record.enabled ?? record.allow);
  return {
    ...(mode ? { mode } : {}),
    retryCount: normalizeBoundedInteger(record.retryCount ?? record.retries, 0, 3),
    timeoutMs: normalizeBoundedInteger(record.timeoutMs, 1000, 120_000),
  };
}

function normalizeRuleMap(value: unknown) {
  return Object.fromEntries(
    Object.entries(asRecord(value)).map(([key, rule]) => [key.trim(), normalizeRule(rule)]),
  );
}

function mergeRules(...rules: AgentMcpPolicyRule[]) {
  return rules.reduce<AgentMcpPolicyRule>((merged, rule) => ({
    mode: rule.mode ?? merged.mode,
    retryCount: rule.retryCount ?? merged.retryCount,
    timeoutMs: rule.timeoutMs ?? merged.timeoutMs,
  }), DEFAULT_POLICY);
}

export function createAgentMcpToolPolicyKey(serverId: string, toolName: string) {
  return `${serverId.trim()}/${toolName.trim()}`;
}

export function parseAgentMcpPolicyConfig(config: unknown): AgentMcpPolicyConfig {
  const policies = asRecord(asRecord(config).policies);
  return {
    defaultRule: normalizeRule(policies.default),
    serverRules: normalizeRuleMap(policies.servers),
    toolRules: normalizeRuleMap(policies.tools),
  };
}

export function resolveAgentMcpPolicy(
  config: AgentMcpPolicyConfig,
  request: { serverId: string; toolName: string },
): AgentMcpPolicyDecision {
  const serverRule = config.serverRules[request.serverId];
  const toolRule = config.toolRules[createAgentMcpToolPolicyKey(request.serverId, request.toolName)];
  const source: AgentMcpPolicySource = toolRule ? 'tool' : serverRule ? 'server'
    : config.defaultRule.mode ? 'default' : 'implicit';
  const rule = mergeRules(config.defaultRule, serverRule ?? {}, toolRule ?? {});
  const mode = rule.mode ?? 'allow';
  return {
    allowed: mode !== 'deny',
    mode,
    reason: mode === 'deny'
      ? `MCP policy denied ${request.serverId}/${request.toolName}.`
      : `MCP policy allowed ${request.serverId}/${request.toolName}.`,
    retryCount: rule.retryCount ?? 0,
    source,
    timeoutMs: rule.timeoutMs ?? null,
  };
}

export function createAgentMcpPolicyLine(
  config: AgentMcpPolicyConfig,
  tool: { name: string; serverId: string },
) {
  const decision = resolveAgentMcpPolicy(config, { serverId: tool.serverId, toolName: tool.name });
  const timeoutText = decision.timeoutMs ? `timeout ${decision.timeoutMs}ms` : 'default timeout';
  return `${decision.mode}, ${decision.source}, retry ${decision.retryCount}, ${timeoutText}`;
}
