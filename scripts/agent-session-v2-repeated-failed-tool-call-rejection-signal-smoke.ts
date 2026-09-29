import assert from 'node:assert/strict';
import {
  createAgentRepeatedFailedToolCallRejection,
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
  index: indexSource,
  runtimeSignal: runtimeSignalSource,
  session: sessionSource,
  signal: signalSource,
} = readProjectSources({
  index: 'src/agent/legacy/index.ts',
  runtimeSignal: 'src/agent/runtime/agentDecisionRejectionSignals.ts',
  session: 'src/agent/agentProductionSessionImplementation.ts',
  signal: 'src/agent/runtime/agentDecisionRejectionSignals.ts',
});

assertSourceMatches(
  runtimeSignalSource,
  /export function createAgentRepeatedFailedToolCallRejection/u,
  'Repeated failed tool call rejection signal should be Runtime-owned.',
);
assertSourceMatches(
  runtimeSignalSource,
  /repeatedFailedToolCallPolicy=This rejection is advisory\/evidence-driven/u,
  'Repeated failed tool call rejection signal should explicitly remain advisory and evidence-driven.',
);
assertSourceMatches(
  sessionSource,
  /from '\.\/runtime\/agentDecisionRejectionSignals'/u,
  'AgentSessionV2 should consume Runtime-owned decision rejection signals.',
);
assertSourceDoesNotMatch(
  sessionSource,
  /createAgentSessionV2RepeatedFailedToolCallRejection/u,
  'AgentSessionV2 should not own repeated failed tool call rejection signal implementation.',
);
assertSourceMatches(sessionSource, /createAgentRepeatedFailedToolCallRejection\(/u);
assertSourceMatches(
  sessionSource,
  /function findLatestFailedAgentSessionV2ToolCall/u,
  'AgentSessionV2 should still own the repeated failed call detection for this slice.',
);

function createCommand(): AgentChatCommand {
  return {
    capabilityId: 'desktop-observation',
    instruction: 'inspect target window',
    kind: 'tool-call',
    sourceText: '/agent inspect target window',
    toolCall: {
      goal: 'inspect target window',
      input: {
        action: 'inspect_window_ui',
        query: 'Missing App',
      },
      name: 'execute_desktop_observation',
    },
  };
}

const previousResult: AgentChatCommandResult = {
  errorText: 'No matching window was found.',
  followUp: 'List current windows before retrying.',
  observations: [
    'Requested source query: Missing App',
    'Available window: Example Launcher',
  ],
  ok: false,
  responseText: 'Unable to inspect the requested window.',
  stateSummary: {
    missingEvidence: ['Target window was not identified.'],
    recommendedRecovery: ['Call observe_windows_and_apps or list_capture_sources before retrying.'],
  },
  verification: 'No matching window was found.',
};

const previousFailure: AgentSessionV2ToolResultEntry = {
  command: createCommand(),
  result: previousResult,
};

const rejectionText = createAgentRepeatedFailedToolCallRejection({
  args: {
    action: 'inspect_window_ui',
    query: 'Missing App',
  },
  previousFailure,
  toolName: 'execute_desktop_observation',
});

assert.match(rejectionText, /Rejected repeated failed tool call before execution/u);
assert.match(rejectionText, /tool=execute_desktop_observation/u);
assert.match(rejectionText, /args=.*inspect_window_ui/u);
assert.match(rejectionText, /previousError=No matching window was found/u);
assert.match(rejectionText, /previousResponse=Unable to inspect the requested window/u);
assert.match(rejectionText, /previousFollowUp=List current windows before retrying/u);
assert.match(rejectionText, /previousObservations=Requested source query: Missing App/u);
assert.match(rejectionText, /repeatedFailedToolCallPolicy=This rejection is advisory\/evidence-driven/u);
assert.match(rejectionText, /Replan with changed args, a different observation\/action tool/u);
assert.doesNotMatch(
  rejectionText,
  /open_app\s*->\s*wait_ui\s*->\s*locate\s*->\s*click\s*->\s*verify/iu,
  'Repeated failed tool call rejection signal should not encode a fixed tool chain.',
);

console.log('agent session v2 repeated failed tool call rejection signal smoke ok');
