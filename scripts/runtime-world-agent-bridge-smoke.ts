import assert from 'node:assert/strict';
import { resolveRuntimeWorldExpressionAction } from '../src/components/pet/useRuntimeWorldExpressionAction.ts';
import {
  createAgentRuntimeWorldProgressEvent,
  createAgentRuntimeWorldResultEvent,
  createAgentRuntimeWorldTaskStartedEvent,
  createRuntimeWorldController,
} from '../src/runtime-world/index.ts';

let now = 100;
const controller = createRuntimeWorldController({ now: () => now });
const observedStates: string[] = [];
const unsubscribe = controller.subscribe((result) => observedStates.push(result.state.mainState));

const started = controller.dispatch(createAgentRuntimeWorldTaskStartedEvent());
assert.equal(started.state.mainState, 'thinking');
assert.equal(started.behaviorRequests[0]?.kind, 'idle-think');
assert.equal(started.presentationIntent?.attention, 'task');

now = 120;
const working = controller.dispatch(createAgentRuntimeWorldProgressEvent({
  continuation: { taskState: { phase: 'executing', taskId: 'task-1' } },
  stepIndex: 1,
  taskPhase: 'executing',
  taskTransition: { kind: 'execution-started' },
  type: 'tools-running',
}));
assert.equal(working.state.mainState, 'working');
assert.equal(working.state.overlayStates.includes('tool-running'), true);
assert.equal(working.processedEvents[0]?.payload?.taskId, 'task-1');

now = 140;
const approval = controller.dispatch(createAgentRuntimeWorldResultEvent({
  status: 'needs-approval',
  taskState: { phase: 'approval', taskId: 'task-1' },
}));
assert.equal(approval.state.mainState, 'listening');
assert.equal(approval.state.overlayStates.includes('tool-running'), false);
assert.equal(approval.behaviorRequests[0]?.kind, 'look-at-user');
assert.equal(approval.presentationIntent?.attention, 'user');

now = 160;
const completed = controller.dispatch(createAgentRuntimeWorldResultEvent({
  status: 'completed',
  taskState: { phase: 'terminal', taskId: 'task-1' },
}));
assert.equal(completed.state.mainState, 'idle');
assert.equal(completed.state.context.conversationActive, false);
assert.equal(completed.behaviorRequests[0]?.kind, 'express-emotion');
assert.equal(completed.presentationIntent?.emotion, 'positive');
assert.equal(resolveRuntimeWorldExpressionAction(completed.presentationIntent, now), 'HAPPY');

now = 180;
const cancelled = controller.dispatch(createAgentRuntimeWorldResultEvent({
  status: 'cancelled',
  taskState: { phase: 'terminal', taskId: 'task-2' },
}));
assert.equal(cancelled.state.mainState, 'idle');
assert.equal(cancelled.behaviorRequests[0]?.kind, 'react');
assert.equal(cancelled.presentationIntent?.emotion, 'concerned');
assert.equal(resolveRuntimeWorldExpressionAction(cancelled.presentationIntent, now), 'SAD');
assert.deepEqual(observedStates, ['thinking', 'working', 'listening', 'idle', 'idle']);

unsubscribe();
console.log('runtime world agent bridge smoke passed');
