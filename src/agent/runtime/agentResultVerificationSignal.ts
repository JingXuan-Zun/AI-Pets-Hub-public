import { type AgentChatCommand, type AgentChatCommandResult } from '../agentChatCommand';
import { type AgentRuntimeToolResultEntry } from './agentRuntimeContract';

function compactAgentResultVerificationText(value: unknown, maxLength = 900) {
  const text = typeof value === 'string'
    ? value
    : value === undefined || value === null
      ? ''
      : JSON.stringify(value);
  const compactText = text.replace(/\s+/gu, ' ').trim();
  if (compactText.length <= maxLength) {
    return compactText;
  }

  return `${compactText.slice(0, Math.max(0, maxLength - 3))}...`;
}

function getLatestAgentResultVerificationToolResult(
  toolResults: AgentRuntimeToolResultEntry[],
) {
  return toolResults.length ? toolResults[toolResults.length - 1] ?? null : null;
}

function formatAgentResultVerificationActionEvidence(
  result: AgentChatCommandResult,
  maxLength = 620,
) {
  const actionEvidence = result.stateSummary?.actionEvidence
    ?? result.receipt?.stateSummary?.actionEvidence
    ?? null;
  if (!actionEvidence) {
    return '';
  }

  const parts = [
    `outcome=${actionEvidence.outcome}`,
    `tool=${actionEvidence.tool}`,
    actionEvidence.action ? `action=${actionEvidence.action}` : '',
    actionEvidence.snapshotProfile ? `snapshotProfile=${actionEvidence.snapshotProfile}` : '',
    actionEvidence.targetRef?.label ? `target=${actionEvidence.targetRef.label}` : '',
    actionEvidence.targetRef?.kind ? `targetKind=${actionEvidence.targetRef.kind}` : '',
    typeof actionEvidence.diff?.changed === 'boolean' ? `changed=${actionEvidence.diff.changed}` : '',
    actionEvidence.diff?.summary ? `diff=${actionEvidence.diff.summary}` : '',
    actionEvidence.diff?.signals?.length ? `signals=${actionEvidence.diff.signals.slice(0, 5).join(' | ')}` : '',
    typeof actionEvidence.confidence === 'number' ? `confidence=${actionEvidence.confidence.toFixed(2)}` : '',
  ].filter(Boolean);

  return compactAgentResultVerificationText(parts.join(' | '), maxLength);
}

const AGENT_RESULT_VERIFICATION_ACTION_TOOL_NAMES = new Set([
  'control_browser',
  'execute_desktop_action',
  'execute_desktop_input',
  'execute_desktop_sequence',
  'execute_file_management_action',
  'organize_desktop_icons',
  'remember_local_app',
  'run_controlled_command',
  'run_local_project_action',
]);

function isAgentResultVerificationActionTool(command: AgentChatCommand) {
  const toolName = command.toolCall?.name;
  return Boolean(toolName && AGENT_RESULT_VERIFICATION_ACTION_TOOL_NAMES.has(toolName));
}

export interface AgentResultVerificationSignalOptions {
  sourceText: string;
  toolResults: AgentRuntimeToolResultEntry[];
  userGoal: string;
}

export function createAgentResultVerificationSignalText(
  options: AgentResultVerificationSignalOptions,
) {
  const latestToolResult = getLatestAgentResultVerificationToolResult(options.toolResults);
  if (!latestToolResult || latestToolResult.result.ok === false) {
    return '';
  }

  const toolName = latestToolResult.command.toolCall?.name ?? latestToolResult.command.kind;
  const result = latestToolResult.result;
  const structuredEvidence = result.stateSummary?.structuredEvidence
    ?? result.receipt?.stateSummary?.structuredEvidence
    ?? null;
  const actionEvidenceText = formatAgentResultVerificationActionEvidence(result);
  const evidenceLines = [
    ...(result.stateSummary?.verificationEvidence ?? []),
    ...(result.receipt?.evidenceLines ?? []).slice(0, 8),
    ...(result.observations ?? []).slice(0, 6),
  ];
  const missingEvidence = result.stateSummary?.missingEvidence ?? [];
  const isActionResult = isAgentResultVerificationActionTool(latestToolResult.command);

  if (!isActionResult && !evidenceLines.length && !structuredEvidence && !missingEvidence.length) {
    return '';
  }

  return [
    `latestTool=${toolName}`,
    `latestToolKind=${isActionResult ? 'action' : 'observation'}`,
    result.receipt?.status ? `receiptStatus=${result.receipt.status}` : '',
    result.assessment?.status ? `assessmentStatus=${result.assessment.status}` : '',
    evidenceLines.length
      ? `latestEvidence=${compactAgentResultVerificationText(evidenceLines.join(' | '), 720)}`
      : 'latestEvidence=none',
    actionEvidenceText ? `actionEvidence=${actionEvidenceText}` : '',
    structuredEvidence ? `structuredEvidence=${compactAgentResultVerificationText(JSON.stringify(structuredEvidence), 620)}` : '',
    missingEvidence.length
      ? `missingEvidence=${compactAgentResultVerificationText(missingEvidence.join(' | '), 520)}`
      : '',
    `successCriteriaHint=${compactAgentResultVerificationText(options.userGoal || options.sourceText, 360)}`,
    isActionResult
      ? 'verificationRule=An action tool returning ok=true only proves the action primitive ran. Before final_answer, verify the user-level outcome from evidence; if the expected app/window/content is not confirmed, call an observation/visual verification tool.'
      : 'verificationRule=Use this observation evidence to decide whether the user-level goal is satisfied, still partial, blocked, or unknown.',
  ].filter(Boolean).join('\n');
}
