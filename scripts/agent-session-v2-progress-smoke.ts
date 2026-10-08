import { readMessageProjectSources as readProjectSources } from './chatMessageSource.mjs';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import {
  runAgentProductionSession,
  type AgentSessionV2ModelCaller,
  type AgentSessionV2ProgressEvent,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';
import { assertSourceMatches } from './smokeTestHarness.ts';
import { readModuleProjectFunction } from './projectModuleSource.mjs';

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
// Verified read-only observations can complete without another model iteration.
assert.equal(result.finalAnswer, 'Display result');
assert.equal(modelCallCount, 1);
assert.deepEqual(
  events.map((event) => event.type),
  [
    'model-thinking',
    'model-decision',
    'tools-running',
    'tool-result',
  ],
);
assert.equal(events[0]?.continuation.steps.length, 0);
assert.equal(events[1]?.continuation.steps.length, 1);
assert.equal(events[2]?.continuation.steps.length, 1);
assert.equal(events[3]?.continuation.toolResults.length, 1);
assert.equal(result.continuation.toolResults.length, 1);

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
const preparedRun = readModuleProjectFunction('src/components/chat/agentRunController.ts', 'runPreparedAgentProductionSession');
const approvalRun = readModuleProjectFunction('src/components/chat/agentRunController.ts', 'resolveAgentApprovalRequest');
const guardedToolFactory = readModuleProjectFunction('src/components/chat/agentRunController.ts', 'createAgentRunToolExecutor');
assertSourceMatches(preparedRun, /createAgentRunToolExecutor\(\{\s*isCancelled,\s*executor: onAgentChatCommand,\s*messageId: runMessageId,\s*missingExecutorResult,\s*signal: abortController\.signal/u);
assertSourceMatches(approvalRun, /createApprovedAgentRuntimeCallbacks\(\{\s*approval, canonicalEventJournal, signal: abortController\.signal, executor: onAgentChatCommand,\s*messageId, missingExecutorResult, isCancelled, configRef,/u);
const approvedCallbackAssembly = readModuleProjectFunction('src/components/chat/agentRunController.ts', 'createApprovedAgentRuntimeCallbacks');
assertSourceMatches(approvedCallbackAssembly, /createAgentRunToolExecutor\(\{\s*isCancelled,\s*executor: executor,\s*messageId: messageId,\s*missingExecutorResult,\s*signal: signal,/u);
assertSourceMatches(guardedToolFactory, /return runAgentToolExecutorWithLiveProgress\(\{ command, executor, messageId, signal \}\)/u);
assertSourceMatches(controllerSource, /createAgentWorkStages\(plan/u);
assertSourceMatches(controllerSource, /createAgentRunTrace\(plan/u);
assertSourceMatches(messageBubbleSource, /const liveStages = \(process\.stages \?\? \[\]\)\.filter/u);
assertSourceMatches(messageBubbleSource, /const sessionSteps = resolveChatAgentRuntimeContinuation\(process\)\?\.steps \?\? \[\]/u);
assert.ok(
  messageBubbleSource.indexOf('const liveStages = (process.stages ?? []).filter')
    < messageBubbleSource.indexOf('const sessionSteps = resolveChatAgentRuntimeContinuation(process)?.steps ?? []'),
  'compact Agent panel should surface live tool progress before persisted Runtime steps',
);

console.log('agent session v2 progress smoke ok');
