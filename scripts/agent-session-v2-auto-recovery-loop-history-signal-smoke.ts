import assert from 'node:assert/strict';
import {
  createAgentAutoRecoveryLoopContinuedHistoryLine,
  createAgentAutoRecoveryLoopStoppedHistoryLine,
} from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const {
  index: indexSource,
  publicIndex: publicIndexSource,
  runtimeSignal: runtimeSignalSource,
  session: sessionSource,
  signal: signalSource,
} = readProjectSources({
  index: 'src/agent/legacy/index.ts',
  publicIndex: 'src/agent/index.ts',
  runtimeSignal: 'src/agent/runtime/agentExecutionProgressSignals.ts',
  session: 'src/agent/agentProductionSessionImplementation.ts',
  signal: 'src/agent/runtime/agentExecutionProgressSignals.ts',
});

assert.match(
  runtimeSignalSource,
  /export function createAgentAutoRecoveryLoopContinuedHistoryLine/u,
  'Runtime should own continued recovery history formatting.',
);
assert.match(
  runtimeSignalSource,
  /export function createAgentAutoRecoveryLoopStoppedHistoryLine/u,
  'Runtime should own stopped recovery history formatting.',
);
assert.match(
  indexSource,
  /export \* from '\.\.\/index'/u,
  'Legacy entry should delegate public exports to the current Agent entry.',
);
assert.match(
  publicIndexSource,
  /export \* from '\.\/runtime\/agentExecutionProgressSignals'/u,
  'Current Agent entry should export Runtime-owned recovery history signals.',
);
assert.match(
  sessionSource,
  /from '\.\.\/runtime\/agentExecutionProgressSignals'/u,
  'AgentSessionV2 should consume Runtime-owned execution progress signals.',
);
assert.match(sessionSource, /from '\.\/productionSession\/autoRecoveryExecution'/u);
assert.match(sessionSource, /createAgentProductionAutoRecoveryExecution\(/u);
assert.doesNotMatch(
  runtimeSignalSource,
  /buildAgentPermissionRoute|createAgentSessionV2AutoRecoveryObservationCommand|executeAutoRecoveryObservation|executeAgentSessionV2ToolCommandWithCache|resolveAgentSessionV2RecoveryPostActionState/u,
  'Auto-recovery loop history signal should not own permission routing, command creation, execution, or post-action state resolution.',
);
assert.doesNotMatch(
  runtimeSignalSource,
  /observe_windows_and_apps\s*->\s*locate_screen_elements\s*->\s*execute_desktop_sequence/iu,
  'Auto-recovery loop history signal should not encode a fixed recovery chain.',
);
assert.doesNotMatch(
  sessionSource,
  /`Step \$\{triggerStepIndex\} automatic recovery loop continued:`/u,
  'AgentSessionV2 should not inline the auto-recovery loop continued history header.',
);

const continued = createAgentAutoRecoveryLoopContinuedHistoryLine({
  loopIndex: 2,
  maxLoops: 3,
  nextAction: 'wait_and_observe',
  nextTool: 'execute_desktop_observation',
  postActionState: 'loading',
  sourceLabel: 'approved-result',
  triggerStepIndex: 7,
});
assert.equal(
  continued,
  [
    'Step 7 automatic recovery loop continued:',
    'source=approved-result',
    'loop=2/3',
    'postActionState=loading',
    'nextTool=execute_desktop_observation',
    'nextAction=wait_and_observe',
  ].join('\n'),
);

const stoppedWithoutState = createAgentAutoRecoveryLoopStoppedHistoryLine({
  reason: 'recovery-did-not-produce-new-evidence',
  sourceLabel: 'approved-result',
  triggerStepIndex: 7,
});
assert.equal(
  stoppedWithoutState,
  [
    'Step 7 automatic recovery loop stopped:',
    'source=approved-result',
    'reason=recovery-did-not-produce-new-evidence',
  ].join('\n'),
);

const stoppedWithState = createAgentAutoRecoveryLoopStoppedHistoryLine({
  postActionState: null,
  reason: 'loop-limit-reached-3',
  sourceLabel: 'approved-result',
  triggerStepIndex: 7,
});
assert.match(stoppedWithState, /postActionState=none/u);

console.log('agent session v2 auto recovery loop history signal smoke ok');
