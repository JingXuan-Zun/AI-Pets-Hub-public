import { readMessageProjectFile as readProjectFile } from './chatMessageSource.mjs';
import assert from 'node:assert/strict';


const messageBubbleSource = readProjectFile('src/components/chat/PetChatConversationMessageBubble.tsx');
const typesSource = readProjectFile('src/types.ts');

assert.match(
  messageBubbleSource,
  /function PetChatAgentProcessCompact\(/u,
  'Agent message bubble should keep a reusable compact process panel for collapsed diagnostics',
);

assert.match(
  messageBubbleSource,
  /function resolveAgentProcessCompactTimeline\(/u,
  'compact process panel should derive a recent-step timeline',
);

assert.match(
  messageBubbleSource,
  /function PetChatAgentCompactTimeline\(/u,
  'compact process panel should render recent Agent progress without expanding details',
);

assert.match(
  messageBubbleSource,
  /resolveAgentProcessStageProgress\(process\.stages\)/u,
  'compact process panel should calculate stage progress',
);

assert.match(
  messageBubbleSource,
  /style=\{\{ width: `\$\{Math\.max\(6, progress\.percent\)\}%` \}\}/u,
  'compact process panel should render a stable progress bar',
);

assert.match(
  messageBubbleSource,
  /\{process\.plan\.steps\.length\}\s*个工具步骤/u,
  'compact process panel should show planned tool step count',
);

assert.match(
  messageBubbleSource,
  /\{evidenceCount\}\s*条状态证据/u,
  'compact process panel should show structured state evidence count',
);

assert.match(
  messageBubbleSource,
  /\{!shouldShowDetails \? \([\s\S]*<PetChatAgentProcessCompact[\s\S]*process=\{run\}[\s\S]*statusText=\{statusText\}[\s\S]*isActive=\{isActiveRun\}[\s\S]*summaryText=\{collapsedSummary\}/u,
  'Agent run panel should show compact process status while details are collapsed',
);

assert.match(
  messageBubbleSource,
  /\{!shouldShowDetails \? \([\s\S]*<PetChatAgentProcessCompact[\s\S]*process=\{approval\}[\s\S]*statusText=\{statusText\}[\s\S]*isActive=\{isActiveApproval\}[\s\S]*summaryText=\{collapsedSummary\}/u,
  'Agent approval panel should show compact process status while details are collapsed',
);

assert.match(
  messageBubbleSource,
  /function PetChatAgentStateSummaryPanel\(/u,
  'Agent details should render a state summary panel',
);

for (const label of ['观察', 'Structured', '变更', '验证', '缺失', '恢复'] as const) {
  assert.match(
    messageBubbleSource,
    new RegExp(`label: '${label}'`, 'u'),
    `state summary panel should include ${label}`,
  );
}

assert.match(
  messageBubbleSource,
  /<PetChatAgentStateSummaryPanel stateSummary=\{stateSummary\} \/>/u,
  'Agent process summary should show standardized state evidence inside expanded details',
);

assert.match(
  messageBubbleSource,
  /resolveAgentProcessStateSummary\(process\)/u,
  'Agent process summary should use receipt/context state summary as its evidence source',
);

assert.match(
  typesSource,
  /stateSummary\?: AgentToolStateSummary \| null;/u,
  'chat Agent state should persist standardized state summary data for the UI',
);

console.log('agent process panel v1.8 smoke ok');
