import assert from 'node:assert/strict';
import {
  createAgentChatEntryRouterInput,
  parseAgentChatEntryRouteDecision,
  resolveAgentChatEntryRoute,
  shouldUseAgentChatEntryRouter,
} from '../src/agent/index.ts';
import { type ChatMessage, type PetConfig } from '../src/types.ts';
import { readProjectFile } from './smokeTestHarness.ts';

const settings = {} as PetConfig['settings'];
const historyMessages = [
  {
    id: 'user-1',
    role: 'user',
    text: 'Open that website again later.',
  },
  {
    id: 'model-1',
    role: 'model',
    petName: 'Mika',
    text: 'Okay, I will keep that chat context in mind.',
  },
] as ChatMessage[];

const agentInputs: string[] = [];
const agentRoute = await resolveAgentChatEntryRoute({
  historyMessages,
  modelCaller: async ({ systemInstruction, userInput }) => {
    agentInputs.push(userInput);
    assert.match(systemInstruction, /entry router/u);
    assert.match(systemInstruction, /Do not select a specific tool here/u);
    assert.match(systemInstruction, /Do not route by keyword matching/u);
    assert.match(systemInstruction, /open_resource/u);
    assert.match(systemInstruction, /current screen\/window\/game content/u);
    assert.match(systemInstruction, /abstract capability questions/u);
    assert.doesNotMatch(systemInstruction, /Allowed JSON actions/u);

    return JSON.stringify({
      confidence: 0.91,
      reason: 'The user wants the app to operate on the local desktop browser.',
      rewrittenGoal: 'Open the browser and visit example.com.',
      route: 'agent',
    });
  },
  settings,
  sourceText: 'Use the browser to open example.com.',
});

assert.equal(agentRoute.mode, 'agent');
assert.equal(agentRoute.rewrittenGoal, 'Open the browser and visit example.com.');
assert.equal(agentRoute.confidence, 0.91);
assert.match(agentInputs[0] ?? '', /Recent chat context/u);
assert.match(agentInputs[0] ?? '', /Open that website again later/u);
assert.match(agentInputs[0] ?? '', /Current user message: Use the browser to open example\.com\./u);

const chatRoute = await resolveAgentChatEntryRoute({
  modelCaller: async () => JSON.stringify({
    confidence: 0.82,
    reason: 'The user is asking for companionship chat.',
    route: 'chat',
  }),
  settings,
  sourceText: 'I feel tired today. Chat with me for a while.',
});

assert.equal(chatRoute.mode, 'chat');
assert.equal(chatRoute.rewrittenGoal, null);

const timeRoute = await resolveAgentChatEntryRoute({
  modelCaller: async () => {
    throw new Error('ordinary time question must not invoke Agent routing');
  },
  settings,
  sourceText: '现在几点？',
});
assert.equal(timeRoute.mode, 'chat');
assert.equal(timeRoute.confidence, 1);

const invalidRoute = await resolveAgentChatEntryRoute({
  modelCaller: async () => 'not json',
  settings,
  sourceText: 'Look at my screen.',
});

assert.equal(invalidRoute.mode, 'chat');
assert.equal(invalidRoute.confidence, 0);
assert.match(invalidRoute.reason, /valid JSON/u);

const parsedFromWrappedText = parseAgentChatEntryRouteDecision([
  'Here is the decision:',
  '{"route":"agent","reason":"needs local display info","confidence":2}',
].join('\n'));
assert.equal(parsedFromWrappedText?.mode, 'agent');
assert.equal(parsedFromWrappedText?.confidence, 1);

const emptyRoute = await resolveAgentChatEntryRoute({
  modelCaller: async () => {
    throw new Error('empty input should not call model');
  },
  settings,
  sourceText: '   ',
});
assert.equal(emptyRoute.mode, 'chat');
assert.equal(emptyRoute.confidence, 1);

assert.equal(
  shouldUseAgentChatEntryRouter({
    sourceText: 'I feel tired today. Chat with me for a while.',
  }),
  true,
  'plain companionship chat should still be decided by the model-driven entry router',
);
assert.equal(
  shouldUseAgentChatEntryRouter({
    sourceText: 'Use the browser to open example.com.',
  }),
  true,
  'local desktop/browser requests should still be eligible for Agent entry routing',
);
assert.equal(
  shouldUseAgentChatEntryRouter({
    historyMessages: [{ id: 'user-display', role: 'user', text: 'Check my current display resolution.' } as ChatMessage],
    sourceText: 'What about the secondary display?',
  }),
  true,
  'short contextual follow-ups after local desktop questions should still route through Agent entry logic',
);

const routerInput = createAgentChatEntryRouterInput({
  historyMessages,
  maxHistoryMessages: 1,
  sourceText: 'Open that previous website.',
});
assert.doesNotMatch(routerInput, /Open that website again later/u);
assert.match(routerInput, /Mika: Okay, I will keep that chat context in mind/u);
assert.match(routerInput, /Current user message: Open that previous website\./u);

const visualQuestionRouterInput = createAgentChatEntryRouterInput({
  sourceText: 'Can you see what is on my current screen?',
});
assert.match(visualQuestionRouterInput, /Current user message: Can you see what is on my current screen\?/u);

const senderSource = readProjectFile('src/components/chat/petChatMessageSendExecution.ts');
const routerSource = readProjectFile('src/agent/agentChatEntryRouter.ts');
assert.doesNotMatch(
  senderSource,
  /shouldEnterAgentDirectlyForLocalCommand\(outgoingText\)[\s\S]*route=agent-direct-local-command/u,
  'message sender should not bypass the model-driven entry router for local commands',
);
assert.doesNotMatch(
  routerSource,
  /LOCAL_INTENT_PATTERN|FOLLOW_UP_PATTERN|hasAgentChatEntryRouterLocalIntent/u,
  'entry routing should not use local keyword prefilters before asking the router model',
);
assert.match(
  senderSource,
  /shouldUseAgentChatEntryRouter\(\{[\s\S]*resolveAgentChatEntryRoute\(/u,
  'message sender should call the model-driven entry router for eligible non-slash text',
);
assert.match(
  senderSource,
  /if \(decision\.mode !== 'agent'\) return '';[\s\S]*return decision\.rewrittenGoal \|\| input\.outgoingText;/u,
  'message sender should enter AgentSessionV2 when the route is agent',
);
assert.match(
  senderSource,
  /router failed; falling back to normal chat/u,
  'message sender should keep chat usable when entry routing fails',
);
assert.doesNotMatch(
  senderSource,
  /shouldUseAgentPlanner|resolveAgentChatCommandWithPlanner|runPreparedAgentChatCommand/u,
  'entry routing should not restore the old planner chain',
);

console.log('agent chat entry router smoke ok');
