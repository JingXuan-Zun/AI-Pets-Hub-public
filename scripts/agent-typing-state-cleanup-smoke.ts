import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from 'typescript';
import { readModuleProjectFunction } from './projectModuleSource.mjs';
import { readProjectSources } from './smokeTestHarness.ts';

const {
  activityState: activityStateSource,
  agentRunController: agentRunControllerSource,
  messageSender: messageSenderSource,
  responseTurn: responseTurnSource,
} = readProjectSources({
  activityState: 'src/components/chat/PetChatConversationActivityStates.tsx',
  agentRunController: 'src/components/chat/agentRunController.ts',
  messageSender: 'src/components/chat/usePetChatMessageSender.ts',
  responseTurn: 'src/components/chat/usePetChatResponseTurn.ts',
});

assert.match(
  activityStateSource,
  /\{isTyping && \([\s\S]*className="flex gap-1"[\s\S]*rounded-full bg-primary/u,
  'the three-dot bubble should be driven by the global isTyping state',
);

const sendExecution = readModuleProjectFunction('src/components/chat/petChatMessageSendExecution.ts', 'executePetChatMessageSend');
const preparedExecution = readModuleProjectFunction('src/components/chat/petChatMessageSendExecution.ts', 'executePreparedRequest');
assert.match(messageSenderSource, /await executePetChatMessageSend\(contextRef\.current/u);
assert.match(sendExecution, /try \{\s*await executePreparedRequest\(context, input, preparedRequest\);\s*\} finally \{\s*finalizeChatSendRequest\(/u);
assert.match(preparedExecution, /await executePreparedAgentSession\(context, input, preparedRequest, instruction\)/u);
assert.match(preparedExecution, /await runPreparedChatSendRequest\(\{ \.\.\.context, preparedRequest \}\)/u);

for (const route of ['agent', 'chat', 'story']) for (const fail of [false, true]) {
  const effects: string[] = [];
  const expectedError = new Error(`${route} failed`);
  const senderContext = { activeChatRequestTokenRef: { current: 7 }, groupChatContinuationEnabledRef: { current: false } };
  const exported = { exports: null as any };
  const dispatch = async (kind: string) => { effects.push(kind); if (fail) throw expectedError; };
  const source = sendExecution + '\n' + preparedExecution + '\nmodule.exports = executePetChatMessageSend;';
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText, {
    module: exported,
    exports: {},
    resolveSendInput: () => ({ outgoingText: 'message' }),
    desktopPetChatStore: { getState: () => ({ chatMode: 'single', isTyping: false }) },
    prepareSendRequest: async () => ({ requestToken: 7, currentChatState: { chatMode: route } }),
    resolveInitialAgentInstruction: () => route === 'agent' ? 'goal' : '',
    resolveAnimationAgentInstruction: (_input: unknown, instruction: string) => instruction,
    resolveRoutedAgentInstruction: async (_context: unknown, _input: unknown, _request: unknown, instruction: string) => instruction,
    executePreparedAgentSession: async () => dispatch('agent'),
    runPreparedChatSendRequest: async () => dispatch(route),
    finalizeChatSendRequest: (token: number, tokenRef: unknown, continuationRef: unknown) => {
      assert.equal(token, 7);
      assert.equal(tokenRef, senderContext.activeChatRequestTokenRef);
      assert.equal(continuationRef, senderContext.groupChatContinuationEnabledRef);
      effects.push('finalize');
    },
  });
  if (fail) await assert.rejects(exported.exports(senderContext), (error) => error === expectedError);
  else await exported.exports(senderContext);
  assert.deepEqual(effects, [route, 'finalize'], 'cleanup runs exactly once after successful or failing dispatch');
}

assert.doesNotMatch(
  messageSenderSource,
  /resolveAgentChatCommandWithPlanner|shouldUseAgentPlanner|runPreparedAgentChatCommand/u,
  'the old fixed planner entry should not be wired into the message sender',
);

assert.match(
  agentRunControllerSource,
  /activeChatRequestTokenRef\.current = requestToken;[\s\S]*stopGroupChat\(\{ immediate: true, cancelActiveRequest: false \}\);/u,
  'Approved Agent runs should stop group chat without invalidating their own request token',
);

assert.match(
  responseTurnSource,
  /desktopPetChatStore\.setTyping\(true\);[\s\S]*try \{[\s\S]*requestPetResponseStream\([\s\S]*\} finally \{[\s\S]*if \(isCurrentRequest\(\)\) \{[\s\S]*desktopPetChatStore\.setTyping\(false\);[\s\S]*desktopPetChatStore\.setTypingPetId\(null\);/u,
  'Pet response turns should always clear typing state through a finally block',
);

assert.doesNotMatch(
  responseTurnSource,
  /if \(isCurrentRequest\(\)\) \{[\s\S]*desktopPetChatStore\.setTyping\(false\);[\s\S]*onPetMessage\?\.\(finalResponse\);[\s\S]*\}/u,
  'typing cleanup should not exist only on the normal completed-response path',
);

console.log('agent typing state cleanup smoke ok');
