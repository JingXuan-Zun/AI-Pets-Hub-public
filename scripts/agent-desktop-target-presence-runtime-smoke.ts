import assert from 'node:assert/strict';
import {
  resolveAgentRecoveryPostActionState,
  type AgentPostActionStateResolverDependencies,
} from '../src/agent/runtime/agentPostActionStateResolver.ts';
import type { AgentRuntimeToolResultEntry } from '../src/agent/runtime/agentRuntimeContract.ts';

function createEntry(options: {
  commandName: string;
  presence: 'absent' | 'present_unreadable' | 'present_interactable';
  evidenceText?: string;
}): AgentRuntimeToolResultEntry {
  return {
    command: {
      instruction: 'Open the target app and continue the task.',
      kind: 'tool-call',
      sourceText: 'open the target app',
      toolCall: {
        goal: 'open the target app',
        input: {},
        name: options.commandName as never,
      },
    },
    result: {
      ok: true,
      observations: options.evidenceText ? [options.evidenceText] : [],
      responseText: options.evidenceText ?? '',
      stateSummary: {
        structuredEvidence: {
          desktopTargetPresence: options.presence,
        },
      },
    },
  };
}

const dependencies: AgentPostActionStateResolverDependencies = {
  collectAutoRecoveryEvidenceText: (entry) => [
    entry.result.responseText,
    ...(entry.result.observations ?? []),
  ].filter(Boolean).join('\n'),
  hasDirectActionIntent: () => true,
  isActionResultTool: (command) => command.toolCall?.name === 'launch_local_app',
  isAutoRecoveryCommand: () => false,
  isPostApprovalVerificationCommand: () => false,
  isRecoverableUnverifiedToolResult: () => true,
};

const unreadableState = resolveAgentRecoveryPostActionState({
  dependencies,
  entry: createEntry({
    commandName: 'launch_local_app',
    evidenceText: 'The launch request was sent, but the window is not readable yet.',
    presence: 'present_unreadable',
  }),
  sourceText: 'open the target app',
  userGoal: 'open the target app',
});
assert.equal(unreadableState, 'waiting_window');

const interactableState = resolveAgentRecoveryPostActionState({
  dependencies,
  entry: createEntry({
    commandName: 'launch_local_app',
    evidenceText: 'no-window-match was present in an older observation, but the current target is interactable.',
    presence: 'present_interactable',
  }),
  sourceText: 'open the target app',
  userGoal: 'open the target app',
});
assert.notEqual(interactableState, 'waiting_window');

const absentObservationState = resolveAgentRecoveryPostActionState({
  dependencies,
  entry: createEntry({
    commandName: 'observe_windows_and_apps',
    presence: 'absent',
  }),
  sourceText: 'open the target app',
  userGoal: 'open the target app',
});
assert.equal(absentObservationState, '');

console.log('agent desktop target presence runtime smoke ok');
