import {
  createRuntimeWorld,
  type RuntimeWorld,
} from './runtimeWorldCore';
import {
  createBehaviorRequestSystem,
  createStateEventSystem,
} from './runtimeWorldSystems';
import {
  createRuntimeWorldDirector,
  type RuntimeWorldDirector,
} from './runtimeWorldDirector';
import type { RuntimeWorldPresentationIntent } from './runtimeWorldPresentationTypes';
import {
  type RuntimeWorldEvent,
  type RuntimeWorldState,
  type RuntimeWorldTickResult,
} from './runtimeWorldTypes';

export type RuntimeWorldEventInput = Omit<RuntimeWorldEvent, 'id' | 'timestampMs'> & {
  timestampMs?: number;
};

export type RuntimeWorldControllerResult = RuntimeWorldTickResult & {
  presentationIntent: RuntimeWorldPresentationIntent | null;
  suppressedBehaviorRequestIds: string[];
};

export type RuntimeWorldController = {
  dispatch: (event: RuntimeWorldEventInput) => RuntimeWorldControllerResult;
  getState: () => RuntimeWorldState;
  subscribe: (listener: (result: RuntimeWorldControllerResult) => void) => () => void;
};

export function createRuntimeWorldController({
  now = () => Date.now(),
  director = createRuntimeWorldDirector(),
  world = createRuntimeWorld({
    systems: [
      createStateEventSystem(),
      createBehaviorRequestSystem(),
    ],
  }),
}: {
  now?: () => number;
  director?: RuntimeWorldDirector;
  world?: RuntimeWorld;
} = {}): RuntimeWorldController {
  const listeners = new Set<(result: RuntimeWorldControllerResult) => void>();
  let eventIndex = 0;
  let lastTimestampMs: number | null = null;

  return {
    dispatch: (input) => {
      const timestampMs = input.timestampMs ?? now();
      const event: RuntimeWorldEvent = {
        ...input,
        id: `runtime-world-${eventIndex += 1}`,
        timestampMs,
      };
      if (world.getState().lifecycle === 'idle') {
        world.start();
      }

      world.addEvent(event);
      const deltaMs = lastTimestampMs == null
        ? 0
        : Math.max(0, timestampMs - lastTimestampMs);
      lastTimestampMs = Math.max(lastTimestampMs ?? timestampMs, timestampMs);
      const worldResult = world.tick(deltaMs, timestampMs);
      const direction = director.direct({
        behaviorRequests: worldResult.behaviorRequests,
        state: worldResult.state,
        timestampMs,
      });
      const result: RuntimeWorldControllerResult = {
        ...worldResult,
        presentationIntent: direction.intent,
        suppressedBehaviorRequestIds: direction.suppressedBehaviorRequestIds,
      };

      listeners.forEach((listener) => listener(result));
      return result;
    },
    getState: () => world.getState(),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
