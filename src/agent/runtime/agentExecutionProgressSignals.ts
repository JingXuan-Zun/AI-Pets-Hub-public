export function createAgentFailedActionRecoveryStepReason() {
  return 'Automatically reading current UI/window evidence after a failed desktop action.';
}

export function createAgentFailedActionRecoveryStepSummary() {
  return 'Failed action recovery: inspect current desktop state.';
}

export function createAgentFailedActionRecoveryRunningMessage() {
  return 'Agent is reading the current UI state after a failed desktop action.';
}

export function createAgentFailedActionRecoveryResultMessage(options: { ok: boolean }) {
  return options.ok
    ? 'Agent read the current UI state after the failed action.'
    : 'Agent received a failed failed-action recovery result.';
}

export function createAgentAutoRecoveryStepReason() {
  return 'Automatically following safe read-only post-action recovery evidence.';
}

export function createAgentAutoRecoveryStepSummary() {
  return 'Auto recovery: observe post-action UI state.';
}

export function createAgentAutoRecoveryRunningMessage(options: {
  isWaitAndObserve: boolean;
  recoveryAttemptText?: string | null;
}) {
  return options.isWaitAndObserve
    ? `Agent is waiting and refreshing observation before deciding the next step${options.recoveryAttemptText ?? ''}.`
    : 'Agent is reading the visible post-action state before deciding the next step.';
}

export function createAgentAutoRecoveryResultMessage(options: { ok: boolean }) {
  return options.ok
    ? 'Agent refreshed post-action evidence.'
    : 'Agent received a failed post-action recovery observation.';
}

export function createAgentPostApprovalVerificationStepReason() {
  return 'Automatically verifying the approved desktop action outcome with read-only visual evidence.';
}

export function createAgentPostApprovalVerificationStepSummary() {
  return 'Post-approval verification: inspect current UI state.';
}

export function createAgentPostApprovalVerificationRunningMessage() {
  return 'Agent is verifying the approved desktop action outcome.';
}

export function createAgentPostApprovalVerificationResultMessage(options: { ok: boolean }) {
  return options.ok
    ? 'Agent verified the approved desktop action outcome.'
    : 'Agent received a failed post-approval verification result.';
}

export function createAgentVisualRefinementStepReason() {
  return 'Automatically focusing a promising visual candidate before deciding the next action.';
}

export function createAgentVisualRefinementStepSummary() {
  return 'Visual refinement: inspect focused candidate area.';
}

export function createAgentVisualRefinementRunningMessage() {
  return 'Agent is refining the visual target with a focused observation.';
}

export function createAgentVisualRefinementResultMessage(options: { ok: boolean }) {
  return options.ok
    ? 'Agent refined the visual target evidence.'
    : 'Agent received a failed visual refinement result.';
}

export function createAgentAutoRecoveryLoopContinuedHistoryLine(options: {
  loopIndex: number;
  maxLoops: number;
  nextAction: string;
  nextTool: string;
  postActionState?: string | null;
  sourceLabel: string;
  triggerStepIndex: number;
}) {
  return [
    `Step ${options.triggerStepIndex} automatic recovery loop continued:`,
    `source=${options.sourceLabel}`,
    `loop=${options.loopIndex}/${options.maxLoops}`,
    `postActionState=${options.postActionState || 'none'}`,
    `nextTool=${options.nextTool}`,
    `nextAction=${options.nextAction || 'unknown'}`,
  ].join('\n');
}

export function createAgentAutoRecoveryLoopStoppedHistoryLine(options: {
  postActionState?: string | null;
  reason: string;
  sourceLabel: string;
  triggerStepIndex: number;
}) {
  return [
    `Step ${options.triggerStepIndex} automatic recovery loop stopped:`,
    `source=${options.sourceLabel}`,
    `reason=${options.reason}`,
    options.postActionState !== undefined ? `postActionState=${options.postActionState || 'none'}` : '',
  ].filter(Boolean).join('\n');
}

export function createAgentPostActionTerminalStoppedHistoryLine(options: {
  historyReason?: string | null;
  postActionState: string;
  sourceLabel: string;
  status: string;
  triggerStepIndex: number;
}) {
  return [
    `Step ${options.triggerStepIndex} post-action state machine stopped:`,
    `source=${options.sourceLabel}`,
    `postActionState=${options.postActionState}`,
    options.historyReason ? `reason=${options.historyReason}` : '',
    `status=${options.status}`,
  ].filter(Boolean).join('\n');
}
