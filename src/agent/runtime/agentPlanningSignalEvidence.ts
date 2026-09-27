import {
  type AgentChatCommand,
  type AgentChatCommandResult,
  type AgentStructuredToolCandidateEvidence,
  type AgentToolCallName,
} from '../agentChatCommand';
import { type AgentRuntimeToolResultEntry } from './agentRuntimeContract';
import { getAgentPostActionState } from './agentToolEvidence';

export {
  getAgentPostActionState,
  getAgentStructuredEvidence,
  hasAgentCandidateLocationEvidence,
} from './agentToolEvidence';

export function compactAgentPlanningSignalText(value: unknown, maxLength = 900) {
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

function formatAgentStructuredCandidate(
  candidate: AgentStructuredToolCandidateEvidence,
  index: number,
) {
  const label = candidate.label?.trim() || candidate.description?.trim() || 'candidate';
  const center = Number.isFinite(Number(candidate.center?.x)) && Number.isFinite(Number(candidate.center?.y))
    ? `center=${Math.round(Number(candidate.center?.x))},${Math.round(Number(candidate.center?.y))}`
    : '';
  const centerRatio = Number.isFinite(Number(candidate.centerRatio?.x)) && Number.isFinite(Number(candidate.centerRatio?.y))
    ? `centerRatio=${Number(candidate.centerRatio?.x).toFixed(3)},${Number(candidate.centerRatio?.y).toFixed(3)}`
    : '';
  const details = [
    candidate.confidence ? `confidence=${candidate.confidence}` : '',
    Array.isArray(candidate.actions) && candidate.actions.length ? `actions=${candidate.actions.slice(0, 4).join(',')}` : '',
    candidate.automationId ? `automationId=${compactAgentPlanningSignalText(candidate.automationId, 90)}` : '',
    candidate.controlType ? `controlType=${compactAgentPlanningSignalText(candidate.controlType, 60)}` : '',
    typeof candidate.enabled === 'boolean' ? `enabled=${candidate.enabled}` : '',
    typeof candidate.keyboardFocusable === 'boolean' ? `keyboardFocusable=${candidate.keyboardFocusable}` : '',
    candidate.hasKeyboardFocus ? 'focused=true' : '',
    candidate.offscreen ? 'offscreen=true' : '',
    candidate.region ? `region=${compactAgentPlanningSignalText(candidate.region, 110)}` : '',
    candidate.relation ? `relation=${compactAgentPlanningSignalText(candidate.relation, 120)}` : '',
    center,
    centerRatio,
  ].filter(Boolean);

  return details.length
    ? `${index + 1}:${compactAgentPlanningSignalText(label, 90)}(${details.join('; ')})`
    : `${index + 1}:${compactAgentPlanningSignalText(label, 90)}`;
}

export function formatAgentStructuredCandidates(
  candidates: AgentStructuredToolCandidateEvidence[] | null | undefined,
) {
  if (!Array.isArray(candidates) || !candidates.length) {
    return '';
  }

  return candidates
    .slice(0, 4)
    .map(formatAgentStructuredCandidate)
    .join(' | ');
}

export const AGENT_TRANSITIONAL_POST_ACTION_STATES = new Set([
  'blocked',
  'error',
  'loading',
  'selection_mismatch',
  'unchanged',
  'unknown',
  'updating',
  'visible_only',
]);

export const AGENT_RETRY_AVOIDANCE_POST_ACTION_STATES = new Set([
  'selection_mismatch',
  'unchanged',
  'visible_only',
]);

export function getAgentActionEvidence(result: AgentChatCommandResult) {
  return result.stateSummary?.actionEvidence
    ?? result.receipt?.stateSummary?.actionEvidence
    ?? null;
}

export function formatAgentActionEvidence(
  result: AgentChatCommandResult,
  maxLength = 620,
) {
  const actionEvidence = getAgentActionEvidence(result);
  if (!actionEvidence) {
    return '';
  }

  const parts = [
    `outcome=${actionEvidence.outcome}`,
    actionEvidence.phase ? `phase=${actionEvidence.phase}` : '',
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

  return compactAgentPlanningSignalText(parts.join(' | '), maxLength);
}

export function getLatestAgentToolResult(
  toolResults: AgentRuntimeToolResultEntry[],
) {
  return toolResults.length ? toolResults[toolResults.length - 1] ?? null : null;
}

export function stableAgentJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableAgentJson).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => (
      `${JSON.stringify(key)}:${stableAgentJson(record[key])}`
    )).join(',')}}`;
  }

  return JSON.stringify(value);
}

export function createAgentToolCallSignature(
  toolName: string,
  args: Record<string, unknown>,
) {
  return `${toolName}:${stableAgentJson(args)}`;
}

const AGENT_ACTION_RESULT_TOOL_NAMES = new Set<AgentToolCallName>([
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

export function isAgentActionResultTool(command: AgentChatCommand) {
  const toolName = command.toolCall?.name;
  return Boolean(
    toolName
    && AGENT_ACTION_RESULT_TOOL_NAMES.has(toolName),
  );
}

const AGENT_ACTION_PRIMITIVE_META_KEYS = new Set([
  'postVerifyQuery',
  'postVerifyVisualQuery',
  'postVerifySourceId',
  'postVerifySourceQuery',
  'postVerifySourceType',
  'reason',
]);

function normalizeAgentToolActionName(value: string) {
  return value.trim().toLowerCase().replace(/[-\s]+/gu, '_');
}

function normalizeAgentActionPrimitiveArgs(
  toolName: string,
  args: Record<string, unknown>,
): unknown {
  if (toolName === 'execute_desktop_sequence') {
    const stepsJson = typeof args.stepsJson === 'string' ? args.stepsJson.trim() : '';
    let parsedSteps: unknown = [];
    if (stepsJson) {
      try {
        parsedSteps = JSON.parse(stepsJson) as unknown;
      } catch {
        parsedSteps = stepsJson;
      }
    }

    return {
      steps: Array.isArray(parsedSteps)
        ? parsedSteps.map((step) => {
            if (!step || typeof step !== 'object') {
              return step;
            }

            const record = step as Record<string, unknown>;
            const nestedTool = typeof record.tool === 'string' ? record.tool.trim() : '';
            const nestedArgs = record.args && typeof record.args === 'object'
              ? normalizeAgentActionPrimitiveArgs(
                  nestedTool,
                  record.args as Record<string, unknown>,
                )
              : record.args ?? null;
            return {
              args: nestedArgs,
              tool: nestedTool,
            };
          })
        : parsedSteps,
    };
  }

  const normalizedArgs = Object.fromEntries(
    Object.entries(args).filter(([key]) => !AGENT_ACTION_PRIMITIVE_META_KEYS.has(key)),
  );

  if (toolName === 'execute_desktop_input') {
    const action = typeof normalizedArgs.action === 'string'
      ? normalizeAgentToolActionName(normalizedArgs.action)
      : '';
    const button = typeof normalizedArgs.button === 'string'
      ? normalizedArgs.button.trim().toLowerCase()
      : '';
    if (action === 'click' && (!button || button === 'left')) {
      delete normalizedArgs.button;
    }
  }

  return normalizedArgs;
}

export function createAgentActionPrimitiveSignature(command: AgentChatCommand) {
  const toolName = command.toolCall?.name;
  if (!toolName || !isAgentActionResultTool(command)) {
    return null;
  }

  return createAgentToolCallSignature(
    toolName,
    {
      primitive: normalizeAgentActionPrimitiveArgs(
        toolName,
        command.toolCall?.input ?? {},
      ),
    },
  );
}
