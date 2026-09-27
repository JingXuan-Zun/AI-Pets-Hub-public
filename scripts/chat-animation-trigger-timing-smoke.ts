import assert from 'node:assert/strict';
import { readProjectFile } from './smokeTestHarness.ts';

const sendExecutionSource = [
  readProjectFile('src/components/chat/chatMessageSendRequestExecution.ts'),
  readProjectFile('src/components/chat/chatPreparedTargetResponses.ts'),
].join('\n');
const turnExecutionSource = readProjectFile(
  'src/components/chat/group/orchestration/groupTurnExecution.ts',
);
const responseTurnSource = readProjectFile('src/components/chat/usePetChatResponseTurn.ts');

assert.ok(
  !/queueUserAnimationTriggers/u.test(sendExecutionSource),
  'user chat text should not enqueue animations before the character reply turn',
);

assert.ok(
  !/(?:'|")user-(?:direct|semantic)(?:'|")/u.test(sendExecutionSource),
  'chat send execution should not trigger user-direct/user-semantic animations from outgoing text',
);

assert.ok(
  /await\s+executeResponseTurn/u.test(sendExecutionSource)
    && /options\.runPetResponseTurn\(options\.plan\.targetSlot/u.test(turnExecutionSource),
  'chat send execution should still await and request the character reply turn',
);

assert.ok(
  /queueModelAnimationTriggers/u.test(responseTurnSource),
  'model reply should still be allowed to trigger animations after the reply is generated',
);

assert.ok(
  /resolveSemanticCharacterAnimationTriggerDecision/u.test(responseTurnSource),
  'model reply turn should call the semantic animation action agent after the character reply',
);

assert.ok(
  /userAnimationIntentText:\s*options\.outgoingText/u.test(turnExecutionSource),
  'original user text should be forwarded as the post-reply animation intent',
);

assert.ok(
  /(?:'|")model-tool(?:'|")/u.test(responseTurnSource)
    || /(?:'|")model-expression(?:'|")/u.test(responseTurnSource),
  'model-side animation trigger sources should remain available',
);

const finalReplyMessageIndex = responseTurnSource.indexOf('finalizeStreamingReplyMessage({');
const modelAnimationTriggerIndex = responseTurnSource.indexOf('await queueModelAnimationTriggers({');

assert.ok(
  finalReplyMessageIndex >= 0,
  'model reply should still be finalized into visible chat before turn completion',
);

assert.ok(
  modelAnimationTriggerIndex > finalReplyMessageIndex,
  'model-side animation playback should be queued after the visible character reply is finalized',
);

const modelAnimationTriggerCall = responseTurnSource.slice(modelAnimationTriggerIndex, modelAnimationTriggerIndex + 320);

assert.ok(
  /userAnimationIntentText:\s*options\.userAnimationIntentText/u.test(modelAnimationTriggerCall),
  'post-reply animation trigger call should receive the original user animation intent text',
);

assert.ok(
  /(?:'|")user-semantic(?:'|")/u.test(responseTurnSource),
  'post-reply semantic animation triggers should be marked as user-semantic for diagnostics',
);

assert.ok(
  !/if\s*\(\s*expressionBindings\.length\s*===\s*0\s*\)\s*\{\s*return;\s*\}/u.test(responseTurnSource),
  'missing expression bindings should not block the semantic animation action agent for normal motion bindings',
);

console.log('chat animation trigger timing smoke ok');
