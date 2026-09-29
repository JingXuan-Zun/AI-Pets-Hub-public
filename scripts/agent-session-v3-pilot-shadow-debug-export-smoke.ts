import assert from 'node:assert/strict';
import {
  createAgentSessionV3PilotShadowDebugExport,
  runAgentSessionV3PilotShadowMode,
  stringifyAgentSessionV3PilotShadowDebugExport,
  type AgentSessionV3PilotEvent,
} from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const { debugExportSource, indexSource } = readProjectSources({
  debugExportSource: 'src/agent/agentSessionV3PilotShadowDebugExport.ts',
  indexSource: 'src/agent/legacy/index.ts',
});

assert.match(
  debugExportSource,
  /export function createAgentSessionV3PilotShadowDebugExport/u,
  'v3 pilot shadow debug export helper should live in its own module.',
);
assert.match(
  debugExportSource,
  /export function createAgentSessionV3PilotShadowPhaseCoverage/u,
  'v3 pilot shadow phase coverage should stay with debug export and be derived from existing shadow output.',
);
assert.match(
  indexSource,
  /export \* from '\.\.\/agentSessionV3PilotShadowDebugExport'/u,
  'v3 pilot shadow debug export helper should be exported through the agent barrel.',
);
assert.doesNotMatch(
  debugExportSource,
  /AgentSessionV2|runAgentSessionV2|executeAgentSessionV2|buildAgentPermissionRoute|execute_desktop|observe_windows_and_apps|locate_screen_elements|toolExecutor/u,
  'v3 pilot shadow debug export should not know v2 runtime execution, permissions, concrete tools, or tool execution.',
);
assert.doesNotMatch(
  debugExportSource,
  /from 'node:fs'|writeFile|appendFile|createWriteStream|mkdir/u,
  'v3 pilot shadow debug export should not write logs directly.',
);
assert.doesNotMatch(
  debugExportSource,
  /observe_windows_and_apps\s*->\s*locate_screen_elements\s*->\s*execute_desktop_sequence/iu,
  'v3 pilot shadow debug export should not encode a fixed tool chain.',
);

const waitingForEvent = await runAgentSessionV3PilotShadowMode({
  debugSummary: {
    enabled: true,
    includeReasons: true,
  },
  enabled: true,
  events: [{
    reason: 'begin waiting sample',
    type: 'start',
  }],
});

const waitingExport = createAgentSessionV3PilotShadowDebugExport(waitingForEvent);
assert.equal(waitingExport.kind, 'agent-session-v3-pilot-shadow-debug');
assert.equal(waitingExport.version, 1);
assert.equal(waitingExport.status, 'observed');
assert.equal(waitingExport.runnerStatus, 'waiting-for-event');
assert.equal(waitingExport.phase, 'model_decision');
assert.equal(waitingExport.terminalStatus, null);
assert.equal(waitingExport.lastEvent, 'start');
assert.equal(waitingExport.consumedEventCount, 1);
assert.equal(waitingExport.eventCount, 1);
assert.equal(waitingExport.transitionCount, 1);
assert.equal(waitingExport.transitions?.length, 1);
assert.equal(waitingExport.transitions?.[0]?.accepted, true);
assert.equal(waitingExport.transitions?.[0]?.to, 'model_decision');
assert.equal(waitingExport.phaseCoverage?.status, 'partial');
assert.equal(waitingExport.phaseCoverage?.terminalObserved, false);
assert.deepEqual(waitingExport.phaseCoverage?.visitedPhases, ['init', 'model_decision']);
assert.deepEqual(waitingExport.phaseCoverage?.eventTypes, ['start']);
assert.equal(waitingExport.phaseCoverage?.acceptedTransitionCount, 1);
assert.equal(waitingExport.phaseCoverage?.rejectedTransitionCount, 0);
assert.ok(waitingExport.phaseCoverage?.unvisitedPhases.includes('execute_transaction'));
assert.match(waitingExport.reason ?? '', /No pilot event/u);
assert.match(waitingExport.debugSummaryText ?? '', /status=waiting-for-event/u);

const invalidTransition = await runAgentSessionV3PilotShadowMode({
  debugSummary: {
    enabled: true,
    includeReasons: true,
  },
  enabled: true,
  events: [{
    reason: 'invalid event first',
    route: 'execute',
    type: 'command-prepared',
  }],
});

const invalidExport = createAgentSessionV3PilotShadowDebugExport(invalidTransition);
assert.equal(invalidExport.status, 'observed');
assert.equal(invalidExport.runnerStatus, 'invalid-transition');
assert.equal(invalidExport.phase, 'init');
assert.equal(invalidExport.transitionCount, 1);
assert.equal(invalidExport.transitions?.[0]?.accepted, false);
assert.equal(invalidExport.transitions?.[0]?.eventType, 'command-prepared');
assert.equal(invalidExport.transitions?.[0]?.to, null);
assert.equal(invalidExport.phaseCoverage?.status, 'invalid');
assert.equal(invalidExport.phaseCoverage?.terminalObserved, false);
assert.deepEqual(invalidExport.phaseCoverage?.visitedPhases, ['init']);
assert.deepEqual(invalidExport.phaseCoverage?.eventTypes, ['command-prepared']);
assert.equal(invalidExport.phaseCoverage?.acceptedTransitionCount, 0);
assert.equal(invalidExport.phaseCoverage?.rejectedTransitionCount, 1);
assert.match(invalidExport.reason ?? '', /not valid/u);
assert.match(invalidExport.debugSummaryText ?? '', /rejected reason=Event command-prepared is not valid/u);

const transitionLimitEvents: AgentSessionV3PilotEvent[] = [
  {
    reason: 'begin transition limit sample',
    type: 'start',
  },
  {
    reason: 'would prepare command after the cap',
    route: 'prepare-command',
    type: 'model-decision-accepted',
  },
];

const transitionLimit = await runAgentSessionV3PilotShadowMode({
  debugSummary: {
    enabled: true,
    includeReasons: true,
  },
  enabled: true,
  events: transitionLimitEvents,
  maxTransitions: 1,
});

const transitionLimitExport = createAgentSessionV3PilotShadowDebugExport(transitionLimit);
assert.equal(transitionLimitExport.status, 'observed');
assert.equal(transitionLimitExport.runnerStatus, 'transition-limit');
assert.equal(transitionLimitExport.phase, 'model_decision');
assert.equal(transitionLimitExport.consumedEventCount, 1);
assert.equal(transitionLimitExport.eventCount, 2);
assert.equal(transitionLimitExport.transitionCount, 1);
assert.equal(transitionLimitExport.phaseCoverage?.status, 'limited');
assert.deepEqual(transitionLimitExport.phaseCoverage?.visitedPhases, ['init', 'model_decision']);
assert.deepEqual(transitionLimitExport.phaseCoverage?.eventTypes, ['start']);
assert.match(transitionLimitExport.reason ?? '', /stopped after 1 transitions/u);

const terminal = await runAgentSessionV3PilotShadowMode({
  debugSummary: {
    enabled: true,
    includeReasons: true,
  },
  enabled: true,
  events: [
    {
      reason: 'begin terminal sample',
      type: 'start',
    },
    {
      reason: 'need one transaction',
      route: 'prepare-command',
      type: 'model-decision-accepted',
    },
    {
      reason: 'prepared by v2',
      route: 'execute',
      type: 'command-prepared',
    },
    {
      ok: true,
      reason: 'transaction finished',
      type: 'transaction-finished',
    },
    {
      reason: 'terminal evidence complete',
      type: 'evaluation-completed',
    },
  ],
});

const terminalExport = createAgentSessionV3PilotShadowDebugExport(terminal);
assert.equal(terminalExport.phaseCoverage?.status, 'terminal');
assert.equal(terminalExport.phaseCoverage?.terminalObserved, true);
assert.deepEqual(terminalExport.phaseCoverage?.visitedPhases, [
  'init',
  'model_decision',
  'prepare_command',
  'execute_transaction',
  'evaluate',
  'done',
]);
assert.deepEqual(terminalExport.phaseCoverage?.eventTypes, [
  'start',
  'model-decision-accepted',
  'command-prepared',
  'transaction-finished',
  'evaluation-completed',
]);

const driverFailed = await runAgentSessionV3PilotShadowMode({
  debugSummary: {
    enabled: true,
    includeReasons: true,
  },
  driver: () => {
    throw new Error('shadow diagnostic driver failed');
  },
  enabled: true,
});

const driverFailedExport = createAgentSessionV3PilotShadowDebugExport(driverFailed);
assert.equal(driverFailedExport.status, 'omitted');
assert.equal(driverFailedExport.runnerStatus, 'driver-failed');
assert.equal(driverFailedExport.phase, 'init');
assert.equal(driverFailedExport.transitionCount, 0);
assert.deepEqual(driverFailedExport.transitions, []);
assert.equal(driverFailedExport.phaseCoverage?.status, 'invalid');
assert.deepEqual(driverFailedExport.phaseCoverage?.visitedPhases, ['init']);
assert.deepEqual(driverFailedExport.phaseCoverage?.eventTypes, []);
assert.equal(driverFailedExport.debugSummaryText, null);
assert.match(driverFailedExport.errorText ?? '', /shadow diagnostic driver failed/u);

const compactExport = createAgentSessionV3PilotShadowDebugExport(waitingForEvent, {
  includeDebugSummaryText: false,
  includePhaseCoverage: false,
  includeTransitions: false,
});
assert.equal(compactExport.debugSummaryText, undefined);
assert.equal(compactExport.phaseCoverage, undefined);
assert.equal(compactExport.transitions, undefined);

const limitedTransitionExport = createAgentSessionV3PilotShadowDebugExport(waitingForEvent, {
  maxTransitions: 0,
});
assert.equal(limitedTransitionExport.transitionCount, 1);
assert.equal(limitedTransitionExport.transitions?.length, 0);

const jsonText = stringifyAgentSessionV3PilotShadowDebugExport(invalidExport);
const parsed = JSON.parse(jsonText);
assert.equal(parsed.kind, 'agent-session-v3-pilot-shadow-debug');
assert.equal(parsed.runnerStatus, 'invalid-transition');
assert.equal(parsed.transitions[0].accepted, false);
assert.doesNotMatch(jsonText, /\n/u);

const prettyJson = stringifyAgentSessionV3PilotShadowDebugExport(invalidExport, {
  pretty: true,
});
assert.deepEqual(JSON.parse(prettyJson), invalidExport);
assert.match(prettyJson, /\n/u);

console.log('agent session v3 pilot shadow debug export smoke ok');
