import assert from 'node:assert/strict';
import { readProjectSources } from './smokeTestHarness.ts';

const {
  rawControllerSource,
  approvalStoreSource,
  responseTurnSource,
  messageBubbleSource,
} = readProjectSources({
  rawControllerSource: 'src/components/chat/agentRunController.ts',
  approvalStoreSource: 'src/components/chat/agentApprovalMessageStore.ts',
  responseTurnSource: 'src/components/chat/usePetChatResponseTurn.ts',
  messageBubbleSource: 'src/components/chat/PetChatConversationMessageBubble.tsx',
});
const controllerSource = `${rawControllerSource}\n${approvalStoreSource}`;

assert.match(
  controllerSource,
  /function mergeAgentApprovalMessageIntoExistingMessage\(/u,
  'Agent approval cards should be able to reuse the existing chat message',
);

assert.match(
  controllerSource,
  /if \(isAgentTaskRuntimeWaitingApproval\(result\) && result\.pendingApproval\) \{/u,
  'Initial Agent Runtime approval should branch on the pending approval result',
);

assert.match(
  controllerSource,
  /const approvalMessage = await createAgentApprovalMessage\(\{[\s\S]*agentRuntime: result\.continuation,[\s\S]*command: result\.pendingApproval\.command,[\s\S]*plan: result\.pendingApproval\.plan/u,
  'Initial Agent Runtime approval should create the approval card from the pending approval command',
);

assert.match(
  controllerSource,
  /updateAgentRunMessage\(runMessageId,[\s\S]*mergeAgentApprovalMessageIntoExistingMessage\(message, approvalMessage\)/u,
  'Initial AgentSessionV2 approval should update the run message instead of appending a new chat bubble',
);

assert.match(
  controllerSource,
  /agentRun: message\.agentRun[\s\S]*status: 'awaiting-approval'/u,
  'Merged approval state should preserve the original Agent run as the task container',
);

assert.doesNotMatch(
  controllerSource,
  /function mergeAgentApprovalMessageIntoExistingMessage\([\s\S]*agentRun: null,[\s\S]*chatMode: approvalMessage\.chatMode/u,
  'Merged approval state should not erase the original Agent run',
);

assert.match(
  controllerSource,
  /if \(isAgentTaskRuntimeWaitingApproval\(sessionResult\) && sessionResult\.pendingApproval\) \{/u,
  'Follow-up approvals should branch on the pending approval result',
);

assert.match(
  controllerSource,
  /taskScopedApprovedContinuation\.outcome\.kind === 'duplicate-blocked'/u,
  'Follow-up approvals should guard against repeated identical approval loops',
);

assert.match(
  controllerSource,
  /const approvalMessage = await createAgentApprovalMessage\(\{[\s\S]*agentRuntime: sessionResult\.continuation,[\s\S]*command: sessionResult\.pendingApproval\.command,[\s\S]*plan: sessionResult\.pendingApproval\.plan/u,
  'Follow-up approvals should create the approval card from the next pending approval command',
);

assert.match(
  controllerSource,
  /updateAgentApprovalMessage\(messageId,[\s\S]*mergeAgentApprovalMessageIntoExistingMessage\(message, approvalMessage\)/u,
  'Follow-up approvals should replace the same approval message instead of appending another one',
);

assert.match(
  controllerSource,
  /agentRun: message\.agentRun[\s\S]*status: 'running'/u,
  'Approving an Agent action should keep the same task run active instead of creating a new message',
);

assert.match(
  messageBubbleSource,
  /!\s*message\.agentApproval \? \([\s\S]*<PetChatAgentRunPanel/u,
  'Messages that contain both approval and run state should render one Agent task panel instead of two stacked panels',
);

assert.match(
  controllerSource,
  /compactReplyIntoMessageId\?: string \| null/u,
  'Agent persona replies should support compacting final output into the existing Agent message',
);

assert.match(
  controllerSource,
  /desktopPetChatStore\.removeMessage\(generatedMessageId\)/u,
  'Generated persona reply messages should be removed after their text is merged into the Agent message',
);

assert.match(
  responseTurnSource,
  /outputMessageId\?: string \| null/u,
  'Chat response turns should support streaming into an existing message',
);

assert.match(
  responseTurnSource,
  /const modelMessageId = outputMessageId \|\| createChatMessageId/u,
  'Agent persona replies should reuse the existing Agent message id when provided',
);

assert.match(
  responseTurnSource,
  /let hasModelMessage = Boolean\(outputMessageId\)/u,
  'Reused Agent messages should be updated instead of appended as new model messages',
);

assert.match(
  controllerSource,
  /outputMessageId: compactReplyIntoMessageId/u,
  'Agent persona reply generation should stream directly into the compact target message',
);

assert.match(
  controllerSource,
  /compactReplyIntoMessageId: runMessageId/u,
  'Initial AgentSessionV2 final reply should compact into the run message',
);

assert.match(
  controllerSource,
  /compactReplyIntoMessageId: messageId/u,
  'Approved AgentSessionV2 final reply should compact into the approval message',
);

console.log('agent single message approval chain smoke ok');
