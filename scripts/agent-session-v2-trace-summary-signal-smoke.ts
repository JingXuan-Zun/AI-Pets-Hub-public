import assert from 'node:assert/strict';
import {
  createAgentApprovalRequiredTraceSummary,
  createAgentPermissionRoutedTraceSummary,
  createAgentToolFinishedTraceSummary,
  createAgentToolStartedTraceSummary,
} from '../src/agent/legacy/index.ts';
import {
  assertSourceDoesNotMatch,
  assertSourceMatches,
  readProjectSources,
} from './smokeTestHarness.ts';

const {
  index: indexSource,
  runtimeSummary: runtimeSummarySource,
  session: sessionSource,
  signal: signalSource,
} = readProjectSources({
  index: 'src/agent/legacy/index.ts',
  runtimeSummary: 'src/agent/runtime/agentDecisionTraceSummary.ts',
  session: 'src/agent/agentProductionSessionImplementation.ts',
  signal: 'src/agent/runtime/agentDecisionTraceSummary.ts',
});

assertSourceMatches(
  runtimeSummarySource,
  /export function createAgentToolStartedTraceSummary/u,
  'Runtime trace summary should expose tool-started summary builder.',
);
assertSourceMatches(
  runtimeSummarySource,
  /export function createAgentPermissionRoutedTraceSummary/u,
  'Runtime trace summary should expose permission-routed summary builder.',
);
assertSourceMatches(
  sessionSource,
  /from '\.\/runtime\/agentDecisionTraceSummary'/u,
  'AgentSessionV2 should consume Runtime trace summaries directly.',
);
assertSourceDoesNotMatch(
  sessionSource,
  /summary: `Starting tool \$\{/u,
  'AgentSessionV2 should not inline tool-started trace summary templates.',
);
assertSourceDoesNotMatch(
  sessionSource,
  /summary: `Permission route evaluated \$\{/u,
  'AgentSessionV2 should not inline permission-routed trace summary templates.',
);

assert.equal(
  createAgentApprovalRequiredTraceSummary({ toolName: 'execute_desktop_sequence' }),
  'Prepared approval-required tool execute_desktop_sequence.',
);
assert.equal(
  createAgentPermissionRoutedTraceSummary({ toolName: 'observe_windows_and_apps' }),
  'Permission route evaluated observe_windows_and_apps.',
);
assert.equal(
  createAgentToolStartedTraceSummary({ toolName: 'locate_screen_elements' }),
  'Starting tool locate_screen_elements.',
);
assert.equal(
  createAgentToolFinishedTraceSummary({ toolName: 'locate_screen_elements' }),
  'Finished tool locate_screen_elements.',
);

console.log('agent session v2 trace summary signal smoke ok');
