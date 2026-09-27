import assert from 'node:assert/strict';
import {
  createAgentSessionV3RuntimeEvaluatePort,
  createAgentSessionV3RuntimeExecuteTransactionPort,
  createAgentSessionV3RuntimeInitPort,
  createAgentSessionV3RuntimeModelDecisionPort,
  createAgentSessionV3RuntimePrepareCommandPort,
  runAgentSessionV3RuntimeController,
  type AgentChatCommand,
  type AgentModelDecisionTurnOutcome,
  type AgentPostActionTerminalEvaluation,
  type AgentToolTransactionResult,
  type AgentSessionV3RuntimeBoundaryPorts,
} from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const {
  adaptersSource,
  controllerSource,
  indexSource,
} = readProjectSources({
  adaptersSource: 'src/agent/agentSessionV3RuntimeAdapters.ts',
  controllerSource: 'src/agent/agentSessionV3RuntimeController.ts',
  indexSource: 'src/agent/legacy/index.ts',
});

assert.match(adaptersSource, /createAgentSessionV3RuntimeModelDecisionPort/u);
assert.match(adaptersSource, /createAgentSessionV3RuntimeExecuteTransactionPort/u);
assert.match(adaptersSource, /createAgentSessionV3RuntimeEvaluatePort/u);
assert.match(indexSource, /export \* from '\.\.\/agentSessionV3RuntimeAdapters';/u);

const baseTiming = {
  id: 'timing-1',
  kind: 'model' as const,
  label: 'decision',
  startedAt: 100,
  status: 'success' as const,
  stepIndex: 1,
};

const modelDecisionOutcome: AgentModelDecisionTurnOutcome = {
  decision: {
    action: 'tool_call',
    reason: 'Need one runtime adapter smoke transaction.',
    tool: 'runtime_adapter_smoke_tool',
  },
  modelResponse: '{"action":"tool_call"}',
  step: {
    action: 'tool_call',
    index: 1,
    reason: 'Need one runtime adapter smoke transaction.',
    summary: 'Model selected a tool call.',
    tool: 'runtime_adapter_smoke_tool',
  },
  timing: baseTiming,
  traceEvents: [],
  type: 'accepted',
};

const command: AgentChatCommand = {
  instruction: 'runtime adapter smoke',
  kind: 'tool-call',
  sourceText: '/agent runtime adapter smoke',
  toolCall: {
    input: {
      query: 'runtime adapter smoke',
    },
    name: 'execute_desktop_observation',
  },
};

const transaction: AgentToolTransactionResult = {
  command,
  result: {
    ok: true,
    responseText: 'Runtime adapter smoke transaction completed.',
    verification: 'Runtime adapter smoke verification.',
  },
  timing: {
    ...baseTiming,
    kind: 'tool',
    label: 'execute_desktop_observation',
  },
};

const terminalEvaluation: AgentPostActionTerminalEvaluation = {
  finalAnswer: 'Runtime adapter smoke done.',
  kind: 'launched',
  postActionState: 'launched',
  status: 'completed',
  stepAction: 'final_answer',
  stepReason: 'Runtime adapter smoke evaluation completed.',
};

const visited: string[] = [];
const ports = {
  evaluate: createAgentSessionV3RuntimeEvaluatePort((context) => {
    visited.push(context.phase);
    assert.deepEqual(context.sideEffectLimit.allowedScopes, ['post-action-evaluation', 'trace-recording']);
    return terminalEvaluation;
  }),
  execute_transaction: createAgentSessionV3RuntimeExecuteTransactionPort((context) => {
    visited.push(context.phase);
    assert.deepEqual(context.sideEffectLimit.allowedScopes, [
      'transaction-execution',
      'trace-recording',
      'progress-emission',
    ]);
    return {
      kind: 'tool-transaction',
      transaction,
    };
  }),
  init: createAgentSessionV3RuntimeInitPort('runtime adapter smoke start'),
  model_decision: createAgentSessionV3RuntimeModelDecisionPort((context) => {
    visited.push(context.phase);
    assert.deepEqual(context.sideEffectLimit.allowedScopes, ['model-call', 'trace-recording']);
    return modelDecisionOutcome;
  }),
  prepare_command: createAgentSessionV3RuntimePrepareCommandPort((context) => {
    visited.push(context.phase);
    assert.deepEqual(context.sideEffectLimit.allowedScopes, [
      'command-preparation',
      'permission-route-consumption',
      'trace-recording',
    ]);
    return {
      reason: 'runtime adapter smoke prepared command',
      route: 'execute',
    };
  }),
} as const satisfies AgentSessionV3RuntimeBoundaryPorts;

const result = await runAgentSessionV3RuntimeController({
  ports,
});

assert.equal(result.status, 'terminal');
assert.equal(result.state.phase, 'done');
assert.equal(result.state.terminal?.status, 'completed');
assert.equal(result.boundary.productionAuthority, false);
assert.deepEqual(visited, [
  'model_decision',
  'prepare_command',
  'execute_transaction',
  'evaluate',
]);
assert.deepEqual(
  result.transitions.map((transition) => transition.event.type),
  [
    'start',
    'model-decision-accepted',
    'command-prepared',
    'transaction-finished',
    'evaluation-completed',
  ],
);

assert.doesNotMatch(
  adaptersSource,
  /buildAgentPermissionRoute|createAgentSessionV2ToolCommand|runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|toolExecutor/u,
  'Runtime adapters surface must not directly own v2 production calls or tool execution.',
);
assert.doesNotMatch(
  adaptersSource,
  /nextTool|nextArgs|toolName|implementationQueue|orderedSteps|requiredReportOrder|recoveryAction/u,
  'Runtime adapters surface must not define fixed order, tool decisions, queues, or recovery actions.',
);
assert.doesNotMatch(
  adaptersSource,
  /observe_windows_and_apps\s*->\s*locate_screen_elements|locate_screen_elements\s*->\s*execute_desktop|execute_desktop_sequence\s*->\s*observe_windows_and_apps/iu,
  'Runtime adapters surface must not encode a fixed desktop workflow.',
);
assert.doesNotMatch(
  controllerSource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Runtime controller must not directly own v2 production calls or tool execution.',
);

console.log('agent session v3 runtime adapters smoke ok');
