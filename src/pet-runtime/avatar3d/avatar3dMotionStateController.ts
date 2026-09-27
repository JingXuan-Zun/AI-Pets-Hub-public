import {
  resolvePetContentMotionBehavior,
  resolvePetContentMotionNames,
  type PetContentManifest,
  type PetContentMotionKey,
} from '../content/petContentManifest';
import { type Avatar3DVisualMode } from './avatar3dActionPresentationProfile';
import {
  resolvePetActionEmotionMode,
  type PetActionStateMachineSnapshot,
} from '../core/petActionStateMachine';
import { type Avatar3DMotionOverrideState } from './avatar3dMotionOverrideController';

export type Avatar3DMotionLoopMode = 'repeat' | 'once';
export type Avatar3DMotionCompletionMode = 'fallback' | 'freeze' | 'motion-key' | 'resume-base';
export type Avatar3DManualMotionPlaybackMode = 'native' | 'semantic';
export type Avatar3DManualMotionSelection = {
  candidateClipNames: string[];
  motionKey: PetContentMotionKey;
  playbackMode?: Avatar3DManualMotionPlaybackMode;
};

export type Avatar3DMotionState = {
  allowInterruption: boolean;
  baseMotionKey: PetContentMotionKey;
  candidateClipNames: string[];
  completionCandidateClipNames: string[];
  completionMode: Avatar3DMotionCompletionMode;
  completionMotionKey: PetContentMotionKey | null;
  completionResolvedMotionKeys: PetContentMotionKey[];
  fallbackCandidateClipNames: string[];
  clampWhenFinished: boolean;
  fallbackMotionKeys: PetContentMotionKey[];
  fallbackTransitionOnComplete: boolean;
  fallbackTransitionSignature: string;
  loopMode: Avatar3DMotionLoopMode;
  lockMs: number;
  mode: NonNullable<Avatar3DMotionOverrideState['mode']>;
  motionKey: PetContentMotionKey;
  overrideMotionKey: PetContentMotionKey | null;
  playbackRate: number;
  priority: number;
  resolvedMotionKeys: PetContentMotionKey[];
  source: Avatar3DMotionOverrideState['source'];
  clipPlaybackMode: Avatar3DManualMotionPlaybackMode;
  visualMode: Avatar3DVisualMode;
};

export function shouldPrioritizeAvatar3DMotionPlayback({
  manualMotionActive,
  motionState,
  runtimeSleeping,
}: {
  manualMotionActive: boolean;
  motionState: Pick<Avatar3DMotionState, 'mode' | 'motionKey' | 'source'>;
  runtimeSleeping: boolean;
}) {
  if (runtimeSleeping) {
    return false;
  }

  return manualMotionActive
    || motionState.mode === 'replace'
    || motionState.motionKey !== 'idle'
    || motionState.source !== 'state-machine';
}

type Avatar3DMotionPlaybackHint = Pick<
  Avatar3DMotionState,
  'allowInterruption' | 'clampWhenFinished' | 'fallbackTransitionOnComplete' | 'lockMs' | 'loopMode' | 'playbackRate' | 'priority'
>;

const MOTION_KEY_BY_VISUAL_MODE: Record<Avatar3DVisualMode, PetContentMotionKey> = {
  eating: 'eating',
  happy: 'happy',
  'hover-body': 'hover-body',
  'hover-hand-left': 'hover-hand-left',
  'hover-hand-right': 'hover-hand-right',
  'hover-head': 'hover-head',
  idle: 'idle',
  moving: 'moving',
  running: 'running',
  sad: 'sad',
  sleeping: 'sleeping',
  swimming: 'swimming',
  walking: 'walking',
};

const MOTION_FALLBACK_CLIP_NAMES: Record<PetContentMotionKey, string[]> = {
  eating: ['eating', 'eat', 'chew', 'chewing', 'mogu', 'happy'],
  happy: ['happy', 'smile', 'joy', 'cheer', 'greet'],
  'hover-body': ['hover-body', 'body', 'pet_body', 'touch_body', 'idle'],
  'hover-hand-left': ['hover-hand-left', 'handl', 'hand_left', 'touch_hand_left', 'wave_left', 'idle'],
  'hover-hand-right': ['hover-hand-right', 'handr', 'hand_right', 'touch_hand_right', 'wave_right', 'idle'],
  'hover-head': ['hover-head', 'head', 'pet_head', 'touch_head', 'happy', 'idle'],
  idle: ['idle', 'idle_loop', 'stand', 'default', 'wait'],
  moving: ['moving', 'move', 'walk', 'walking', 'locomotion'],
  running: ['running', 'run', 'dash', 'sprint', 'move_fast'],
  sad: ['sad', 'cry', 'upset', 'down'],
  sleeping: ['sleeping', 'sleep', 'rest', 'doze'],
  swimming: ['swimming', 'swim', 'float'],
  walking: ['walking', 'walk', 'move', 'locomotion'],
};

const MOTION_FALLBACK_KEY_CHAIN: Record<PetContentMotionKey, PetContentMotionKey[]> = {
  eating: ['happy', 'idle'],
  happy: ['idle'],
  'hover-body': ['idle'],
  'hover-hand-left': ['happy', 'idle'],
  'hover-hand-right': ['happy', 'idle'],
  'hover-head': ['happy', 'idle'],
  idle: [],
  moving: ['walking', 'idle'],
  running: ['walking', 'moving', 'idle'],
  sad: ['idle'],
  sleeping: ['idle'],
  swimming: ['moving', 'idle'],
  walking: ['moving', 'idle'],
};

const MOTION_PLAYBACK_HINT_BY_KEY: Record<PetContentMotionKey, Avatar3DMotionPlaybackHint> = {
  eating: {
    allowInterruption: true,
    clampWhenFinished: false,
    fallbackTransitionOnComplete: false,
    lockMs: 0,
    loopMode: 'repeat',
    playbackRate: 0.94,
    priority: 62,
  },
  happy: {
    allowInterruption: true,
    clampWhenFinished: false,
    fallbackTransitionOnComplete: false,
    lockMs: 0,
    loopMode: 'repeat',
    playbackRate: 1.02,
    priority: 58,
  },
  'hover-body': {
    allowInterruption: true,
    clampWhenFinished: false,
    fallbackTransitionOnComplete: false,
    lockMs: 0,
    loopMode: 'repeat',
    playbackRate: 0.92,
    priority: 48,
  },
  'hover-hand-left': {
    allowInterruption: true,
    clampWhenFinished: false,
    fallbackTransitionOnComplete: false,
    lockMs: 0,
    loopMode: 'repeat',
    playbackRate: 0.98,
    priority: 50,
  },
  'hover-hand-right': {
    allowInterruption: true,
    clampWhenFinished: false,
    fallbackTransitionOnComplete: false,
    lockMs: 0,
    loopMode: 'repeat',
    playbackRate: 0.98,
    priority: 50,
  },
  'hover-head': {
    allowInterruption: true,
    clampWhenFinished: false,
    fallbackTransitionOnComplete: false,
    lockMs: 0,
    loopMode: 'repeat',
    playbackRate: 1,
    priority: 56,
  },
  idle: {
    allowInterruption: true,
    clampWhenFinished: false,
    fallbackTransitionOnComplete: false,
    lockMs: 0,
    loopMode: 'repeat',
    playbackRate: 0.9,
    priority: 10,
  },
  moving: {
    allowInterruption: true,
    clampWhenFinished: false,
    fallbackTransitionOnComplete: false,
    lockMs: 0,
    loopMode: 'repeat',
    playbackRate: 1,
    priority: 24,
  },
  running: {
    allowInterruption: true,
    clampWhenFinished: false,
    fallbackTransitionOnComplete: false,
    lockMs: 0,
    loopMode: 'repeat',
    playbackRate: 1.1,
    priority: 38,
  },
  sad: {
    allowInterruption: true,
    clampWhenFinished: false,
    fallbackTransitionOnComplete: false,
    lockMs: 0,
    loopMode: 'repeat',
    playbackRate: 0.84,
    priority: 52,
  },
  sleeping: {
    allowInterruption: true,
    clampWhenFinished: false,
    fallbackTransitionOnComplete: false,
    lockMs: 0,
    loopMode: 'repeat',
    playbackRate: 0.72,
    priority: 46,
  },
  swimming: {
    allowInterruption: true,
    clampWhenFinished: false,
    fallbackTransitionOnComplete: false,
    lockMs: 0,
    loopMode: 'repeat',
    playbackRate: 0.82,
    priority: 34,
  },
  walking: {
    allowInterruption: true,
    clampWhenFinished: false,
    fallbackTransitionOnComplete: false,
    lockMs: 0,
    loopMode: 'repeat',
    playbackRate: 0.96,
    priority: 30,
  },
};

export function resolveAvatar3DMotionKey(
  visualMode: Avatar3DVisualMode,
) {
  return MOTION_KEY_BY_VISUAL_MODE[visualMode] ?? 'idle';
}

function resolveAvatar3DBaseMotionKey(
  snapshot: PetActionStateMachineSnapshot,
): PetContentMotionKey {
  const emotionMode = resolvePetActionEmotionMode(snapshot.baseAction);
  if (emotionMode === 'eating') {
    return 'eating';
  }

  if (emotionMode === 'happy') {
    return 'happy';
  }

  if (emotionMode === 'sad') {
    return 'sad';
  }

  if (emotionMode === 'sleeping') {
    return 'sleeping';
  }

  if (snapshot.motionMode === 'running') {
    return 'running';
  }

  if (snapshot.motionMode === 'walking') {
    return 'walking';
  }

  if (snapshot.motionMode === 'swimming') {
    return 'swimming';
  }

  return snapshot.requestedIsMoving ? 'moving' : 'idle';
}

function resolveAvatar3DMotionFallbackKeys(
  contentManifest: PetContentManifest | null | undefined,
  motionKey: PetContentMotionKey,
) {
  const configuredFallbackKeys = resolvePetContentMotionBehavior(contentManifest, motionKey)?.fallbackKeys ?? [];
  return configuredFallbackKeys.length
    ? configuredFallbackKeys
    : (MOTION_FALLBACK_KEY_CHAIN[motionKey] ?? []);
}

function resolveAvatar3DMotionCandidateClipNames(
  contentManifest: PetContentManifest | null | undefined,
  motionKeys: PetContentMotionKey[],
) {
  return Array.from(new Set(
    motionKeys.flatMap((nextMotionKey) => ([
      ...resolvePetContentMotionNames(contentManifest, nextMotionKey),
      ...(MOTION_FALLBACK_CLIP_NAMES[nextMotionKey] ?? [nextMotionKey]),
    ])),
  ));
}

function resolveAvatar3DMotionCompletionMode(
  configuredMotionBehavior: ReturnType<typeof resolvePetContentMotionBehavior>,
  loopMode: Avatar3DMotionLoopMode,
  motionOverrideState: Avatar3DMotionOverrideState | undefined,
) {
  if (configuredMotionBehavior?.completionMode) {
    return configuredMotionBehavior.completionMode;
  }

  if (loopMode !== 'once') {
    return 'fallback' as const;
  }

  if (
    motionOverrideState?.mode === 'replace'
    && (
      motionOverrideState.source === 'message'
      || motionOverrideState.source === 'fallback'
      || motionOverrideState.source === 'hover'
    )
  ) {
    return 'resume-base' as const;
  }

  return 'fallback' as const;
}

export function resolveAvatar3DMotionState({
  contentManifest,
  manualMotionSelection,
  motionOverrideState,
  snapshot,
  visualMode,
}: {
  contentManifest?: PetContentManifest | null;
  manualMotionSelection?: Avatar3DManualMotionSelection | null;
  motionOverrideState?: Avatar3DMotionOverrideState;
  snapshot: PetActionStateMachineSnapshot;
  visualMode: Avatar3DVisualMode;
}): Avatar3DMotionState {
  const baseMotionKey = resolveAvatar3DBaseMotionKey(snapshot);
  const mode = motionOverrideState?.mode ?? 'preserve';
  const overrideMotionKey = motionOverrideState?.overrideMotionKey ?? null;
  const manualMotionKey = manualMotionSelection?.candidateClipNames.length
    ? manualMotionSelection.motionKey
    : null;
  const motionKey = manualMotionKey ?? (mode === 'replace'
    ? (overrideMotionKey ?? baseMotionKey)
    : mode === 'soft-stop'
      ? (overrideMotionKey ?? 'idle')
      : baseMotionKey);
  const configuredMotionBehavior = resolvePetContentMotionBehavior(contentManifest, motionKey);
  const fallbackMotionKeys = resolveAvatar3DMotionFallbackKeys(contentManifest, motionKey);
  const resolvedMotionKeys = Array.from(new Set([
    motionKey,
    ...fallbackMotionKeys,
  ]));
  const playbackHint = MOTION_PLAYBACK_HINT_BY_KEY[motionKey] ?? MOTION_PLAYBACK_HINT_BY_KEY.idle;
  const loopMode = configuredMotionBehavior?.loopMode ?? playbackHint.loopMode;
  const priority = (configuredMotionBehavior?.priority ?? playbackHint.priority)
    + Math.max(0, motionOverrideState?.priorityBoost ?? 0);
  const lockMs = Math.max(
    configuredMotionBehavior?.lockMs ?? playbackHint.lockMs,
    motionOverrideState?.lockMsMin ?? 0,
  );
  const allowInterruption = configuredMotionBehavior?.allowInterruption ?? playbackHint.allowInterruption;
  const completionMode = resolveAvatar3DMotionCompletionMode(
    configuredMotionBehavior,
    loopMode,
    motionOverrideState,
  );
  const completionMotionKey = completionMode === 'resume-base'
    ? baseMotionKey
    : completionMode === 'motion-key'
      ? (configuredMotionBehavior?.completionMotionKey ?? fallbackMotionKeys[0] ?? baseMotionKey)
      : completionMode === 'fallback'
        ? (fallbackMotionKeys[0] ?? null)
        : null;
  const completionResolvedMotionKeys = completionMode === 'freeze'
    ? []
    : completionMotionKey
      ? Array.from(new Set([
        completionMotionKey,
        ...resolveAvatar3DMotionFallbackKeys(contentManifest, completionMotionKey),
      ]))
      : [];
  const fallbackTransitionOnComplete = loopMode === 'once'
    ? completionMode !== 'freeze'
    : playbackHint.fallbackTransitionOnComplete;
  const isManualMotionSelectionActive = Boolean(
    manualMotionSelection
    && manualMotionSelection.motionKey === motionKey
    && manualMotionSelection.candidateClipNames.length > 0
  );
  const clipPlaybackMode = isManualMotionSelectionActive
    ? (manualMotionSelection?.playbackMode ?? 'semantic')
    : 'semantic';
  const basePlaybackRate = clipPlaybackMode === 'native'
    ? 1
    : (configuredMotionBehavior?.playbackRate ?? playbackHint.playbackRate);
  const playbackRate = Number((
    basePlaybackRate
    * Math.max(0.1, motionOverrideState?.playbackRateMultiplier ?? 1)
  ).toFixed(3));
  const resolvedCandidateClipNames = resolveAvatar3DMotionCandidateClipNames(contentManifest, resolvedMotionKeys);
  const candidateClipNames = (
    isManualMotionSelectionActive
  )
    ? Array.from(new Set([
      ...(manualMotionSelection?.candidateClipNames ?? []),
      ...resolvedCandidateClipNames,
    ]))
    : resolvedCandidateClipNames;

  return {
    allowInterruption,
    baseMotionKey,
    candidateClipNames,
    completionCandidateClipNames: resolveAvatar3DMotionCandidateClipNames(contentManifest, completionResolvedMotionKeys),
    completionMode,
    completionMotionKey,
    completionResolvedMotionKeys,
    fallbackCandidateClipNames: resolveAvatar3DMotionCandidateClipNames(contentManifest, fallbackMotionKeys),
    clampWhenFinished: loopMode === 'once' ? true : playbackHint.clampWhenFinished,
    fallbackMotionKeys,
    fallbackTransitionOnComplete,
    fallbackTransitionSignature: fallbackMotionKeys.join('|'),
    clipPlaybackMode,
    loopMode,
    lockMs,
    mode,
    motionKey,
    overrideMotionKey,
    playbackRate,
    priority,
    resolvedMotionKeys,
    source: motionOverrideState?.source ?? 'state-machine',
    visualMode,
  };
}
