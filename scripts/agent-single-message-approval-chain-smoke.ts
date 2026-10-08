import { readMessageProjectSources as readProjectSources } from './chatMessageSource.mjs';
import assert from 'node:assert/strict';
import { readModuleProjectFunction } from './projectModuleSource.mjs';


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
const initialRun = readModuleProjectFunction('src/components/chat/agentRunController.ts', 'runPreparedAgentProductionSession');
const approvalRun = readModuleProjectFunction('src/components/chat/agentRunController.ts', 'resolveAgentApprovalRequest');
const initialAttachment = readModuleProjectFunction('src/components/chat/agentRunController.ts', 'attachAgentRunPendingApproval');
const approvalAttachment = readModuleProjectFunction('src/components/chat/agentRunController.ts', 'attachAgentPendingApproval');
const initialStage = readModuleProjectFunction('src/components/chat/agentRunController.ts', 'presentAgentRunPendingApproval');
const approvalStage = readModuleProjectFunction('src/components/chat/agentRunController.ts', 'presentAgentPendingApproval');
const creationStage = readModuleProjectFunction('src/components/chat/agentRunController.ts', 'createPendingApprovalStageMessage');
const initialReplyStage = readModuleProjectFunction('src/components/chat/agentRunController.ts', 'speakInitialAgentResultReply');
const approvalReplyStage = readModuleProjectFunction('src/components/chat/agentRunController.ts', 'speakApprovedAgentResultReply');
assert.match(creationStage, /createAgentApprovalMessage\(\{[\s\S]*agentRuntime,[\s\S]*command: pendingApproval\.command,[\s\S]*plan: pendingApproval\.plan/u);
assert.match(initialStage, /const approvalMessage = await createPendingApprovalStageMessage\(options\);[\s\S]*attachAgentRunPendingApproval\(messageId, approvalMessage\)/u);
assert.match(approvalStage, /const approvalMessage = await createPendingApprovalStageMessage\(options\);[\s\S]*attachAgentPendingApproval\(messageId, approvalMessage\)/u);

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
  /await presentAgentRunPendingApproval\(\{[\s\S]*agentRuntime: result\.continuation, pendingApproval: result\.pendingApproval,[\s\S]*initial: true/u,
  'Initial Agent Runtime approval should create the approval card from the pending approval command',
);

assert.match(
  initialRun,
  /await presentAgentRunPendingApproval\(\{[\s\S]*messageId: runMessageId/u,
  'Initial AgentSessionV2 approval should update the run message instead of appending a new chat bubble',
);
assert.match(initialAttachment, /if \(messageId\) \{[\s\S]*updateAgentRunMessage\(messageId,[\s\S]*mergeAgentApprovalMessageIntoExistingMessage\(message, approvalMessage\)[\s\S]*else \{[\s\S]*desktopPetChatStore\.addMessage\(approvalMessage\)/u);

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
  /return presentAgentPendingApproval\(\{[\s\S]*agentRuntime: sessionResult\.continuation, pendingApproval: sessionResult\.pendingApproval/u,
  'Follow-up approvals should create the approval card from the next pending approval command',
);

assert.match(
  approvalRun,
  /dispatchApprovedPendingPresentation\(\{[\s\S]*preparedRequest, messageId \}\);\s*if \(pendingPresentation\) await pendingPresentation;/u,
  'Follow-up approvals should replace the same approval message instead of appending another one',
);
assert.match(approvalAttachment, /updateAgentApprovalMessage\(messageId,[\s\S]*mergeAgentApprovalMessageIntoExistingMessage\(message, approvalMessage\)/u);
assert.doesNotMatch(approvalAttachment, /addMessage/u, 'approval continuation must reuse its message even when no update is possible');

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
  initialRun,
  /speakInitialAgentResultReply\(\{[\s\S]*messageId: runMessageId/u,
  'Initial AgentSessionV2 final reply should compact into the run message',
);
assert.match(initialReplyStage, /return speakGroupTaskProductionResult\(\{[\s\S]*compactReplyIntoMessageId: messageId/u);

assert.match(
  approvalRun,
  /speakApprovedAgentResultReply\(\{[\s\S]*preparedRequest, messageId,/u,
  'Approved AgentSessionV2 final reply should compact into the approval message',
);
assert.match(approvalReplyStage, /return speakGroupTaskProductionResult\(\{[\s\S]*compactReplyIntoMessageId: messageId/u);

console.log('agent single message approval chain smoke ok');
