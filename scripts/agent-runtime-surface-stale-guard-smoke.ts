import assert from 'node:assert/strict';

import {
  buildAgentPermissionRoute,
  createAgentRuntimeOperationSurface,
  createAgentTaskRuntimeStateRecord,
  runAgentCommandExecution,
  runAgentTaskScopedApprovalContinuations,
  type AgentChatCommand,
  type AgentRuntimeResult,
} from '../src/agent/index.ts';

const sourceText = '/agent click the selected control';
const userGoal = 'Click the selected control';

function clickCommand(): AgentChatCommand {
  return {
    capabilityId: 'desktop-input',
    instruction: userGoal,
    kind: 'tool-call',
    sourceText,
    toolCall: {
      goal: userGoal,
      input: { action: 'click', x: 320, y: 240 },
      name: 'execute_desktop_input',
    },
  };
}

const currentSurface = createAgentRuntimeOperationSurface({
  generation: 3,
  owner: { hwnd: 101, pid: 202, processName: 'example-app.exe', windowTitle: 'Example App' },
  surfaceId: 'surface-example-101',
});
const staleSurface = createAgentRuntimeOperationSurface({
  generation: 2,
  owner: { hwnd: 100, pid: 201, processName: 'example-app.exe', windowTitle: 'Example App' },
  surfaceId: 'surface-example-100',
});

function taskState(surface = currentSurface) {
  const base = createAgentTaskRuntimeStateRecord({
    now: 1000,
    sourceText,
    status: 'needs-approval',
    userGoal,
  });
  return {
    ...base,
    runId: 'run-example',
    taskId: 'task-example',
    surface,
    targetBinding: {
      confidence: 'high' as const,
      evidenceRefs: ['evidence-target'],
      label: 'Selected control',
      surfaceGeneration: currentSurface.generation,
      surfaceId: currentSurface.surfaceId,
    },
  };
}

const command = clickCommand();
let dispatchCount = 0;
const staleExecution = await runAgentCommandExecution({
  appendTraceEvent: () => undefined,
  approvalReason: () => 'Approval required.',
  command,
  executeCommand: async () => {
    dispatchCount += 1;
    return { ok: true, responseText: 'unexpected' };
  },
  getTimingDetail: () => 'surface-stale-guard-smoke',
  isCancellationRequested: () => false,
  resolveTimingStatus: () => 'success',
  stepIndex: 1,
  taskState: taskState(staleSurface),
  timingTracker: {
    beginEntry: () => ({ id: 'timing', kind: 'tool', label: 'test', startedAt: 1, status: 'running', stepIndex: 1 }),
    finishEntry: (entry: any) => ({ ...entry, endedAt: 2, durationMs: 1, status: 'success' }),
    getBudgetStopReason: () => null,
    getMarkedStopReason: () => null,
    markStopReason: () => undefined,
  },
});
assert.equal(staleExecution.kind, 'target-stale');
assert.equal(dispatchCount, 0);

const currentExecution = await runAgentCommandExecution({
  appendTraceEvent: () => undefined,
  approvalReason: () => 'Approval required.',
  command,
  executeCommand: async () => {
    dispatchCount += 1;
    return { ok: true, responseText: 'unexpected before approval' };
  },
  getTimingDetail: () => 'surface-current-guard-smoke',
  isCancellationRequested: () => false,
  resolveTimingStatus: () => 'success',
  stepIndex: 1,
  taskState: taskState(),
  timingTracker: {
    beginEntry: () => ({ id: 'timing', kind: 'tool', label: 'test', startedAt: 1, status: 'running', stepIndex: 1 }),
    finishEntry: (entry: any) => ({ ...entry, endedAt: 2, durationMs: 1, status: 'success' }),
    getBudgetStopReason: () => null,
    getMarkedStopReason: () => null,
    markStopReason: () => undefined,
  },
});
assert.equal(currentExecution.kind, 'approval-required');
if (currentExecution.kind === 'approval-required') {
  assert.equal(currentExecution.approval.surfaceId, currentSurface.surfaceId);
  assert.equal(currentExecution.approval.surfaceGeneration, currentSurface.generation);
  assert.equal(currentExecution.approval.taskId, 'task-example');
  assert.equal(currentExecution.approval.runId, 'run-example');
}

const route = buildAgentPermissionRoute(command);
assert.ok(route.plan);
const staleApproval = {
  command,
  plan: route.plan,
  reason: 'Approval required.',
  routeSummary: route.summary,
  runId: 'run-example',
  taskId: 'task-example',
  surfaceId: staleSurface.surfaceId,
  surfaceGeneration: staleSurface.generation,
};
const initialResult: AgentRuntimeResult = {
  continuation: {
    historyLines: [],
    sourceText,
    steps: [],
    taskState: taskState(currentSurface),
    traceEvents: [],
    toolResults: [],
    userGoal,
  },
  finalAnswer: 'approval',
  pendingApproval: staleApproval,
  sourceText,
  status: 'needs-approval',
  steps: [],
  taskState: taskState(currentSurface),
  traceEvents: [],
  toolResults: [],
};
let continuationDispatchCount = 0;
const continuation = await runAgentTaskScopedApprovalContinuations({
  approvedCommand: {
    ...command,
    toolCall: { ...command.toolCall!, input: { action: 'focus_window', hwnd: 101 }, name: 'execute_desktop_action' },
  },
  approvedPlan: route.plan,
  createSkippedResult: () => ({ ok: true, responseText: 'skipped' }),
  execute: async () => {
    continuationDispatchCount += 1;
    return { ok: true, responseText: 'must not execute' };
  },
  initialResult,
  resume: async () => initialResult,
});
assert.equal(continuationDispatchCount, 0);
assert.equal(continuation.outcome.kind, 'stale-context');
assert.equal(continuation.outcome.reason, 'approval-stale-surface');

console.log('agent runtime surface stale guard smoke ok');
