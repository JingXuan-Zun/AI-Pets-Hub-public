import assert from 'node:assert/strict';

import {
  advanceAgentTaskRuntimeProgress,
  commitAgentTaskRuntimeState,
} from '../src/agent/runtime/agentTaskRuntime';
import { findLatestAgentRuntimeDiagnostic } from '../src/agent/runtime/agentRuntimeDiagnostics';
import type {
  AgentRuntimeProgressEvent,
  AgentRuntimeResult,
} from '../src/agent/runtime/agentRuntimeContract';

const baseContinuation = {
  diagnostics: null,
  historyLines: [],
  sourceText: 'open an application',
  steps: [],
  taskState: null,
  traceEvents: [],
  toolResults: [],
  userGoal: 'Open an application',
};

const progressEvent: AgentRuntimeProgressEvent = {
  continuation: baseContinuation,
  message: 'observing',
  stepIndex: 0,
  taskPhase: 'observing',
  type: 'tools-running',
};

const progressed = advanceAgentTaskRuntimeProgress({
  event: progressEvent,
  now: 100,
});
const progressDiagnostic = findLatestAgentRuntimeDiagnostic(
  progressed.event.continuation.diagnostics,
  'task-runtime',
);
assert.equal(progressed.taskState.owner, 'task-runtime');
assert.equal(progressDiagnostic?.source, 'task-runtime-state');
assert.equal(progressDiagnostic?.payload.status, 'active');
assert.equal(progressDiagnostic?.payload.details?.revision, 1);

const result: AgentRuntimeResult = {
  continuation: {
    ...baseContinuation,
    taskState: progressed.taskState,
  },
  diagnostics: [{
    authority: 'diagnostic-only',
    category: 'runtime-shadow',
    payload: { details: null, status: 'comparison', summary: 'Shadow remains diagnostic-only.', tool: null },
    source: 'v4-shadow',
    timestamp: 100,
  }],
  finalAnswer: 'Waiting for approval.',
  sourceText: baseContinuation.sourceText,
  status: 'needs-approval',
  steps: [],
  taskState: progressed.taskState,
  traceEvents: [],
  toolResults: [],
};

const committed = commitAgentTaskRuntimeState(result, 200, progressed.taskState);
const committedStateDiagnostic = findLatestAgentRuntimeDiagnostic(
  committed.diagnostics,
  'task-runtime',
);
assert.equal(committed.taskState?.state, 'waiting_approval');
assert.equal(committed.taskState?.phase, 'approval');
assert.equal(committedStateDiagnostic?.payload.status, 'waiting_approval');
assert.equal(committedStateDiagnostic?.payload.details?.revision, 2);
assert.equal(findLatestAgentRuntimeDiagnostic(committed.diagnostics, 'runtime-shadow')?.source, 'v4-shadow');
assert.equal(committed.continuation.diagnostics, committed.diagnostics);

console.log('agent task runtime diagnostic projection smoke passed');
