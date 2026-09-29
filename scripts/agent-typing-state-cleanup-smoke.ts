import assert from 'node:assert/strict';
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

assert.match(
  messageSenderSource,
  /try \{[\s\S]*resolveAgentProductionSessionInstruction\(outgoingText\)[\s\S]*runPreparedAgentProductionSession\([\s\S]*runPreparedChatSendRequest\([\s\S]*\} finally \{[\s\S]*finalizeChatSendRequest\(/u,
  'Production Session execution and normal chat execution should share the same finalize cleanup',
);

const tryMatch = /try \{\s*(?:const|let) agentSessionV2Instruction/u.exec(messageSenderSource);
const tryIndex = tryMatch?.index ?? -1;
const plannerIndex = messageSenderSource.indexOf('runPreparedAgentProductionSession({');
const finallyIndex = messageSenderSource.indexOf('    } finally {\n      finalizeChatSendRequest(');
assert.equal(
  tryIndex >= 0 && plannerIndex > tryIndex && finallyIndex > plannerIndex,
  true,
  'AgentSessionV2 should run after the request cleanup try/finally is installed',
);

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
