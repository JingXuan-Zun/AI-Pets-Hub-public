import assert from 'node:assert/strict';
import { readProjectSources } from './smokeTestHarness.ts';

function extractBetween(source: string, startNeedle: string, endNeedle: string) {
  const start = source.indexOf(startNeedle);
  assert.ok(start >= 0, `${startNeedle} should exist`);
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  assert.ok(end > start, `${endNeedle} should exist after ${startNeedle}`);
  return source.slice(start, end);
}

const {
  typesSource,
  constantsSource,
  normalizationSource,
  containerSource,
  settingsSource,
  agentSessionV2Source,
} = readProjectSources({
  typesSource: 'src/types.ts',
  constantsSource: 'src/constants.ts',
  normalizationSource: 'src/petConfigNormalization.ts',
  containerSource: 'src/components/pet/usePetContainerPanelChatState.ts',
  settingsSource: 'src/components/settings/SettingsSystemTab.tsx',
  agentSessionV2Source: 'src/agent/agentProductionSessionImplementation.ts',
});

assert.match(
  typesSource,
  /export type AgentRuntimeMode = 'v2-default' \| 'v3-experimental';/u,
  'PetConfig should expose a narrow runtime mode setting.',
);
assert.match(
  typesSource,
  /agentRuntimeMode: AgentRuntimeMode;/u,
  'PetConfig settings should carry the agent runtime mode.',
);
assert.match(
  constantsSource,
  /agentRuntimeMode: 'v3-experimental'/u,
  'runtime mode should stage v3 as the configured default while v2 remains selectable.',
);

assert.match(
  normalizationSource,
  /function normalizeAgentRuntimeMode\(value: unknown\)/u,
  'runtime mode normalization should be explicit.',
);
assert.match(
  normalizationSource,
  /return value === 'v3-experimental'[\s\S]*\? 'v3-experimental'[\s\S]*: DEFAULT_CONFIG\.settings\.agentRuntimeMode;/u,
  'normalization should accept only the experimental v3 value and otherwise fall back to the default v2 mode.',
);
assert.match(
  normalizationSource,
  /agentRuntimeMode: normalizeAgentRuntimeMode\(rawSettings\.agentRuntimeMode\)/u,
  'normalizePetConfig should normalize the persisted runtime mode setting.',
);

assert.match(
  agentSessionV2Source,
  /export async function defaultAgentSessionV2ModelCaller/u,
  'v3 UI route should reuse the v2 default model caller instead of duplicating model logic.',
);

const chatSessionCallSource = extractBetween(
  containerSource,
  'const chatSessionState = usePetChatSession({',
  '\n  });',
);
assert.match(
  chatSessionCallSource,
  /agentRuntimeMode: config\.settings\.agentRuntimeMode/u,
  'chat container should pass the configured runtime mode to the chat route.',
);
assert.match(
  chatSessionCallSource,
  /runAgentSessionV3Experimental: config\.settings\.agentRuntimeMode === 'v3-experimental'/u,
  'v3 runner should be injected only when the configured mode selects v3.',
);
assert.match(
  chatSessionCallSource,
  /runAgentSessionV3ExperimentalChatRunner\(\{/u,
  'chat container should inject the concrete v3 experimental chat runner.',
);
assert.match(
  chatSessionCallSource,
  /modelCaller: defaultAgentSessionV2ModelCaller/u,
  'v3 runner should reuse the default v2 model caller.',
);
assert.match(
  chatSessionCallSource,
  /settings: context\.preparedRequest\.currentConfig\.settings/u,
  'v3 runner should receive the current normalized settings from the prepared request.',
);
assert.match(
  chatSessionCallSource,
  /toolExecutor: context\.toolExecutor/u,
  'v3 runner should reuse the guarded chat tool executor.',
);

assert.match(settingsSource, /TEXT_AGENT_RUNTIME_TITLE/u);
assert.match(settingsSource, /value=\{localConfig\.settings\.agentRuntimeMode\}/u);
assert.match(settingsSource, /<option value="v2-default">v2 fallback<\/option>/u);
assert.match(settingsSource, /<option value="v3-experimental">v3 staged default<\/option>/u);
assert.match(
  settingsSource,
  /agentRuntimeMode: event\.target\.value as PetConfig\['settings'\]\['agentRuntimeMode'\]/u,
  'settings UI should write the typed runtime mode setting.',
);

for (const [label, source] of [
  ['chat container', containerSource],
  ['settings system tab', settingsSource],
] as const) {
  assert.doesNotMatch(
    source,
    /observe_windows_and_apps\s*->\s*locate_screen_elements|locate_screen_elements\s*->\s*execute_desktop|execute_desktop_sequence\s*->\s*observe_windows_and_apps/iu,
    `${label} must not encode a fixed desktop workflow.`,
  );
  assert.doesNotMatch(
    source,
    /implementationQueue|orderedSteps|requiredReportOrder|recoveryAction/u,
    `${label} must not define fixed tool queues, report order, or recovery actions.`,
  );
}

console.log('agent session v3 experimental ui entry smoke ok');
