import assert from 'node:assert/strict';
import { readProjectSources } from './smokeTestHarness.ts';

const {
  agentCommandSource,
  chatTypesSource,
  controllerSource,
  messageBubbleSource,
  runtimeSource,
} = readProjectSources({
  agentCommandSource: 'src/agent/agentChatCommand.ts',
  chatTypesSource: 'src/types.ts',
  controllerSource: 'src/components/chat/agentRunController.ts',
  messageBubbleSource: 'src/components/chat/PetChatConversationMessageBubble.tsx',
  runtimeSource: 'src/agent/agentRuntimeSystemTools.ts',
});

assert.match(
  agentCommandSource,
  /export interface AgentChatExecutionReceipt[\s\S]*status: 'blocked' \| 'failed' \| 'success' \| 'unverified';[\s\S]*summaryLines: string\[\];[\s\S]*title: string;/u,
  'Agent command results should expose a structured execution receipt',
);

assert.match(
  agentCommandSource,
  /receipt\?: AgentChatExecutionReceipt \| null;/u,
  'Agent command results should carry an optional execution receipt',
);

assert.match(
  chatTypesSource,
  /export interface ChatAgentExecutionReceipt[\s\S]*evidenceLines\?: string\[\];[\s\S]*verification\?: string \| null;/u,
  'chat message types should persist receipt evidence and verification',
);

assert.match(
  chatTypesSource,
  /export interface ChatAgentApproval \{[\s\S]*receipt\?: ChatAgentExecutionReceipt \| null;/u,
  'Agent approval messages should persist execution receipts',
);

assert.match(
  chatTypesSource,
  /export interface ChatAgentRun \{[\s\S]*receipt\?: ChatAgentExecutionReceipt \| null;/u,
  'Agent run messages should persist execution receipts',
);

assert.match(
  controllerSource,
  /function createAgentExecutionReceipt\([\s\S]*result\.receipt[\s\S]*toolName: result\.receipt\.toolName \?\? command\.toolCall\?\.name \?\? command\.kind/u,
  'agent run controller should normalize tool receipts',
);

assert.equal(
  (controllerSource.match(/receipt: createAgentExecutionReceipt\(/gu) ?? []).length >= 3,
  true,
  'direct runs, approved runs, and exception paths should store execution receipts',
);

assert.match(
  controllerSource,
  /function createDeniedAgentExecutionReceipt\(/u,
  'denied approvals should store a blocked receipt instead of looking like a silent no-op',
);

assert.match(
  messageBubbleSource,
  /function PetChatAgentExecutionReceipt\(/u,
  'chat message bubble should render execution receipts',
);

assert.match(
  messageBubbleSource,
  /<PetChatAgentExecutionReceipt receipt=\{process\.receipt\} \/>/u,
  'Agent process summary should show the execution receipt',
);

assert.match(
  runtimeSource,
  /function createDisplayInfoReceipt\(/u,
  'display info tool should create a first-class receipt',
);

assert.match(
  runtimeSource,
  /receipt: createDisplayInfoReceipt\(displays\)/u,
  'display info handler should return its receipt with the tool result',
);

assert.match(
  runtimeSource,
  /function createSystemInfoReceipt\(/u,
  'system info tool should create a first-class receipt',
);

assert.match(
  runtimeSource,
  /receipt: createSystemInfoReceipt\(systemInfo, displays\)/u,
  'system info handler should return its receipt with the tool result',
);

console.log('agent execution receipt smoke ok');
