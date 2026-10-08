import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PetChatAgentSessionV2TracePanel } from '../src/components/chat/message/AgentMessageTracePanel.tsx';
import { createAgentSessionV2TraceDebugSummary } from '../src/components/chat/message/agentMessageDebugSummary.ts';
import { type ChatAgentSessionV2Process } from '../src/components/chat/message/agentMessageTypes.ts';
import { transitionAgentTaskRuntimeState } from '../src/agent/runtime/agentTaskRuntime.ts';

const initial = transitionAgentTaskRuntimeState({
  event: { type: 'progress', phase: 'planning' },
  now: 1000,
  sourceText: 'PRIVATE_SOURCE_DO_NOT_EXPORT',
  userGoal: 'PRIVATE_GOAL_DO_NOT_EXPORT',
});
const session: ChatAgentSessionV2Process = {
  historyLines: [],
  sourceText: initial.sourceText,
  userGoal: initial.userGoal,
  steps: [],
  toolResults: [],
  traceEvents: [],
  taskState: {
    ...initial,
    taskId: 'task-current',
    runId: 'run-current',
    revision: 7,
    state: 'waiting_approval',
    phase: 'approval',
    modelIterationCount: 3,
    modelIterationLimit: 8,
    recoveryAttemptCount: 1,
    recoveryLimit: 3,
    updatedAt: 2000,
  },
};
const before = structuredClone(session);
const summary = createAgentSessionV2TraceDebugSummary(session, []);
for (const line of [
  'Task Runtime:', 'taskId=task-current', 'runId=run-current', 'revision=7',
  'state=waiting_approval', 'phase=approval', 'modelIterationCount=3',
  'modelIterationLimit=8', 'recoveryAttemptCount=1', 'recoveryLimit=3',
  'startedAt=1000', 'updatedAt=2000',
]) {
  assert.ok(summary.split('\n').includes(line), `Missing task evidence: ${line}`);
}
assert.deepEqual(session, before, 'Copying diagnostics must not mutate runtime state.');
assert.ok(!summary.includes('PRIVATE_'), 'Task evidence must not serialize the private request or goal.');

const resumed = createAgentSessionV2TraceDebugSummary({
  ...session,
  taskState: { ...session.taskState!, revision: 8, state: 'active', phase: 'verifying_outcome' },
}, []);
assert.ok(resumed.includes('taskId=task-current\n'));
assert.ok(resumed.includes('revision=8\n'));
assert.ok(resumed.includes('phase=verifying_outcome\n'));
assert.ok(!resumed.includes('revision=7\n'), 'A new snapshot must reflect the current state.');

for (const taskState of [null, undefined]) {
  const historical = createAgentSessionV2TraceDebugSummary({ ...session, taskState }, []);
  assert.ok(historical.includes('Task Runtime:\nunavailable'));
  assert.ok(!historical.includes('taskId=task-current'));
}
const taskOnlyMarkup = renderToStaticMarkup(createElement(PetChatAgentSessionV2TracePanel, { session }));
assert.ok(taskOnlyMarkup.includes('Copy trace debug summary'), 'Task-only records must expose the copy button.');
const emptyMarkup = renderToStaticMarkup(createElement(PetChatAgentSessionV2TracePanel, {
  session: { ...session, taskState: null },
}));
assert.equal(emptyMarkup, '', 'Empty historical records should not render a diagnostic panel.');
const traceOnlyMarkup = renderToStaticMarkup(createElement(PetChatAgentSessionV2TracePanel, {
  session: {
    ...session,
    taskState: null,
    traceEvents: [{
      id: 'event-one', type: 'final_answer', stepIndex: 1, timestamp: 2000, summary: 'Done',
    }],
  },
}));
assert.ok(traceOnlyMarkup.includes('Copy trace debug summary'), 'Historical traces without taskState remain copyable.');
const diagnosticOnlyMarkup = renderToStaticMarkup(createElement(PetChatAgentSessionV2TracePanel, {
  session: {
    ...session,
    taskState: null,
    diagnostics: [{
      authority: 'diagnostic-only', category: 'runtime-shadow', source: 'test', timestamp: 2000,
      payload: { summary: 'Diagnostic only' },
    }],
  },
}));
assert.ok(diagnosticOnlyMarkup.includes('Copy trace debug summary'), 'Standalone runtime diagnosis remains copyable.');
assert.deepEqual(session, before, 'Rendering the trace panel must not mutate task state.');
console.log('Agent trace task-state summary smoke passed.');
