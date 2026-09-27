import assert from 'node:assert/strict';
import {
  createAgentTargetSelectionApprovalReason,
  createAgentTargetSelectionCoordinateStepReason,
  createAgentTargetSelectionUiAutomationStepReason,
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
  /export function createAgentTargetSelectionApprovalReason/u,
  'Target selection approval reason should be Runtime-owned.',
);
assertSourceMatches(
  runtimeSignalSource,
  /export function createAgentTargetSelectionUiAutomationStepReason/u,
  'Target selection UI Automation step reason should be Runtime-owned.',
);
assertSourceMatches(
  runtimeSignalSource,
  /export function createAgentTargetSelectionCoordinateStepReason/u,
  'Target selection coordinate step reason should be Runtime-owned.',
);
assertSourceMatches(
  sessionSource,
  /from '\.\/runtime\/agentApprovalReasonSignals'/u,
  'AgentSessionV2 should consume Runtime-owned approval reason signals.',
);
assertSourceDoesNotMatch(
  runtimeSignalSource,
  /buildAgentPermissionRoute|resolveAgentSessionV2TargetSelectionCandidate|hasAgentSessionV2SameRetryAvoidanceWindowUiCandidate|createAgentSessionV2ToolCommand/u,
  'Target selection approval reason signal should not own permission routing, candidate selection, retry predicates, or command construction.',
);
assertSourceDoesNotMatch(
  runtimeSignalSource,
  /observe_windows_and_apps\s*->\s*locate_screen_elements\s*->\s*execute_desktop_sequence/iu,
  'Target selection approval reason signal should not encode a fixed recovery chain.',
);
assertSourceDoesNotMatch(
  sessionSource,
  /The target "\$\{targetText\}" is visible but not confirmed as selected\/current/u,
  'AgentSessionV2 should not inline the normal target selection approval reason template.',
);
assertSourceDoesNotMatch(
  sessionSource,
  /The target "\$\{targetText\}" is still visible but the previous selection primitive/u,
  'AgentSessionV2 should not inline the alternate target selection approval reason template.',
);

assert.equal(
  createAgentTargetSelectionUiAutomationStepReason({
    targetText: 'Example Game',
  }),
  'Select the UI Automation item "Example Game" before locating its primary action.',
);
assert.equal(
  createAgentTargetSelectionUiAutomationStepReason({
    alternateUiAction: 'focus',
    targetText: 'Example Game',
  }),
  'Use alternate UI Automation recovery action "focus" for "Example Game" because the previous selection primitive did not verify the target.',
);
assert.equal(
  createAgentTargetSelectionCoordinateStepReason({
    targetText: 'Example Game',
  }),
  'Click the visually located target item "Example Game" to select it before locating its primary action.',
);

const normalReason = createAgentTargetSelectionApprovalReason({
  currentSelection: 'Another Game',
  targetText: 'Example Game',
});
assert.match(normalReason, /"Example Game" is visible but not confirmed as selected\/current/u);
assert.match(normalReason, /Current selection appears to be "Another Game"/u);
assert.match(normalReason, /select the target item first/u);

const alternateReason = createAgentTargetSelectionApprovalReason({
  currentSelection: null,
  targetText: 'Example Game',
  usingAlternateRecovery: true,
});
assert.match(alternateReason, /previous selection primitive did not verify/u);
assert.match(alternateReason, /different UI Automation recovery action/u);

for (const text of [normalReason, alternateReason]) {
  assert.doesNotMatch(
    text,
    /observe_windows_and_apps\s*->\s*locate_screen_elements\s*->\s*execute_desktop_sequence/iu,
    'Target selection approval reason should not describe a fixed tool chain.',
  );
}

console.log('agent session v2 target selection approval reason signal smoke ok');
