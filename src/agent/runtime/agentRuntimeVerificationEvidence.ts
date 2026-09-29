import {
  type AgentStructuredToolEvidence,
  type AgentStructuredToolTargetInteractionVerificationEvidence,
} from '../agentChatCommand';

/**
 * Reads the generic target/action verification field while accepting the
 * legacy launcher-shaped field as a one-way compatibility input.
 */
export function resolveAgentTargetInteractionVerification(
  evidence: AgentStructuredToolEvidence | null | undefined,
): AgentStructuredToolTargetInteractionVerificationEvidence | null {
  return evidence?.targetInteractionVerification
    ?? evidence?.launcherVerification
    ?? null;
}
