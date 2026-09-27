import {
  type AgentRuntimePendingApproval,
  type AgentRuntimeTraceEventDraft,
} from './agentRuntimeContract';
import { createAgentApprovalRequiredTraceSummary } from './agentDecisionTraceSummary';

export interface AgentRuntimePendingApprovalAssembly {
  finalAnswer: string;
  historyLine: string;
  pendingApproval: AgentRuntimePendingApproval;
  status: 'needs-approval';
  traceEvent: AgentRuntimeTraceEventDraft;
}

export interface CreateAgentPendingApprovalAssemblyOptions {
  approval: AgentRuntimePendingApproval;
  label: string;
  stepIndex: number;
}

export function createAgentPendingApprovalAssembly(
  options: CreateAgentPendingApprovalAssemblyOptions,
): AgentRuntimePendingApprovalAssembly {
  const toolName = options.approval.command.toolCall?.name ?? options.approval.command.kind;
  return {
    finalAnswer: options.approval.reason,
    historyLine: [
      `Step ${options.stepIndex} prepared ${options.label}:`,
      `tool=${toolName}`,
      `reason=${options.approval.reason}`,
      `permission=${options.approval.routeSummary}`,
    ].join('\n'),
    pendingApproval: options.approval,
    status: 'needs-approval',
    traceEvent: {
      details: {
        args: options.approval.command.toolCall?.input ?? {},
        label: options.label,
        reason: options.approval.reason,
        routeSummary: options.approval.routeSummary,
      },
      status: 'needs-approval',
      stepIndex: options.stepIndex,
      summary: createAgentApprovalRequiredTraceSummary({ toolName }),
      tool: toolName,
      type: 'approval_required',
    },
  };
}
