import assert from 'node:assert/strict';
import {
  createAgentSessionV3PilotInitialState,
  runAgentSessionV3PilotRunner,
  type AgentSessionV3PilotEvent,
} from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const { runnerSource, indexSource } = readProjectSources({
  runnerSource: 'src/agent/agentSessionV3PilotRunner.ts',
  indexSource: 'src/agent/legacy/index.ts',
});

assert.match(
  runnerSource,
  /export async function runAgentSessionV3PilotRunner/u,
  'v3 pilot runner should live in its own module.',
);
assert.match(
  indexSource,
  /export \* from '\.\.\/agentSessionV3PilotRunner'/u,
  'v3 pilot runner should be exported through the agent barrel.',
);
assert.doesNotMatch(
  runnerSource,
  /execute_desktop|observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence/u,
  'v3 pilot runner should not encode concrete tools or a fixed tool chain.',
);
assert.doesNotMatch(
  runnerSource,
  /runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|createAgentSessionV2PendingApprovalAssembly|evaluateAgentSessionV2PostActionTerminal/u,
  'v3 pilot runner should not call v2 modules directly.',
);

const happyPathEvents: AgentSessionV3PilotEvent[] = [
  { type: 'start' },
  {
    route: 'prepare-command',
    type: 'model-decision-accepted',
  },
  {
    route: 'execute',
    type: 'command-prepared',
  },
  {
    ok: true,
    type: 'transaction-finished',
  },
  {
    reason: 'evidence completed the task',
    type: 'evaluation-completed',
  },
];
const terminalResult = await runAgentSessionV3PilotRunner({
  driver: ({ transitionCount }) => happyPathEvents[transitionCount] ?? null,
});
assert.equal(terminalResult.status, 'terminal');
assert.equal(terminalResult.state.phase, 'done');
assert.equal(terminalResult.state.terminal?.status, 'completed');
assert.equal(terminalResult.transitions.length, happyPathEvents.length);

const waitingResult = await runAgentSessionV3PilotRunner({
  driver: () => null,
});
assert.equal(waitingResult.status, 'waiting-for-event');
assert.equal(waitingResult.state.phase, 'init');
assert.match(waitingResult.reason ?? '', /No pilot event/u);

const invalidResult = await runAgentSessionV3PilotRunner({
  driver: () => ({
    route: 'execute',
    type: 'command-prepared',
  }),
});
assert.equal(invalidResult.status, 'invalid-transition');
assert.equal(invalidResult.state.phase, 'init');
assert.equal(invalidResult.transitions.length, 1);
assert.equal(invalidResult.transition?.accepted, false);

const limitResult = await runAgentSessionV3PilotRunner({
  driver: ({ state }) => {
    if (state.phase === 'init') {
      return { type: 'start' };
    }

    return {
      route: 'prepare-command',
      type: 'model-decision-accepted',
    };
  },
  maxTransitions: 1,
});
assert.equal(limitResult.status, 'transition-limit');
assert.equal(limitResult.state.phase, 'model_decision');
assert.equal(limitResult.transitions.length, 1);

const failedDriverResult = await runAgentSessionV3PilotRunner({
  driver: () => {
    throw new Error('driver unavailable');
  },
});
assert.equal(failedDriverResult.status, 'driver-failed');
assert.equal(failedDriverResult.errorText, 'driver unavailable');

const alreadyTerminalState = {
  ...createAgentSessionV3PilotInitialState(),
  phase: 'done' as const,
  terminal: {
    reason: 'already done',
    status: 'completed' as const,
  },
};
const alreadyTerminalResult = await runAgentSessionV3PilotRunner({
  driver: () => {
    throw new Error('driver should not be called for terminal state');
  },
  initialState: alreadyTerminalState,
});
assert.equal(alreadyTerminalResult.status, 'terminal');
assert.equal(alreadyTerminalResult.reason, 'already done');
assert.equal(alreadyTerminalResult.transitions.length, 0);

console.log('agent session v3 pilot runner smoke ok');
