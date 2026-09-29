import assert from 'node:assert/strict';
import {
  advanceAgentSessionV3PilotState,
  createAgentSessionV3PilotInitialState,
  createAgentSessionV3PilotTraceSummaryLines,
  createAgentSessionV3PilotTraceSummaryText,
  formatAgentSessionV3PilotTransitionLine,
  type AgentSessionV3PilotRunnerResult,
} from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const { summarySource, indexSource } = readProjectSources({
  summarySource: 'src/agent/agentSessionV3PilotTraceSummary.ts',
  indexSource: 'src/agent/legacy/index.ts',
});

assert.match(
  summarySource,
  /export function createAgentSessionV3PilotTraceSummaryText/u,
  'v3 pilot trace summary should live in its own module.',
);
assert.match(
  indexSource,
  /export \* from '\.\.\/agentSessionV3PilotTraceSummary'/u,
  'v3 pilot trace summary should be exported through the agent barrel.',
);
assert.doesNotMatch(
  summarySource,
  /advanceAgentSessionV3PilotState|runAgentSessionV3PilotRunner|runAgentSessionV2|execute_desktop|observe_windows_and_apps|locate_screen_elements/u,
  'v3 pilot trace summary should be pure formatting and should not advance state, run the pilot, call v2 modules, or encode concrete tools.',
);

let state = createAgentSessionV3PilotInitialState();
const start = advanceAgentSessionV3PilotState(state, {
  reason: 'begin pilot replay',
  type: 'start',
});
assert.equal(start.accepted, true);
state = start.state;

const accepted = advanceAgentSessionV3PilotState(state, {
  reason: 'Need evidence before answering.',
  route: 'prepare-command',
  type: 'model-decision-accepted',
});
assert.equal(accepted.accepted, true);
state = accepted.state;

const prepared = advanceAgentSessionV3PilotState(state, {
  route: 'execute',
  type: 'command-prepared',
});
assert.equal(prepared.accepted, true);
state = prepared.state;

const finished = advanceAgentSessionV3PilotState(state, {
  ok: true,
  reason: 'A very long reason that should be compacted before it is written into the summary output because logs should stay readable and stable across routine runs.',
  type: 'transaction-finished',
});
assert.equal(finished.accepted, true);
state = finished.state;

const completed = advanceAgentSessionV3PilotState(state, {
  reason: 'Evidence completed the task.',
  type: 'evaluation-completed',
});
assert.equal(completed.accepted, true);
state = completed.state;

const result: AgentSessionV3PilotRunnerResult = {
  reason: 'Evidence completed the task.',
  state,
  status: 'terminal',
  transition: completed,
  transitions: [
    start,
    accepted,
    prepared,
    finished,
    completed,
  ],
};

assert.equal(
  formatAgentSessionV3PilotTransitionLine(start, 0),
  '1. init --start--> model_decision',
);
assert.equal(
  formatAgentSessionV3PilotTransitionLine(accepted, 1, { includeReasons: true }),
  '2. model_decision --model-decision-accepted--> prepare_command reason=Need evidence before answering.',
);
assert.equal(
  formatAgentSessionV3PilotTransitionLine(finished, 3, {
    includeReasons: true,
    maxReasonLength: 44,
  }),
  '4. execute_transaction --transaction-finished--> evaluate reason=A very long reason that should be compacted...',
);

const lines = createAgentSessionV3PilotTraceSummaryLines(result, {
  includeReasons: true,
  maxReasonLength: 80,
});
assert.deepEqual(lines.slice(0, 3), [
  'AgentSessionV3Pilot status=terminal phase=done terminal=completed recoveries=0 transitions=5',
  'reason=Evidence completed the task.',
  '1. init --start--> model_decision reason=begin pilot replay',
]);
assert.equal(lines.at(-1), '5. evaluate --evaluation-completed--> done reason=Evidence completed the task.');

const text = createAgentSessionV3PilotTraceSummaryText(result, {
  includeReasons: false,
});
assert.match(text, /^AgentSessionV3Pilot status=terminal phase=done terminal=completed recoveries=0 transitions=5/u);
assert.match(text, /2\. model_decision --model-decision-accepted--> prepare_command/u);
assert.doesNotMatch(text, /reason=/u);

const invalidResult: AgentSessionV3PilotRunnerResult = {
  reason: 'invalid transition',
  state: createAgentSessionV3PilotInitialState(),
  status: 'invalid-transition',
  transitions: [{
    accepted: false,
    event: {
      route: 'execute',
      type: 'command-prepared',
    },
    from: 'init',
    reason: 'Event command-prepared is not valid while v3 pilot phase is init.',
    state: createAgentSessionV3PilotInitialState(),
  }],
};
assert.match(
  createAgentSessionV3PilotTraceSummaryText(invalidResult, { includeReasons: true }),
  /1\. init --command-prepared--> rejected reason=Event command-prepared is not valid/u,
);

console.log('agent session v3 pilot trace summary smoke ok');
