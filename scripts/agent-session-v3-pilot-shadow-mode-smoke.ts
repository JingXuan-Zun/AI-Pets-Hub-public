import assert from 'node:assert/strict';
import {
  runAgentSessionV3PilotShadowMode,
  type AgentSessionV3PilotEvent,
} from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const { shadowSource, indexSource } = readProjectSources({
  shadowSource: 'src/agent/agentSessionV3PilotShadowMode.ts',
  indexSource: 'src/agent/legacy/index.ts',
});

assert.match(
  shadowSource,
  /export async function runAgentSessionV3PilotShadowMode/u,
  'v3 pilot shadow mode should live in its own module.',
);
assert.match(
  indexSource,
  /export \* from '\.\.\/agentSessionV3PilotShadowMode'/u,
  'v3 pilot shadow mode should be exported through the agent barrel.',
);
assert.doesNotMatch(
  shadowSource,
  /AgentSessionV2|runAgentSessionV2|executeAgentSessionV2|buildAgentPermissionRoute|execute_desktop|observe_windows_and_apps|locate_screen_elements/u,
  'v3 pilot shadow mode should not call production v2 modules, permission routing, execution internals, or concrete desktop tools.',
);
assert.doesNotMatch(
  shadowSource,
  /observe_windows_and_apps\s*->\s*locate_screen_elements\s*->\s*execute_desktop_sequence/iu,
  'v3 pilot shadow mode should not encode a fixed tool chain.',
);

const completedEvents: AgentSessionV3PilotEvent[] = [
  {
    reason: 'begin shadow replay',
    type: 'start',
  },
  {
    reason: 'Need existing v2 evidence before answering.',
    route: 'prepare-command',
    type: 'model-decision-accepted',
  },
  {
    reason: 'Prepared command was already produced by v2.',
    route: 'execute',
    type: 'command-prepared',
  },
  {
    ok: true,
    reason: 'v2 transaction already finished.',
    type: 'transaction-finished',
  },
  {
    reason: 'v2 terminal evaluation completed the task.',
    type: 'evaluation-completed',
  },
];

const disabled = await runAgentSessionV3PilotShadowMode({
  enabled: false,
  events: completedEvents,
});
assert.equal(disabled.status, 'disabled');
assert.equal(disabled.result, null);
assert.equal(disabled.debugSummaryText, null);
assert.equal(disabled.consumedEventCount, 0);

const observed = await runAgentSessionV3PilotShadowMode({
  debugSummary: {
    enabled: true,
    includeReasons: true,
  },
  enabled: true,
  events: completedEvents,
});
assert.equal(observed.status, 'observed');
assert.equal(observed.result?.status, 'terminal');
assert.equal(observed.result.state.phase, 'done');
assert.equal(observed.result.state.terminal?.status, 'completed');
assert.equal(observed.eventCount, completedEvents.length);
assert.equal(observed.consumedEventCount, completedEvents.length);
assert.match(
  observed.debugSummaryText ?? '',
  /^AgentSessionV3Pilot status=terminal phase=done terminal=completed recoveries=0 transitions=5/mu,
);
assert.match(
  observed.debugSummaryText ?? '',
  /2\. model_decision --model-decision-accepted--> prepare_command reason=Need existing v2 evidence before answering\./u,
);

const summaryDisabled = await runAgentSessionV3PilotShadowMode({
  debugSummary: {
    enabled: false,
    includeReasons: true,
  },
  enabled: true,
  events: completedEvents,
});
assert.equal(summaryDisabled.status, 'observed');
assert.equal(summaryDisabled.result?.status, 'terminal');
assert.equal(summaryDisabled.debugSummaryText, null);

const invalidTransition = await runAgentSessionV3PilotShadowMode({
  debugSummary: {
    enabled: true,
    includeReasons: true,
  },
  enabled: true,
  events: [{
    reason: 'invalid shadow replay event',
    route: 'execute',
    type: 'command-prepared',
  }],
});
assert.equal(invalidTransition.status, 'observed');
assert.equal(invalidTransition.result?.status, 'invalid-transition');
assert.match(
  invalidTransition.debugSummaryText ?? '',
  /1\. init --command-prepared--> rejected reason=Event command-prepared is not valid/u,
);

const driverFailed = await runAgentSessionV3PilotShadowMode({
  debugSummary: {
    enabled: true,
    includeReasons: true,
  },
  driver: () => {
    throw new Error('shadow translation failed');
  },
  enabled: true,
});
assert.equal(driverFailed.status, 'omitted');
assert.equal(driverFailed.result?.status, 'driver-failed');
assert.equal(driverFailed.debugSummaryText, null);
assert.match(driverFailed.errorText ?? '', /shadow translation failed/u);

const missingSource = await runAgentSessionV3PilotShadowMode({
  enabled: true,
});
assert.equal(missingSource.status, 'omitted');
assert.equal(missingSource.result, null);
assert.match(missingSource.reason ?? '', /No v3 pilot shadow event source/u);

console.log('agent session v3 pilot shadow mode smoke ok');
