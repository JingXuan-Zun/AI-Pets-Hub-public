import assert from 'node:assert/strict';
import {
  createAgentVisualActionApprovalReason,
  createAgentVisualInputStepReason,
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
  runtimeSignal: 'src/agent/runtime/agentApprovalReasonSignals.ts',
  session: 'src/agent/agentProductionSessionImplementation.ts',
  signal: 'src/agent/runtime/agentApprovalReasonSignals.ts',
});

assertSourceMatches(
  runtimeSignalSource,
  /export function createAgentVisualInputStepReason/u,
  'Visual input step reason should be Runtime-owned.',
);
assertSourceMatches(
  runtimeSignalSource,
  /export function createAgentVisualActionApprovalReason/u,
  'Visual action approval reason should be Runtime-owned.',
);
assertSourceMatches(
  sessionSource,
  /from '\.\/runtime\/agentApprovalReasonSignals'/u,
  'AgentSessionV2 should consume Runtime-owned approval reason signals.',
);
assertSourceDoesNotMatch(
  sessionSource,
  /銆\?\{targetText\}|銆\?\{primaryActionText\}|鍧愭爣\s*\([^`]+?\)\s*[^\n`]*\{targetText\}/u,
  'AgentSessionV2 should not contain old mojibake visual approval placeholders.',
);
assertSourceDoesNotMatch(
  runtimeSignalSource,
  /buildAgentPermissionRoute|resolveAgentSessionV2VisualActionApprovalPoint|hasAgentSessionV2ClearActionableVisualEvidence/u,
  'Visual approval reason signal should not own permission routing or visual candidate selection policy.',
);

const point = { x: 1440, y: 920 };

assert.equal(
  createAgentVisualInputStepReason({
    action: 'single_input',
    inputAction: 'click',
    point,
    primaryActionText: 'Start',
    targetText: 'Example Game',
  }),
  'Click (1440, 920) to trigger "Start" for "Example Game".',
);
assert.equal(
  createAgentVisualInputStepReason({
    action: 'single_input',
    inputAction: 'double_click',
    point,
    primaryActionText: 'Start',
    targetText: 'Example Game',
  }),
  'Double-click (1440, 920) to trigger "Start" for "Example Game".',
);
assert.equal(
  createAgentVisualInputStepReason({
    action: 'confirm',
    inputAction: 'click_then_enter',
    keyName: 'Enter',
    point,
    primaryActionText: 'Start',
    targetText: 'Example Game',
  }),
  'Press Enter to confirm "Start" for "Example Game".',
);

const clickApprovalReason = createAgentVisualActionApprovalReason({
  inputAction: 'click',
  point,
  primaryActionText: 'Start',
  targetText: 'Example Game',
});
assert.match(clickApprovalReason, /Located "Example Game" and its "Start"/u);
assert.match(clickApprovalReason, /\(1440, 920\)/u);
assert.doesNotMatch(clickApprovalReason, /\{targetText\}|\{primaryActionText\}/u);

const keyboardApprovalReason = createAgentVisualActionApprovalReason({
  inputAction: 'click_then_space',
  keyName: 'Space',
  point,
  primaryActionText: 'Start',
  targetText: 'Example Game',
});
assert.match(keyboardApprovalReason, /then press Space/u);

const fallbackReason = createAgentVisualActionApprovalReason({
  coordinateFallbackAfterWindowUiFailure: true,
  inputAction: 'click',
  point,
  primaryActionText: 'Start',
  targetText: 'Example Game',
});
assert.match(fallbackReason, /UI Automation could not apply the direct control action/u);
assert.match(fallbackReason, /"Example Game" has a clear coordinate/u);

for (const text of [clickApprovalReason, keyboardApprovalReason, fallbackReason]) {
  assert.doesNotMatch(
    text,
    /observe_windows_and_apps\s*->\s*locate_screen_elements\s*->\s*execute_desktop_sequence/iu,
    'Visual approval reason signal should not encode a fixed recovery chain.',
  );
}

console.log('agent session v2 visual approval reason signal smoke ok');
