import assert from 'node:assert/strict';
import {
  createAgentSessionV2ReadOnlyToolCacheKey,
  isAgentSessionV2CacheableReadOnlyToolCommand,
  runAgentProductionSession,
  type AgentChatCommand,
  type AgentSessionV2ModelCaller,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const settings = {} as PetConfig['settings'];

function createObservationCommand(input: Record<string, unknown>): AgentChatCommand {
  return {
    instruction: 'read desktop state',
    sourceText: '/agent cache smoke',
    toolCall: {
      goal: 'Read desktop state',
      input,
      name: 'execute_desktop_observation',
    },
  };
}

const normalCommand = createObservationCommand({ action: 'get_display_info' });
const metadataCommand = createObservationCommand({ action: 'get_display_info', note: 'model note' });
const refreshCommand = createObservationCommand({ action: 'get_display_info', forceRefresh: true });

assert.equal(isAgentSessionV2CacheableReadOnlyToolCommand(normalCommand), true);
assert.equal(isAgentSessionV2CacheableReadOnlyToolCommand(refreshCommand), false);
assert.equal(createAgentSessionV2ReadOnlyToolCacheKey(normalCommand), createAgentSessionV2ReadOnlyToolCacheKey(metadataCommand));
assert.equal(createAgentSessionV2ReadOnlyToolCacheKey(refreshCommand), null);

const executedCommands: AgentChatCommand[] = [];
let modelCallCount = 0;
const modelCaller: AgentSessionV2ModelCaller = async ({ systemInstruction }) => {
  modelCallCount += 1;
  assert.match(systemInstruction, /short-lived cache/u);
  return JSON.stringify({
    action: 'tool_call',
    args: { action: 'get_display_info', forceRefresh: true },
    reason: 'Force a fresh read.',
    tool: 'execute_desktop_observation',
  });
};

const result = await runAgentProductionSession({
  maxSteps: 2,
  modelCaller,
  settings,
  sourceText: '/agent force refresh smoke',
  toolExecutor: async (command) => {
    executedCommands.push(command);
    return {
      observations: ['fresh observation'],
      ok: true,
      responseText: 'fresh result',
      verification: 'fresh observation verified',
    };
  },
  userGoal: 'force refresh smoke',
});

assert.equal(result.status, 'completed');
assert.equal(result.finalAnswer, 'fresh result');
assert.equal(modelCallCount, 1);
assert.equal(executedCommands.length, 1);
assert.equal(executedCommands[0].toolCall?.input.forceRefresh, true);
assert.equal(
  result.toolResults.some((entry) => (
    entry.result.observations?.some((line) => line.startsWith('AgentRuntime cache hit'))
  )),
  false,
);

console.log('agent session v2 readonly cache smoke ok');
