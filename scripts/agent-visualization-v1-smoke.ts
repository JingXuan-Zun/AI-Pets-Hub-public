import { readMessageProjectSources as readProjectSources } from './chatMessageSource.mjs';
import assert from 'node:assert/strict';


const {
  chatTypesSource,
  controllerSource,
  messageBubbleSource,
} = readProjectSources({
  chatTypesSource: 'src/types.ts',
  controllerSource: 'src/components/chat/agentRunController.ts',
  messageBubbleSource: 'src/components/chat/PetChatConversationMessageBubble.tsx',
});

for (const stageId of [
  'understand-request',
  'plan-actions',
  'permission-check',
  'await-approval',
  'execute-tools',
  'verify-result',
  'decide-next-step',
  'persona-reply',
] as const) {
  assert.match(
    chatTypesSource,
    new RegExp(`'${stageId}'`, 'u'),
    `chat agent work stage ids should include ${stageId}`,
  );
}

assert.match(
  messageBubbleSource,
  /type ChatAgentProcessPanelSource = NonNullable<ChatMessage\['agentRun'\]> \| NonNullable<ChatMessage\['agentApproval'\]>;/u,
  'Agent process summary should accept both run and approval sources',
);

assert.match(
  messageBubbleSource,
  /function PetChatAgentProcessSummary\(/u,
  'chat message bubble should render a compact Agent process summary',
);

assert.match(
  messageBubbleSource,
  /处理过程/u,
  'Agent process summary should use user-facing Chinese copy',
);
assert.ok(!messageBubbleSource.includes('Agent V2 过程'));
assert.ok(!messageBubbleSource.includes('Agent 过程'));

assert.match(
  messageBubbleSource,
  /当前[\s\S]*currentStage\.title/u,
  'Agent process summary should expose the current visible stage',
);

assert.match(
  messageBubbleSource,
  /阶段 \{completedStageCount\}\/\{stages\.length\}/u,
  'Agent process summary should expose stage progress',
);

assert.match(
  messageBubbleSource,
  /工具[\s\S]*process\.plan\.steps\.length/u,
  'Agent process summary should expose planned tool count',
);

assert.match(
  messageBubbleSource,
  /权限[\s\S]*confirmStepCount/u,
  'Agent process summary should expose approval pressure',
);

assert.match(
  messageBubbleSource,
  /resolveAgentProcessCollapsedSummary\(run, statusText\)/u,
  'Agent run panel should create a compact collapsed summary',
);

assert.match(
  messageBubbleSource,
  /<PetChatAgentProcessCompact[\s\S]*process=\{run\}[\s\S]*summaryText=\{collapsedSummary\}/u,
  'Agent run panel should keep default process output in one compact timeline panel',
);

assert.match(
  messageBubbleSource,
  /\{shouldShowDetails \? <PetChatAgentProcessSummary process=\{run\} \/> : null\}/u,
  'Agent run panel should keep the process summary inside expanded details',
);

assert.match(
  messageBubbleSource,
  /resolveAgentApprovalCollapsedSummary\(approval, statusText\)/u,
  'Agent approval panel should create a compact collapsed summary',
);

assert.match(
  messageBubbleSource,
  /<PetChatAgentProcessCompact[\s\S]*process=\{approval\}[\s\S]*summaryText=\{collapsedSummary\}/u,
  'Agent approval panel should keep default process output in one compact timeline panel',
);

assert.match(
  messageBubbleSource,
  /\{shouldShowDetails \? <PetChatAgentProcessSummary process=\{approval\} \/> : null\}/u,
  'Agent approval panel should keep the process summary inside expanded details',
);

assert.match(
  messageBubbleSource,
  /const isActiveRun = run\?\.status === 'running' \|\| run\?\.status === 'planned' \|\| run\?\.status === 'awaiting-approval';/u,
  'Agent run panel should still know whether the run is active',
);

assert.match(
  messageBubbleSource,
  /const \[isExpanded, setIsExpanded\] = useState\(false\);[\s\S]*setIsExpanded\(false\);[\s\S]*run\?\.id/u,
  'Agent run details should default to collapsed and reset when a new run message appears',
);

assert.match(
  messageBubbleSource,
  /const isActiveApproval = approval\?\.status === 'pending' \|\| approval\?\.status === 'running' \|\| approval\?\.status === 'awaiting-approval';/u,
  'Agent approval panel should still know whether approval is active',
);

assert.match(
  messageBubbleSource,
  /setIsExpanded\(false\);[\s\S]*approval\?\.id/u,
  'Agent approval details should default to collapsed and reset when a new approval message appears',
);

for (const label of [
  '详细阶段',
  '执行事件',
  '执行轮次',
  '工具计划',
] as const) {
  assert.match(messageBubbleSource, new RegExp(label, 'u'), `Agent detail panel should include ${label}`);
}

assert.match(
  controllerSource,
  /function formatAgentPlanToolSummary\(/u,
  'Agent controller should build readable tool summaries for the process panel',
);

assert.match(
  controllerSource,
  /function formatAgentPlanPermissionDetails\(/u,
  'Agent controller should preserve permission reasons in workflow details',
);

assert.match(
  controllerSource,
  /summary: `goal: \$\{plan\.goal\}`/u,
  'understand-request stage should surface the resolved goal',
);

assert.match(
  controllerSource,
  /summary: `prepared \$\{toolStepCount\} action\(s\): \$\{formatAgentPlanToolSummary\(plan\)\}`/u,
  'plan-actions stage should surface planned actions instead of a bare count',
);

assert.match(
  controllerSource,
  /Waiting for user approval/u,
  'permission-check stage should explain approval waiting in user-facing text',
);

console.log('agent visualization v1 smoke ok');
