import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readModuleProjectFile } from './projectModuleSource.mjs';
import type { ChatMessage } from '../src/types';
import { mergeAgentApprovalMessageIntoExistingMessage } from '../src/components/chat/agentApprovalMessageStore';

const existing = {
  id: 'message-1',
  role: 'model',
  text: 'Running',
  agentApproval: null,
  agentRun: null,
  groupTaskEvent: null,
} as ChatMessage;
const groupTaskEvent = {
  type: 'task-pending-approval' as const,
  groupSessionId: 'session-1',
  topicId: 'topic-1',
  taskId: 'task-1',
  factualSummary: 'Waiting',
};
const approvalMessage = {
  id: 'approval-message',
  role: 'model',
  text: 'Approve?',
  agentApproval: { id: 'approval-1' } as NonNullable<ChatMessage['agentApproval']>,
  groupTaskEvent,
  petId: 'alice',
  petName: 'Alice',
} as ChatMessage;

const merged = mergeAgentApprovalMessageIntoExistingMessage(existing, approvalMessage);
assert.equal(merged.id, 'message-1');
assert.equal(merged.text, 'Approve?');
assert.equal(merged.agentApproval?.id, 'approval-1');
assert.deepEqual(merged.groupTaskEvent, groupTaskEvent);
assert.equal(merged.petId, 'alice');

const controllerSource = readModuleProjectFile('src/components/chat/agentRunController.ts');
const continuationSource = fs.readFileSync(
  'src/components/chat/agentApprovalContinuationExecution.ts',
  'utf8',
);
assert.doesNotMatch(controllerSource, /function updateAgentApprovalMessage\(/);
assert.match(controllerSource, /runChatAgentApprovalContinuations\(/);
assert.match(continuationSource, /runAgentProductionApprovalContinuations\(/);

console.log('agent approval message store smoke ok');
