import assert from 'node:assert/strict';
import {
  createAgentVisualRefinementResultMessage,
  createAgentVisualRefinementRunningMessage,
  createAgentVisualRefinementStepReason,
  createAgentVisualRefinementStepSummary,
} from '../src/agent/legacy/index.ts';
import {
  assertSourceDoesNotMatch,
  assertSourceMatches,
  readProjectSources,
} from './smokeTestHarness.ts';

const {
  execution: executionSource,
  index: indexSource,
  runtimeSignal: runtimeSignalSource,
  session: sessionSource,
  signal: signalSource,
} = readProjectSources({
  execution: 'src/agent/runtime/agentVisualRefinementExecutionRuntime.ts',
  index: 'src/agent/legacy/index.ts',
  runtimeSignal: 'src/agent/runtime/agentExecutionProgressSignals.ts',
  session: 'src/agent/agentProductionSessionImplementation.ts',
  signal: 'src/agent/runtime/agentExecutionProgressSignals.ts',
});

assertSourceMatches(
  runtimeSignalSource,
  /export function createAgentVisualRefinementStepReason/u,
  'Visual refinement step reason should be Runtime-owned.',
);
assertSourceDoesNotMatch(
  sessionSource,
  /from '\.\/agentSessionV2VisualRefinementStepReasonSignal'/u,
  'AgentSessionV2 should consume Runtime refinement progress instead of a V2 presentation signal.',
);
assertSourceMatches(
  executionSource,
  /from '\.\/agentExecutionProgressSignals'/u,
  'Visual Refinement Execution Runtime should consume shared Runtime progress signals.',
);
assertSourceDoesNotMatch(
  runtimeSignalSource,
  /createAgentSessionV2VisualRefinementCommand|buildAgentPermissionRoute|executeAgentSessionV2ToolCommandWithCache|resolveAgentSessionV2VisualActionApproval|hasAgentSessionV2ClearActionableVisualEvidence/u,
  'Visual refinement step reason signal should not own command creation, permission routing, execution, approval resolution, or candidate evidence policy.',
);
assertSourceDoesNotMatch(
  runtimeSignalSource,
  /observe_windows_and_apps\s*->\s*locate_screen_elements\s*->\s*execute_desktop_sequence/iu,
  'Visual refinement step reason signal should not encode a fixed recovery chain.',
);
assertSourceDoesNotMatch(
  sessionSource,
  /reason: 'Automatically focusing a promising visual candidate before deciding the next action\.'/u,
  'AgentSessionV2 should not inline visual refinement step reason.',
);

assert.equal(
  createAgentVisualRefinementStepReason(),
  'Automatically focusing a promising visual candidate before deciding the next action.',
);
assert.equal(
  createAgentVisualRefinementStepSummary(),
  'Visual refinement: inspect focused candidate area.',
);
assert.equal(
  createAgentVisualRefinementRunningMessage(),
  'Agent is refining the visual target with a focused observation.',
);
assert.equal(
  createAgentVisualRefinementResultMessage({ ok: true }),
  'Agent refined the visual target evidence.',
);
assert.equal(
  createAgentVisualRefinementResultMessage({ ok: false }),
  'Agent received a failed visual refinement result.',
);

console.log('agent session v2 visual refinement step reason signal smoke ok');
