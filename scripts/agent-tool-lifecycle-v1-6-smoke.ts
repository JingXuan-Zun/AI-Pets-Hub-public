import assert from 'node:assert/strict';
import {
  AGENT_TOOL_LIFECYCLE_METADATA,
  createAgentPlannerAvailableToolLines,
  formatAgentToolLifecycleMetadata,
  getAgentToolLifecycleMetadata,
  listAgentToolNames,
} from '../src/agent/index.ts';
import { type AgentToolCallName } from '../src/agent/agentChatCommand.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const { registrySource, plannerSource, modeRouterSource } = readProjectSources({
  registrySource: 'src/agent/agentToolRegistry.ts',
  plannerSource: 'src/agent/agentPlanner.ts',
  modeRouterSource: 'src/agent/agentModeRouter.ts',
});

assert.match(
  registrySource,
  /export interface AgentToolLifecycleMetadata[\s\S]*observes[\s\S]*mutates[\s\S]*verifies[\s\S]*recoversWith/u,
  'tool registry should expose structured lifecycle metadata',
);

assert.match(
  registrySource,
  /export const AGENT_TOOL_LIFECYCLE_METADATA/u,
  'tool lifecycle registry should be exported',
);

assert.match(registrySource, /launch_local_app[\s\S]*focused-window/u);
assert.match(registrySource, /organize_desktop_icons[\s\S]*desktop-icon-positions/u);
assert.match(registrySource, /inspect_local_project[\s\S]*project-run-candidates/u);

assert.match(
  plannerSource,
  /TOOL_LIFECYCLE_SYSTEM_INSTRUCTION[\s\S]*observes = state[\s\S]*recoversWith = preferred tools/u,
  'planner should define lifecycle instructions for tool selection',
);

assert.match(
  plannerSource,
  /Completed tool lifecycle: \$\{formatAgentToolLifecycleMetadata\(request\.currentCommand\.toolCall\.name\)\}/u,
  'recovery planner input should include the completed tool lifecycle metadata',
);

assert.match(
  modeRouterSource,
  /formatAgentToolLifecycleMetadata\(definition\.name\)/u,
  'mode-specific tool lists should include lifecycle metadata',
);

for (const toolName of listAgentToolNames()) {
  const metadata = AGENT_TOOL_LIFECYCLE_METADATA[toolName as AgentToolCallName];
  assert.ok(metadata, `missing lifecycle metadata for ${toolName}`);
  assert.ok(Array.isArray(metadata.observes), `${toolName} observes should be structured`);
  assert.ok(Array.isArray(metadata.mutates), `${toolName} mutates should be structured`);
  assert.ok(Array.isArray(metadata.verifies), `${toolName} verifies should be structured`);
  assert.ok(Array.isArray(metadata.recoversWith), `${toolName} recoversWith should be structured`);
}

assert.deepEqual(getAgentToolLifecycleMetadata('get_display_info').mutates, []);
assert.ok(getAgentToolLifecycleMetadata('get_display_info').observes.includes('display-list'));
assert.ok(getAgentToolLifecycleMetadata('launch_local_app').mutates.includes('focused-window'));
assert.ok(getAgentToolLifecycleMetadata('launch_local_app').verifies.includes('focused-window'));
assert.ok(getAgentToolLifecycleMetadata('organize_desktop_icons').recoversWith.includes('get_display_info'));
assert.ok(getAgentToolLifecycleMetadata('run_local_project_action').recoversWith.includes('inspect_local_project'));

const launchLifecycle = formatAgentToolLifecycleMetadata('launch_local_app');
assert.match(launchLifecycle, /observes: app-index, focused-window/u);
assert.match(launchLifecycle, /mutates: focused-window, process-list/u);
assert.match(launchLifecycle, /verifies: focused-window, launch-request-accepted/u);

const plannerLines = createAgentPlannerAvailableToolLines();
assert.ok(plannerLines.some((line) => (
  line.includes('launch_local_app')
  && line.includes('observes: app-index, focused-window')
  && line.includes('recoversWith: launch_local_app')
)));
assert.ok(plannerLines.some((line) => (
  line.includes('organize_desktop_icons')
  && line.includes('verifies: desktop-icon-positions, grid-snap-result')
)));

console.log('agent tool lifecycle v1.6 smoke ok');
