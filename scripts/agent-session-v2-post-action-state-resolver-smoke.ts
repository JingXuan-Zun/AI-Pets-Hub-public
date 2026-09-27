import assert from 'node:assert/strict';
import {
  inferAgentPostActionStateFromEvidence,
  inferAgentSelectionPostActionStateFromStructuredEvidence,
  resolveAgentRecoveryPostActionState,
  type AgentChatCommand,
  type AgentChatCommandResult,
  type AgentPostActionStateResolverDependencies,
  type AgentSessionV2ToolResultEntry,
} from '../src/agent/legacy/index.ts';
import {
  assertSourceDoesNotMatch,
  assertSourceMatches,
  readProjectSources,
} from './smokeTestHarness.ts';

const {
  runtimeResolver: runtimeResolverSource,
  resolver: resolverSource,
  session: sessionSource,
} = readProjectSources({
  runtimeResolver: 'src/agent/runtime/agentPostActionStateResolver.ts',
  resolver: 'src/agent/runtime/agentPostActionStateResolver.ts',
  session: 'src/agent/agentProductionSessionImplementation.ts',
});

assertSourceMatches(
  runtimeResolverSource,
  /export function inferAgentSelectionPostActionStateFromStructuredEvidence/u,
  'Selection post-action state inference should live in the Runtime resolver module',
);
assertSourceMatches(
  runtimeResolverSource,
  /export function inferAgentPostActionStateFromEvidence/u,
  'Textual post-action state inference should live in the Runtime resolver module',
);
assertSourceMatches(
  runtimeResolverSource,
  /export function resolveAgentRecoveryPostActionState/u,
  'Recovery post-action state resolution should live in the Runtime resolver module',
);
assertSourceDoesNotMatch(
  sessionSource,
  /function inferAgentSessionV2SelectionPostActionStateFromStructuredEvidence/u,
  'AgentSessionV2 should consume selection state inference instead of defining it inline',
);
assertSourceDoesNotMatch(
  sessionSource,
  /function inferAgentSessionV2PostActionStateFromEvidence/u,
  'AgentSessionV2 should consume textual state inference instead of defining it inline',
);
assertSourceDoesNotMatch(
  sessionSource,
  /function resolveAgentSessionV2RecoveryPostActionState/u,
  'AgentSessionV2 should consume recovery state resolution instead of defining it inline',
);

const sourceText = '/agent open League of Legends inside Riot Client';
const userGoal = 'open League of Legends inside Riot Client';

function createCommand(input: Record<string, unknown> = {}): AgentChatCommand {
  return {
    capabilityId: 'desktop-observation',
    instruction: userGoal,
    kind: 'tool-call',
    sourceText,
    toolCall: {
      goal: userGoal,
      input,
      name: 'execute_desktop_observation',
    },
  };
}

function createResult(overrides: Partial<AgentChatCommandResult> = {}): AgentChatCommandResult {
  return {
    ok: true,
    responseText: 'Observation complete.',
    ...overrides,
  };
}

function createEntry(result: AgentChatCommandResult): AgentSessionV2ToolResultEntry {
  return {
    command: createCommand(),
    result,
  };
}

const visibleOnlyEntry = createEntry(createResult({
  stateSummary: {
    structuredEvidence: {
      launcherVerification: {
        status: 'needs-target-selection',
        targetMatched: 'League of Legends',
        targetSelected: false,
        targetVisible: true,
      },
      targetMatched: 'League of Legends',
    },
  },
}));
assert.equal(
  inferAgentSelectionPostActionStateFromStructuredEvidence(visibleOnlyEntry),
  'visible_only',
);

const selectionMismatchEntry = createEntry(createResult({
  stateSummary: {
    structuredEvidence: {
      currentSelection: 'Valorant',
      targetMatched: 'League of Legends',
    },
  },
}));
assert.equal(
  inferAgentSelectionPostActionStateFromStructuredEvidence(selectionMismatchEntry),
  'selection_mismatch',
);

const dependencies: AgentPostActionStateResolverDependencies = {
  collectAutoRecoveryEvidenceText: (entry) => [
    ...(entry.result.observations ?? []),
    entry.result.verification ?? '',
    entry.result.responseText,
  ].join('\n'),
  hasDirectActionIntent: () => true,
  isActionResultTool: () => false,
  isAutoRecoveryCommand: () => false,
  isPostApprovalVerificationCommand: () => true,
  isRecoverableUnverifiedToolResult: () => false,
};

const loadingEntry = createEntry(createResult({
  observations: [
    'The app is still launching and a spinner is visible.',
  ],
}));
assert.equal(
  inferAgentPostActionStateFromEvidence({
    dependencies,
    entry: loadingEntry,
  }),
  'loading',
);

const unchangedEntry = createEntry(createResult({
  observations: [
    'Same screen; no visible change after the click.',
  ],
  stateSummary: {
    missingEvidence: [
      'No launch confirmation is visible.',
    ],
  },
}));
assert.equal(
  resolveAgentRecoveryPostActionState({
    dependencies,
    entry: unchangedEntry,
    sourceText,
    userGoal,
  }),
  'unchanged',
);

const structuredWinsEntry = createEntry(createResult({
  observations: [
    'Text says still loading, but structured evidence already classified login required.',
  ],
  stateSummary: {
    structuredEvidence: {
      postActionState: 'login_required',
    },
  },
}));
assert.equal(
  resolveAgentRecoveryPostActionState({
    dependencies,
    entry: structuredWinsEntry,
    sourceText,
    userGoal,
  }),
  'login_required',
);

const implicitUnknownEntry = createEntry(createResult({
  observations: [
    'The result is unconfirmed and no window evidence is available.',
  ],
}));
assert.equal(
  resolveAgentRecoveryPostActionState({
    dependencies,
    entry: implicitUnknownEntry,
    sourceText,
    userGoal,
  }),
  'unknown',
);

console.log('agent session v2 post action state resolver smoke ok');
