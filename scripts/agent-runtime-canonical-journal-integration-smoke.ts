import assert from 'node:assert/strict';
import {
  AgentCanonicalEventJournal,
} from '../src/agent/runtime/agentCanonicalEventJournal.ts';
import {
  runAgentRuntime,
} from '../src/agent/runtime/agentRuntime.ts';
import {
  clearAgentCanonicalEventJournalRegistry,
  getAgentCanonicalEventJournal,
  getOrCreateAgentCanonicalEventJournal,
  releaseAgentCanonicalEventJournal,
} from '../src/agent/runtime/agentCanonicalEventJournalRegistry.ts';
import type {
  AgentRuntimeAdapter,
  AgentRuntimeRunResult,
  AgentRuntimeResult,
} from '../src/agent/runtime/agentRuntimeContract.ts';

const journal = new AgentCanonicalEventJournal();
const continuation = {
  historyLines: [],
  sourceText: 'journal integration',
  steps: [],
  traceEvents: [],
  toolResults: [],
  userGoal: 'record task lifecycle',
};
const adapter: AgentRuntimeAdapter<AgentRuntimeResult> = {
  id: 'journal-integration-smoke',
  async run(context) {
    assert.ok(context?.canonicalEventJournal === journal);
    const result: AgentRuntimeResult = {
      continuation,
      finalAnswer: 'done',
      sourceText: continuation.sourceText,
      status: 'completed',
      steps: [],
      traceEvents: [],
      toolResults: [],
    };
    return { implementation: 'stable', reason: 'smoke', result } satisfies AgentRuntimeRunResult<AgentRuntimeResult>;
  },
};

const run = await runAgentRuntime({
  adapter,
  canonicalEventJournal: journal,
  taskIdentity: { sourceText: continuation.sourceText, userGoal: continuation.userGoal },
});
assert.equal(run.result?.status, 'completed');
const events = journal.snapshot();
assert.deepEqual(events.map((event) => event.type), ['task_started', 'task_completed']);
assert.equal(events[0]?.taskId, events[1]?.taskId);
assert.equal(events[0]?.runId, events[1]?.runId);
assert.equal(journal.projectTask(events[0]?.taskId ?? '').state, 'succeeded');

const approvalJournal = new AgentCanonicalEventJournal();
const approvalAdapter: AgentRuntimeAdapter<AgentRuntimeResult> = {
  id: 'journal-approval-smoke',
  async run() {
    return {
      implementation: 'stable',
      reason: 'smoke',
      result: {
        continuation,
        finalAnswer: 'approval required',
        pendingApproval: null,
        sourceText: continuation.sourceText,
        status: 'needs-approval',
        steps: [],
        traceEvents: [],
        toolResults: [],
      },
    };
  },
};
await runAgentRuntime({
  adapter: approvalAdapter,
  canonicalEventJournal: approvalJournal,
  taskIdentity: { sourceText: continuation.sourceText, userGoal: continuation.userGoal },
});
assert.deepEqual(approvalJournal.snapshot().map((event) => event.type), [
  'task_started',
  'approval_requested',
]);
assert.equal(approvalJournal.projectTask(approvalJournal.snapshot()[0]?.taskId ?? '').state, 'waiting_approval');

clearAgentCanonicalEventJournalRegistry();
const scopedJournal = getOrCreateAgentCanonicalEventJournal('message-1');
assert.equal(getOrCreateAgentCanonicalEventJournal('message-1'), scopedJournal);
assert.equal(getAgentCanonicalEventJournal('message-1'), scopedJournal);
releaseAgentCanonicalEventJournal('message-1');
assert.equal(getAgentCanonicalEventJournal('message-1'), null);
assert.notEqual(getOrCreateAgentCanonicalEventJournal('message-1'), scopedJournal);

console.log('agent runtime canonical journal integration smoke ok');
