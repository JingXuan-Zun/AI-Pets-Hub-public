import assert from 'node:assert/strict';
import { readProjectSources } from './smokeTestHarness.ts';

const { controllerSource, coreSource, messageBubbleSource } = readProjectSources({
  controllerSource: 'src/components/chat/agentRunController.ts',
  coreSource: 'src/agent/agentCore.ts',
  messageBubbleSource: 'src/components/chat/PetChatConversationMessageBubble.tsx',
});
const appendRunLoopSummaryFunction = coreSource.match(
  /function appendAgentRunLoopSummary\([\s\S]*?\n\}/u,
)?.[0] ?? '';

assert.match(
  appendRunLoopSummaryFunction,
  /return result;/u,
  'Agent run loop rounds should stay in structured UI state instead of being appended to responseText',
);

assert.doesNotMatch(
  appendRunLoopSummaryFunction,
  /responseText|summary/u,
  'Agent visible responseText should not be rebuilt by appending run-loop summaries',
);

assert.match(
  controllerSource,
  /stripAgentRunLoopSummaryFromText\(/u,
  'Agent persona prompt should sanitize legacy run-loop blocks before asking the character to reply',
);

assert.ok(
  controllerSource.includes('stripAgentRunLoopSummaryFromText'),
  'Agent persona prompt should explicitly sanitize long tool-loop text before character reply',
);

assert.match(
  controllerSource,
  /text: createAgentFallbackVisibleReply\(result\)/u,
  'Agent fallback model messages should use compact visible text',
);

assert.match(
  messageBubbleSource,
  /function resolveAgentProcessCollapsedSummary\(/u,
  'Agent message bubble should have a compact collapsed summary resolver',
);

assert.match(
  messageBubbleSource,
  /function PetChatAgentCompactTimeline\(/u,
  'Agent collapsed state should expose a short recent-step timeline',
);

assert.match(
  messageBubbleSource,
  /const \[isExpanded, setIsExpanded\] = useState\(false\);/u,
  'Agent details should default to collapsed',
);

assert.match(
  messageBubbleSource,
  /\{!shouldShowDetails \? \([\s\S]*<PetChatAgentProcessCompact[\s\S]*process=\{run\}[\s\S]*summaryText=\{collapsedSummary\}/u,
  'Agent run collapsed state should show one compact process panel with the current summary',
);

assert.match(
  messageBubbleSource,
  /\{!shouldShowDetails \? \([\s\S]*<PetChatAgentProcessCompact[\s\S]*process=\{approval\}[\s\S]*summaryText=\{collapsedSummary\}/u,
  'Agent approval collapsed state should show one compact process panel with the current summary',
);

assert.match(
  messageBubbleSource,
  /\{!shouldShowDetails \? \([\s\S]*<PetChatAgentProcessCompact[\s\S]*process=\{run\}/u,
  'Agent run collapsed state should use the compact process panel instead of appending extra messages',
);

assert.match(
  messageBubbleSource,
  /\{!shouldShowDetails \? \([\s\S]*<PetChatAgentProcessCompact[\s\S]*process=\{approval\}/u,
  'Agent approval collapsed state should use the compact process panel instead of appending extra messages',
);

assert.match(
  messageBubbleSource,
  /\{shouldShowDetails \? <PetChatAgentProcessSummary process=\{run\} \/> : null\}/u,
  'Agent run process details should render only after expansion',
);

assert.match(
  messageBubbleSource,
  /\{shouldShowDetails \? <PetChatAgentApprovalSummary summary=\{approval\.approvalSummary\} \/> : null\}/u,
  'Agent approval summary should render only after expansion',
);

console.log('agent compact chat ux smoke ok');
