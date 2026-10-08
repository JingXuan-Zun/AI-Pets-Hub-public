import { type AgentExecutionPlan, type AgentChatCommand } from '../../../agent';
import { type ChatAgentApprovalSummary } from '../../../types';
import { formatAgentPlanToolSummary } from './workStageCreation';
import { type PreparedChatSendRequest } from '../chatMessageSendFlowUtils';
import { getApprovalCommandDesktopOrganization, findLatestDesktopOrganizationPreviewSummary } from './desktopOrganizationApproval';
import { desktopPetChatStore } from '../../../chatStore';
import { createAgentDesktopSequenceApprovalSummary } from './desktopSequenceApproval';
import { createAgentMcpApprovalSummaryWithSchema } from '../agentMcpApprovalSummary';

export function createFallbackAgentApprovalSummary(plan: AgentExecutionPlan): ChatAgentApprovalSummary {
  return {
    lines: [
      `goal: ${plan.goal}`,
      `will execute ${plan.steps.length} local action(s): ${formatAgentPlanToolSummary(plan)}`,
      ...plan.steps
        .flatMap((step) => step.details ?? [])
        .filter(Boolean)
        .slice(0, 3),
    ],
    title: 'Confirm before execution',
    warning: null,
  };
}

export async function createAgentApprovalSummary(
  command: AgentChatCommand,
  plan: AgentExecutionPlan,
  preparedRequest: PreparedChatSendRequest,
): Promise<ChatAgentApprovalSummary> {
  const organization = getApprovalCommandDesktopOrganization(command);
  if (organization?.mode === 'execute') {
    const previewSummary = findLatestDesktopOrganizationPreviewSummary(desktopPetChatStore.getState().messages)
      ?? findLatestDesktopOrganizationPreviewSummary(preparedRequest.promptHistoryMessages);
    if (previewSummary) {
      return {
        lines: previewSummary.lines,
        title: 'Execute previous desktop organization plan',
        warning: previewSummary.warning,
      };
    }

    return {
      lines: [
        'This will execute the latest generated desktop organization plan.',
        ...createFallbackAgentApprovalSummary(plan).lines.slice(1),
      ],
      title: 'Execute desktop organization plan',
      warning: 'No previous preview summary was found in chat context. Re-observe first if the desktop changed.',
    };
  }

  const sequenceSummary = createAgentDesktopSequenceApprovalSummary(command, plan);
  if (sequenceSummary) {
    return sequenceSummary;
  }

  const mcpSummary = await createAgentMcpApprovalSummaryWithSchema(command, plan);
  if (mcpSummary) {
    return mcpSummary;
  }

  return createFallbackAgentApprovalSummary(plan);
}
