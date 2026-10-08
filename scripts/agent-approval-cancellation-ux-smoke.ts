import { readMessageProjectFile as readProjectFile } from './chatMessageSource.mjs';
import assert from 'node:assert/strict';
import { isStoppableAgentApprovalStatus } from '../src/components/chat/agentProgressMessageProjection';


const controllerSource = readProjectFile('src/components/chat/agentRunController.ts');
const bubbleSource = readProjectFile('src/components/chat/PetChatConversationMessageBubble.tsx');

for (const status of ['pending', 'running', 'awaiting-approval'] as const) {
  assert.equal(isStoppableAgentApprovalStatus(status), true, `${status} approval must be cancellable`);
}
for (const status of ['approved', 'denied', 'completed', 'failed', 'stopped'] as const) {
  assert.equal(isStoppableAgentApprovalStatus(status), false, `${status} approval must stay terminal`);
}
assert.match(controllerSource, /isStoppableAgentApprovalStatus\(/u,
  'controller cancellation must consume the shared approval status policy');
assert.match(
  bubbleSource,
  /const canStopApproval = Boolean\(messageId && onStopAgentRun && isActiveApproval\);/u,
  'approval UI must expose stop while approval is pending or running',
);

console.log('agent approval cancellation ux smoke ok');
