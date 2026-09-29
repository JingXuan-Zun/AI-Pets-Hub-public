import assert from 'node:assert/strict';
import {
  runAgentProductionSession,
  shouldUseAgentChatEntryRouter,
  type AgentChatCommand,
  type AgentSessionV2ModelCaller,
} from '../src/agent/legacy/index.ts';
import { createAgentCommandFromPlannerDecision } from '../src/agent/agentLegacy.ts';
import { type PetConfig } from '../src/types.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const settings = {} as PetConfig['settings'];

const sourceText = '/agent watch this video and summarize it';
const userGoal = 'watch this video and summarize it';
const executedCommands: AgentChatCommand[] = [];
let modelCallCount = 0;

const modelCaller: AgentSessionV2ModelCaller = async ({ systemInstruction, userInput }) => {
  modelCallCount += 1;
  assert.match(systemInstruction, /video summarization requests/u);
  assert.match(systemInstruction, /Do not use web search tools for video summarization/u);

  if (modelCallCount === 1) {
    return JSON.stringify({
      action: 'tool_call',
      args: {
        action: 'search_web',
        target: 'watch this video summary',
      },
      reason: 'Wrongly treating the video summary request as a web search.',
      tool: 'execute_desktop_action',
      understanding: {
        neededCapability: 'video summary',
        successCriteria: 'the video is summarized',
        userNeed: 'watch this video and summarize it',
      },
    });
  }

  assert.match(userInput, /rejected video summary search/iu);
  assert.match(userInput, /provided URL, the current browser tab\/page, or the current visible screen\/window/iu);
  return JSON.stringify({
    action: 'ask_user',
    message: 'Where is the video source: the current screen, browser tab, or a URL you want to send?',
    understanding: {
      neededCapability: 'video source before observation',
      userNeed: 'watch and summarize a video',
    },
  });
};

const result = await runAgentProductionSession({
  maxSteps: 3,
  modelCaller,
  settings,
  sourceText,
  toolExecutor: async (command) => {
    executedCommands.push(command);
    throw new Error('video summary search must be rejected before execution');
  },
  userGoal,
});

assert.equal(result.status, 'needs-user');
assert.equal(modelCallCount, 2);
assert.equal(executedCommands.length, 0);
assert.match(result.finalAnswer, /video source/u);
assert.match(result.continuation.historyLines.join('\n'), /Rejected video summary search/u);

const legacySearchCommand = createAgentCommandFromPlannerDecision(sourceText, {
  args: {
    query: 'watch this video summary',
  },
  intent: 'tool',
  tool: 'browser_search',
});
assert.equal(legacySearchCommand?.kind, 'unsupported');
assert.ok(
  (legacySearchCommand?.plannerMessage ?? '').trim().length > 0,
  'legacy video search command should produce an unsupported reason instead of searching',
);

assert.equal(
  shouldUseAgentChatEntryRouter({
    sourceText: 'Can you watch this video and summarize it?',
  }),
  true,
  'video summary requests should be eligible for Agent entry routing',
);

const { entryRouterSource, sessionSource, plannerSource, registrySource } = readProjectSources({
  entryRouterSource: 'src/agent/agentChatEntryRouter.ts',
  sessionSource: 'src/agent/agentProductionSessionImplementation.ts',
  plannerSource: 'src/agent/agentPlanner.ts',
  registrySource: 'src/agent/agentToolRegistry.ts',
});

assert.match(entryRouterSource, /watch or summarize a video/u);
assert.match(sessionSource, /createAgentVideoSummarySearchRejection/u);
assert.match(plannerSource, /isPlannerVideoSummaryIntentWithoutSearch/u);
assert.match(registrySource, /video summary requests/u);

console.log('agent video summary routing smoke ok');
