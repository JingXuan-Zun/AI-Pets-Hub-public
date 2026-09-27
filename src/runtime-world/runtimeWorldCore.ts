import {
  type RuntimeWorldBehaviorRequest,
  type RuntimeWorldContextSnapshot,
  type RuntimeWorldEmotionVector,
  type RuntimeWorldEvent,
  type RuntimeWorldMemorySnapshot,
  type RuntimeWorldStatePatch,
  type RuntimeWorldState,
  type RuntimeWorldSystem,
  type RuntimeWorldTickResult,
} from './runtimeWorldTypes';

export const DEFAULT_RUNTIME_WORLD_EMOTION: RuntimeWorldEmotionVector = {
  affection: 50,
  calm: 70,
  curiosity: 50,
  excitement: 30,
  happiness: 55,
  shyness: 30,
};

export function createDefaultRuntimeWorldContext(nowMs = 0): RuntimeWorldContextSnapshot {
  return {
    appFocus: null,
    conversationActive: false,
    nowMs,
    systemLoad: 'unknown',
    userActivity: null,
  };
}

export function createDefaultRuntimeWorldMemory(nowMs = 0): RuntimeWorldMemorySnapshot {
  return {
    currentStateStartedAtMs: nowMs,
    lastBehaviorKind: null,
    recentBehaviorKinds: [],
    repeatedBehaviorCount: 0,
  };
}

export function createRuntimeWorldState(nowMs = 0): RuntimeWorldState {
  return {
    context: createDefaultRuntimeWorldContext(nowMs),
    emotion: { ...DEFAULT_RUNTIME_WORLD_EMOTION },
    lifecycle: 'idle',
    mainState: 'idle',
    memory: createDefaultRuntimeWorldMemory(nowMs),
    overlayStates: [],
  };
}

function orderRuntimeWorldEvents(events: RuntimeWorldEvent[]) {
  return [...events].sort((left, right) => {
    const priorityDelta = (right.priority ?? 0) - (left.priority ?? 0);
    if (priorityDelta !== 0) {
      return priorityDelta;
    }

    return left.timestampMs - right.timestampMs;
  });
}

function normalizeEmotionVector(emotion: RuntimeWorldEmotionVector): RuntimeWorldEmotionVector {
  return {
    affection: clampRuntimeWorldScore(emotion.affection),
    calm: clampRuntimeWorldScore(emotion.calm),
    curiosity: clampRuntimeWorldScore(emotion.curiosity),
    excitement: clampRuntimeWorldScore(emotion.excitement),
    happiness: clampRuntimeWorldScore(emotion.happiness),
    shyness: clampRuntimeWorldScore(emotion.shyness),
  };
}

function clampRuntimeWorldScore(value: number) {
  if (!Number.isFinite(value)) {
    return 50;
  }

  return Math.max(0, Math.min(100, value));
}

function mergeRuntimeWorldState(
  current: RuntimeWorldState,
  nextPartial: RuntimeWorldStatePatch,
): RuntimeWorldState {
  return {
    ...current,
    ...nextPartial,
    context: {
      ...current.context,
      ...nextPartial.context,
    },
    emotion: normalizeEmotionVector({
      ...current.emotion,
      ...nextPartial.emotion,
    }),
    memory: {
      ...current.memory,
      ...nextPartial.memory,
    },
    overlayStates: nextPartial.overlayStates
      ? [...nextPartial.overlayStates]
      : current.overlayStates,
  };
}

function updateRuntimeWorldMemory(
  memory: RuntimeWorldMemorySnapshot,
  behaviorRequests: RuntimeWorldBehaviorRequest[],
): RuntimeWorldMemorySnapshot {
  if (behaviorRequests.length === 0) {
    return memory;
  }

  const selectedBehaviorKind = behaviorRequests[0].kind;
  const repeatedBehaviorCount = selectedBehaviorKind === memory.lastBehaviorKind
    ? memory.repeatedBehaviorCount + 1
    : 1;

  return {
    ...memory,
    lastBehaviorKind: selectedBehaviorKind,
    recentBehaviorKinds: [
      selectedBehaviorKind,
      ...memory.recentBehaviorKinds,
    ].slice(0, 8),
    repeatedBehaviorCount,
  };
}

export type RuntimeWorld = {
  addEvent: (event: RuntimeWorldEvent) => void;
  getState: () => RuntimeWorldState;
  pause: () => void;
  resume: () => void;
  shutdown: () => void;
  start: () => void;
  tick: (deltaMs: number, timestampMs: number) => RuntimeWorldTickResult;
};

export function createRuntimeWorld({
  initialState = createRuntimeWorldState(),
  systems = [],
}: {
  initialState?: RuntimeWorldState;
  systems?: RuntimeWorldSystem[];
} = {}): RuntimeWorld {
  let state = initialState;
  let pendingEvents: RuntimeWorldEvent[] = [];

  const setLifecycle = (lifecycle: RuntimeWorldState['lifecycle']) => {
    state = mergeRuntimeWorldState(state, { lifecycle });
  };

  return {
    addEvent: (event) => {
      if (state.lifecycle === 'shutdown') {
        return;
      }

      pendingEvents.push(event);
    },
    getState: () => state,
    pause: () => {
      if (state.lifecycle === 'running') {
        setLifecycle('paused');
      }
    },
    resume: () => {
      if (state.lifecycle === 'paused') {
        setLifecycle('running');
      }
    },
    shutdown: () => {
      pendingEvents = [];
      setLifecycle('shutdown');
    },
    start: () => {
      if (state.lifecycle === 'idle') {
        setLifecycle('running');
      }
    },
    tick: (deltaMs, timestampMs) => {
      const processedEvents = state.lifecycle === 'running'
        ? orderRuntimeWorldEvents(pendingEvents)
        : [];
      pendingEvents = state.lifecycle === 'running' ? [] : pendingEvents;

      const emittedEvents: RuntimeWorldEvent[] = [];
      let behaviorRequests: RuntimeWorldBehaviorRequest[] = [];
      let nextState = mergeRuntimeWorldState(state, {
        context: {
          nowMs: timestampMs,
        },
      });

      if (state.lifecycle === 'running') {
        for (const system of systems) {
          const result = system.update({
            deltaMs,
            events: processedEvents,
            state: nextState,
            timestampMs,
          });

          if (!result) {
            continue;
          }

          emittedEvents.push(...(result.events ?? []));
          behaviorRequests = behaviorRequests.concat(result.behaviorRequests ?? []);
          nextState = result.state
            ? mergeRuntimeWorldState(nextState, result.state)
            : nextState;
        }
      }

      nextState = mergeRuntimeWorldState(nextState, {
        memory: updateRuntimeWorldMemory(nextState.memory, behaviorRequests),
      });
      state = nextState;

      return {
        behaviorRequests,
        emittedEvents,
        processedEvents,
        state,
      };
    },
  };
}
