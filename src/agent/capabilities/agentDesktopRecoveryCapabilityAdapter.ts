import { createAgentDesktopAutoRecoveryObservationCommand } from './agentDesktopRecoveryObservationBuilder';
import { createAgentDesktopFailedDesktopActionRecoveryCommand } from './agentDesktopRecoveryCommandBuilder';
import { type AgentRecoveryProposalAdapters } from '../runtime/agentRecoveryController';
import { type AgentRuntimeToolResultEntry } from '../runtime/agentRuntimeContract';

export function createAgentDesktopRecoveryCapabilityAdapter(options: {
  resolvePostActionState: (input: {
    entry: AgentRuntimeToolResultEntry | null;
    sourceText: string;
    userGoal: string;
  }) => string;
}): AgentRecoveryProposalAdapters {
  return {
    automaticObservation: (request) => createAgentDesktopAutoRecoveryObservationCommand({
      dependencies: {
        resolvePostActionState: options.resolvePostActionState,
      },
      latestEntry: request.latestEntry,
      sourceText: request.sourceText,
      toolResults: request.toolResults,
      userGoal: request.userGoal,
    }),
    failedAction: (request) => createAgentDesktopFailedDesktopActionRecoveryCommand({
      latestEntry: request.latestEntry,
      sourceText: request.sourceText,
      toolResults: request.toolResults,
      userGoal: request.userGoal,
    }),
  };
}
