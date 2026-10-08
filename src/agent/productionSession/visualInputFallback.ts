import { type AgentChatCommand, type AgentStructuredToolEvidence } from '../agentChatCommand';
import { type AgentRuntimeToolResultEntry } from '../runtime/agentRuntimeContract';
import { type AgentVisualInputFallbackMode } from '../runtime/agentApprovalReasonSignals';
import { getAgentPostActionState, getAgentStructuredEvidence } from '../runtime/agentPlanningSignalEvidence';
import { isAgentVisualLauncherVerificationBlocking as isAgentSessionV2LauncherVerificationBlocking, isAgentVisualUsefulPrimaryAction as isAgentSessionV2UsefulPrimaryAction } from './visualCandidateEvidence';
import { type createAgentProductionVisualRetryEvidence } from './visualRetryEvidence';
import { type createAgentProductionVisualCandidateSelection } from './visualCandidateSelection';

export function createAgentProductionVisualInputFallback(options: {
  retryEvidence: ReturnType<typeof createAgentProductionVisualRetryEvidence>;
  candidateSelection: ReturnType<typeof createAgentProductionVisualCandidateSelection>;
  findRecoverableUnverifiedActionAttempt: (entries: AgentRuntimeToolResultEntry[]) => AgentRuntimeToolResultEntry | null;
}) {
  const { findRecoverableUnverifiedActionAttempt: findLatestAgentSessionV2RecoverableUnverifiedActionAttempt } = options;
  const { getAgentProductionCommandClickPoints: getAgentSessionV2CommandClickPoints, isAgentProductionNearPreviousActionPoint: isAgentSessionV2NearPreviousActionPoint, normalizeAgentProductionToolActionName: normalizeAgentSessionV2ToolActionName } = options.retryEvidence;
  const { resolveAgentProductionVisualActionApprovalPoint: resolveAgentSessionV2VisualActionApprovalPoint } = options.candidateSelection;

  function getAgentProductionToolInputAction(command: AgentChatCommand) {
    const action = command.toolCall?.input.action;
    return typeof action === 'string' ? action.trim() : '';
  }

  function isAgentProductionVisualToolName(toolName: string | null | undefined) {
    return toolName === 'summarize_visual_snapshot' || toolName === 'analyze_game_screen';
  }

  function isAgentProductionVisualToolCommand(command: AgentChatCommand) {
    const toolName = command.toolCall?.name;
    const action = getAgentProductionToolInputAction(command);
    return isAgentProductionVisualToolName(toolName)
      || (
        toolName === 'execute_desktop_observation'
        && action === 'summarize_visual_snapshot'
      );
  }

  function getAgentProductionCommandDesktopInputActions(command: AgentChatCommand) {
    const toolName = command.toolCall?.name ?? '';
    const input = command.toolCall?.input ?? {};
    if (toolName === 'execute_desktop_input') {
      const action = typeof input.action === 'string' ? normalizeAgentSessionV2ToolActionName(input.action) : '';
      return action ? [action] : [];
    }

    if (toolName !== 'execute_desktop_sequence' || typeof input.stepsJson !== 'string') {
      return [];
    }

    try {
      const steps = JSON.parse(input.stepsJson) as unknown;
      if (!Array.isArray(steps)) {
        return [];
      }

      return steps.flatMap((step) => {
        if (!step || typeof step !== 'object') {
          return [];
        }

        const record = step as Record<string, unknown>;
        const nestedTool = typeof record.tool === 'string' ? record.tool : '';
        const nestedArgs = record.args && typeof record.args === 'object'
          ? record.args as Record<string, unknown>
          : {};
        if (nestedTool !== 'execute_desktop_input') {
          return [];
        }

        const action = typeof nestedArgs.action === 'string'
          ? normalizeAgentSessionV2ToolActionName(nestedArgs.action)
          : '';
        return action ? [action] : [];
      });
    } catch {
      return [];
    }
  }

  function isAgentProductionWindowUiCoordinateFallbackEvidence(entry: AgentRuntimeToolResultEntry) {
    if (entry.result.ok !== false) {
      return false;
    }

    const toolName = entry.command.toolCall?.name ?? '';
    const action = getAgentProductionToolInputAction(entry.command);
    const input = entry.command.toolCall?.input ?? {};
    const sequenceText = typeof input.stepsJson === 'string' ? input.stepsJson : '';
    const isWindowUiAction = (
      toolName === 'execute_desktop_action'
      && (action === 'interact_window_ui' || action === 'invoke_window_ui')
    ) || (
      toolName === 'execute_desktop_sequence'
      && /"action"\s*:\s*"(?:interact_window_ui|invoke_window_ui)"/u.test(sequenceText)
    );
    if (!isWindowUiAction) {
      return false;
    }

    const evidence = getAgentStructuredEvidence(entry);
    if (
      evidence?.visualActionReadiness !== 'ready'
      || evidence.postActionRecovery?.nextTool !== 'execute_desktop_input'
      || evidence.confidence === 'low'
      || isAgentSessionV2LauncherVerificationBlocking(evidence)
      || !evidence.targetMatched
      || !isAgentSessionV2UsefulPrimaryAction(evidence.primaryAction)
    ) {
      return false;
    }

    return Boolean(resolveAgentSessionV2VisualActionApprovalPoint({
      evidence,
      toolResults: [entry],
    }));
  }

  function shouldUseAgentProductionDoubleClickFallback(options: {
    evidence: AgentStructuredToolEvidence | null;
    point: { x: number; y: number };
    toolResults?: AgentRuntimeToolResultEntry[] | null;
  }) {
    if (
      options.evidence?.visualActionReadiness !== 'ready'
      || options.evidence.confidence === 'low'
      || isAgentSessionV2LauncherVerificationBlocking(options.evidence)
    ) {
      return false;
    }

    const previousAttempt = findLatestAgentSessionV2RecoverableUnverifiedActionAttempt(options.toolResults ?? []);
    if (
      !previousAttempt
      || getAgentPostActionState(previousAttempt) !== 'unchanged'
    ) {
      return false;
    }

    const previousActions = getAgentProductionCommandDesktopInputActions(previousAttempt.command);
    if (!previousActions.includes('click') || previousActions.includes('double_click')) {
      return false;
    }

    const previousPoints = getAgentSessionV2CommandClickPoints(previousAttempt.command);
    return isAgentSessionV2NearPreviousActionPoint(options.point, previousPoints);
  }

  function shouldUseAgentProductionKeyboardConfirmFallback(options: {
    evidence: AgentStructuredToolEvidence | null;
    point: { x: number; y: number };
    toolResults?: AgentRuntimeToolResultEntry[] | null;
  }) {
    if (
      options.evidence?.visualActionReadiness !== 'ready'
      || options.evidence.confidence === 'low'
      || isAgentSessionV2LauncherVerificationBlocking(options.evidence)
    ) {
      return false;
    }

    if (!hasAgentProductionKeyboardConfirmEvidence(options.evidence)) {
      return false;
    }

    const previousAttempt = findLatestAgentSessionV2RecoverableUnverifiedActionAttempt(options.toolResults ?? []);
    if (
      !previousAttempt
      || getAgentPostActionState(previousAttempt) !== 'unchanged'
    ) {
      return false;
    }

    const previousActions = getAgentProductionCommandDesktopInputActions(previousAttempt.command);
    if (!previousActions.includes('double_click') || previousActions.includes('hotkey')) {
      return false;
    }

    const previousPoints = getAgentSessionV2CommandClickPoints(previousAttempt.command);
    return isAgentSessionV2NearPreviousActionPoint(options.point, previousPoints);
  }

  function hasAgentProductionKeyboardConfirmEvidence(evidence: AgentStructuredToolEvidence | null) {
    const candidates = [
      ...(evidence?.actionCandidates ?? []),
      ...(evidence?.targetCandidates ?? []),
    ];
    if (!candidates.length) {
      return true;
    }

    const candidatesWithExplicitKeyboardState = candidates.filter((candidate) => (
      typeof candidate.enabled === 'boolean'
      || typeof candidate.keyboardFocusable === 'boolean'
      || typeof candidate.hasKeyboardFocus === 'boolean'
      || typeof candidate.offscreen === 'boolean'
    ));
    if (!candidatesWithExplicitKeyboardState.length) {
      return true;
    }

    return candidatesWithExplicitKeyboardState.some((candidate) => (
      candidate.enabled !== false
      && candidate.offscreen !== true
      && (candidate.hasKeyboardFocus === true || candidate.keyboardFocusable === true)
    ));
  }

  function inferAgentProductionKeyboardConfirmInputAction(
    evidence: AgentStructuredToolEvidence | null,
  ): Extract<AgentVisualInputFallbackMode, 'click_then_enter' | 'click_then_space'> {
    const text = [
      evidence?.primaryAction,
      evidence?.elementDescription,
      evidence?.elementRegion,
      evidence?.targetMatched,
      ...(evidence?.actionCandidates ?? []).flatMap((candidate) => [
        candidate.controlType,
        candidate.label,
        candidate.description,
        ...(candidate.actions ?? []),
      ]),
      ...(evidence?.targetCandidates ?? []).flatMap((candidate) => [
        candidate.controlType,
        candidate.label,
        candidate.description,
        ...(candidate.actions ?? []),
      ]),
    ].filter(Boolean).join(' ').toLowerCase();

    return /(?:checkbox|radio\s*button|radiobutton|toggle|check|uncheck|\u52fe\u9009|\u53d6\u6d88\u52fe\u9009|\u5207\u6362)/iu.test(text)
      ? 'click_then_space'
      : 'click_then_enter';
  }

  return { getAgentProductionToolInputAction, isAgentProductionVisualToolCommand, getAgentProductionCommandDesktopInputActions, isAgentProductionWindowUiCoordinateFallbackEvidence, shouldUseAgentProductionDoubleClickFallback, shouldUseAgentProductionKeyboardConfirmFallback, inferAgentProductionKeyboardConfirmInputAction };
}
