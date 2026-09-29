import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import {
  runAgentProductionSession,
  type AgentSessionV2ModelCaller,
  type AgentSessionV2ProgressEvent,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';
import {
  assertSourceMatches,
  readProjectSources,
} from './smokeTestHarness.ts';

const settings = {} as PetConfig['settings'];

const events: AgentSessionV2ProgressEvent[] = [];
let modelCallCount = 0;
let toolStarted = false;
let toolResolved = false;

const modelCaller: AgentSessionV2ModelCaller = async () => {
  modelCallCount += 1;
  await delay(20);

  if (modelCallCount === 1) {
    return JSON.stringify({
      action: 'tool_call',
      args: {
        action: 'get_display_info',
      },
      reason: 'Need current display facts.',
      tool: 'execute_desktop_observation',
      understanding: {
        neededCapability: 'live progress smoke',
        successCriteria: 'tool result is observed before final answer',
        userNeed: 'check live Agent progress events',
      },
    });
  }

  return JSON.stringify({
    action: 'final_answer',
    message: 'progress smoke done',
  });
};

const result = await runAgentProductionSession({
  modelCaller,
  onProgress: (event) => {
    events.push(event);
    if (event.type === 'tools-running') {
      assert.equal(toolStarted, false);
      assert.equal(toolResolved, false);
    }

    if (event.type === 'tool-result') {
      assert.equal(toolResolved, true);
      assert.equal(event.continuation.toolResults.length, 1);
      assert.equal(event.continuation.steps[event.continuation.steps.length - 1]?.action, 'tool_result');
    }
  },
  settings,
  sourceText: '/agent progress smoke',
  toolExecutor: async () => {
    toolStarted = true;
    await delay(20);
    toolResolved = true;
    return {
      observations: ['Display observations: 2'],
      ok: true,
      responseText: 'Display result',
      verification: 'display verified',
    };
  },
  userGoal: 'progress smoke',
});

assert.equal(result.status, 'completed');
assert.equal(result.finalAnswer, 'progress smoke done');
assert.deepEqual(
  events.map((event) => event.type),
  [
    'model-thinking',
    'model-decision',
    'tools-running',
    'tool-result',
    'model-thinking',
    'model-decision',
  ],
);
assert.equal(events[0]?.continuation.steps.length, 0);
assert.equal(events[1]?.continuation.steps.length, 1);
assert.equal(events[2]?.continuation.steps.length, 1);
assert.equal(events[3]?.continuation.toolResults.length, 1);
assert.equal(events[5]?.continuation.steps[events[5].continuation.steps.length - 1]?.action, 'final_answer');

const {
  controller: controllerSource,
  messageBubble: messageBubbleSource,
} = readProjectSources({
  controller: 'src/components/chat/agentRunController.ts',
  messageBubble: 'src/components/chat/PetChatConversationMessageBubble.tsx',
});
assertSourceMatches(controllerSource, /function updateAgentToolExecutionProgressMessage/u);
assertSourceMatches(controllerSource, /function runAgentToolExecutorWithLiveProgress/u);
assertSourceMatches(controllerSource, /phase: 'started'/u);
assertSourceMatches(controllerSource, /正在调用工具/u);
assertSourceMatches(controllerSource, /工具调用完成/u);
assertSourceMatches(controllerSource, /runAgentToolExecutorWithLiveProgress\(\{[\s\S]*messageId: runMessageId/u);
assertSourceMatches(controllerSource, /runAgentToolExecutorWithLiveProgress\(\{[\s\S]*messageId,/u);
assertSourceMatches(controllerSource, /createAgentWorkStages\(plan/u);
assertSourceMatches(controllerSource, /createAgentRunTrace\(plan/u);
assertSourceMatches(messageBubbleSource, /const liveStages = \(process\.stages \?\? \[\]\)\.filter/u);
assertSourceMatches(messageBubbleSource, /const sessionSteps = process\.agentSessionV2\?\.steps \?\? \[\]/u);
assert.ok(
  messageBubbleSource.indexOf('const liveStages = (process.stages ?? []).filter')
    < messageBubbleSource.indexOf('const sessionSteps = process.agentSessionV2?.steps ?? []'),
  'compact Agent panel should surface live tool progress before older AgentSessionV2 steps',
);

console.log('agent session v2 progress smoke ok');
