import assert from 'node:assert/strict';
import {
  createAgentSessionV3PilotInitialState,
  createAgentSessionV3PilotPhaseDriver,
  runAgentSessionV3PilotRunner,
  type AgentSessionV3PilotState,
} from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const { driverSource, indexSource } = readProjectSources({
  driverSource: 'src/agent/agentSessionV3PilotPhaseDriver.ts',
  indexSource: 'src/agent/legacy/index.ts',
});

assert.match(
  driverSource,
  /export function createAgentSessionV3PilotPhaseDriver/u,
  'v3 pilot phase driver should live in its own module.',
);
assert.match(
  indexSource,
  /export \* from '\.\.\/agentSessionV3PilotPhaseDriver'/u,
  'v3 pilot phase driver should be exported through the agent barrel.',
);
assert.doesNotMatch(
  driverSource,
  /execute_desktop|observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence/u,
  'v3 pilot phase driver should not encode concrete tools or a fixed tool chain.',
);
assert.doesNotMatch(
  driverSource,
  /runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|createAgentSessionV2PendingApprovalAssembly|evaluateAgentSessionV2PostActionTerminal/u,
  'v3 pilot phase driver should not call v2 modules directly.',
);

const visitedPhases: string[] = [];
const driver = createAgentSessionV3PilotPhaseDriver({
  handlers: {
    evaluate: (context) => {
      visitedPhases.push(context.state.phase);
      return {
        reason: 'phase handler completed evaluation',
        type: 'evaluation-completed',
      };
    },
    execute_transaction: (context) => {
      visitedPhases.push(context.state.phase);
      return {
        ok: true,
        type: 'transaction-finished',
      };
    },
    init: (context) => {
      visitedPhases.push(context.state.phase);
      return { type: 'start' };
    },
    model_decision: (context) => {
      visitedPhases.push(context.state.phase);
      return {
        route: 'prepare-command',
        type: 'model-decision-accepted',
      };
    },
    prepare_command: (context) => {
      visitedPhases.push(context.state.phase);
      return {
        route: 'execute',
        type: 'command-prepared',
      };
    },
  },
});

const result = await runAgentSessionV3PilotRunner({ driver });
assert.equal(result.status, 'terminal');
assert.equal(result.state.phase, 'done');
assert.deepEqual(visitedPhases, [
  'init',
  'model_decision',
  'prepare_command',
  'execute_transaction',
  'evaluate',
]);

const unhandledDriver = createAgentSessionV3PilotPhaseDriver({
  handlers: {},
});
const unhandledEvent = await unhandledDriver({
  state: createAgentSessionV3PilotInitialState(),
  transitionCount: 0,
  transitions: [],
});
assert.equal(unhandledEvent, null);

const fallbackDriver = createAgentSessionV3PilotPhaseDriver({
  handlers: {},
  onUnhandledPhase: (context) => ({
    reason: `fallback handled ${context.state.phase}`,
    type: 'start',
  }),
});
assert.deepEqual(await fallbackDriver({
  state: createAgentSessionV3PilotInitialState(),
  transitionCount: 0,
  transitions: [],
}), {
  reason: 'fallback handled init',
  type: 'start',
});

const terminalState: AgentSessionV3PilotState = {
  ...createAgentSessionV3PilotInitialState(),
  phase: 'done',
  terminal: {
    reason: 'complete',
    status: 'completed',
  },
};
const terminalEvent = await fallbackDriver({
  state: terminalState,
  transitionCount: 0,
  transitions: [],
});
assert.equal(terminalEvent, null);

console.log('agent session v3 pilot phase driver smoke ok');
