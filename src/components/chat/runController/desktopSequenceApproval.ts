import { type AgentChatCommand, type AgentExecutionPlan } from '../../../agent';
import { compactAgentPersonaPromptText } from './personaText';
import { type ChatAgentApprovalSummary } from '../../../types';

export function normalizeAgentApprovalActionName(value: unknown) {
  return typeof value === 'string'
    ? value.trim().replace(/[-\s]+/gu, '_')
    : '';
}

export function getAgentApprovalRecordString(
  record: Record<string, unknown>,
  key: string,
) {
  const value = record[key];
  return typeof value === 'string' ? value.trim() : '';
}

export function parseAgentApprovalDesktopSequenceSteps(command: AgentChatCommand) {
  if (command.toolCall?.name !== 'execute_desktop_sequence') {
    return [];
  }

  const stepsJson = command.toolCall.input?.stepsJson;
  if (typeof stepsJson !== 'string' || !stepsJson.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(stepsJson) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((step): step is Record<string, unknown> => (
        Boolean(step)
        && typeof step === 'object'
        && !Array.isArray(step)
      ))
      .map((step) => {
        const rawArgs = step.args ?? step.input;
        const args = rawArgs && typeof rawArgs === 'object' && !Array.isArray(rawArgs)
          ? rawArgs as Record<string, unknown>
          : {};
        return {
          args,
          reason: getAgentApprovalRecordString(step, 'reason'),
          tool: getAgentApprovalRecordString(step, 'tool') || 'unknown',
        };
      });
  } catch {
    return [];
  }
}

export function describeAgentApprovalDesktopSequenceStep(
  step: ReturnType<typeof parseAgentApprovalDesktopSequenceSteps>[number],
  index: number,
) {
  const action = normalizeAgentApprovalActionName(
    step.args.action ?? step.args.operation ?? step.args.desktopAction,
  );
  const target = [
    getAgentApprovalRecordString(step.args, 'target'),
    getAgentApprovalRecordString(step.args, 'query'),
    getAgentApprovalRecordString(step.args, 'url'),
    getAgentApprovalRecordString(step.args, 'targetDisplay')
      || getAgentApprovalRecordString(step.args, 'displayId')
      || getAgentApprovalRecordString(step.args, 'display'),
  ].find(Boolean);
  const label = action || step.tool;
  const targetText = target ? ` -> ${compactAgentPersonaPromptText(target, 56)}` : '';
  const reasonText = step.reason ? ` (${compactAgentPersonaPromptText(step.reason, 64)})` : '';

  return `${index + 1}. ${label}${targetText}${reasonText}`;
}

export function createAgentDesktopSequenceApprovalSummary(
  command: AgentChatCommand,
  plan: AgentExecutionPlan,
): ChatAgentApprovalSummary | null {
  const sequenceSteps = parseAgentApprovalDesktopSequenceSteps(command);
  if (!sequenceSteps.length) {
    return null;
  }

  return {
    lines: [
      `One approval will run ${sequenceSteps.length} desktop step(s) in order.`,
      `goal: ${plan.goal}`,
      ...sequenceSteps.slice(0, 5).map(describeAgentApprovalDesktopSequenceStep),
    ],
    title: 'Confirm grouped desktop operation',
    warning: sequenceSteps.length > 5
      ? `${sequenceSteps.length - 5} more step(s) are hidden here; expand details before approving if needed.`
      : null,
  };
}
