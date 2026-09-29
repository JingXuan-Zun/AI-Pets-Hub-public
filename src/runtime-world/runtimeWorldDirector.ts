import type {
  RuntimeWorldBehaviorKind,
  RuntimeWorldBehaviorRequest,
  RuntimeWorldState,
} from './runtimeWorldTypes';
import type {
  RuntimeWorldPresentationAttention,
  RuntimeWorldPresentationEmotion,
  RuntimeWorldPresentationEnergy,
  RuntimeWorldPresentationIntent,
} from './runtimeWorldPresentationTypes';

type RuntimeWorldDirectorInput = {
  behaviorRequests: RuntimeWorldBehaviorRequest[];
  state: RuntimeWorldState;
  timestampMs: number;
};

export type RuntimeWorldDirectorResult = {
  intent: RuntimeWorldPresentationIntent | null;
  suppressedBehaviorRequestIds: string[];
};

export type RuntimeWorldDirector = {
  direct: (input: RuntimeWorldDirectorInput) => RuntimeWorldDirectorResult;
  getActiveIntent: () => RuntimeWorldPresentationIntent | null;
  reset: () => void;
};

type BehaviorPresentationProfile = {
  attention: RuntimeWorldPresentationAttention;
  basePriority: number;
  cooldownMs: number;
  durationMs: number;
  emotion: RuntimeWorldPresentationEmotion;
};

const behaviorPresentationProfiles: Record<
  RuntimeWorldBehaviorKind,
  BehaviorPresentationProfile
> = {
  'express-emotion': {
    attention: 'user',
    basePriority: 90,
    cooldownMs: 3_000,
    durationMs: 1_500,
    emotion: 'positive',
  },
  'follow-mouse': {
    attention: 'none',
    basePriority: 20,
    cooldownMs: 250,
    durationMs: 300,
    emotion: 'neutral',
  },
  greet: {
    attention: 'user',
    basePriority: 70,
    cooldownMs: 4_000,
    durationMs: 1_800,
    emotion: 'positive',
  },
  'idle-think': {
    attention: 'task',
    basePriority: 40,
    cooldownMs: 5_000,
    durationMs: 3_600,
    emotion: 'neutral',
  },
  'look-at-user': {
    attention: 'user',
    basePriority: 80,
    cooldownMs: 2_500,
    durationMs: 1_500,
    emotion: 'neutral',
  },
  react: {
    attention: 'user',
    basePriority: 100,
    cooldownMs: 3_500,
    durationMs: 1_800,
    emotion: 'concerned',
  },
};

function orderBehaviorRequests(requests: RuntimeWorldBehaviorRequest[]) {
  return [...requests].sort((left, right) => {
    const priorityDelta = getEffectivePriority(right) - getEffectivePriority(left);
    if (priorityDelta !== 0) {
      return priorityDelta;
    }

    return right.timestampMs - left.timestampMs;
  });
}

function getEffectivePriority(request: RuntimeWorldBehaviorRequest) {
  return behaviorPresentationProfiles[request.kind].basePriority + request.priority;
}

function isBehaviorCompatibleWithState(
  behaviorKind: RuntimeWorldBehaviorKind,
  mainState: RuntimeWorldState['mainState'],
) {
  if (behaviorKind === 'idle-think') {
    return mainState === 'thinking' || mainState === 'working';
  }

  if (behaviorKind === 'look-at-user') {
    return mainState === 'listening' || mainState === 'speaking';
  }

  if (behaviorKind === 'express-emotion' || behaviorKind === 'react') {
    return mainState === 'idle' || mainState === 'speaking';
  }

  return mainState !== 'sleeping';
}

function createPresentationIntent(
  request: RuntimeWorldBehaviorRequest,
  state: RuntimeWorldState,
  timestampMs: number,
): RuntimeWorldPresentationIntent {
  const profile = behaviorPresentationProfiles[request.kind];
  const emotion = request.kind === 'express-emotion' && state.mainState === 'speaking'
    ? 'neutral'
    : profile.emotion;
  const energy: RuntimeWorldPresentationEnergy = state.mainState === 'sleeping'
    ? 'low'
    : 'normal';

  return {
    attention: profile.attention,
    behaviorKind: request.kind,
    durationMs: profile.durationMs,
    emotion,
    energy,
    id: `presentation:${request.id}`,
    mainState: state.mainState,
    priority: getEffectivePriority(request),
    reasonEventId: request.reasonEventId ?? null,
    sourceBehaviorRequestId: request.id,
    timestampMs,
  };
}

function isWithinCooldown(
  activeIntent: RuntimeWorldPresentationIntent,
  request: RuntimeWorldBehaviorRequest,
  timestampMs: number,
) {
  return activeIntent.behaviorKind === request.kind
    && timestampMs - activeIntent.timestampMs
      < behaviorPresentationProfiles[request.kind].cooldownMs;
}

function canReplaceActiveIntent(
  activeIntent: RuntimeWorldPresentationIntent,
  request: RuntimeWorldBehaviorRequest,
  state: RuntimeWorldState,
) {
  if (!isBehaviorCompatibleWithState(activeIntent.behaviorKind, state.mainState)) {
    return true;
  }

  return getEffectivePriority(request) > activeIntent.priority;
}

export function createRuntimeWorldDirector(): RuntimeWorldDirector {
  let activeIntent: RuntimeWorldPresentationIntent | null = null;

  return {
    direct: ({ behaviorRequests, state, timestampMs }) => {
      if (activeIntent && timestampMs >= activeIntent.timestampMs + activeIntent.durationMs) {
        activeIntent = null;
      }

      const suppressedBehaviorRequestIds: string[] = [];
      for (const request of orderBehaviorRequests(behaviorRequests)) {
        if (activeIntent && isWithinCooldown(activeIntent, request, timestampMs)) {
          suppressedBehaviorRequestIds.push(request.id);
          continue;
        }

        if (activeIntent && !canReplaceActiveIntent(activeIntent, request, state)) {
          suppressedBehaviorRequestIds.push(request.id);
          continue;
        }

        activeIntent = createPresentationIntent(request, state, timestampMs);
        return { intent: activeIntent, suppressedBehaviorRequestIds };
      }

      return { intent: null, suppressedBehaviorRequestIds };
    },
    getActiveIntent: () => activeIntent,
    reset: () => {
      activeIntent = null;
    },
  };
}
