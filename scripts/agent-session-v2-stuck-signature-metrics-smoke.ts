import assert from 'node:assert/strict';
import {
  findAgentRepeatedActionOutcomeWindowMetric,
  findAgentRepeatedRecentToolResultSignatureMetrics,
  type AgentChatCommand,
  type AgentChatCommandResult,
  type AgentSessionV2ToolResultEntry,
} from '../src/agent/legacy/index.ts';
import {
  assertSourceDoesNotMatch,
  assertSourceMatches,
  readProjectSources,
} from './smokeTestHarness.ts';
import {
  findAgentRepeatedActionOutcomeWindowMetric,
  findAgentRepeatedRecentToolResultSignatureMetrics,
} from '../src/agent/runtime/agentStuckSignatureMetrics.ts';

function createToolCommand(toolName: string, input: Record<string, unknown>): AgentChatCommand {
  return {
    capabilityId: 'desktop-observation',
    instruction: 'stuck signature metrics smoke',
    kind: 'tool-call',
    sourceText: '/agent stuck signature metrics smoke',
    toolCall: {
      goal: 'stuck signature metrics smoke',
      input,
      name: toolName as AgentChatCommand['toolCall']['name'],
    },
  };
}

function createActionResult(options: {
  action: string;
  changed: boolean;
  outcome: 'blocked' | 'changed' | 'no-op' | 'uncertain';
  tool?: 'execute_desktop_action' | 'execute_desktop_input' | 'execute_desktop_sequence';
}): AgentChatCommandResult {
  return {
    ok: true,
    responseText: `action outcome ${options.outcome}`,
    stateSummary: {
      actionEvidence: {
        action: options.action,
        confidence: options.outcome === 'changed' ? 0.82 : 0.45,
        diff: {
          changed: options.changed,
          signals: [`changed=${options.changed}`],
          summary: `Synthetic ${options.outcome} action evidence.`,
        },
        outcome: options.outcome,
        snapshotProfile: 'light',
        targetRef: {
          confidence: 'medium',
          kind: 'pixel',
          label: 'synthetic target',
        },
        timestamp: Date.now(),
        tool: options.tool ?? 'execute_desktop_input',
      },
    },
  };
}

const clickCommand = createToolCommand('execute_desktop_input', {
  action: 'click',
  x: 120,
  y: 240,
});
const typeCommand = createToolCommand('execute_desktop_input', {
  action: 'type_text',
  text: 'abc',
});
const failedObservationCommand = createToolCommand('locate_screen_elements', {
  query: 'target button',
});

const noOpClickResult = createActionResult({
  action: 'click',
  changed: false,
  outcome: 'no-op',
});
const uncertainTypeResult = createActionResult({
  action: 'type_text',
  changed: true,
  outcome: 'uncertain',
});
const changedClickResult = createActionResult({
  action: 'click',
  changed: true,
  outcome: 'changed',
});
const failedObservationResult: AgentChatCommandResult = {
  errorText: 'target not found',
  ok: false,
  responseText: 'target not found',
};

const repeatedWindowResults: AgentSessionV2ToolResultEntry[] = [
  {
    command: clickCommand,
    result: noOpClickResult,
  },
  {
    command: typeCommand,
    result: uncertainTypeResult,
  },
  {
    command: clickCommand,
    result: noOpClickResult,
  },
  {
    command: typeCommand,
    result: uncertainTypeResult,
  },
];

const repeatedWindowMetric = findAgentRepeatedActionOutcomeWindowMetric(repeatedWindowResults);
assert.deepEqual(
  findAgentRepeatedActionOutcomeWindowMetric(repeatedWindowResults),
  repeatedWindowMetric,
);
assert.equal(repeatedWindowMetric?.windowSize, 2);
assert.equal(repeatedWindowMetric?.repeatCount, 2);
assert.match(repeatedWindowMetric?.signature ?? '', /outcome=no-op/u);
assert.match(repeatedWindowMetric?.signature ?? '', /outcome=uncertain/u);

const changedOnlyMetric = findAgentRepeatedActionOutcomeWindowMetric([
  {
    command: clickCommand,
    result: changedClickResult,
  },
  {
    command: clickCommand,
    result: changedClickResult,
  },
  {
    command: clickCommand,
    result: changedClickResult,
  },
  {
    command: clickCommand,
    result: changedClickResult,
  },
]);
assert.equal(changedOnlyMetric, null, 'changed-only repeated actions should not be treated as stuck-signature evidence.');

const repeatedToolInput = [
  {
    command: failedObservationCommand,
    result: failedObservationResult,
  },
  {
    command: failedObservationCommand,
    result: failedObservationResult,
  },
];
const repeatedToolMetrics = findAgentRepeatedRecentToolResultSignatureMetrics(repeatedToolInput);
assert.deepEqual(
  findAgentRepeatedRecentToolResultSignatureMetrics(repeatedToolInput),
  repeatedToolMetrics,
);
assert.equal(repeatedToolMetrics.length, 1);
assert.equal(repeatedToolMetrics[0]?.count, 2);
assert.match(repeatedToolMetrics[0]?.signature ?? '', /locate_screen_elements/u);

const { metrics: sourceText, runtime: runtimeSource } = readProjectSources({
  metrics: 'src/agent/runtime/agentStuckSignatureMetrics.ts',
  runtime: 'src/agent/runtime/agentStuckSignatureMetrics.ts',
});
assertSourceMatches(runtimeSource, /export function findAgentRepeatedActionOutcomeWindowMetric/u);

console.log('agent session v2 stuck signature metrics smoke ok');
