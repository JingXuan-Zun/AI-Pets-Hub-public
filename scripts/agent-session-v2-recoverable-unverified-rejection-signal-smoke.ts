import assert from 'node:assert/strict';
import {
  createAgentRecoverableUnverifiedRejection,
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
  runtimeSignal: 'src/agent/runtime/agentFinalAnswerRejectionSignals.ts',
  session: 'src/agent/agentProductionSessionImplementation.ts',
});

assertSourceMatches(
  runtimeSignalSource,
  /export function createAgentRecoverableUnverifiedRejection/u,
  'Recoverable unverified rejection signal should be Runtime-owned.',
);
assertSourceMatches(
  runtimeSignalSource,
  /recoverableUnverifiedRejectionPolicy=This signal is advisory\/evidence-driven/u,
  'Recoverable unverified rejection signal should explicitly remain advisory and evidence-driven.',
);
assertSourceMatches(
  sessionSource,
  /from '\.\/runtime\/agentFinalAnswerRejectionSignals'/u,
  'AgentSessionV2 should consume Runtime-owned final answer rejection signals.',
);
assertSourceDoesNotMatch(
  sessionSource,
  /createAgentSessionV2RecoverableUnverifiedRejection/u,
  'AgentSessionV2 should not own recoverable unverified rejection signal implementation.',
);
assertSourceMatches(sessionSource, /createAgentRecoverableUnverifiedRejection\(/u);
assertSourceMatches(
  sessionSource,
  /function isAgentSessionV2RecoverableUnverifiedToolResult/u,
  'AgentSessionV2 should still own the reject-or-continue predicate for this slice.',
);

function createCommand(): AgentChatCommand {
  return {
    capabilityId: 'desktop-input',
    instruction: 'click launch button',
    kind: 'tool-call',
    sourceText: '/agent launch Example App',
    toolCall: {
      goal: 'launch Example App',
      input: {
        action: 'click',
        x: 1120,
        y: 720,
      },
      name: 'execute_desktop_input',
    },
  };
}

const result: AgentChatCommandResult = {
  ok: true,
  receipt: {
    evidenceLines: [
      'Click was sent to the launch button.',
      'No launched target window was observed.',
    ],
    status: 'unverified',
    summaryLines: ['Call: execute_desktop_input click'],
    title: 'Execution receipt',
    toolName: 'execute_desktop_input',
    verification: 'The click action did not verify the requested app launch.',
  },
  responseText: 'Click sent, but launch is not verified.',
  stateSummary: {
    actionEvidence: {
      action: 'click',
      confidence: 0.64,
      diff: {
        changed: false,
        signals: ['active-window unchanged', 'no new process/window evidence'],
        summary: 'No visible post-click state change was detected.',
      },
      outcome: 'uncertain',
      snapshotProfile: 'light',
      targetRef: {
        confidence: 'medium',
        kind: 'pixel',
        label: 'Example App launch button',
      },
      timestamp: 123456,
      tool: 'execute_desktop_input',
    },
    missingEvidence: [
      'The requested app window is not visible yet.',
      'The post-action state is still unverified.',
    ],
    recommendedRecovery: [
      'Observe current windows or refresh visual evidence before retrying.',
      'Retry only with changed target evidence.',
    ],
    structuredEvidence: {
      postActionRecovery: {
        nextArgs: {
          action: 'wait_and_observe',
          forceRefresh: true,
          waitMs: 2500,
        },
        nextTool: 'execute_desktop_observation',
        reason: 'Need fresh post-click evidence.',
        strategy: 'wait-and-observe',
      },
      postActionState: 'unchanged',
      visualActionReadiness: 'needs-coordinate',
    },
    verificationEvidence: [
      'Click primitive completed, but user-level launch is not verified.',
    ],
  },
  verification: 'No launched target window was observed.',
};

const entry: AgentSessionV2ToolResultEntry = {
  command: createCommand(),
  result,
};

const rejectionText = createAgentRecoverableUnverifiedRejection(
  entry,
  'It is done.',
);

assert.match(rejectionText, /The latest recoverable tool result is still unverified: tool=execute_desktop_input/u);
assert.match(rejectionText, /receiptStatus=unverified/u);
assert.match(rejectionText, /actionEvidence=outcome=uncertain/u);
assert.match(rejectionText, /snapshotProfile=light/u);
assert.match(rejectionText, /target=Example App launch button/u);
assert.match(rejectionText, /postActionState=unchanged/u);
assert.match(rejectionText, /postActionRecoveryStrategy=wait-and-observe/u);
assert.match(rejectionText, /postActionRecoveryNextTool=execute_desktop_observation/u);
assert.match(rejectionText, /postActionRecoveryNextArgs=.*wait_and_observe/u);
assert.match(rejectionText, /visualActionReadiness=needs-coordinate/u);
assert.match(rejectionText, /missingEvidence=The requested app window is not visible yet/u);
assert.match(rejectionText, /recommendedRecovery=Observe current windows or refresh visual evidence before retrying/u);
assert.match(rejectionText, /receiptEvidence=Click was sent to the launch button/u);
assert.match(rejectionText, /verification=No launched target window was observed/u);
assert.match(rejectionText, /postActionRecovery=The latest UI appears unchanged/u);
assert.match(rejectionText, /recoverableUnverifiedRejectionPolicy=This signal is advisory\/evidence-driven/u);
assert.match(rejectionText, /rejectedMessage=It is done/u);
assert.doesNotMatch(
  rejectionText,
  /open_app\s*->|wait_ui\s*->|locate\s*->|click\s*->|verify/iu,
  'Recoverable unverified rejection signal should not encode a fixed tool chain.',
);

console.log('agent session v2 recoverable unverified rejection signal smoke ok');
