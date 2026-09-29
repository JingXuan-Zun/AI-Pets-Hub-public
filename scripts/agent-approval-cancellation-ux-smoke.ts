import assert from 'node:assert/strict';
import { readProjectFile } from './smokeTestHarness.ts';

const controllerSource = readProjectFile('src/components/chat/agentRunController.ts');
const bubbleSource = readProjectFile('src/components/chat/PetChatConversationMessageBubble.tsx');

assert.match(
  controllerSource,
  /function isStoppableAgentApprovalStatus\(status: ChatAgentApprovalStatus\) \{\s*return status === 'pending' \|\| status === 'running' \|\| status === 'awaiting-approval';/u,
  'pending approval must be cancellable before approval is granted',
);
assert.match(
  bubbleSource,
  /const canStopApproval = Boolean\(messageId && onStopAgentRun && isActiveApproval\);/u,
  'approval UI must expose stop while approval is pending or running',
);

console.log('agent approval cancellation ux smoke ok');
