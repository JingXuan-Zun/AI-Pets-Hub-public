import assert from 'node:assert/strict';
import {
  resolveAgentSessionV3ExperimentalRoute,
  runAgentSessionV3ExperimentalFeatureFlagRoute,
} from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const {
  constantsSource,
  normalizationSource,
  containerSource,
  controllerSource,
  messageSenderSource,
  routeSource,
  chatRunnerSource,
  v2AdapterSource,
} = readProjectSources({
  constantsSource: 'src/constants.ts',
  normalizationSource: 'src/petConfigNormalization.ts',
  containerSource: 'src/components/pet/usePetContainerPanelChatState.ts',
  controllerSource: 'src/components/chat/agentRunController.ts',
  messageSenderSource: 'src/components/chat/usePetChatMessageSender.ts',
  routeSource: 'src/agent/agentSessionV3ExperimentalFeatureFlag.ts',
  chatRunnerSource: 'src/agent/agentSessionV3ExperimentalChatRunner.ts',
  v2AdapterSource: 'src/agent/agentSessionV3ExperimentalV2Adapters.ts',
});

assert.match(
  constantsSource,
  /agentRuntimeMode: 'v3-experimental'/u,
  'persisted default config should stage v3 as the normal configured route.',
);
assert.match(
  normalizationSource,
  /return value === 'v3-experimental'[\s\S]*\? 'v3-experimental'[\s\S]*: DEFAULT_CONFIG\.settings\.agentRuntimeMode;/u,
  'normalization should accept the staged v3 value and otherwise use the configured default.',
);
assert.doesNotMatch(
  normalizationSource,
  /value === 'v3-default'|return 'v3-default'/u,
  'normalization should not introduce a separate implicit v3 default mode.',
);
assert.match(
  containerSource,
  /runAgentSessionV3Experimental: config\.settings\.agentRuntimeMode === 'v3-experimental'[\s\S]*\? \(context\) => runAgentSessionV3ExperimentalChatRunner/u,
  'the UI container should inject the v3 runner only when the experimental setting is selected.',
);
assert.match(
  controllerSource,
  /mode: agentRuntimeMode \?\? preparedRequest\.currentConfig\.settings\.agentRuntimeMode \?\? 'v2-default'/u,
  'normal agent runs should use the configured runtime mode before falling back to v2.',
);
assert.match(
  controllerSource,
  /v3ExperimentalAvailable: Boolean\(runAgentSessionV3Experimental\)/u,
  'the controller should treat v3 as available only when the injected runner exists.',
);
assert.match(
  messageSenderSource,
  /agentRuntimeMode\?: AgentSessionV3ExperimentalFeatureFlagMode \| null/u,
  'chat send and approval continuation should carry the runtime mode explicitly.',
);

const defaultDecision = resolveAgentSessionV3ExperimentalRoute({
  v3ExperimentalAvailable: true,
});
assert.equal(defaultDecision.route, 'v2-default');
assert.equal(defaultDecision.v3ExperimentalRequested, false);

const explicitAvailableDecision = resolveAgentSessionV3ExperimentalRoute({
  mode: 'v3-experimental',
  v3ExperimentalAvailable: true,
});
assert.equal(explicitAvailableDecision.route, 'v3-experimental');
assert.equal(explicitAvailableDecision.v3ExperimentalRequested, true);

const explicitUnavailableDecision = resolveAgentSessionV3ExperimentalRoute({
  mode: 'v3-experimental',
  v3ExperimentalAvailable: false,
});
assert.equal(explicitUnavailableDecision.route, 'v2-fallback');
assert.equal(explicitUnavailableDecision.fallbackToV2, true);

let v2RunCount = 0;
let v3RunCount = 0;
const defaultRoute = await runAgentSessionV3ExperimentalFeatureFlagRoute({
  runV2: async () => {
    v2RunCount += 1;
    return { runtime: 'v2-default' as const };
  },
  runV3Experimental: async () => {
    v3RunCount += 1;
    return { runtime: 'v3-experimental' as const };
  },
  v3ExperimentalAvailable: true,
});
assert.equal(defaultRoute.decision.route, 'v2-default');
assert.deepEqual(defaultRoute.result, { runtime: 'v2-default' });
assert.equal(v2RunCount, 1);
assert.equal(v3RunCount, 0);

const explicitRoute = await runAgentSessionV3ExperimentalFeatureFlagRoute({
  mode: 'v3-experimental',
  runV2: async () => {
    v2RunCount += 1;
    return { runtime: 'v2-fallback' as const };
  },
  runV3Experimental: async () => {
    v3RunCount += 1;
    return { runtime: 'v3-experimental' as const };
  },
  v3ExperimentalAvailable: true,
});
assert.equal(explicitRoute.decision.route, 'v3-experimental');
assert.deepEqual(explicitRoute.result, { runtime: 'v3-experimental' });
assert.equal(v2RunCount, 1);
assert.equal(v3RunCount, 1);

const fallbackRoute = await runAgentSessionV3ExperimentalFeatureFlagRoute({
  mode: 'v3-experimental',
  runV2: async () => {
    v2RunCount += 1;
    return { runtime: 'v2-fallback' as const };
  },
  runV3Experimental: null,
  v3ExperimentalAvailable: true,
  v3UnavailableReason: 'v3 runner not injected',
});
assert.equal(fallbackRoute.decision.route, 'v2-fallback');
assert.deepEqual(fallbackRoute.result, { runtime: 'v2-fallback' });
assert.equal(v2RunCount, 2);
assert.equal(v3RunCount, 1);

const configuredDefaultRoute = await runAgentSessionV3ExperimentalFeatureFlagRoute({
  mode: 'v3-experimental',
  runV2: async () => {
    v2RunCount += 1;
    return { runtime: 'v2-fallback' as const };
  },
  runV3Experimental: async () => {
    v3RunCount += 1;
    return { runtime: 'configured-v3-default' as const };
  },
  v3ExperimentalAvailable: true,
});
assert.equal(configuredDefaultRoute.decision.route, 'v3-experimental');
assert.deepEqual(configuredDefaultRoute.result, { runtime: 'configured-v3-default' });
assert.equal(v2RunCount, 2);
assert.equal(v3RunCount, 2);

for (const [label, source] of [
  ['feature flag route', routeSource],
  ['chat runner', chatRunnerSource],
  ['v2 adapter', v2AdapterSource],
  ['chat container', containerSource],
  ['agent run controller', controllerSource],
] as const) {
  assert.doesNotMatch(
    source,
    /observe_windows_and_apps\s*->\s*locate_screen_elements|locate_screen_elements\s*->\s*execute_desktop|execute_desktop_sequence\s*->\s*observe_windows_and_apps/iu,
    `${label} must not encode a fixed desktop workflow during the v3 handoff guard.`,
  );
  assert.doesNotMatch(
    source,
    /implementationQueue|orderedSteps|requiredReportOrder|recoveryAction/u,
    `${label} must not define fixed queues, report order, or recovery actions during the v3 handoff guard.`,
  );
}

assert.doesNotMatch(
  routeSource,
  /runAgentSessionV2\(|runAgentSessionV3ExperimentalSession\(/u,
  'the feature flag route should choose injected runners instead of owning v2 or v3 execution.',
);

console.log('agent session v3 default handoff guard smoke ok');
