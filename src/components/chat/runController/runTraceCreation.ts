import { type AgentExecutionPlan } from '../../../agent';
import { type ChatAgentRunTraceStatus, type ChatAgentRunTraceItem } from '../../../types';

export function createAgentRunTrace(
  plan: AgentExecutionPlan,
  options: {
    blockedStepId?: string | null;
    needsApproval?: boolean;
    status?: ChatAgentRunTraceStatus;
  } = {},
): ChatAgentRunTraceItem[] {
  const createdAt = Date.now();
  return [
    {
      detail: plan.instruction,
      id: 'understand-request',
      label: 'Understand request',
      status: 'completed',
      timestamp: createdAt,
    },
    {
      detail: `${plan.steps.length} step(s)`,
      id: 'build-plan',
      label: 'Build plan',
      status: 'completed',
      timestamp: createdAt,
    },
    {
      detail: options.blockedStepId
        ? 'Permission policy blocked this run'
        : options.needsApproval
          ? 'Contains approval-required actions'
          : 'Permission policy allows continuing',
      id: 'check-permission',
      label: 'Permission check',
      status: options.blockedStepId ? 'blocked' : 'completed',
      timestamp: createdAt,
    },
    ...(options.needsApproval ? [{
      id: 'wait-for-approval',
      label: 'Waiting for user approval',
      status: 'running' as const,
      timestamp: createdAt,
    }] : []),
    ...plan.steps.map((step, index) => ({
      detail: step.decision.reason,
      id: `step-${step.id}`,
      label: step.summary,
      status: options.blockedStepId === step.id
        ? 'blocked'
        : index === 0 && !options.needsApproval && !options.blockedStepId
          ? options.status ?? 'running'
          : 'pending',
      timestamp: undefined,
    } satisfies ChatAgentRunTraceItem)),
    {
      id: 'summarize-result',
      label: 'Summarize result',
      status: 'pending',
    },
    {
      id: 'decide-next-step',
      label: 'Decide next step',
      status: 'pending',
    },
    {
      id: 'persona-reply',
      label: 'Character reply',
      status: 'pending',
    },
  ];
}
