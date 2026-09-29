import assert from 'node:assert/strict';
import {
  createBehaviorRequestSystem,
  createRuntimeWorld,
  createRuntimeWorldState,
  createStateEventSystem,
  type RuntimeWorldEvent,
} from '../src/runtime-world/index.ts';
import { readProjectFile } from './smokeTestHarness.ts';

function event(id: string, kind: RuntimeWorldEvent['kind'], priority = 0): RuntimeWorldEvent {
  return {
    id,
    kind,
    priority,
    source: kind.startsWith('agent.') ? 'agent' : 'user',
    timestampMs: Number(id.replace(/\D/gu, '')) || 0,
  };
}

const world = createRuntimeWorld({
  initialState: createRuntimeWorldState(100),
  systems: [
    createStateEventSystem(),
    createBehaviorRequestSystem(),
  ],
});

assert.equal(world.getState().lifecycle, 'idle');
world.addEvent(event('e1', 'input.mouse-move', 1));
assert.equal(
  world.tick(16, 116).processedEvents.length,
  0,
  'idle world should not process queued events before start',
);

world.start();
const startedResult = world.tick(16, 132);
assert.deepEqual(
  startedResult.processedEvents.map((processedEvent) => processedEvent.id),
  ['e1'],
  'events queued before start should process after start',
);
assert.equal(startedResult.behaviorRequests[0].kind, 'follow-mouse');
assert.equal(startedResult.state.overlayStates.includes('curious'), true);
assert.equal(startedResult.state.memory.lastBehaviorKind, 'follow-mouse');

world.addEvent(event('e2', 'input.mouse-move', 1));
const repeatedResult = world.tick(16, 148);
assert.equal(repeatedResult.state.memory.repeatedBehaviorCount, 2);
assert.equal(repeatedResult.state.memory.recentBehaviorKinds.length, 2);

world.addEvent(event('e3', 'input.mouse-click', 2));
world.addEvent(event('e4', 'agent.conversation-started', 8));
const priorityResult = world.tick(16, 164);
assert.deepEqual(
  priorityResult.processedEvents.map((processedEvent) => processedEvent.id),
  ['e4', 'e3'],
  'higher priority events should be processed first',
);
assert.equal(priorityResult.state.mainState, 'listening');
assert.equal(priorityResult.state.context.conversationActive, true);
assert.equal(priorityResult.behaviorRequests[0].kind, 'look-at-user');

world.addEvent(event('e5', 'agent.reply-generated', 8));
const speakingResult = world.tick(16, 180);
assert.equal(speakingResult.state.mainState, 'speaking');
assert.equal(speakingResult.behaviorRequests[0].kind, 'express-emotion');

world.pause();
world.addEvent(event('e6', 'input.mouse-click', 4));
const pausedResult = world.tick(16, 196);
assert.equal(pausedResult.processedEvents.length, 0);
assert.equal(pausedResult.behaviorRequests.length, 0);
assert.equal(pausedResult.state.lifecycle, 'paused');

world.resume();
const resumedResult = world.tick(16, 212);
assert.deepEqual(
  resumedResult.processedEvents.map((processedEvent) => processedEvent.id),
  ['e6'],
  'paused world should keep queued events for resume',
);
assert.equal(resumedResult.behaviorRequests[0].kind, 'react');

world.shutdown();
world.addEvent(event('e7', 'input.mouse-click', 9));
const shutdownResult = world.tick(16, 228);
assert.equal(shutdownResult.state.lifecycle, 'shutdown');
assert.equal(shutdownResult.processedEvents.length, 0);

const coreSource = readProjectFile('src/runtime-world/runtimeWorldCore.ts');
const systemsSource = readProjectFile('src/runtime-world/runtimeWorldSystems.ts');
const typeSource = readProjectFile('src/runtime-world/runtimeWorldTypes.ts');
const packageSource = readProjectFile('package.json');

assert.match(typeSource, /RuntimeWorldEventKind/u);
assert.match(typeSource, /RuntimeWorldBehaviorRequest/u);
assert.match(typeSource, /RuntimeWorldEmotionVector/u);
assert.match(typeSource, /RuntimeWorldMemorySnapshot/u);
assert.match(coreSource, /createRuntimeWorld/u);
assert.match(systemsSource, /createStateEventSystem/u);
assert.match(systemsSource, /createBehaviorRequestSystem/u);
assert.doesNotMatch(coreSource, /React|Electron|Live2D|Three|Unity/u);
assert.doesNotMatch(systemsSource, /React|Electron|Live2D|Three|Unity/u);
assert.doesNotMatch(packageSource, /runtime-world-core-smoke/u);

console.log('runtime world core smoke passed');
