import assert from 'node:assert/strict';
import { readProjectSources } from './smokeTestHarness.ts';

const {
  controller: controllerSource,
  sender: senderSource,
} = readProjectSources({
  controller: 'src/components/chat/agentRunController.ts',
  sender: 'src/components/chat/usePetChatMessageSender.ts',
});

assert.match(
  senderSource,
  /followUpAction\?\.kind === 'run-command' && onAgentChatCommand[\s\S]*command: followUpAction\.command[\s\S]*await onAgentChatCommand\(followUpAction\.command\)[\s\S]*approvedToolResult/u,
  'run-command follow-up buttons should execute their bound command directly instead of re-planning from the label',
);

assert.match(
  controllerSource,
  /interface RunPreparedAgentSessionV2Options \{[\s\S]*approvedToolResult\?: AgentSessionV2ToolResultEntry \| null/u,
  'prepared AgentSessionV2 runs should accept a seeded follow-up tool result',
);

assert.match(
  controllerSource,
  /runV2: \(\) => runAgentSessionV2\(\{[\s\S]*approvedToolResult,[\s\S]*cancellationSignal/u,
  'seeded follow-up tool results should enter the normal AgentSessionV2 lifecycle',
);

console.log('agent follow-up action direct command smoke ok');
