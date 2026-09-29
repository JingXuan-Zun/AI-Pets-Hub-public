import assert from 'node:assert/strict';
import {
  createAgentRepeatedUnverifiedActionRetryRejection,
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
  runtimeSignal: runtimeSignalSource,
  session: sessionSource,
} = readProjectSources({
  runtimeSignal: 'src/agent/runtime/agentDecisionRejectionSignals.ts',
  session: 'src/agent/agentProductionSessionImplementation.ts',
});

assertSourceMatches(
  runtimeSignalSource,
  /export function createAgentRepeatedUnverifiedActionRetryRejection/u,
  'Repeated unverified action retry rejection signal should be Runtime-owned.',
);
assertSourceMatches(
  runtimeSignalSource,
  /repeatedUnverifiedActionRetryPolicy=This rejection is advisory\/evidence-driven/u,
  'Repeated unverified action retry rejection signal should explicitly remain advisory and evidence-driven.',
);
assertSourceMatches(
  sessionSource,
  /from '\.\/runtime\/agentDecisionRejectionSignals'/u,
  'AgentSessionV2 should consume Runtime-owned decision rejection signals.',
);
assertSourceDoesNotMatch(
  sessionSource,
  /createAgentSessionV2RepeatedUnverifiedActionRetryRejection/u,
  'AgentSessionV2 should not own repeated unverified action retry rejection signal implementation.',
);
assertSourceMatches(sessionSource, /createAgentRepeatedUnverifiedActionRetryRejection\(/u);
assertSourceMatches(
  sessionSource,
  /function findAgentSessionV2RepeatedUnverifiedActionRetry/u,
  'AgentSessionV2 should still own the repeated retry detection predicate for this slice.',
);

function createDesktopInputCommand(x: number, y: number): AgentChatCommand {
  return {
    capabilityId: 'desktop-input',
    instruction: 'click launch button',
    kind: 'tool-call',
    sourceText: '/agent launch Example App',
    toolCall: {
      goal: 'launch Example App',
      input: {
        action: 'click',
        x,
        y,
      },
      name: 'execute_desktop_input',
    },
  };
}

const previousResult: AgentChatCommandResult = {
  ok: true,
  receipt: {
    evidenceLines: ['Click was sent, but launch was not verified.'],
    status: 'unverified',
    summaryLines: ['Call: execute_desktop_input click'],
    title: 'Execution receipt',
    toolName: 'execute_desktop_input',
    verification: 'No launched target window evidence.',
  },
  responseText: 'Click sent, but the app launch is still unverified.',
  stateSummary: {
    missingEvidence: [
      'No launched target window was observed.',
      'The target may still be visible-only rather than selected/current.',
    ],
    recommendedRecovery: [
      'Re-locate the target action with a focused crop before retrying.',
      'Ask one short question if candidates remain ambiguous.',
    ],
    structuredEvidence: {
      postActionRecovery: {
        nextArgs: {
          action: 'locate_element',
          focusCenterRatioX: 0.72,
          focusCenterRatioY: 0.64,
        },
        nextTool: 'locate_screen_elements',
        reason: 'Need fresher target/action relation evidence before another click.',
        strategy: 're-locate-target',
      },
      postActionState: 'visible_only',
      visualActionReadiness: 'needs-target-selection',
    },
  },
  verification: 'No launched target window evidence.',
};

const previousAttempt: AgentSessionV2ToolResultEntry = {
  command: createDesktopInputCommand(1120, 720),
  result: previousResult,
};

const rejectionText = createAgentRepeatedUnverifiedActionRetryRejection({
  candidateSignature: 'execute_desktop_input:{"primitive":{"action":"click","x":1120,"y":720}}',
  command: createDesktopInputCommand(1120, 720),
  previousAttempt,
});

assert.match(rejectionText, /Rejected repeated unverified action retry before approval/u);
assert.match(rejectionText, /tool=execute_desktop_input/u);
assert.match(rejectionText, /actionPrimitiveSignature=execute_desktop_input/u);
assert.match(rejectionText, /previousTool=execute_desktop_input/u);
assert.match(rejectionText, /previousPostActionState=visible_only/u);
assert.match(rejectionText, /previousRecoveryStrategy=re-locate-target/u);
assert.match(rejectionText, /previousRecoveryReason=Need fresher target\/action relation evidence/u);
assert.match(rejectionText, /previousMissingEvidence=No launched target window was observed/u);
assert.match(rejectionText, /previousRecommendedRecovery=Re-locate the target action with a focused crop before retrying/u);
assert.match(rejectionText, /repeatedUnverifiedActionRetryPolicy=This rejection is advisory\/evidence-driven/u);
assert.match(rejectionText, /The same action primitive already ran/u);
assert.match(rejectionText, /Do not ask the user to approve the exact same primitive again/u);
assert.doesNotMatch(
  rejectionText,
  /open_app\s*->\s*wait_ui\s*->\s*locate\s*->\s*click\s*->\s*verify/iu,
  'Repeated unverified action retry rejection signal should not encode a fixed tool chain.',
);

console.log('agent session v2 repeated unverified action retry rejection signal smoke ok');
