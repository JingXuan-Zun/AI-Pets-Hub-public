import { readMessageProjectFile as readProjectFile } from './chatMessageSource.mjs';
import assert from 'node:assert/strict';


const controllerSource = readProjectFile('src/components/chat/agentRunController.ts');
const bubbleSource = readProjectFile('src/components/chat/PetChatConversationMessageBubble.tsx');

for (const helperName of [
  'createAgentProductionSessionInitialVisibleText',
  'createAgentProductionSessionResultVisibleText',
  'createAgentPendingApprovalVisibleText',
  'createAgentApprovalDeniedVisibleText',
  'createAgentApprovalAcceptedVisibleText',
  'createAgentApprovalContinuationVisibleText',
  'createAgentApprovalNextStepVisibleText',
  'createAgentApprovalFailureVisibleText',
] as const) {
  assert.match(
    controllerSource,
    new RegExp(`function ${helperName}\\(`, 'u'),
    `${helperName} should centralize visible Agent status copy`,
  );
}

for (const staleCopy of [
  'Agent operation failed:',
  'Agent action failed, so I stopped.',
  'Done.',
  'AgentSessionV2 has no local tool executor',
  'AgentSessionV2 completed without an additional tool result',
] as const) {
  assert.ok(
    !controllerSource.includes(staleCopy),
    `visible Agent status copy should not use stale system text: ${staleCopy}`,
  );
}

assert.match(controllerSource, /我先看清楚/u);
assert.match(controllerSource, /确认后会直接操作电脑/u);
assert.match(controllerSource, /好，这次我不动/u);
assert.match(controllerSource, /好，我继续/u);
assert.match(controllerSource, /这一段有结果了/u);

assert.match(
  bubbleSource,
  /\{run\.plan\.goal\}/u,
  'run card should render the human-facing task goal',
);
assert.match(
  bubbleSource,
  /\{approval\.plan\.goal\}/u,
  'approval card should render the human-facing confirmation goal',
);
assert.ok(!bubbleSource.includes('Agent: {run.plan.goal}'));
assert.ok(!bubbleSource.includes('Agent: {approval.plan.goal}'));
assert.ok(!bubbleSource.includes('AgentSessionV2 process'));
assert.match(bubbleSource, /title=\{isExpanded \?/u);

console.log('agent visible status copy smoke ok');
