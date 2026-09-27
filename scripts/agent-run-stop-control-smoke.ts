import assert from 'node:assert/strict';
import fs from 'node:fs';
import type { AgentProductionSessionResult } from '../src/agent';
import type { ChatMessage } from '../src/types';
import { abortAgentRunController, registerAgentRunAbortController } from '../src/components/chat/agentRunAbortRegistry';
import { resolveAgentStopTarget } from '../src/components/chat/agentRunStopPolicy';
import {
  getAgentTaskRuntimeRunStatus,
  isAgentTaskRuntimeWaitingApproval,
  resolveAgentApprovalUiStatus,
} from '../src/components/chat/agentRuntimeUiStatusProjection';
import { ActiveGroupRuntimeRef } from '../src/components/chat/group/runtime/activeGroupRuntimeRef';
import { GroupChatRuntime } from '../src/components/chat/group/runtime/groupChatRuntime';

const abortController = new AbortController();
const unregister = registerAgentRunAbortController('agent-1', abortController);
assert.equal(abortAgentRunController('agent-1'), true);
assert.equal(abortController.signal.aborted, true);
assert.equal(abortAgentRunController('agent-1'), false);
unregister();

const messages = [
  { id: 'running', agentRun: { status: 'running' } },
  { id: 'completed', agentRun: { status: 'completed' } },
  { id: 'approval', agentApproval: { status: 'pending' } },
] as ChatMessage[];
assert.equal(resolveAgentStopTarget(messages)?.id, 'approval');
assert.equal(resolveAgentStopTarget(messages, 'completed')?.id, 'completed');
assert.equal(resolveAgentStopTarget(messages, 'missing'), null);

const waitingResult = {
  status: 'needs-approval',
  taskState: { state: 'waiting_approval' },
} as AgentProductionSessionResult;
assert.equal(isAgentTaskRuntimeWaitingApproval(waitingResult), true);
assert.equal(getAgentTaskRuntimeRunStatus(waitingResult), 'awaiting-approval');
assert.equal(resolveAgentApprovalUiStatus('awaiting-approval'), 'awaiting-approval');
assert.equal(resolveAgentApprovalUiStatus('blocked'), 'blocked');
assert.equal(getAgentTaskRuntimeRunStatus({
  status: 'max-steps',
  taskState: null,
} as AgentProductionSessionResult), 'failed');
assert.equal(getAgentTaskRuntimeRunStatus({
  status: 'cancelled',
  taskState: null,
} as AgentProductionSessionResult), 'blocked');

const activeGroupRef = new ActiveGroupRuntimeRef();
const groupRuntime = new GroupChatRuntime({
  activeRoleIds: ['alice'],
  groupSessionId: 'group-1',
  mode: 'single-round',
});
groupRuntime.beginPlanning();
activeGroupRef.set(groupRuntime);
const secondAbortController = new AbortController();
const unregisterSecond = registerAgentRunAbortController('agent-2', secondAbortController);
assert.equal(abortAgentRunController('agent-2'), true);
assert.equal(activeGroupRef.get(), groupRuntime);
assert.equal(groupRuntime.controller.getSnapshot().status, 'planning');
unregisterSecond();

const controllerSource = fs.readFileSync('src/components/chat/agentRunController.ts', 'utf8');
assert.doesNotMatch(controllerSource, /const activeAgentRunAbortControllers/);
assert.doesNotMatch(controllerSource, /function getAgentTaskRuntimeRunStatus\(/);
assert.match(controllerSource, /resolveAgentStopTarget\(messages, messageId\)/);

console.log('agent run stop control smoke ok');
