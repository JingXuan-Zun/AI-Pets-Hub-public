import assert from 'node:assert/strict';
import { assertProductionRuntimeSourceContracts } from './productionRuntimeSourceContracts.ts';

import {
  runAgentProductionRuntime,
  runAgentProductionSession,
  type AgentProductionSessionResult,
} from '../src/agent/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const {
  boundarySource,
  contractSource,
  controllerSource,
  instructionSource,
} = readProjectSources({
  boundarySource: 'src/agent/agentProductionSession.ts',
  contractSource: 'src/agent/agentProductionSessionContract.ts',
  controllerSource: 'src/components/chat/agentRunController.ts',
  instructionSource: 'src/agent/agentProductionSessionInstruction.ts',
});

assert.match(boundarySource, /return runAgentProductionSessionImplementation\(options\)/u);
assert.match(boundarySource, /from '\.\/agentProductionSessionImplementation'/u);
assert.doesNotMatch(boundarySource, /runAgentSessionV2/u);
assert.doesNotMatch(boundarySource, /AgentSessionV2Result|RunAgentSessionV2Options|resolveAgentSessionV2Instruction/u);
assert.match(contractSource, /interface AgentProductionSessionResult extends AgentRuntimeResult/u);
assert.doesNotMatch(contractSource, /AgentSessionV[23]|agentSessionV[23]|\.\/legacy\//u);
assert.match(instructionSource, /export function resolveAgentProductionSessionInstruction/u);
assert.doesNotMatch(instructionSource, /AgentSessionV[23]|agentSessionV[23]|\.\/legacy\//u);
assertProductionRuntimeSourceContracts();
assert.match(controllerSource, /runAgentProductionRuntime\(\{/u);
assert.doesNotMatch(controllerSource, /createAgentRuntimeProductionAdapter|\brunAgentProductionSession\(/u);
assert.doesNotMatch(
  controllerSource,
  /\brunAgentSessionV2\b|\bAgentSessionV2Result\b|(?:function|interface)\s+\w*AgentSessionV2/u,
);

const result: AgentProductionSessionResult = await runAgentProductionSession({
  modelCaller: async () => JSON.stringify({
    action: 'final_answer',
    message: 'production session boundary ok',
    reason: 'No tool execution is required.',
  }),
  settings: {},
  sourceText: 'production session boundary',
  userGoal: 'return a deterministic answer',
});

assert.equal(result.status, 'completed');
assert.equal(result.finalAnswer, 'production session boundary ok');
assert.equal(result.taskState?.owner, 'task-runtime');

// The runtime entry must route through the native adapter into the same
// production session implementation and forward its progress callback.
const runtimeProgress: string[] = [];
const runtimeRun = await runAgentProductionRuntime({
  modelCaller: async () => JSON.stringify({
    action: 'final_answer',
    message: 'production runtime boundary ok',
    reason: 'No tool execution is required.',
  }),
  onProgress: (progress) => {
    runtimeProgress.push(progress.type);
  },
  settings: {},
  sourceText: 'production session boundary',
  userGoal: 'return a deterministic answer',
});

assert.equal(runtimeRun.implementation, 'stable');
assert.equal(runtimeRun.result?.status, 'completed');
assert.equal(runtimeRun.result?.finalAnswer, 'production runtime boundary ok');
assert.equal(runtimeRun.result?.taskState?.owner, 'task-runtime');
assert.ok(runtimeProgress.length > 0, 'runtime entry should forward session progress');

console.log('agent production session boundary smoke ok');
