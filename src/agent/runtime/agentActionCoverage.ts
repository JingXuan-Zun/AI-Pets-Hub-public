export { createAgentCommandActionCoverage, diagnoseAgentCommandExplicitProhibition } from './actionCoverage/commandActionCoverage';
export { createAgentAttemptedActionCoverage } from './actionCoverage/attemptedActionCoverage';
import { AGENT_ACTION_KIND_LABELS } from './actionCoverage/requestedActionCoverage';
export {
  AGENT_ACTION_KIND_LABELS,
  normalizeAgentIntentText,
  isAgentVideoSummaryIntent,
  hasAgentExplicitVideoSearchIntent,
  isAgentPreviewOnlyIntent,
  isAgentExplicitReadOnlyObservationIntent,
  isAgentPlainEnglishCheckObservationIntent,
  hasAgentDirectActionIntent,
  hasAgentExplicitDirectActionIntent,
  hasAgentEffectiveDirectActionIntent,
  createAgentExplicitlyProhibitedActionCoverage,
  createAgentRequestedActionCoverage,
} from './actionCoverage/requestedActionCoverage';
import { type AgentChatCommand } from '../agentChatCommand';
import {
  type AgentRuntimeToolResultEntry as AgentRuntimeToolResultEntry,
} from './agentRuntimeContract';

export type AgentRequestedActionKind =
  | 'browser-navigation'
  | 'close-window'
  | 'desktop-input'
  | 'desktop-organization-execute'
  | 'file-management-execute'
  | 'in-app-action'
  | 'open-or-launch'
  | 'window-move-or-control';

export interface AgentActionCoverageDependencies {
  getPostActionState: (entry: AgentRuntimeToolResultEntry | null) => string;
  hasDesktopOrganizationRequest: (text: string) => boolean;
  hasWindowMoveToDisplayRequest: (text: string) => boolean;
  isAutoRecoveryReadCommand: (command: AgentChatCommand) => boolean;
  isAutoRecoveryWaitCommand: (command: AgentChatCommand) => boolean;
  isPostApprovalVerificationCommand: (command: AgentChatCommand) => boolean;
  isVerifiedTargetWindowObservation: (entry: AgentRuntimeToolResultEntry) => boolean;
}

export function isAgentActionKindCovered(
  kind: AgentRequestedActionKind,
  attemptedCoverage: Set<AgentRequestedActionKind>,
) {
  return attemptedCoverage.has(kind);
}

export function formatAgentActionCoverageKinds(
  coverage: Iterable<AgentRequestedActionKind>,
) {
  return [...coverage].map((kind) => `${kind}=${AGENT_ACTION_KIND_LABELS[kind]}`).join(' | ') || 'none';
}
