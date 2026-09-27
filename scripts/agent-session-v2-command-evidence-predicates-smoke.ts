import assert from 'node:assert/strict';
import {
  AGENT_POST_APPROVAL_VERIFICATION_MARKER,
  hasAgentPostApprovalVerificationRun,
  isAgentPostApprovalVerificationCommand,
  isAgentVerifiedTargetWindowObservation,
  type AgentChatCommand,
  type AgentChatCommandResult,
  type AgentSessionV2ToolResultEntry,
} from '../src/agent/legacy/index.ts';
import {
  assertSourceDoesNotMatch,
  assertSourceMatches,
  readProjectSources,
} from './smokeTestHarness.ts';

const {
  predicates: predicateSource,
  runtimePredicates: runtimePredicateSource,
  session: sessionSource,
} = readProjectSources({
  predicates: 'src/agent/runtime/agentCommandEvidencePredicates.ts',
  runtimePredicates: 'src/agent/runtime/agentCommandEvidencePredicates.ts',
  session: 'src/agent/agentProductionSessionImplementation.ts',
});

assertSourceMatches(
  runtimePredicateSource,
  /export function isAgentPostApprovalVerificationCommand/u,
  'Post-approval verification command predicate should be Runtime-owned',
);
assertSourceMatches(
  runtimePredicateSource,
  /export function isAgentVerifiedTargetWindowObservation/u,
  'Verified target window observation predicate should be Runtime-owned',
);
assertSourceMatches(
  runtimePredicateSource,
  /AgentRuntimeToolResultEntry/u,
  'Command evidence predicates should consume the version-neutral Runtime Tool Result contract.',
);
assertSourceMatches(
  sessionSource,
  /from '\.\/runtime\/agentCommandEvidencePredicates'/u,
  'AgentSessionV2 should consume Runtime command evidence predicates directly.',
);
assertSourceDoesNotMatch(
  sessionSource,
  /function isAgentSessionV2PostApprovalVerificationCommand/u,
  'AgentSessionV2 should consume the post-approval predicate instead of defining it inline',
);
assertSourceDoesNotMatch(
  sessionSource,
  /function isAgentSessionV2VerifiedTargetWindowObservation/u,
  'AgentSessionV2 should consume the verified-window predicate instead of defining it inline',
);

const sourceText = '/agent open Riot Client';
const userGoal = 'open Riot Client';

function createCommand(
  name: AgentChatCommand['toolCall'] extends { name: infer Name } ? Name : never,
  input: Record<string, unknown>,
): AgentChatCommand {
  return {
    capabilityId: 'desktop-observation',
    instruction: userGoal,
    kind: 'tool-call',
    sourceText,
    toolCall: {
      goal: userGoal,
      input,
      name,
    },
  };
}

const postApprovalWindowObservation = createCommand('observe_windows_and_apps', {
  recoveryReason: `Check visible windows after approval: ${AGENT_POST_APPROVAL_VERIFICATION_MARKER}`,
  query: 'Riot Client',
});
assert.equal(isAgentPostApprovalVerificationCommand(postApprovalWindowObservation), true);

const postApprovalVisualSummary = createCommand('execute_desktop_observation', {
  action: 'summarize_visual_snapshot',
  question: `AgentRuntime post-action verification: is Riot Client open?`,
  query: 'Riot Client',
});
assert.equal(isAgentPostApprovalVerificationCommand(postApprovalVisualSummary), true);

const plainVisualSummary = createCommand('execute_desktop_observation', {
  action: 'summarize_visual_snapshot',
  question: 'Is Riot Client open?',
  query: 'Riot Client',
});
assert.equal(isAgentPostApprovalVerificationCommand(plainVisualSummary), false);

function createResult(
  overrides: Partial<AgentChatCommandResult> = {},
): AgentChatCommandResult {
  return {
    ok: true,
    observations: [
      'Riot Client window is visible.',
    ],
    responseText: 'Riot Client window is visible.',
    stateSummary: {
      structuredEvidence: {
        finalWindow: {
          processName: 'RiotClientServices.exe',
          title: 'Riot Client',
        },
        status: 'success',
        targetMatched: 'Riot Client',
      },
      verificationEvidence: [
        'Riot Client window is visible.',
      ],
    },
    verification: 'Riot Client window is visible.',
    ...overrides,
  };
}

const verifiedWindowEntry: AgentSessionV2ToolResultEntry = {
  command: postApprovalWindowObservation,
  result: createResult(),
};
assert.equal(isAgentVerifiedTargetWindowObservation(verifiedWindowEntry), true);
assert.equal(hasAgentPostApprovalVerificationRun([verifiedWindowEntry]), true);

const failedWindowEntry: AgentSessionV2ToolResultEntry = {
  command: postApprovalWindowObservation,
  result: createResult({
    assessment: {
      status: 'failed',
      summary: 'The target window was not verified.',
    },
  }),
};
assert.equal(isAgentVerifiedTargetWindowObservation(failedWindowEntry), false);
const staleFallbackWindowEntry = {
  ...verifiedWindowEntry,
  result: {
    ...verifiedWindowEntry.result,
    stateSummary: {
      ...verifiedWindowEntry.result.stateSummary,
      structuredEvidence: {
        ...verifiedWindowEntry.result.stateSummary!.structuredEvidence,
        observationFreshness: 'stale-fallback' as const,
      },
    },
  },
};
assert.equal(isAgentVerifiedTargetWindowObservation(staleFallbackWindowEntry), false);

const actionResultWindowEntry: AgentSessionV2ToolResultEntry = {
  command: {
    ...postApprovalWindowObservation,
    toolCall: {
      goal: userGoal,
      input: {
        action: 'launch_local_app',
        target: 'Riot Client',
      },
      name: 'execute_desktop_action',
    },
  },
  result: createResult({
    observations: [],
    responseText: 'Launch command completed.',
    verification: 'Launch command completed.',
  }),
};
assert.equal(isAgentVerifiedTargetWindowObservation(actionResultWindowEntry), true);

console.log('agent session v2 command evidence predicates smoke ok');
