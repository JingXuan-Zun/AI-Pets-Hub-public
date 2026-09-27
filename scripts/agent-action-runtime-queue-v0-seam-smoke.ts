import assert from 'node:assert/strict';
import { readProjectSources } from './smokeTestHarness.ts';

const { runtimeSource, sessionSource } = readProjectSources({
  runtimeSource: 'src/agent/agentActionRuntime.ts',
  sessionSource: 'src/agent/agentProductionSessionImplementation.ts',
});

assert.match(
  runtimeSource,
  /export interface AgentActionInstance/u,
  'ActionRuntime should own the minimal current action state.',
);
assert.match(
  runtimeSource,
  /export interface AgentActionRuntimeQueue[\s\S]*currentAction: AgentActionInstance \| null/u,
  'ActionQueue v0 should only expose the current action, not a full TaskRuntime.',
);
assert.match(
  runtimeSource,
  /export function updateAgentActionInstance/u,
  'ActionRuntime should own action state updates.',
);
assert.doesNotMatch(
  runtimeSource,
  /TaskInstance|DAG|graphNodes|parallelBranches/u,
  'ActionQueue v0 should not grow into TaskRuntime, DAG, or graph execution yet.',
);
assert.match(
  sessionSource,
  /let actionRuntimeQueue: AgentActionRuntimeQueue = \{[\s\S]*currentAction: null/u,
  'AgentSessionV2 should keep a narrow per-session ActionRuntime queue.',
);
assert.match(
  sessionSource,
  /const recordActionRuntimeDecision = /u,
  'AgentSessionV2 should record ActionRuntime decisions through a single local adapter.',
);
assert.match(
  sessionSource,
  /ActionRuntime current action:[\s\S]*events=\$\{currentAction\.entries\.length\}/u,
  'ActionRuntime current action history should expose lifecycle progress for debugging.',
);

console.log('agent action runtime queue v0 seam smoke ok');
