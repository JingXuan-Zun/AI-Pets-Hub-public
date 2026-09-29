import assert from 'node:assert/strict';
import {
  compactAgentTraceDetails,
  createAgentToolFinishedTraceDetails,
  createAgentTraceRecorder,
  resolveAgentTraceEventSequence,
  type AgentChatCommand,
  type AgentChatCommandResult,
  type AgentSessionV2TraceEvent,
} from '../src/agent/legacy/index.ts';
import {
  assertSourceDoesNotMatch,
  assertSourceMatches,
  readProjectSources,
} from './smokeTestHarness.ts';

const {
  index: indexSource,
  runtimeTraceEvents: runtimeTraceEventsSource,
  session: sessionSource,
  traceEvents: traceEventsSource,
} = readProjectSources({
  index: 'src/agent/legacy/index.ts',
  runtimeTraceEvents: 'src/agent/runtime/agentTraceEvents.ts',
  session: 'src/agent/agentProductionSessionImplementation.ts',
  traceEvents: 'src/agent/runtime/agentTraceEvents.ts',
});

assertSourceMatches(
  runtimeTraceEventsSource,
  /export function createAgentTraceRecorder/u,
  'Trace Events Runtime should own trace recorder creation.',
);
assertSourceMatches(
  runtimeTraceEventsSource,
  /export function compactAgentTraceDetails/u,
  'Trace Events Runtime should own trace detail compaction.',
);
assertSourceMatches(
  runtimeTraceEventsSource,
  /export function compactAgentTraceEvents/u,
  'Trace Events Runtime should own trace retention compaction.',
);
assertSourceMatches(
  runtimeTraceEventsSource,
  /createAgentToolFinishedTraceDetails/u,
  'Trace Events Runtime should own tool-finished trace details.',
);
assertSourceDoesNotMatch(
  sessionSource,
  /function compactAgentSessionV2TraceDetails/u,
  'AgentSessionV2 should not own trace detail compaction implementation.',
);
assertSourceDoesNotMatch(
  sessionSource,
  /function compactAgentSessionV2TraceEvents/u,
  'AgentSessionV2 should not own trace retention implementation.',
);
assertSourceMatches(
  sessionSource,
  /const traceRecorder = createAgentTraceRecorder\(traceEvents\)/u,
  'AgentSessionV2 should use Trace Events Runtime directly.',
);
assertSourceMatches(
  sessionSource,
  /const appendTraceEvent = traceRecorder\.append/u,
  'AgentSessionV2 should append trace events through the recorder.',
);

const compactDetails = compactAgentTraceDetails({
  empty: '',
  missing: null,
  ok: true,
  verbose: 'x'.repeat(500),
});
assert.equal(compactDetails?.ok, true);
assert.equal('empty' in (compactDetails ?? {}), false);
assert.equal('missing' in (compactDetails ?? {}), false);
assert.equal(String(compactDetails?.verbose).length, 360);

const traceEvents: AgentSessionV2TraceEvent[] = [{
  action: null,
  id: 'trace-3',
  status: 'success',
  stepIndex: 1,
  summary: 'existing event',
  timestamp: Date.now(),
  tool: 'observe_windows_and_apps',
  type: 'tool_finished',
}];
assert.equal(resolveAgentTraceEventSequence(traceEvents), 3);

const recorder = createAgentTraceRecorder(traceEvents);
const appended = recorder.append({
  details: {
    responseText: 'Observed window',
    skipped: '',
  },
  status: 'success',
  stepIndex: 2,
  summary: 'A'.repeat(700),
  tool: 'observe_windows_and_apps',
  type: 'tool_finished',
});
assert.equal(appended.id, 'trace-4');
assert.equal(appended.details?.responseText, 'Observed window');
assert.equal('skipped' in (appended.details ?? {}), false);
assert.equal(appended.summary.length, 520);

for (let index = 0; index < 100; index += 1) {
  recorder.append({
    status: index % 2 === 0 ? 'success' : 'failed',
    stepIndex: index + 3,
    summary: `retention event ${index}`,
    tool: index % 2 === 0 ? 'observe_windows_and_apps' : 'execute_desktop_observation',
    type: index % 3 === 0 ? 'model_output' : 'tool_finished',
  });
}
assert.ok(traceEvents.length <= 80, `traceEvents should be compacted, got ${traceEvents.length}`);
assert.equal(traceEvents[0]?.type, 'trace_compacted');
assert.match(String(traceEvents[0]?.details?.typeCounts ?? ''), /tool_finished/u);
assert.match(String(traceEvents[0]?.details?.toolCounts ?? ''), /observe_windows_and_apps/u);

const command: AgentChatCommand = {
  capabilityId: 'desktop-control',
  instruction: 'trace event smoke',
  kind: 'tool-call',
  sourceText: '/agent trace event smoke',
  toolCall: {
    goal: 'trace event smoke',
    input: {
      action: 'click',
      x: 10,
      y: 20,
    },
    name: 'execute_desktop_input',
  },
};
const result: AgentChatCommandResult = {
  ok: true,
  responseText: 'Clicked target',
  stateSummary: {
    actionEvidence: {
      action: 'click',
      confidence: 0.88,
      diff: {
        changed: true,
        signals: ['target changed'],
        summary: 'Target changed.',
      },
      outcome: 'changed',
      targetRef: {
        confidence: 'high',
        kind: 'pixel',
        label: 'target',
      },
      timestamp: Date.now(),
      tool: 'execute_desktop_input',
    },
    structuredEvidence: {
      launcherVerification: {
        reason: 'Visual target is visible, but no primary action was identified.',
        status: 'needs-primary-action',
        targetVisible: true,
      },
      targetMatched: 'target',
      visualActionReadiness: 'needs-primary-action',
    },
  },
  verification: 'Target clicked',
};
const toolFinishedDetails = createAgentToolFinishedTraceDetails(command, result, {
  durationMs: 12,
  endedAt: Date.now(),
  id: 'timing-1',
  kind: 'tool',
  label: 'execute_desktop_input',
  startedAt: Date.now() - 12,
  status: 'success',
  stepIndex: 1,
});
assert.equal(toolFinishedDetails.actionOutcome, 'changed');
assert.equal(toolFinishedDetails.actionTarget, 'target');
assert.equal(toolFinishedDetails.durationMs, 12);
assert.equal(toolFinishedDetails.visualActionReadiness, 'needs-primary-action');
assert.equal(toolFinishedDetails.visualActionBlocker, 'primary-open-start-play-action-not-identified');
assert.match(String(toolFinishedDetails.launcherReason), /no primary action/u);

console.log('agent session v2 trace events smoke ok');
