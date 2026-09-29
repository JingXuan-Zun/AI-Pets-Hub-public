import assert from 'node:assert/strict';
import fs from 'node:fs';
import type { AgentRuntimeProgressEvent } from '../src/agent';
import type { ChatMessage } from '../src/types';
import { projectAgentProgressMessage } from '../src/components/chat/agentProgressMessageProjection';

const event = {
  type: 'model-thinking',
  continuation: { steps: [], toolResults: [] },
} as AgentRuntimeProgressEvent;
const runningMessage = {
  id: 'run-1',
  role: 'model',
  text: 'Old',
  agentRun: { status: 'running' },
} as ChatMessage;
const projected = projectAgentProgressMessage({
  event,
  message: runningMessage,
  visibleText: 'Thinking',
});
assert.equal(projected.text, 'Thinking');
assert.equal(projected.agentRun?.status, 'running');
assert.equal(projected.agentRun?.agentRuntime, event.continuation);

const completedMessage = {
  ...runningMessage,
  agentRun: { ...runningMessage.agentRun!, status: 'completed' as const },
};
assert.equal(projectAgentProgressMessage({
  event,
  message: completedMessage,
  visibleText: 'Must not replace',
}), completedMessage);

const controllerSource = fs.readFileSync('src/components/chat/agentRunController.ts', 'utf8');
assert.doesNotMatch(controllerSource, /function isStoppableAgentRunStatus\(/);
assert.match(controllerSource, /updateAgentProgressMessage\(/);

console.log('agent progress message projection smoke ok');
