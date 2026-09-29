import assert from 'node:assert/strict';
import {
  createAgentVisualInvokeApprovalReason,
  createAgentVisualInvokeSubmitStepReason,
  createAgentVisualInvokeTextInputStepReason,
  createAgentVisualInvokeWindowUiStepReason,
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
  /export function createAgentVisualInvokeApprovalReason/u,
  'Visual invoke approval reason should be Runtime-owned.',
);
assertSourceMatches(
  runtimeSignalSource,
  /export function createAgentVisualInvokeWindowUiStepReason/u,
  'Visual invoke UI Automation step reason should be Runtime-owned.',
);
assertSourceMatches(
  sessionSource,
  /from '\.\/runtime\/agentApprovalReasonSignals'/u,
  'AgentSessionV2 should consume Runtime-owned approval reason signals.',
);
assertSourceDoesNotMatch(
  runtimeSignalSource,
  /inferAgentSessionV2WindowUiAction|buildAgentPermissionRoute|resolveAgentSessionV2InvokableUiCandidate|createAgentSessionV2ToolCommand/u,
  'Visual invoke approval reason signal should not own UI action inference, permission routing, candidate selection, or command construction.',
);
assertSourceDoesNotMatch(
  runtimeSignalSource,
  /observe_windows_and_apps\s*->\s*locate_screen_elements\s*->\s*execute_desktop_sequence/iu,
  'Visual invoke approval reason signal should not encode a fixed recovery chain.',
);
assertSourceDoesNotMatch(
  sessionSource,
  /Located "\$\{targetText\}" with an invokable UI Automation control/u,
  'AgentSessionV2 should not inline the visual invoke approval reason template.',
);
assertSourceDoesNotMatch(
  sessionSource,
  /Type the requested text into the focused "\$\{targetText\}" control/u,
  'AgentSessionV2 should not inline the visual invoke text input reason template.',
);

assert.equal(
  createAgentVisualInvokeWindowUiStepReason({
    targetText: 'Example Game',
    uiAction: 'focus',
  }),
  'Focus the UI Automation control "Example Game".',
);
assert.equal(
  createAgentVisualInvokeWindowUiStepReason({
    targetText: 'Example Game',
    uiAction: 'invoke',
  }),
  'Invoke the UI Automation control "Example Game".',
);
assert.equal(
  createAgentVisualInvokeTextInputStepReason({
    targetText: 'Search',
  }),
  'Type the requested text into the focused "Search" control.',
);
assert.equal(
  createAgentVisualInvokeSubmitStepReason({
    submitKey: 'Enter',
    targetText: 'Search',
  }),
  'Confirm the focused "Search" input with Enter.',
);

const approvalReason = createAgentVisualInvokeApprovalReason({
  primaryActionText: 'Start',
  targetText: 'Example Game',
});
assert.equal(
  approvalReason,
  'Located "Example Game" with an invokable UI Automation control for "Start". Requesting approval to invoke it directly.',
);
assert.doesNotMatch(
  approvalReason,
  /observe_windows_and_apps\s*->\s*locate_screen_elements\s*->\s*execute_desktop_sequence/iu,
  'Visual invoke approval reason should not describe a fixed tool chain.',
);

console.log('agent session v2 visual invoke approval reason signal smoke ok');
