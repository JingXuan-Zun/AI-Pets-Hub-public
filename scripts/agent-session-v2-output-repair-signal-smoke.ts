import assert from 'node:assert/strict';
import {
  createAgentInvalidModelOutputRepairText,
  createAgentInvalidToolInputRepairText,
  createAgentUnavailableToolRepairText,
} from '../src/agent/legacy/index.ts';
import {
  assertSourceDoesNotMatch,
  assertSourceMatches,
  readProjectSources,
} from './smokeTestHarness.ts';
import {
  createAgentInvalidModelOutputRepairText,
  createAgentInvalidToolInputRepairText,
  createAgentUnavailableToolRepairText,
} from '../src/agent/runtime/agentDecisionRepairSignal.ts';

const {
  index: indexSource,
  runtimeSignal: runtimeSignalSource,
  session: sessionSource,
  signal: signalSource,
} = readProjectSources({
  index: 'src/agent/legacy/index.ts',
  runtimeSignal: 'src/agent/runtime/agentDecisionRepairSignal.ts',
  session: 'src/agent/agentProductionSessionImplementation.ts',
  signal: 'src/agent/runtime/agentDecisionRepairSignal.ts',
});

assertSourceMatches(runtimeSignalSource, /export function createAgentInvalidModelOutputRepairText/u);
assertSourceMatches(runtimeSignalSource, /export function createAgentUnavailableToolRepairText/u);
assertSourceMatches(runtimeSignalSource, /export function createAgentInvalidToolInputRepairText/u);
assertSourceMatches(
  sessionSource,
  /from '\.\/runtime\/agentDecisionRepairSignal'/u,
  'AgentSessionV2 should consume Decision Repair Signal Runtime directly.',
);

assert.match(
  indexSource,
  /export \* from '\.\.\/agentSessionV2OutputRepairSignal'/u,
  'Output repair signal module should be exported through the agent barrel.',
);
assert.match(
  runtimeSignalSource,
  /outputRepairPolicy=This repair is decision-contract-driven/u,
  'Output repair signals should explicitly remain decision-contract-driven.',
);

const invalidModelOutputText = createAgentInvalidModelOutputRepairText('not json at all');
assert.equal(invalidModelOutputText, createAgentInvalidModelOutputRepairText('not json at all'));
assert.match(invalidModelOutputText, /rejected invalid model output/u);
assert.match(invalidModelOutputText, /Return exactly one JSON object/u);
assert.match(invalidModelOutputText, /Allowed actions: tool_call, tool_calls, ask_user, final_answer/u);
assert.match(invalidModelOutputText, /Rejected output: not json at all/u);

const unavailableToolText = createAgentUnavailableToolRepairText({
  allowedPrimaryToolNames: ['observe_windows_and_apps', 'execute_desktop_action'],
  toolName: 'legacy_tool',
});
assert.equal(unavailableToolText, createAgentUnavailableToolRepairText({
  allowedPrimaryToolNames: ['observe_windows_and_apps', 'execute_desktop_action'],
  toolName: 'legacy_tool',
}));
assert.match(unavailableToolText, /rejected unavailable tool selection/u);
assert.match(unavailableToolText, /Rejected tool: legacy_tool/u);
assert.match(unavailableToolText, /Allowed primary tools: observe_windows_and_apps, execute_desktop_action/u);

const invalidToolInputText = createAgentInvalidToolInputRepairText({
  args: { action: 'click' },
  error: 'Missing required target',
  toolName: 'execute_desktop_action',
});
assert.equal(invalidToolInputText, createAgentInvalidToolInputRepairText({
  args: { action: 'click' },
  error: 'Missing required target',
  toolName: 'execute_desktop_action',
}));
assert.match(invalidToolInputText, /rejected invalid tool input/u);
assert.match(invalidToolInputText, /Schema error: Missing required target/u);
assert.match(invalidToolInputText, /Rejected args: \{"action":"click"\}/u);
assert.match(invalidToolInputText, /provide args that match the selected tool schema/u);

for (const text of [invalidModelOutputText, unavailableToolText, invalidToolInputText]) {
  assert.match(text, /outputRepairPolicy=This repair is decision-contract-driven/u);
  assert.doesNotMatch(
    text,
    /observe_windows_and_apps\s*->\s*execute_desktop_action\s*->\s*verify/iu,
    'Output repair signals should not encode a fixed recovery chain.',
  );
}

console.log('agent session v2 output repair signal smoke ok');
