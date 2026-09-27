import { type AgentChatCommand } from '../agentChatCommand';
import {
  compactAgentPlanningSignalText,
  createAgentActionPrimitiveSignature,
  formatAgentStructuredCandidates,
  getAgentPostActionState,
  getAgentStructuredEvidence,
  getLatestAgentToolResult,
} from './agentPlanningSignalEvidence';
import {
  createAgentRankedRecoveryStrategies,
  type AgentRecoveryStrategyRankingDependencies,
} from './agentRecoveryStrategyRanking';
import { type AgentRuntimeToolResultEntry } from './agentRuntimeContract';

export interface AgentPostActionRecoveryFollowUpSignalDependencies {
  findRecoverableUnverifiedActionAttempt: (
    toolResults: AgentRuntimeToolResultEntry[],
  ) => AgentRuntimeToolResultEntry | null;
  isAutoRecoveryCommand: (command: AgentChatCommand) => boolean;
  isReadOnlyRecoveryEvidenceCommand?: (command: AgentChatCommand) => boolean;
  recoveryStrategyDependencies: AgentRecoveryStrategyRankingDependencies;
}

function getAgentAutoRecoveryPostActionState(entry: AgentRuntimeToolResultEntry) {
  const structuredState = getAgentPostActionState(entry);
  if (structuredState && structuredState !== 'unknown') {
    return structuredState;
  }

  const question = entry.command.toolCall?.input?.question;
  if (typeof question !== 'string') {
    return 'unknown';
  }

  const match = question.match(/Post-action state is ([a-z_]+)/iu);
  return match?.[1]?.trim().toLowerCase() || 'unknown';
}

function normalizeAgentRecoveryText(value: unknown) {
  return typeof value === 'string' ? value.replace(/\s+/gu, ' ').trim() : '';
}

function getAgentFirstRecoveryText(...values: unknown[]) {
  for (const value of values) {
    const text = normalizeAgentRecoveryText(value);
    if (text) {
      return text;
    }
  }

  return '';
}

function createAgentVisualActionBlocker(value: unknown) {
  const readiness = typeof value === 'string' ? value.trim() : '';
  switch (readiness) {
    case 'needs-target-selection':
      return 'target-visible-but-not-selected-or-current';
    case 'needs-primary-action':
      return 'primary-open-start-play-action-not-identified';
    case 'needs-coordinate':
      return 'native-screen-coordinate-not-resolved';
    case 'needs-relation':
      return 'target-action-ownership-not-proven';
    case 'low-confidence':
      return 'visual-confidence-too-low';
    case 'not-actionable':
      return 'visible-evidence-not-actionable';
    default:
      return '';
  }
}

function createAgentSuggestedLocateArgs(options: {
  latestEntry: AgentRuntimeToolResultEntry;
  previousAttempt: AgentRuntimeToolResultEntry;
}) {
  const latestInput = options.latestEntry.command.toolCall?.input ?? {};
  const previousInput = options.previousAttempt.command.toolCall?.input ?? {};
  const structuredEvidence = getAgentStructuredEvidence(options.latestEntry);
  const sourceQuery = getAgentFirstRecoveryText(
    latestInput.sourceQuery,
    latestInput.query,
    latestInput.target,
    latestInput.name,
    latestInput.title,
    latestInput.processName,
    previousInput.sourceQuery,
    previousInput.query,
    previousInput.target,
    previousInput.name,
    previousInput.title,
    previousInput.processName,
    structuredEvidence?.finalWindow?.title,
    structuredEvidence?.finalWindow?.processName,
  );
  const targetDescription = getAgentFirstRecoveryText(
    structuredEvidence?.targetMatched,
    latestInput.targetText,
    latestInput.targetDescription,
    previousInput.postVerifyQuery,
    previousInput.postVerifyVisualQuery,
    previousInput.targetText,
    previousInput.targetDescription,
    options.previousAttempt.command.toolCall?.goal,
    options.latestEntry.command.toolCall?.goal,
  );
  const args = {
    action: 'locate_element',
    forceRefresh: true,
    ...(sourceQuery ? { sourceQuery } : {}),
    sourceType: 'window',
    ...(targetDescription ? {
      targetDescription: `${targetDescription}; include the target item and its associated primary open/start/play/launch action`,
      targetText: targetDescription,
    } : {}),
  };

  return Object.keys(args).length > 3 ? JSON.stringify(args) : '';
}

export function createAgentPostActionRecoveryFollowUpText(options: {
  dependencies: AgentPostActionRecoveryFollowUpSignalDependencies;
  toolResults: AgentRuntimeToolResultEntry[];
}) {
  const { dependencies, toolResults } = options;
  const latestEntry = getLatestAgentToolResult(toolResults);
  const previousAttempt = dependencies.findRecoverableUnverifiedActionAttempt(toolResults);
  if (
    !latestEntry
    || !previousAttempt
    || (
      !dependencies.isAutoRecoveryCommand(latestEntry.command)
      && !dependencies.isReadOnlyRecoveryEvidenceCommand?.(latestEntry.command)
    )
  ) {
    return '';
  }

  const toolName = latestEntry.command.toolCall?.name ?? latestEntry.command.kind;
  const result = latestEntry.result;
  const structuredEvidence = getAgentStructuredEvidence(latestEntry);
  const targetCandidates = formatAgentStructuredCandidates(structuredEvidence?.targetCandidates);
  const actionCandidates = formatAgentStructuredCandidates(structuredEvidence?.actionCandidates);
  const evidenceLines = [
    ...(result.stateSummary?.verificationEvidence ?? []),
    ...(result.receipt?.evidenceLines ?? []).slice(0, 8),
    ...(result.observations ?? []).slice(0, 8),
  ];
  const postActionState = getAgentAutoRecoveryPostActionState(latestEntry);
  const previousAttemptSignature = createAgentActionPrimitiveSignature(previousAttempt.command);
  const rankedRecoveryStrategies = createAgentRankedRecoveryStrategies({
    dependencies: dependencies.recoveryStrategyDependencies,
    entry: latestEntry,
    postActionState,
    previousAttemptSignature,
    toolResults,
  });
  const suggestedLocateArgs = createAgentSuggestedLocateArgs({
    latestEntry,
    previousAttempt,
  });
  const visualActionBlocker = createAgentVisualActionBlocker(
    structuredEvidence?.visualActionReadiness,
  );

  return [
    'reason=post_action_recovery_observed',
    `recoveryTool=${toolName}`,
    `sourcePostActionState=${postActionState}`,
    `previousActionTool=${previousAttempt.command.toolCall?.name ?? previousAttempt.command.kind}`,
    previousAttemptSignature ? `previousActionPrimitiveSignature=${compactAgentPlanningSignalText(previousAttemptSignature, 520)}` : '',
    result.ok === false ? 'recoveryObservationStatus=failed' : 'recoveryObservationStatus=ok',
    evidenceLines.length
      ? `latestRecoveryEvidence=${compactAgentPlanningSignalText(evidenceLines.join(' | '), 760)}`
      : 'latestRecoveryEvidence=none',
    result.errorText ? `errorText=${compactAgentPlanningSignalText(result.errorText, 360)}` : '',
    result.followUp ? `followUp=${compactAgentPlanningSignalText(result.followUp, 360)}` : '',
    result.stateSummary?.missingEvidence?.length
      ? `missingEvidence=${compactAgentPlanningSignalText(result.stateSummary.missingEvidence.join(' | '), 520)}`
      : '',
    result.stateSummary?.recommendedRecovery?.length
      ? `recommendedRecovery=${compactAgentPlanningSignalText(result.stateSummary.recommendedRecovery.join(' | '), 520)}`
      : '',
    structuredEvidence?.targetMatched ? `target=${structuredEvidence.targetMatched}` : '',
    structuredEvidence?.primaryAction ? `primaryAction=${structuredEvidence.primaryAction}` : '',
    structuredEvidence?.visualActionReadiness ? `visualActionReadiness=${structuredEvidence.visualActionReadiness}` : '',
    visualActionBlocker ? `visualActionBlocker=${visualActionBlocker}` : '',
    structuredEvidence?.launcherVerification?.reason
      ? `launcherReason=${compactAgentPlanningSignalText(structuredEvidence.launcherVerification.reason, 220)}`
      : '',
    Number.isFinite(Number(structuredEvidence?.elementCenter?.x)) && Number.isFinite(Number(structuredEvidence?.elementCenter?.y))
      ? `elementCenter=${Math.round(Number(structuredEvidence?.elementCenter?.x))},${Math.round(Number(structuredEvidence?.elementCenter?.y))}`
      : '',
    Number.isFinite(Number(structuredEvidence?.elementCenterRatio?.x)) && Number.isFinite(Number(structuredEvidence?.elementCenterRatio?.y))
      ? `elementCenterRatio=${Number(structuredEvidence?.elementCenterRatio?.x).toFixed(3)},${Number(structuredEvidence?.elementCenterRatio?.y).toFixed(3)}`
      : '',
    structuredEvidence?.elementRegion ? `elementRegion=${structuredEvidence.elementRegion}` : '',
    targetCandidates ? `targetCandidates=${compactAgentPlanningSignalText(targetCandidates, 520)}` : '',
    actionCandidates ? `actionCandidates=${compactAgentPlanningSignalText(actionCandidates, 520)}` : '',
    rankedRecoveryStrategies ? `rankedRecoveryStrategies=${rankedRecoveryStrategies}` : '',
    suggestedLocateArgs ? 'suggestedLocateTool=locate_screen_elements' : '',
    suggestedLocateArgs ? `suggestedLocateArgs=${compactAgentPlanningSignalText(suggestedLocateArgs, 620)}` : '',
    'inAppLauncherRecoveryHint=If the user asked to open/start B inside A and current evidence only shows no verified B window, do not repeat a plain OS launch. Use current app/window evidence to inspect or locate inside the outer app/launcher A: prefer locate_screen_elements or inspect_window_ui with sourceQuery/sourceId for A and targetDescription/targetText for B plus its primary open/start/play/launch action. This is evidence-driven guidance, not a fixed app-specific chain.',
    'postActionRecoveryFollowUpPolicy=This signal is advisory/evidence-driven. Use it to reason from current recovery evidence, but it does not mandate a fixed recovery tool chain.',
    'requiredReplan=This is evidence collected after an incomplete user action. Do not treat the recovery observation itself as task completion.',
    previousAttemptSignature ? 'retryMemory=Do not ask approval for the same previousActionPrimitiveSignature again unless the user or new evidence changed the precondition. Change args/coordinates/target/window, observe more specifically, or explain the concrete blocker.' : '',
    'nextStepRule=If the target/action/coordinate is ready, select an approval-required execute_desktop_sequence or execute_desktop_input so the app permission UI can confirm once. If the screen is loading/updating, wait_and_observe. If login/private/admin confirmation is required, ask_user with one short instruction. If candidates are ambiguous or coordinates are missing, call locate_screen_elements with a focused query/crop. If a concrete unrecoverable error is visible, final_answer as blocked with that evidence.',
  ].filter(Boolean).join('\n');
}
