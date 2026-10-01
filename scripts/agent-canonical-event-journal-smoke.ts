import assert from 'node:assert/strict';
import {
  AgentCanonicalEventJournal,
} from '../src/agent/runtime/agentCanonicalEventJournal.ts';
import {
  createAgentToolOutcomeContract,
} from '../src/agent/runtime/agentToolOutcomeContract.ts';

const journal = new AgentCanonicalEventJournal();
const taskId = 'task-smoke';
const runId = 'run-smoke';

journal.append({ runId, taskId, type: 'task_started', timestamp: 10 });
journal.append({
  payload: {
    outcome: createAgentToolOutcomeContract({
      effect: 'uncertain',
      execution: 'executed',
      nonIdempotentSideEffect: true,
      verification: 'unknown',
    }),
    tool: 'desktop-action',
  },
  runId,
  taskId,
  type: 'tool_resulted',
  timestamp: 20,
});

const projection = journal.projectTask(taskId);
assert.equal(projection.revision, 2);
assert.equal(projection.latestOutcome?.retryPolicy, 'halt');
assert.equal(projection.state, 'active');
assert.deepEqual(journal.listTaskEvents(taskId).map((event) => event.revision), [1, 2]);

journal.append({ runId, taskId, type: 'task_completed', timestamp: 30 });
assert.equal(journal.projectTask(taskId).state, 'succeeded');
assert.equal(journal.projectTask(taskId).phase, 'terminal');

const approvalTaskId = 'task-approval-smoke';
journal.append({ runId, taskId: approvalTaskId, type: 'task_started', timestamp: 40 });
journal.append({ runId, taskId: approvalTaskId, type: 'approval_requested', timestamp: 50 });
assert.equal(journal.projectTask(approvalTaskId).state, 'waiting_approval');
journal.append({ runId, taskId: approvalTaskId, type: 'approval_granted', timestamp: 60 });
assert.equal(journal.projectTask(approvalTaskId).state, 'active');

const beforeRejectedBatch = journal.snapshot().length;
assert.throws(() => journal.appendBatch([
  { runId, taskId: 'task-batch', type: 'task_started', timestamp: 70 },
  { runId, taskId: 'task-batch', type: 'tool_resulted', timestamp: 80 },
]));
assert.equal(journal.snapshot().length, beforeRejectedBatch);

const isolated = new AgentCanonicalEventJournal();
const inputPayload = {
  outcome: createAgentToolOutcomeContract({ execution: 'executed', effect: 'changed', verification: 'satisfied' }),
  nested: { values: ['original'] },
};
const appended = isolated.append({ runId, taskId, type: 'tool_resulted', payload: inputPayload });
inputPayload.nested.values[0] = 'input mutation';
(appended.payload.nested as typeof inputPayload.nested).values[0] = 'append mutation';
const snapshot = isolated.snapshot();
(snapshot[0].payload.outcome as typeof inputPayload.outcome).classification = 'failure';
isolated.projectTask(taskId).latestOutcome!.classification = 'failure';
assert.equal(isolated.projectTask(taskId).latestOutcome?.classification, 'success');
assert.deepEqual(isolated.snapshot()[0].payload.nested, { values: ['original'] });
const batch = isolated.appendBatch([{ runId, taskId, type: 'checkpoint', payload: inputPayload }]);
(batch[0].payload.nested as typeof inputPayload.nested).values[0] = 'batch mutation';
assert.deepEqual(isolated.snapshot()[1].payload.nested, { values: ['input mutation'] });

console.log('agent canonical event journal smoke ok');
