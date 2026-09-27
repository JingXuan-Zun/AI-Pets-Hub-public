import { type AgentMcpToolDefinition } from './agentMcpTypes';
import {
  createAgentMcpPolicyLine,
  parseAgentMcpPolicyConfig,
} from './agentMcpPolicy';

const PLATFORM_SERVER_ID = 'platform';
const PLATFORM_READ_ONLY_TOOL_NAMES = new Set(['skills.list', 'skills.manifest', 'skills.scaffold']);
const READ_TEXT_PATTERN = /\b(list|get|read|search|find|fetch|query|inspect|observe|describe|show|lookup|status|health|preview|check)\b/u;
const WRITE_TEXT_PATTERN = /\b(create|update|write|edit|set|move|rename|copy|upload|download|send|post|publish|put|patch|execute|run|start|stop|launch|open|click|type|invoke|control|save|remember|append|insert)\b/u;
const DESTRUCTIVE_TEXT_PATTERN = /\b(delete|remove|rm|drop|destroy|erase|clear|purge|reset|format|kill|shutdown|terminate|overwrite|uninstall|forget)\b/u;
const EXECUTION_TEXT_PATTERN = /\b(shell|terminal|command|script|powershell|bash|cmd|process)\b/u;
const MUTATING_SCHEMA_PATTERN = /\b(content|body|payload|message|destination|new name|value|write|append|insert|move|rename|file action|operation)\b/u;
const DESTRUCTIVE_SCHEMA_PATTERN = /\b(delete|remove|overwrite|replace|force|recursive|permanent|purge|truncate|destroy|confirm)\b/u;
const EXECUTION_SCHEMA_PATTERN = /\b(command|script|shell|executable|process|stdin|env|environment|cwd|working directory)\b/u;
const SENSITIVE_SCHEMA_PATTERN = /\b(api key|apikey|authorization|bearer|credential|password|secret|token|private key|access token|refresh token|cookie|session)\b/u;

export type AgentMcpToolRisk = 'destructive-like' | 'read' | 'reversible-write';

type AgentMcpToolRiskInput = Pick<AgentMcpToolDefinition, 'name' | 'serverId'>
  & Partial<Pick<AgentMcpToolDefinition, 'annotations' | 'description' | 'inputSchema' | 'title'>>;

interface AgentMcpRiskSignals {
  destructive: boolean;
  execution: boolean;
  mutating: boolean;
  read: boolean;
  riskSignals: string[];
  schemaSignals: string[];
  sensitive: boolean;
  write: boolean;
}

export interface AgentMcpToolRiskSummary {
  approvalMode: 'confirm' | 'silent';
  risk: AgentMcpToolRisk;
  riskReason: string;
  riskSignals: string[];
  schemaSignals: string[];
  source: 'external' | 'platform';
  text: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeRiskText(parts: unknown[]) {
  return parts
    .filter((part): part is string => typeof part === 'string' && Boolean(part.trim()))
    .join(' ')
    .replace(/([a-z])([A-Z])/gu, '$1 $2')
    .replace(/[._:/\\-]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
    .toLowerCase();
}

function appendSchemaTokens(value: unknown, tokens: string[], depth = 0) {
  if (depth > 4 || tokens.length > 80) {
    return;
  }

  if (Array.isArray(value)) {
    value.slice(0, 24).forEach((item) => {
      if (typeof item === 'string') tokens.push(item);
      else appendSchemaTokens(item, tokens, depth + 1);
    });
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  for (const [key, child] of Object.entries(value).slice(0, 60)) {
    if (key === 'properties' && isRecord(child)) {
      tokens.push(...Object.keys(child));
      Object.values(child).forEach((item) => appendSchemaTokens(item, tokens, depth + 1));
      continue;
    }

    if (['const', 'default', 'description', 'title'].includes(key) && typeof child === 'string') {
      tokens.push(child);
    }
    appendSchemaTokens(child, tokens, depth + 1);
  }
}

function collectSchemaTokens(schema: unknown) {
  const tokens: string[] = [];
  appendSchemaTokens(schema, tokens);
  return tokens.slice(0, 80);
}

function pushSignal(signals: string[], label: string, enabled: boolean) {
  if (enabled) {
    signals.push(label);
  }
  return enabled;
}

function collectAgentMcpRiskSignals(tool: AgentMcpToolRiskInput): AgentMcpRiskSignals {
  const text = normalizeRiskText([tool.name, tool.title, tool.description]);
  const schemaText = normalizeRiskText(collectSchemaTokens(tool.inputSchema));
  const riskSignals: string[] = [];
  const schemaSignals: string[] = [];
  const destructive = pushSignal(riskSignals, 'text:destructive-like', DESTRUCTIVE_TEXT_PATTERN.test(text));
  const execution = pushSignal(riskSignals, 'text:execution-capable', EXECUTION_TEXT_PATTERN.test(text));
  const read = pushSignal(riskSignals, 'text:read-like', READ_TEXT_PATTERN.test(text));
  const write = pushSignal(riskSignals, 'text:write-like', WRITE_TEXT_PATTERN.test(text));
  const schemaDestructive = pushSignal(schemaSignals, 'schema:destructive-arguments', DESTRUCTIVE_SCHEMA_PATTERN.test(schemaText));
  const schemaExecution = pushSignal(schemaSignals, 'schema:execution-arguments', EXECUTION_SCHEMA_PATTERN.test(schemaText));
  const mutating = pushSignal(schemaSignals, 'schema:mutating-arguments', MUTATING_SCHEMA_PATTERN.test(schemaText));
  const sensitive = pushSignal(schemaSignals, 'schema:sensitive-arguments', SENSITIVE_SCHEMA_PATTERN.test(schemaText));
  const annotations = isRecord(tool.annotations) ? tool.annotations : {};
  const annotationDestructive = pushSignal(schemaSignals, 'annotation:destructive', annotations.destructiveHint === true);
  const annotationOpenWorld = pushSignal(schemaSignals, 'annotation:open-world', annotations.openWorldHint === true);
  const annotationReadOnly = pushSignal(schemaSignals, 'annotation:read-only', annotations.readOnlyHint === true);

  return {
    destructive: destructive || schemaDestructive || annotationDestructive,
    execution: execution || schemaExecution,
    mutating: mutating || annotationOpenWorld,
    read: read || annotationReadOnly,
    riskSignals: [...riskSignals, ...schemaSignals],
    schemaSignals,
    sensitive,
    write,
  };
}

function resolveAgentMcpRisk(tool: AgentMcpToolRiskInput, signals: AgentMcpRiskSignals): AgentMcpToolRisk {
  if (tool.serverId === PLATFORM_SERVER_ID && PLATFORM_READ_ONLY_TOOL_NAMES.has(tool.name)) {
    return 'read';
  }

  if (tool.serverId === PLATFORM_SERVER_ID) {
    return 'reversible-write';
  }

  if (signals.destructive || signals.execution) {
    return 'destructive-like';
  }

  if (signals.write || signals.mutating || signals.sensitive) {
    return 'reversible-write';
  }

  return signals.read ? 'read' : 'reversible-write';
}

function createRiskReason(
  source: AgentMcpToolRiskSummary['source'],
  risk: AgentMcpToolRisk,
  signals: AgentMcpRiskSignals,
) {
  if (source === 'platform' && risk === 'read') {
    return 'platform list tool is read-only';
  }

  if (source === 'platform') {
    return 'platform action requires user confirmation';
  }

  if (risk === 'destructive-like') {
    if (signals.schemaSignals.includes('annotation:destructive')) {
      return 'MCP annotation marks the tool as destructive';
    }
    return signals.execution
      ? 'name or schema suggests command/process execution'
      : 'name or schema suggests destructive operation';
  }

  if (risk === 'read') {
    return signals.schemaSignals.includes('annotation:read-only')
      ? 'MCP annotation marks the tool as read-only'
      : 'name and description suggest read-only discovery';
  }

  if (signals.sensitive) {
    return 'schema includes credential-like inputs';
  }

  if (signals.mutating) {
    return 'schema includes state-changing input fields';
  }

  return signals.write
    ? 'name or description suggests state-changing action'
    : 'external or unclear tool defaults to confirmation';
}

function createSummaryText(summary: Omit<AgentMcpToolRiskSummary, 'text'>) {
  const approvalText = summary.approvalMode === 'silent'
    ? 'no approval required'
    : 'user approval required';
  return `${summary.source} ${summary.risk}; ${summary.riskReason}; ${approvalText}.`;
}

export function resolveAgentMcpToolSource(serverId: string): AgentMcpToolRiskSummary['source'] {
  return serverId === PLATFORM_SERVER_ID ? 'platform' : 'external';
}

export function summarizeAgentMcpToolRisk(tool: AgentMcpToolRiskInput): AgentMcpToolRiskSummary {
  const source = resolveAgentMcpToolSource(tool.serverId);
  const signals = collectAgentMcpRiskSignals(tool);
  const risk = resolveAgentMcpRisk(tool, signals);
  const approvalMode = source === 'platform' && PLATFORM_READ_ONLY_TOOL_NAMES.has(tool.name) ? 'silent' : 'confirm';
  const summary = {
    approvalMode,
    risk,
    riskReason: createRiskReason(source, risk, signals),
    riskSignals: signals.riskSignals,
    schemaSignals: signals.schemaSignals,
    source,
  } satisfies Omit<AgentMcpToolRiskSummary, 'text'>;

  return {
    ...summary,
    text: createSummaryText(summary),
  };
}

export function createAgentMcpToolRiskLine(tool: AgentMcpToolRiskInput) {
  const summary = summarizeAgentMcpToolRisk(tool);
  const signalText = summary.riskSignals.length
    ? `, signals ${summary.riskSignals.join('|')}`
    : '';
  return `${tool.serverId}/${tool.name}: ${summary.risk}, ${summary.approvalMode}, ${summary.source}, ${summary.riskReason}${signalText}`;
}

export function createAgentMcpToolPolicyRiskLine(
  tool: AgentMcpToolRiskInput,
  config: unknown,
) {
  const riskLine = createAgentMcpToolRiskLine(tool);
  const policyLine = createAgentMcpPolicyLine(parseAgentMcpPolicyConfig(config), tool);
  return `${riskLine}, policy ${policyLine}`;
}
