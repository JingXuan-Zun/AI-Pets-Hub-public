import assert from 'node:assert/strict';

import {
  createAgentRuntimeEvidenceEnvelope,
  createAgentRuntimeOperationSurface,
  createAgentRuntimeRunId,
  isAgentRuntimeTargetBindingCurrent,
} from '../src/agent/runtime/agentRuntimeTaskContract';
import {
  transitionAgentTaskRuntimeState,
} from '../src/agent/runtime/agentTaskRuntime';

const surface = createAgentRuntimeOperationSurface({
  capabilities: {
    desktopInput: true,
    uia: true,
    windowCapture: true,
  },
  generation: 2,
  owner: { hwnd: 42, pid: 7, processName: 'example-app', windowTitle: 'Example App' },
  now: 100,
  presence: 'present_interactable',
});
assert.equal(surface.profile, 'unknown');
assert.equal(surface.presence, 'present_interactable');
assert.equal(surface.generation, 2);
assert.equal(surface.capabilities.uia, true);
assert.match(surface.surfaceId, /^surface-100-/u);

const taskId = 'task-contract-smoke';
const evidence = createAgentRuntimeEvidenceEnvelope({
  capturedAt: 110,
  kind: 'window',
  payload: { title: 'Example App' },
  sourceId: 'observe_windows_and_apps',
  surface,
  taskId,
});
assert.equal(evidence.taskId, taskId);
assert.equal(evidence.surfaceId, surface.surfaceId);
assert.equal(evidence.surfaceGeneration, 2);
assert.match(evidence.evidenceId, /^evidence-110-/u);

const first = transitionAgentTaskRuntimeState({
  event: { phase: 'observing', type: 'progress' },
  now: 100,
  sourceText: 'open an application',
  userGoal: 'Open an application',
});
const second = transitionAgentTaskRuntimeState({
  event: { phase: 'resolving_target', type: 'progress' },
  now: 120,
  previous: first,
  sourceText: first.sourceText,
  userGoal: first.userGoal,
});
assert.match(first.runId, new RegExp(`^${createAgentRuntimeRunId(first.sourceText, 100)}-\\d+$`, 'u'));
assert.equal(second.runId, first.runId);
assert.equal(second.revision, first.revision + 1);

const sameMillisecondTask = transitionAgentTaskRuntimeState({
  event: { phase: 'observing', type: 'progress' },
  now: 100,
  sourceText: 'open an application',
  userGoal: 'Open an application',
});
assert.notEqual(sameMillisecondTask.runId, first.runId, 'same-time identical tasks must receive different run identities');
assert.notEqual(sameMillisecondTask.taskId, first.taskId, 'same-time identical tasks must receive different task identities');
assert.equal(isAgentRuntimeTargetBindingCurrent({
  surface,
  target: {
    surfaceGeneration: surface.generation,
    surfaceId: surface.surfaceId,
  },
}), true);
assert.equal(isAgentRuntimeTargetBindingCurrent({
  surface: { ...surface, generation: surface.generation + 1 },
  target: {
    surfaceGeneration: surface.generation,
    surfaceId: surface.surfaceId,
  },
}), false);

console.log('agent runtime task contract smoke passed');
