import assert from 'node:assert/strict';
import { readProjectSources } from './smokeTestHarness.ts';

const {
  sessionSource,
  registrySource,
  controllerSource,
  messageBubbleSource,
} = readProjectSources({
  sessionSource: 'src/agent/agentProductionSessionImplementation.ts',
  registrySource: 'src/agent/agentToolRegistry.ts',
  controllerSource: 'src/components/chat/agentRunController.ts',
  messageBubbleSource: 'src/components/chat/PetChatConversationMessageBubble.tsx',
});

assert.match(
  sessionSource,
  /Use one preflight, then one approval whenever possible/u,
  'AgentSessionV2 should prefer one read-only preflight followed by one permission approval',
);

assert.match(
  sessionSource,
  /Approval batching rule:[\s\S]*combine them into execute_desktop_sequence/u,
  'AgentSessionV2 should combine already-known approval-required primitives into execute_desktop_sequence',
);

assert.match(
  registrySource,
  /Prefer this whenever multiple approval-required primitives are already known/u,
  'execute_desktop_sequence registry guidance should advertise single-approval batching',
);

assert.match(
  controllerSource,
  /function parseAgentApprovalDesktopSequenceSteps\(/u,
  'Approval UI should parse execute_desktop_sequence steps for a grouped confirmation summary',
);

assert.match(
  controllerSource,
  /One approval will run \$\{sequenceSteps\.length\} desktop step\(s\) in order\./u,
  'Approval summary should tell the user a grouped sequence runs after one approval',
);

assert.match(
  controllerSource,
  /title: 'Confirm grouped desktop operation'/u,
  'Grouped desktop sequences should have a distinct approval card title',
);

assert.match(
  controllerSource,
  /parseAgentApprovalDesktopSequenceSteps\(command\)/u,
  'Grouped approval summary should still be derived from sequence steps, not Runtime Core metadata.',
);

assert.doesNotMatch(
  controllerSource,
  /runtimeCorePlanJson[\s\S]{0,240}Confirm grouped desktop operation/u,
  'Runtime Core metadata should not create an extra approval step or leak into the grouped approval summary.',
);

assert.match(
  messageBubbleSource,
  /const title = approval\.approvalSummary\?\.title\?\.trim\(\) \?\? '';/u,
  'Collapsed approval card should include the approval summary title',
);

assert.match(
  messageBubbleSource,
  /title && firstLine \? `\$\{title\}: \$\{firstLine\}` : firstLine/u,
  'Collapsed approval card should compact the grouped title and first line into one task card',
);

console.log('agent approval batching ux smoke ok');
