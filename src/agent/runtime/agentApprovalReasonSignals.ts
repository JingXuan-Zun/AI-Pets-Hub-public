import { compactAgentPlanningSignalText } from './agentPlanningSignalEvidence';

export type AgentVisualInputFallbackMode =
  | 'click'
  | 'double_click'
  | 'click_then_enter'
  | 'click_then_space';

export function createAgentApprovalReadyFollowUpReason(options: {
  actionLabel: string;
}) {
  const actionLabel = compactAgentPlanningSignalText(options.actionLabel, 180) || 'pending action';
  return [
    `Read-only observation and planning are complete. The next step requires user approval: ${actionLabel}`,
    'approvalReadyFollowUpPolicy=This signal is evidence-driven. It promotes an already prepared approval-required follow-up after read-only planning, without prescribing a fixed tool chain.',
  ].join('\n');
}

export function createAgentApprovalRequiredToolReason(options: {
  decisionReason?: string | null;
  permissionSummary?: string | null;
}) {
  const decisionReason = options.decisionReason?.trim();
  if (decisionReason) return decisionReason;

  const permissionSummary = options.permissionSummary?.trim();
  if (permissionSummary) return permissionSummary;

  return 'This step needs user approval before it can run.';
}

export function createAgentTargetSelectionUiAutomationStepReason(options: {
  alternateUiAction?: string | null;
  targetText: string;
}) {
  const alternateUiAction = options.alternateUiAction?.trim();
  if (alternateUiAction) {
    return `Use alternate UI Automation recovery action "${alternateUiAction}" for "${options.targetText}" because the previous selection primitive did not verify the target.`;
  }
  return `Select the UI Automation item "${options.targetText}" before locating its primary action.`;
}

export function createAgentTargetSelectionCoordinateStepReason(options: { targetText: string }) {
  return `Click the visually located target item "${options.targetText}" to select it before locating its primary action.`;
}

export function createAgentTargetSelectionApprovalReason(options: {
  currentSelection?: string | null;
  targetText: string;
  usingAlternateRecovery?: boolean;
}) {
  const currentSelection = options.currentSelection?.trim();
  const currentText = currentSelection
    ? ` Current selection appears to be "${currentSelection}".`
    : '';
  if (options.usingAlternateRecovery) {
    return `The target "${options.targetText}" is still visible but the previous selection primitive did not verify it as selected/current.${currentText} Requesting approval for a different UI Automation recovery action, then verify selection before any primary open/start/play action.`;
  }
  return `The target "${options.targetText}" is visible but not confirmed as selected/current.${currentText} Requesting approval to select the target item first, then verify selection before any primary open/start/play action.`;
}

export function createAgentVisualInputStepReason(options: {
  action: 'click' | 'confirm' | 'single_input';
  inputAction: AgentVisualInputFallbackMode;
  keyName?: string | null;
  point: { x: number; y: number };
  primaryActionText: string;
  targetText: string;
}) {
  const pointText = `(${options.point.x}, ${options.point.y})`;
  if (options.action === 'click') {
    return `Click ${pointText} first so "${options.targetText}" / "${options.primaryActionText}" can receive focus.`;
  }
  if (options.action === 'confirm') {
    return `Press ${options.keyName ?? 'Enter'} to confirm "${options.primaryActionText}" for "${options.targetText}".`;
  }
  if (options.inputAction === 'double_click') {
    return `Double-click ${pointText} to trigger "${options.primaryActionText}" for "${options.targetText}".`;
  }
  return `Click ${pointText} to trigger "${options.primaryActionText}" for "${options.targetText}".`;
}

export function createAgentVisualActionApprovalReason(options: {
  coordinateFallbackAfterWindowUiFailure?: boolean;
  inputAction: AgentVisualInputFallbackMode;
  keyName?: string | null;
  point: { x: number; y: number };
  primaryActionText: string;
  targetText: string;
}) {
  const pointText = `(${options.point.x}, ${options.point.y})`;
  if (options.coordinateFallbackAfterWindowUiFailure) {
    if (options.inputAction === 'double_click') {
      return `UI Automation could not apply the direct control action, and the previous click did not advance the UI. Requesting approval to double-click ${pointText} as a coordinate fallback.`;
    }
    return `UI Automation could not apply the direct control action, but "${options.targetText}" has a clear coordinate. Requesting approval to click ${pointText} as a coordinate fallback.`;
  }
  if (options.inputAction === 'click_then_enter' || options.inputAction === 'click_then_space') {
    return `The previous click did not visibly advance the UI, but "${options.targetText}" is still at the same location. Requesting approval to click ${pointText}, then press ${options.keyName ?? 'Enter'} to confirm.`;
  }
  if (options.inputAction === 'double_click') {
    return `The previous click did not visibly advance the UI, but "${options.targetText}" is still clearly located. Requesting approval to double-click ${pointText}.`;
  }
  return `Located "${options.targetText}" and its "${options.primaryActionText}". Requesting approval to click ${pointText}.`;
}

export function createAgentVisualInvokeWindowUiStepReason(options: {
  targetText: string;
  uiAction: string;
}) {
  return options.uiAction === 'focus'
    ? `Focus the UI Automation control "${options.targetText}".`
    : `Invoke the UI Automation control "${options.targetText}".`;
}

export function createAgentVisualInvokeTextInputStepReason(options: { targetText: string }) {
  return `Type the requested text into the focused "${options.targetText}" control.`;
}

export function createAgentVisualInvokeSubmitStepReason(options: {
  submitKey: string;
  targetText: string;
}) {
  return `Confirm the focused "${options.targetText}" input with ${options.submitKey}.`;
}

export function createAgentVisualInvokeApprovalReason(options: {
  primaryActionText: string;
  targetText: string;
}) {
  return `Located "${options.targetText}" with an invokable UI Automation control for "${options.primaryActionText}". Requesting approval to invoke it directly.`;
}
