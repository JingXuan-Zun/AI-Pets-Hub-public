import assert from 'node:assert/strict';

import {
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
assert.match(boundarySource, /run:\s*\(runtimeContext\) => runAgentProductionSessionImplementation\(\{/u);
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

console.log('agent production session boundary smoke ok');
