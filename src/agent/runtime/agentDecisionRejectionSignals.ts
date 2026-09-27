import {
  type AgentChatCommand,
  type AgentToolCallName,
} from '../agentChatCommand';
import {
  compactAgentPlanningSignalText,
  getAgentStructuredEvidence,
} from './agentPlanningSignalEvidence';
import { type AgentRuntimeToolResultEntry } from './agentRuntimeContract';

export function createAgentPrematureActionConfirmationRejection(
  entry: AgentRuntimeToolResultEntry,
  rejectedMessage?: string,
) {
  const toolName = entry.command.toolCall?.name ?? entry.command.kind;
  const evidence = getAgentStructuredEvidence(entry);
  return [
    'The model produced a rejected premature action confirmation.',
    'The latest observation already identifies a clear next desktop action for the original user request.',
    `tool=${toolName}`,
    evidence?.targetMatched ? `target=${evidence.targetMatched}` : '',
    evidence?.primaryAction ? `primaryAction=${evidence.primaryAction}` : '',
    evidence?.elementRegion ? `elementRegion=${evidence.elementRegion}` : '',
    Number.isFinite(Number(evidence?.elementCenter?.x)) && Number.isFinite(Number(evidence?.elementCenter?.y))
      ? `elementCenter=${Math.round(Number(evidence?.elementCenter?.x))},${Math.round(Number(evidence?.elementCenter?.y))}`
      : '',
    Number.isFinite(Number(evidence?.elementCenterRatio?.x)) && Number.isFinite(Number(evidence?.elementCenterRatio?.y))
      ? `elementCenterRatio=${Number(evidence?.elementCenterRatio?.x).toFixed(3)},${Number(evidence?.elementCenterRatio?.y).toFixed(3)}`
      : '',
    evidence?.relation ? `relation=${evidence.relation}` : '',
    evidence?.confidence ? `confidence=${evidence.confidence}` : '',
    evidence?.visualActionReadiness ? `visualActionReadiness=${evidence.visualActionReadiness}` : '',
    'prematureActionConfirmationRejectionPolicy=This rejection is advisory/evidence-driven. It prevents asking for chat confirmation when the original user already requested the action and actionable evidence is available, but it does not mandate a fixed recovery tool chain.',
    'The user already requested this action. Do not ask for permission in chat.',
    'Select an approval-required desktop input/sequence tool so the app permission UI can ask once before execution.',
    'Prefer execute_desktop_sequence when the remaining action is a click/type/hotkey/drag based on known coordinates or a known focused window.',
    rejectedMessage ? `rejectedMessage=${compactAgentPlanningSignalText(rejectedMessage, 360)}` : '',
  ].filter(Boolean).join('\n');
}

function normalizeAgentTransitionalDesktopActionName(value: string) {
  return value.trim().toLowerCase().replace(/[-\s]+/gu, '_');
}

function getAgentTransitionalDesktopActionName(args: Record<string, unknown> | undefined) {
  const action = args?.action ?? args?.desktopAction ?? args?.operation;
  return typeof action === 'string'
    ? normalizeAgentTransitionalDesktopActionName(action)
    : '';
}

export function createAgentTransitionalDesktopActionRejection(
  args: Record<string, unknown> | undefined,
) {
  const action = getAgentTransitionalDesktopActionName(args) || 'unknown';
  return [
    `Transitional desktop action "${action}" is kept only for old compatibility.`,
    args ? `rejectedArgs=${compactAgentPlanningSignalText(args, 520)}` : '',
    'transitionalDesktopActionRejectionPolicy=This rejection is advisory/evidence-driven. It prevents using compatibility-only compound desktop actions for new decisions, but it does not mandate a fixed recovery tool chain.',
    'Re-plan with current desktop evidence and choose supported generic desktop primitives; use execute_desktop_sequence when a known multi-step desktop action should be approved once, or choose a necessary observation/question when evidence is incomplete. Do not repeat the compatibility-only compound action unchanged.',
  ].filter(Boolean).join('\n');
}

export function createAgentVideoSummarySearchRejection() {
  return [
    'Rejected video summary search: the user asked to watch/summarize a video, not to search for videos.',
    'First identify the video source from a provided URL, the current browser tab/page, or the current visible screen/window.',
    'If the source is still unclear, ask one short question for the video link or whether the video is on the current screen.',
    'videoSummarySearchRejectionPolicy=This rejection is advisory/evidence-driven. It blocks substituting search for video observation, but it does not mandate a fixed source-discovery tool chain.',
  ].join(' ');
}

export function createAgentRepeatedFailedToolCallRejection(options: {
  args: Record<string, unknown>;
  previousFailure: AgentRuntimeToolResultEntry;
  toolName: AgentToolCallName;
}) {
  const previousResult = options.previousFailure.result;
  return [
    'Rejected repeated failed tool call before execution.',
    `tool=${options.toolName}`,
    `args=${compactAgentPlanningSignalText(options.args, 520)}`,
    previousResult.errorText ? `previousError=${compactAgentPlanningSignalText(previousResult.errorText, 420)}` : '',
    previousResult.responseText ? `previousResponse=${compactAgentPlanningSignalText(previousResult.responseText, 360)}` : '',
    previousResult.followUp ? `previousFollowUp=${compactAgentPlanningSignalText(previousResult.followUp, 360)}` : '',
    previousResult.observations?.length
      ? `previousObservations=${compactAgentPlanningSignalText(previousResult.observations.join(' | '), 520)}`
      : '',
    'repeatedFailedToolCallPolicy=This rejection is advisory/evidence-driven. It prevents repeating the exact same failed tool call, but it does not mandate a fixed recovery tool chain.',
    'Replan with changed args, a different observation/action tool, a necessary ask_user question, or a concise blocked answer if no safe path remains.',
  ].filter(Boolean).join('\n');
}

export function createAgentRepeatedUnverifiedActionRetryRejection(options: {
  candidateSignature: string;
  command: AgentChatCommand;
  previousAttempt: AgentRuntimeToolResultEntry;
}) {
  const previousStructuredEvidence = getAgentStructuredEvidence(options.previousAttempt);
  const previousToolName = options.previousAttempt.command.toolCall?.name ?? options.previousAttempt.command.kind;
  const currentToolName = options.command.toolCall?.name ?? options.command.kind;
  const latestRecovery = previousStructuredEvidence?.postActionRecovery;
  return [
    'Rejected repeated unverified action retry before approval.',
    `tool=${currentToolName}`,
    `actionPrimitiveSignature=${compactAgentPlanningSignalText(options.candidateSignature, 520)}`,
    `previousTool=${previousToolName}`,
    previousStructuredEvidence?.postActionState ? `previousPostActionState=${previousStructuredEvidence.postActionState}` : '',
    latestRecovery?.strategy ? `previousRecoveryStrategy=${latestRecovery.strategy}` : '',
    latestRecovery?.reason ? `previousRecoveryReason=${compactAgentPlanningSignalText(latestRecovery.reason, 360)}` : '',
    options.previousAttempt.result.stateSummary?.missingEvidence?.length
      ? `previousMissingEvidence=${compactAgentPlanningSignalText(options.previousAttempt.result.stateSummary.missingEvidence.join(' | '), 520)}`
      : '',
    options.previousAttempt.result.stateSummary?.recommendedRecovery?.length
      ? `previousRecommendedRecovery=${compactAgentPlanningSignalText(options.previousAttempt.result.stateSummary.recommendedRecovery.join(' | '), 520)}`
      : '',
    'repeatedUnverifiedActionRetryPolicy=This rejection is advisory/evidence-driven. It prevents asking approval for the exact same unverified primitive, but it does not mandate a fixed recovery tool chain.',
    'The same action primitive already ran and did not verify the user-level goal.',
    'Replan with changed coordinates/target/window/action args, collect a more specific observation, ask one short necessary question, or report a concrete blocker with evidence. Do not ask the user to approve the exact same primitive again.',
  ].filter(Boolean).join('\n');
}
