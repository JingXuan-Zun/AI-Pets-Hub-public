import { type AgentExecutionPlan } from '../../../agent';
import { type ChatAgentWorkStageStatus, type ChatAgentWorkStage } from '../../../types';

export function formatAgentPlanToolSummary(plan: AgentExecutionPlan) {
  if (!plan.steps.length) {
    return 'no local tool steps';
  }

  const labels = plan.steps.map((step) => step.summary);
  return labels.length > 2
    ? `${labels.slice(0, 2).join(' | ')}; plus ${labels.length - 2} more action(s)`
    : labels.join(' | ');
}

export function formatAgentPlanPermissionDetails(plan: AgentExecutionPlan) {
  return plan.steps.map((step) => [
    step.summary,
    `permission: ${step.decision.mode}`,
    step.decision.reason,
  ].filter(Boolean).join(' | '));
}

export function createAgentWorkStages(
  plan: AgentExecutionPlan,
  options: {
    blockedStepId?: string | null;
    needsApproval?: boolean;
    status?: ChatAgentWorkStageStatus;
  } = {},
): ChatAgentWorkStage[] {
  const createdAt = Date.now();
  const toolStepCount = plan.steps.length;
  const blockedStep = options.blockedStepId
    ? plan.steps.find((step) => step.id === options.blockedStepId)
    : null;
  const permissionSummary = options.blockedStepId
    ? `Permission blocked: ${blockedStep?.summary ?? options.blockedStepId}`
    : options.needsApproval
      ? 'Some actions require user approval'
      : 'Permission policy allows continuing';

  return [
    {
      completedAt: createdAt,
      details: [plan.instruction],
      id: 'understand-request',
      startedAt: createdAt,
      status: 'completed',
      summary: `goal: ${plan.goal}`,
      title: 'Understand request',
    },
    {
      completedAt: createdAt,
      details: plan.steps.flatMap((step) => [step.summary, ...(step.details ?? [])]),
      id: 'plan-actions',
      startedAt: createdAt,
      status: 'completed',
      summary: `prepared ${toolStepCount} action(s): ${formatAgentPlanToolSummary(plan)}`,
      title: 'Plan actions',
    },
    {
      completedAt: options.needsApproval ? undefined : createdAt,
      details: formatAgentPlanPermissionDetails(plan),
      id: 'permission-check',
      startedAt: createdAt,
      status: options.blockedStepId ? 'blocked' : 'completed',
      summary: permissionSummary,
      title: 'Permission check',
    },
    ...(options.needsApproval
      ? [{
          details: ['Waiting for user approval or denial.'],
          id: 'await-approval' as const,
          startedAt: createdAt,
          status: 'running' as const,
          summary: 'Waiting for user approval',
          title: 'Await approval',
        }]
      : []),
    {
      details: plan.steps.map((step) => step.summary),
      id: 'execute-tools',
      startedAt: options.blockedStepId || options.needsApproval ? undefined : createdAt,
      status: options.blockedStepId
        ? 'blocked'
        : options.needsApproval
          ? 'pending'
          : options.status ?? 'running',
      summary: options.blockedStepId
        ? 'Not executed'
        : options.needsApproval
          ? 'Will execute after approval'
          : `Calling local tools: ${formatAgentPlanToolSummary(plan)}`,
      title: 'Execute tools',
    },
    {
      id: 'verify-result',
      status: 'pending',
      summary: 'Waiting for execution result',
      title: 'Verify result',
    },
    {
      id: 'decide-next-step',
      status: 'pending',
      summary: 'Waiting to decide next step after verification',
      title: 'Decide next step',
    },
    {
      id: 'persona-reply',
      status: 'pending',
      summary: 'Waiting for character reply',
      title: 'Character reply',
    },
  ];
}
