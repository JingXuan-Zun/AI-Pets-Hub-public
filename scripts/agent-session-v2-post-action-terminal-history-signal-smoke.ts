import assert from 'node:assert/strict';
import { createAgentPostActionTerminalStoppedHistoryLine } from '../src/agent/legacy/index.ts';
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
  runtimeSignal: 'src/agent/runtime/agentExecutionProgressSignals.ts',
  session: 'src/agent/agentProductionSessionImplementation.ts',
  signal: 'src/agent/runtime/agentExecutionProgressSignals.ts',
});

assertSourceMatches(
  runtimeSignalSource,
  /export function createAgentPostActionTerminalStoppedHistoryLine/u,
  'Runtime should own post-action terminal history formatting.',
);
assertSourceMatches(
  sessionSource,
  /from '\.\/runtime\/agentExecutionProgressSignals'/u,
  'AgentSessionV2 should consume Runtime-owned execution progress signals.',
);
assertSourceDoesNotMatch(
  runtimeSignalSource,
  /evaluateAgentSessionV2PostActionTerminal|createFinalResult|createAgentSessionV2ToolCommand|buildAgentPermissionRoute|executeAgentSessionV2ToolCommandWithCache/u,
  'Post-action terminal history signal should not own terminal evaluation, final result creation, commands, permission routing, or execution.',
);
assertSourceDoesNotMatch(
  runtimeSignalSource,
  /observe_windows_and_apps\s*->\s*locate_screen_elements\s*->\s*execute_desktop_sequence/iu,
  'Post-action terminal history signal should not encode a fixed recovery chain.',
);
assertSourceDoesNotMatch(
  sessionSource,
  /`Step \$\{triggerStepIndex\} post-action state machine stopped:`/u,
  'AgentSessionV2 should not inline the post-action terminal stopped history header.',
);

const withReason = createAgentPostActionTerminalStoppedHistoryLine({
  historyReason: 'verified-target-window',
  postActionState: 'launched',
  sourceLabel: 'post-approval-verification',
  status: 'completed',
  triggerStepIndex: 5,
});
assert.equal(
  withReason,
  [
    'Step 5 post-action state machine stopped:',
    'source=post-approval-verification',
    'postActionState=launched',
    'reason=verified-target-window',
    'status=completed',
  ].join('\n'),
);

const withoutReason = createAgentPostActionTerminalStoppedHistoryLine({
  postActionState: 'login_required',
  sourceLabel: 'auto-recovery-result',
  status: 'needs-user',
  triggerStepIndex: 8,
});
assert.equal(
  withoutReason,
  [
    'Step 8 post-action state machine stopped:',
    'source=auto-recovery-result',
    'postActionState=login_required',
    'status=needs-user',
  ].join('\n'),
);

console.log('agent session v2 post action terminal history signal smoke ok');
