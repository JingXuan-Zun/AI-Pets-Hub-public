import { type AgentChatCommand } from '../agentChatCommand';
import {
  isAgentRuntimeTargetBindingCurrent,
  type AgentRuntimeOperationSurface,
  type AgentRuntimeTargetBinding,
} from './agentRuntimeTaskContract';
import {
  type AgentRuntimePendingApproval,
  type AgentTaskRuntimeStateRecord,
} from './agentRuntimeContract';

export type AgentRuntimeTargetGuardReason =
  | 'no-target-binding'
  | 'target-not-actionable'
  | 'target-stale-surface';

export interface AgentRuntimeTargetGuardResult {
  allowed: boolean;
  reason: AgentRuntimeTargetGuardReason;
  targetBinding: AgentRuntimeTargetBinding | null;
}

export type AgentRuntimeApprovalGuardReason =
  | 'approval-context-current'
  | 'approval-stale-identity'
  | 'approval-stale-surface';

export interface AgentRuntimeApprovalGuardResult {
  allowed: boolean;
  reason: AgentRuntimeApprovalGuardReason;
}

const TARGETED_ACTIONS = new Set([
  'click',
  'double_click',
  'drag',
  'drop',
  'invoke',
  'press',
  'scroll',
  'select',
  'set_value',
  'send_keys',
  'type',
]);

function normalizeAction(value: unknown) {
  return typeof value === 'string'
    ? value.trim().toLowerCase().replace(/[\s-]+/gu, '_')
    : '';
}

function hasTargetedSequenceStep(command: AgentChatCommand) {
  if (command.toolCall?.name !== 'execute_desktop_sequence') {
    return false;
  }
  const stepsJson = command.toolCall.input.stepsJson;
  if (typeof stepsJson !== 'string') {
    return false;
  }
  try {
    const steps = JSON.parse(stepsJson) as unknown;
    return Array.isArray(steps) && steps.some((step) => {
      if (!step || typeof step !== 'object') {
        return false;
      }
      const record = step as Record<string, unknown>;
      return TARGETED_ACTIONS.has(normalizeAction(record.action))
        || record.tool === 'execute_desktop_input';
    });
  } catch {
    return false;
  }
}

function isTargetedAction(command: AgentChatCommand) {
  const input = command.toolCall?.input ?? {};
  const action = normalizeAction(input.action);
  return TARGETED_ACTIONS.has(action)
    || Boolean(command.toolCall?.actionScope?.targetRef?.trim())
    || hasTargetedSequenceStep(command);
}

export function validateAgentRuntimeTargetBinding(options: {
  command: AgentChatCommand;
  state?: Pick<AgentTaskRuntimeStateRecord, 'surface' | 'targetBinding'> | null;
}): AgentRuntimeTargetGuardResult {
  const targetBinding = options.state?.targetBinding ?? null;
  if (!targetBinding) {
    return {
      allowed: true,
      reason: 'no-target-binding',
      targetBinding: null,
    };
  }
  if (!isTargetedAction(options.command)) {
    return {
      allowed: true,
      reason: 'target-not-actionable',
      targetBinding,
    };
  }

  const surface = options.state?.surface ?? null;
  if (!isAgentRuntimeTargetBindingCurrent({
    surface: surface as Pick<AgentRuntimeOperationSurface, 'generation' | 'surfaceId'> | null,
    target: targetBinding,
  })) {
    return {
      allowed: false,
      reason: 'target-stale-surface',
      targetBinding,
    };
  }
  return {
    allowed: true,
    reason: 'target-not-actionable',
    targetBinding,
  };
}

export function createAgentRuntimeStaleTargetError(options: {
  targetBinding: AgentRuntimeTargetBinding;
  surface?: Pick<AgentRuntimeOperationSurface, 'generation' | 'surfaceId'> | null;
}) {
  const surface = options.surface ?? null;
  return [
    'Target binding is stale and was not executed.',
    `targetSurface=${options.targetBinding.surfaceId}@${options.targetBinding.surfaceGeneration}`,
    `currentSurface=${surface?.surfaceId ?? 'none'}@${surface?.generation ?? 'none'}`,
    'Re-observe and resolve the target before retrying the action.',
  ].join(' ');
}

export function validateAgentRuntimeApprovalContext(options: {
  approval: AgentRuntimePendingApproval;
  state?: Pick<AgentTaskRuntimeStateRecord, 'runId' | 'surface' | 'taskId'> | null;
}): AgentRuntimeApprovalGuardResult {
  const state = options.state ?? null;
  const approval = options.approval;
  if (approval.runId && state?.runId && approval.runId !== state.runId) {
    return { allowed: false, reason: 'approval-stale-identity' };
  }
  if (approval.taskId && state?.taskId && approval.taskId !== state.taskId) {
    return { allowed: false, reason: 'approval-stale-identity' };
  }
  if (
    approval.surfaceId
    && approval.surfaceGeneration != null
    && (
      approval.surfaceId !== state?.surface?.surfaceId
      || approval.surfaceGeneration !== state.surface?.generation
    )
  ) {
    return { allowed: false, reason: 'approval-stale-surface' };
  }
  return { allowed: true, reason: 'approval-context-current' };
}
