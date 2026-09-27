import assert from 'node:assert/strict';
import { readProjectFile } from './smokeTestHarness.ts';

const senderSource = readProjectFile('src/components/chat/petChatMessageSendExecution.ts');
const controllerSource = readProjectFile('src/components/chat/agentRunController.ts');

const approvalLogIndex = senderSource.indexOf("'text approval resolved pending request'");
const prepareIndex = senderSource.indexOf('return prepareChatSendRequest');

assert.notEqual(approvalLogIndex, -1, 'text approval path should exist');
assert.notEqual(prepareIndex, -1, 'normal send preparation should exist');
assert.ok(
  approvalLogIndex < prepareIndex,
  'text approval should resolve before prepareChatSendRequest so approve/continue text does not create a user message',
);

assert.match(
  senderSource,
  /if \(!decision \|\| !message\?\.id\) \{[\s\S]*resetVoiceInputSession\(context\.voiceInputSessionRef, context\.voiceTranscriptRef\);[\s\S]*desktopPetChatStore\.setInputValue\(''\);[\s\S]*await resolveAgentApprovalRequest\(/u,
  'approval text path should clear draft/voice state and continue the existing Agent message directly',
);

assert.doesNotMatch(
  senderSource.slice(prepareIndex),
  /text approval resolved pending request/u,
  'approval text continuation should not be handled after prepareChatSendRequest',
);

assert.match(
  controllerSource,
  /mergeAgentApprovalMessageIntoExistingMessage\(message, approvalMessage\)/u,
  'next approval cards should continue merging into the existing Agent message',
);

console.log('agent approval single message ux smoke ok');
