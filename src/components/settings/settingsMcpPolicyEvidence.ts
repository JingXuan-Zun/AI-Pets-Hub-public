import {
  createAgentMcpToolPolicyKey,
  parseAgentMcpPolicyConfig,
  resolveAgentMcpPolicy,
} from '../../agent/agentMcpPolicy';
import { summarizeAgentMcpToolRisk, type AgentMcpToolRisk } from '../../agent/agentMcpRiskSummary';
import {
  applyMcpPolicyPresetToConfigText,
  type SettingsMcpPolicyPresetId,
} from './settingsMcpPolicyBulkUtils';

export interface SettingsMcpPolicyEvidenceTool {
  description?: string;
  inputSchema?: Record<string, unknown>;
  name: string;
  serverId: string;
  title?: string;
}

export interface SettingsMcpPolicyEvidenceRow {
  allowed: boolean;
  decisionMode: 'allow' | 'deny';
  expectedMode: 'allow' | 'deny';
  policySource: string;
  risk: AgentMcpToolRisk;
  riskSignals: string[];
  serverId: string;
  status: 'blocked' | 'ready';
  toolName: string;
}

export interface SettingsMcpPolicyEvidenceReport {
  changedCount: number;
  generatedAt: string;
  kind: 'settings-mcp-policy-evidence';
  presetId: SettingsMcpPolicyPresetId;
  readyCount: number;
  rows: SettingsMcpPolicyEvidenceRow[];
  status: 'blocked' | 'ready';
  summaryText: string;
  version: 1;
}

function getExpectedMode(presetId: SettingsMcpPolicyPresetId, risk: AgentMcpToolRisk) {
  if (presetId === 'deny-high-risk') {
    return risk === 'destructive-like' ? 'deny' : 'allow';
  }

  return 'allow';
}

function assertConfigObject(configText: string) {
  const parsed = JSON.parse(configText);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('MCP config JSON must be an object.');
  }
}

function createEvidenceRow(
  tool: SettingsMcpPolicyEvidenceTool,
  configText: string,
  presetId: SettingsMcpPolicyPresetId,
): SettingsMcpPolicyEvidenceRow {
  const riskSummary = summarizeAgentMcpToolRisk(tool);
  const expectedMode = getExpectedMode(presetId, riskSummary.risk);
  const policy = resolveAgentMcpPolicy(parseAgentMcpPolicyConfig(JSON.parse(configText)), {
    serverId: tool.serverId,
    toolName: tool.name,
  });
  const status = policy.mode === expectedMode ? 'ready' : 'blocked';
  return {
    allowed: policy.allowed,
    decisionMode: policy.mode,
    expectedMode,
    policySource: policy.source,
    risk: riskSummary.risk,
    riskSignals: riskSummary.riskSignals,
    serverId: tool.serverId,
    status,
    toolName: tool.name,
  };
}

export function createSettingsMcpPolicyEvidenceReport(options: {
  configText: string;
  presetId: SettingsMcpPolicyPresetId;
  serverId?: string | null;
  tools: SettingsMcpPolicyEvidenceTool[];
}): SettingsMcpPolicyEvidenceReport {
  assertConfigObject(options.configText);
  const applied = applyMcpPolicyPresetToConfigText(
    options.configText,
    options.tools,
    options.presetId,
    options.serverId,
  );
  if (applied.error) {
    throw new Error(applied.error);
  }

  const rows = options.tools.map((tool) => createEvidenceRow(tool, applied.rawText, options.presetId));
  const readyCount = rows.filter((row) => row.status === 'ready').length;
  const status = readyCount === rows.length ? 'ready' : 'blocked';
  return {
    changedCount: applied.changedCount,
    generatedAt: new Date().toISOString(),
    kind: 'settings-mcp-policy-evidence',
    presetId: options.presetId,
    readyCount,
    rows,
    status,
    summaryText: `MCPPolicyEvidence status=${status} preset=${options.presetId} ready=${readyCount}/${rows.length}`,
    version: 1,
  };
}

export function createSettingsMcpPolicyEvidenceText(report: SettingsMcpPolicyEvidenceReport) {
  return `${JSON.stringify(report, null, 2)}\n`;
}

export function createSettingsMcpPolicyEvidenceToolKey(tool: SettingsMcpPolicyEvidenceTool) {
  return createAgentMcpToolPolicyKey(tool.serverId, tool.name);
}
