import { type AgentRuntimeDecisionAction } from './agentRuntimeContract';

export function createAgentModelOutputTraceSummary() {
  return 'Model returned a decision payload.';
}

export function createAgentModelOutputFailedTraceSummary() {
  return 'Model call failed before producing a decision payload.';
}

export function createAgentDecisionRejectedTraceSummary() {
  return 'Decision contract rejected the model output.';
}

export function createAgentDecisionAcceptedTraceSummary(action: AgentRuntimeDecisionAction) {
  return `Decision contract accepted action ${action}.`;
}

export function createAgentFinalAnswerAcceptedTraceSummary() {
  return 'Agent accepted final_answer.';
}

export function createAgentUnavailableToolRejectedTraceSummary() {
  return 'Decision contract rejected an unavailable tool selection.';
}

export function createAgentApprovalRequiredTraceSummary(options: { toolName: string }) {
  return `Prepared approval-required tool ${options.toolName}.`;
}

export function createAgentPermissionRoutedTraceSummary(options: { toolName: string }) {
  return `Permission route evaluated ${options.toolName}.`;
}

export function createAgentToolStartedTraceSummary(options: { toolName: string }) {
  return `Starting tool ${options.toolName}.`;
}

export function createAgentToolFinishedTraceSummary(options: { toolName: string }) {
  return `Finished tool ${options.toolName}.`;
}
