import assert from 'node:assert/strict';
import {
  createAgentCompatibilityToolRejection as createLegacyCompatibilityToolRejection,
} from '../src/agent/legacy/index.ts';
import { createAgentCompatibilityToolRejection } from '../src/agent/runtime/agentCompatibilityToolRejection.ts';
import {
  assertSourceDoesNotMatch,
  assertSourceMatches,
  readProjectSources,
} from './smokeTestHarness.ts';

const {
  index: indexSource,
  legacyIndex: legacyIndexSource,
  selection: selectionSource,
  runtimeSignal: runtimeSignalSource,
  session: sessionSource,
  signal: signalSource,
} = readProjectSources({
  index: 'src/agent/index.ts',
  legacyIndex: 'src/agent/legacy/index.ts',
  selection: 'src/agent/productionSession/singleToolSelection.ts',
  runtimeSignal: 'src/agent/runtime/agentCompatibilityToolRejection.ts',
  session: 'src/agent/agentProductionSessionImplementation.ts',
  signal: 'src/agent/runtime/agentCompatibilityToolRejection.ts',
});

assertSourceMatches(
  runtimeSignalSource,
  /export function createAgentCompatibilityToolRejection/u,
  'Compatibility Tool Rejection should live in Runtime.',
);
assertSourceMatches(
  runtimeSignalSource,
  /compatibilityToolRejectionPolicy=This rejection is advisory\/decision-contract-driven/u,
  'Compatibility tool rejection signal should explicitly remain decision-contract-driven.',
);
assert.match(
  indexSource,
  /export \* from '\.\/runtime\/agentCompatibilityToolRejection'/u,
  'Compatibility tool rejection signal module should be exported through the agent barrel.',
);
assertSourceMatches(
  sessionSource,
  /from '\.\/runtime\/agentCompatibilityToolRejection'/u,
  'AgentSessionV2 should consume Runtime compatibility rejection directly.',
);
assert.doesNotMatch(
  sessionSource,
  /function createAgentSessionV2CompatibilityToolRejection/u,
  'AgentSessionV2 should not own compatibility tool rejection signal implementation.',
);
assert.match(
  sessionSource,
  /function isAgentSessionV2PrimaryToolName/u,
  'AgentSessionV2 should still own primary tool availability checks for this slice.',
);

assert.match(legacyIndexSource, /export \* from '\.\.\/index'/u);
assert.doesNotMatch(indexSource, /agentSessionV2CompatibilityToolRejectionSignal/u);
assertSourceMatches(sessionSource, /from '\.\/productionSession\/singleToolSelection'/u);
assertSourceMatches(sessionSource, /prepareSingleToolSelection\(decision, stepIndex\)/u);
assertSourceMatches(selectionSource, /from '\.\.\/runtime\/agentCompatibilityToolRejection'/u);
assertSourceMatches(selectionSource, /createAgentCompatibilityToolRejection\(effectiveToolName\)/u);

const desktopText = createAgentCompatibilityToolRejection('launch_local_app');
assert.equal(desktopText, createLegacyCompatibilityToolRejection('launch_local_app'));
assert.match(desktopText, /Compatibility-only tool "launch_local_app"/u);
assert.match(desktopText, /observe_windows_and_apps/u);
assert.match(desktopText, /execute_desktop_action/u);
assert.match(desktopText, /compatibilityToolRejectionPolicy=This rejection is advisory\/decision-contract-driven/u);
assert.doesNotMatch(
  desktopText,
  /observe_windows_and_apps\s*->\s*execute_desktop_action\s*->\s*verify/iu,
  'Compatibility tool rejection signal should not encode a fixed execution chain.',
);

const visualText = createAgentCompatibilityToolRejection('summarize_visual_snapshot');
assert.match(visualText, /desktop observation or visual\/system fact task/u);
assert.match(visualText, /execute_desktop_observation/u);

const fileText = createAgentCompatibilityToolRejection('read_text_file');
assert.match(fileText, /local file or folder observation task/u);
assert.match(fileText, /execute_local_file_action/u);

const unknownText = createAgentCompatibilityToolRejection('legacy_unknown');
assert.match(unknownText, /one of the listed primary Agent tools/u);
assert.match(unknownText, /Do not call the compatibility-only tool again/u);

console.log('agent session v2 compatibility tool rejection signal smoke ok');
