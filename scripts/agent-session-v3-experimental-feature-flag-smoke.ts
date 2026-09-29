import assert from 'node:assert/strict';
import {
  isAgentSessionV3ExperimentalFallbackableResult,
  resolveAgentSessionV3ExperimentalRoute,
  runAgentSessionV3ExperimentalFeatureFlagRoute,
} from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const { routeSource, indexSource, v3AdapterSource } = readProjectSources({
  routeSource: 'src/agent/agentSessionV3ExperimentalFeatureFlag.ts',
  indexSource: 'src/agent/legacy/index.ts',
  v3AdapterSource: 'src/agent/agentSessionV3ExperimentalV2Adapters.ts',
});

assert.match(routeSource, /export function resolveAgentSessionV3ExperimentalRoute/u);
assert.match(routeSource, /export function isAgentSessionV3ExperimentalFallbackableResult/u);
assert.match(routeSource, /export async function runAgentSessionV3ExperimentalFeatureFlagRoute/u);
assert.match(routeSource, /Experimental v3 runtime could not safely prepare the next command, so v2 fallback ran automatically/u);
assert.match(indexSource, /export \* from '\.\.\/agentSessionV3ExperimentalFeatureFlag';/u);

const defaultDecision = resolveAgentSessionV3ExperimentalRoute();
assert.equal(defaultDecision.route, 'v2-default');
assert.equal(defaultDecision.v3ExperimentalRequested, false);
assert.match(defaultDecision.reason, /AgentSessionV2 remains the default runtime path/u);

const explicitUnavailableFallback = resolveAgentSessionV3ExperimentalRoute({
  mode: 'v3-experimental',
  v3ExperimentalAvailable: false,
  v3UnavailableReason: 'v3 adapter missing',
});
assert.equal(explicitUnavailableFallback.route, 'v2-fallback');
assert.equal(explicitUnavailableFallback.v3ExperimentalRequested, true);
assert.equal(explicitUnavailableFallback.reason, 'v3 adapter missing');

const explicitUnavailableNoFallback = resolveAgentSessionV3ExperimentalRoute({
  fallbackToV2: false,
  mode: 'v3-experimental',
  v3ExperimentalAvailable: false,
});
assert.equal(explicitUnavailableNoFallback.route, 'unavailable');
assert.equal(explicitUnavailableNoFallback.fallbackToV2, false);

const explicitAvailable = resolveAgentSessionV3ExperimentalRoute({
  mode: 'v3-experimental',
  v3ExperimentalAvailable: true,
});
assert.equal(explicitAvailable.route, 'v3-experimental');
assert.equal(explicitAvailable.v3ExperimentalRequested, true);

let v2RunCount = 0;
let v3RunCount = 0;
const defaultRouteResult = await runAgentSessionV3ExperimentalFeatureFlagRoute({
  runV2: async () => {
    v2RunCount += 1;
    return { runtime: 'v2' as const };
  },
  runV3Experimental: async () => {
    v3RunCount += 1;
    return { runtime: 'v3' as const };
  },
  v3ExperimentalAvailable: true,
});
assert.equal(defaultRouteResult.decision.route, 'v2-default');
assert.deepEqual(defaultRouteResult.result, { runtime: 'v2' });
assert.equal(v2RunCount, 1);
assert.equal(v3RunCount, 0);

const v3RouteResult = await runAgentSessionV3ExperimentalFeatureFlagRoute({
  mode: 'v3-experimental',
  runV2: async () => {
    v2RunCount += 1;
    return { runtime: 'v2' as const };
  },
  runV3Experimental: async () => {
    v3RunCount += 1;
    return { runtime: 'v3' as const };
  },
  v3ExperimentalAvailable: true,
});
assert.equal(v3RouteResult.decision.route, 'v3-experimental');
assert.deepEqual(v3RouteResult.result, { runtime: 'v3' });
assert.equal(v2RunCount, 1);
assert.equal(v3RunCount, 1);

const fallbackableV3Result = {
  finalAnswer: 'Agent v3 runtime could not safely prepare that command.',
  runtime: {
    state: {
      lastEvent: 'command-unavailable',
      phase: 'recover',
    },
  },
  status: 'failed',
} as any;
assert.equal(isAgentSessionV3ExperimentalFallbackableResult(fallbackableV3Result), true);

const waitingRecoverV3Result = {
  finalAnswer: 'Agent v3 runtime could not safely prepare that command.',
  runtime: {
    state: {
      lastEvent: 'recovery-model-requested',
      phase: 'recover',
    },
  },
  status: 'waiting',
} as any;
assert.equal(isAgentSessionV3ExperimentalFallbackableResult(waitingRecoverV3Result), true);

const chatRunnerNeedsUserFallbackResult = {
  finalAnswer: [
    'Agent v3 runtime could not safely prepare that command.',
    'Evaluation did not produce a terminal result.',
    'Switch back to v2 fallback or adjust the request so the staged runtime can continue.',
  ].join('\n'),
  status: 'needs-user',
} as any;
assert.equal(isAgentSessionV3ExperimentalFallbackableResult(chatRunnerNeedsUserFallbackResult), true);

const chatRunnerUnverifiedLaunchFallbackResult = {
  finalAnswer: [
    'Launch status: launched-unverified',
    'Launch request sent, but no focusable window was verified: no-window-match.',
    'Approved tool result is unverified; recovery should continue before completion.',
  ].join('\n'),
  status: 'needs-user',
} as any;
assert.equal(isAgentSessionV3ExperimentalFallbackableResult(chatRunnerUnverifiedLaunchFallbackResult), true);

const v3UnavailableAfterRunResult = await runAgentSessionV3ExperimentalFeatureFlagRoute({
  mode: 'v3-experimental',
  runV2: async () => {
    v2RunCount += 1;
    return { runtime: 'v2-after-v3-unavailable' as const };
  },
  runV3Experimental: async () => {
    v3RunCount += 1;
    return fallbackableV3Result;
  },
  v3ExperimentalAvailable: true,
});
assert.equal(v3UnavailableAfterRunResult.decision.route, 'v2-fallback');
assert.match(v3UnavailableAfterRunResult.decision.reason, /v2 fallback ran automatically/u);
assert.deepEqual(v3UnavailableAfterRunResult.result, { runtime: 'v2-after-v3-unavailable' });
assert.equal(v3UnavailableAfterRunResult.v3Result, null);
assert.equal(v2RunCount, 2);
assert.equal(v3RunCount, 2);

const v3WaitingRecoverRouteResult = await runAgentSessionV3ExperimentalFeatureFlagRoute({
  mode: 'v3-experimental',
  runV2: async () => {
    v2RunCount += 1;
    return { runtime: 'v2-after-v3-waiting-recover' as const };
  },
  runV3Experimental: async () => {
    v3RunCount += 1;
    return waitingRecoverV3Result;
  },
  v3ExperimentalAvailable: true,
});
assert.equal(v3WaitingRecoverRouteResult.decision.route, 'v2-fallback');
assert.deepEqual(v3WaitingRecoverRouteResult.result, { runtime: 'v2-after-v3-waiting-recover' });
assert.equal(v2RunCount, 3);
assert.equal(v3RunCount, 3);

const chatRunnerNeedsUserRouteResult = await runAgentSessionV3ExperimentalFeatureFlagRoute({
  mode: 'v3-experimental',
  runV2: async () => {
    v2RunCount += 1;
    return { runtime: 'v2-after-chat-runner-needs-user' as const };
  },
  runV3Experimental: async () => {
    v3RunCount += 1;
    return chatRunnerNeedsUserFallbackResult;
  },
  v3ExperimentalAvailable: true,
});
assert.equal(chatRunnerNeedsUserRouteResult.decision.route, 'v2-fallback');
assert.deepEqual(chatRunnerNeedsUserRouteResult.result, { runtime: 'v2-after-chat-runner-needs-user' });
assert.equal(v2RunCount, 4);
assert.equal(v3RunCount, 4);

const chatRunnerUnverifiedLaunchRouteResult = await runAgentSessionV3ExperimentalFeatureFlagRoute({
  mode: 'v3-experimental',
  runV2: async () => {
    v2RunCount += 1;
    return { runtime: 'v2-after-unverified-launch' as const };
  },
  runV3Experimental: async () => {
    v3RunCount += 1;
    return chatRunnerUnverifiedLaunchFallbackResult;
  },
  v3ExperimentalAvailable: true,
});
assert.equal(chatRunnerUnverifiedLaunchRouteResult.decision.route, 'v2-fallback');
assert.deepEqual(chatRunnerUnverifiedLaunchRouteResult.result, { runtime: 'v2-after-unverified-launch' });
assert.equal(v2RunCount, 5);
assert.equal(v3RunCount, 5);

const fallbackRouteResult = await runAgentSessionV3ExperimentalFeatureFlagRoute({
  mode: 'v3-experimental',
  runV2: async () => {
    v2RunCount += 1;
    return { runtime: 'v2-fallback' as const };
  },
  runV3Experimental: null,
  v3ExperimentalAvailable: true,
  v3UnavailableReason: 'v3 runner not injected',
});
assert.equal(fallbackRouteResult.decision.route, 'v2-fallback');
assert.deepEqual(fallbackRouteResult.result, { runtime: 'v2-fallback' });
assert.equal(v2RunCount, 6);
assert.equal(v3RunCount, 5);

const unavailableRouteResult = await runAgentSessionV3ExperimentalFeatureFlagRoute({
  fallbackToV2: false,
  mode: 'v3-experimental',
  runV2: async () => {
    throw new Error('v2 fallback is disabled for this smoke');
  },
  runV3Experimental: null,
  v3ExperimentalAvailable: false,
});
assert.equal(unavailableRouteResult.decision.route, 'unavailable');
assert.equal(unavailableRouteResult.result, null);
assert.equal(unavailableRouteResult.v2Result, null);
assert.equal(unavailableRouteResult.v3Result, null);

for (const [label, source] of [
  ['feature flag route', routeSource],
  ['v3 adapter wiring', v3AdapterSource],
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

assert.doesNotMatch(
  routeSource,
  /runAgentSessionV2\(|runAgentSessionV3ExperimentalSession\(/u,
  'feature flag route should choose injected runners, not directly own runtime execution.',
);

console.log('agent session v3 experimental feature flag smoke ok');
