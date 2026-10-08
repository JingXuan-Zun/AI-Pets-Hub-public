import assert from 'node:assert/strict';
import { createAgentRuntimeCancelledResult, isAgentRuntimeCancellationRequested, runCancellableAgentRuntimeTask } from '../src/agent/agentRuntimeCancellation.ts';
import * as visualCancellation from '../src/agent/visual/visualTaskCancellation.ts';
import type { AgentRuntimeExecutorContext } from '../src/agent/agentRuntimeExecutor.ts';

function context(signal?: AbortSignal): AgentRuntimeExecutorContext {
  return { signal } as AgentRuntimeExecutorContext;
}
function trackedController() {
  const controller = new AbortController();
  const counts = { added: 0, removed: 0 };
  const add = controller.signal.addEventListener.bind(controller.signal);
  const remove = controller.signal.removeEventListener.bind(controller.signal);
  controller.signal.addEventListener = (...args) => { counts.added++; add(...args); };
  controller.signal.removeEventListener = (...args) => { counts.removed++; remove(...args); };
  return { controller, counts };
}

assert.equal(visualCancellation.runCancellableAgentRuntimeTask, runCancellableAgentRuntimeTask);
assert.equal(visualCancellation.createAgentRuntimeCancelledResult, createAgentRuntimeCancelledResult);
assert.equal(visualCancellation.isAgentRuntimeCancellationRequested, isAgentRuntimeCancellationRequested);
const alreadyCancelled = new AbortController();
alreadyCancelled.abort();
let started = false;
const beforeStart = await runCancellableAgentRuntimeTask(context(alreadyCancelled.signal), 'control_browser', async () => { started = true; return 1; });
assert.equal(started, false);
assert.deepEqual(beforeStart, { cancelled: true, result: createAgentRuntimeCancelledResult('control_browser') });
assert.deepEqual(await runCancellableAgentRuntimeTask(context(), 'observe_windows_and_apps', Promise.resolve(42)), { cancelled: false, value: 42 });

const success = trackedController();
assert.deepEqual(await runCancellableAgentRuntimeTask(context(success.controller.signal), 'control_browser', async () => 'done'), { cancelled: false, value: 'done' });
assert.deepEqual(success.counts, { added: 1, removed: 1 });

const duringRun = trackedController();
let completeLate!: (value: string) => void;
const pending = runCancellableAgentRuntimeTask(context(duringRun.controller.signal), 'summarize_visual_snapshot', new Promise<string>(resolve => { completeLate = resolve; }));
duringRun.controller.abort();
const cancelled = await pending;
assert.deepEqual(cancelled, { cancelled: true, result: createAgentRuntimeCancelledResult('summarize_visual_snapshot') });
assert.deepEqual(duringRun.counts, { added: 1, removed: 1 });
completeLate('late result');
await Promise.resolve();
assert.equal(cancelled.cancelled, true);

const failure = trackedController();
const rejection = new Error('tool failed');
await assert.rejects(runCancellableAgentRuntimeTask(context(failure.controller.signal), 'run_local_project_action', Promise.reject(rejection)), error => error === rejection);
assert.deepEqual(failure.counts, { added: 1, removed: 1 });
const thrown = new Error('task factory failed');
await assert.rejects(runCancellableAgentRuntimeTask(context(), 'control_browser', () => { throw thrown; }), error => error === thrown);
assert.equal(createAgentRuntimeCancelledResult({ name: 'control_browser', input: {} }).receipt?.toolName, 'control_browser');
console.log('agent shared cancellation behavior smoke ok');
