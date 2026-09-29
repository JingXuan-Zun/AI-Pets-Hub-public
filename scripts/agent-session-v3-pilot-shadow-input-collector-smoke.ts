import assert from 'node:assert/strict';
import {
  createAgentSessionV3PilotShadowInputCollector,
  runAgentSessionV3PilotShadowMode,
  type AgentChatCommand,
  type AgentModelDecisionTurnOutcome,
  type AgentPostActionTerminalEvaluation,
  type AgentToolTransactionResult,
} from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const { collectorSource, indexSource } = readProjectSources({
  collectorSource: 'src/agent/agentSessionV3PilotShadowInputCollector.ts',
  indexSource: 'src/agent/legacy/index.ts',
});

assert.match(
  collectorSource,
  /export function createAgentSessionV3PilotShadowInputCollector/u,
  'v3 pilot shadow input collector should live in its own module.',
);
assert.match(
  indexSource,
  /export \* from '\.\.\/agentSessionV3PilotShadowInputCollector'/u,
  'v3 pilot shadow input collector should be exported through the agent barrel.',
);
assert.doesNotMatch(
  collectorSource,
  /runAgentSessionV2|executeAgentSessionV2|buildAgentPermissionRoute|execute_desktop|observe_windows_and_apps|locate_screen_elements/u,
  'Shadow input collector should not call production v2 runners, permission routing, execution internals, or concrete desktop tools.',
);
assert.doesNotMatch(
  collectorSource,
  /observe_windows_and_apps\s*->\s*locate_screen_elements\s*->\s*execute_desktop_sequence/iu,
  'Shadow input collector should not encode a fixed tool chain.',
);

let clock = 1000;
const collector = createAgentSessionV3PilotShadowInputCollector({
  now: () => clock += 10,
});

const timing = {
  id: 'timing-1',
  kind: 'model' as const,
  label: 'decision',
  startedAt: 100,
  status: 'success' as const,
  stepIndex: 1,
};

const command: AgentChatCommand = {
  instruction: 'shadow collector command',
  kind: 'tool-call',
  sourceText: '/agent shadow collector',
  toolCall: {
    input: {
      capability: 'read-state',
    },
    name: 'generic_runtime_tool',
  },
};

const modelDecision: AgentModelDecisionTurnOutcome = {
  decision: {
    action: 'tool_call',
    reason: 'Need v2 evidence before answering.',
    tool: 'generic_runtime_tool',
  },
  modelResponse: '{}',
  step: {
    action: 'tool_call',
    index: 1,
    summary: 'tool call',
  },
  timing,
  traceEvents: [],
  type: 'accepted',
};

const transaction: AgentToolTransactionResult = {
  command,
  result: {
    ok: true,
    responseText: 'Runtime evidence observed.',
    verification: 'Evidence indicates the requested state is satisfied.',
  },
  timing: {
    ...timing,
    kind: 'tool',
    label: 'generic_runtime_tool',
  },
};

const terminalEvaluation: AgentPostActionTerminalEvaluation = {
  finalAnswer: 'The task is complete.',
  kind: 'launched',
  postActionState: 'launched',
  status: 'completed',
  stepAction: 'final_answer',
  stepReason: 'Post-action evidence satisfies the request.',
};

collector.appendStart('begin real outcome shadow sample');
collector.appendModelDecisionTurn(modelDecision, { label: 'model' });
collector.appendPreparedCommand({
  label: 'prepared',
  reason: 'v2 command was prepared before sampling.',
  route: 'execute',
});
collector.appendToolExecutionTransaction(transaction, { label: 'transaction' });
collector.appendPostActionTerminalEvaluation(terminalEvaluation, { label: 'terminal-evaluation' });

const snapshot = collector.snapshot();
assert.deepEqual(snapshot.entries.map((entry) => entry.kind), [
  'start',
  'model-decision-turn',
  'prepared-command',
  'tool-transaction',
  'post-action-terminal',
]);
assert.deepEqual(snapshot.events.map((event) => event.type), [
  'start',
  'model-decision-accepted',
  'command-prepared',
  'transaction-finished',
  'evaluation-completed',
]);
assert.deepEqual(snapshot.entries.map((entry) => entry.timestamp), [
  1010,
  1020,
  1030,
  1040,
  1050,
]);
assert.equal(snapshot.entries[1]?.label, 'model');

const shadow = await runAgentSessionV3PilotShadowMode({
  debugSummary: {
    enabled: true,
    includeReasons: true,
  },
  enabled: true,
  events: collector.getEvents(),
});
assert.equal(shadow.status, 'observed');
assert.equal(shadow.result?.status, 'terminal');
assert.equal(shadow.result.state.terminal?.status, 'completed');
assert.match(
  shadow.debugSummaryText ?? '',
  /AgentSessionV3Pilot status=terminal phase=done terminal=completed recoveries=0 transitions=5/u,
);

const nullTerminalEvent = collector.appendPostActionTerminalEvaluation(null);
assert.equal(nullTerminalEvent, null);
assert.equal(collector.getEvents().length, 5);

collector.clear();
assert.equal(collector.getEntries().length, 0);
assert.equal(collector.getEvents().length, 0);

collector.appendStart('begin approval sample');
collector.appendEvent({
  reason: 'Need approval path.',
  route: 'prepare-command',
  type: 'model-decision-accepted',
}, {
  kind: 'raw-event',
  label: 'synthetic-model-decision',
});
collector.appendPreparedCommand({
  preparationSource: 'normal',
  reason: 'Prepared approval command.',
  route: 'approval',
});
collector.appendApprovalDecision({
  approved: false,
  reason: 'User declined the sampled action.',
});

const approvalShadow = await runAgentSessionV3PilotShadowMode({
  enabled: true,
  events: collector.getEvents(),
});
assert.equal(approvalShadow.status, 'observed');
assert.equal(approvalShadow.result?.status, 'terminal');
assert.equal(approvalShadow.result.state.terminal?.status, 'needs-user');

console.log('agent session v3 pilot shadow input collector smoke ok');
