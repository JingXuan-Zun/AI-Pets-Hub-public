import * as THREE from 'three';
import {
  createAvatar3DRuntimeInstance,
  summarizeAvatar3DObjectForDebug,
  type Avatar3DFrameUpdater,
  type Avatar3DRuntimeFrameState,
  type Avatar3DRuntimeInstance,
} from './avatar3dRuntimeInstance';

type CreateAnimatedAvatar3DRuntimeInstanceOptions = {
  clips?: THREE.AnimationClip[] | null;
  dispose?: () => void;
  object: THREE.Object3D;
  sourceLabel?: string;
  update?: Avatar3DFrameUpdater | null;
};

type PreparedClipEntry = {
  action: THREE.AnimationAction;
  clip: THREE.AnimationClip;
  normalizedName: string;
  playbackRateMultiplier: number;
  rawName: string;
};

const DEFAULT_MOTION_CANDIDATES = ['idle'];
const MOTION_CROSS_FADE_SECONDS = 0.22;

function normalizeClipName(name: string) {
  return name.trim().toLowerCase();
}

export function dedupeAnimationClipsByName(
  clips: THREE.AnimationClip[],
) {
  const uniqueClipMap = new Map<string, THREE.AnimationClip>();

  clips.forEach((clip, index) => {
    const normalizedClipName = normalizeClipName(clip.name);
    const cacheKey = normalizedClipName || `__unnamed_clip_${index}`;
    if (uniqueClipMap.has(cacheKey)) {
      return;
    }

    uniqueClipMap.set(cacheKey, clip);
  });

  return Array.from(uniqueClipMap.values());
}

function createPreparedClipEntries(
  mixer: THREE.AnimationMixer,
  clips: THREE.AnimationClip[],
) {
  return clips
    .filter((clip): clip is THREE.AnimationClip => clip instanceof THREE.AnimationClip)
    .map((clip, index) => {
      const rawName = clip.name.trim() || `clip-${index + 1}`;
      return {
        action: mixer.clipAction(clip),
        clip,
        normalizedName: normalizeClipName(rawName),
        playbackRateMultiplier: Number.isFinite((clip.userData as { desktopPetPlaybackRateMultiplier?: number } | undefined)?.desktopPetPlaybackRateMultiplier)
          ? Math.max(0.1, Number((clip.userData as { desktopPetPlaybackRateMultiplier?: number }).desktopPetPlaybackRateMultiplier))
          : 1,
        rawName,
      } satisfies PreparedClipEntry;
    });
}

function resolveMatchingClipEntry(
  clipEntries: PreparedClipEntry[],
  candidateClipNames: string[],
  options: {
    allowFirstClipFallback?: boolean;
  } = {},
) {
  const normalizedCandidates = candidateClipNames
    .map(normalizeClipName)
    .filter(Boolean);

  for (const normalizedCandidate of normalizedCandidates) {
    const exactMatch = clipEntries.find((clipEntry) => clipEntry.normalizedName === normalizedCandidate);
    if (exactMatch) {
      return exactMatch;
    }
  }

  for (const normalizedCandidate of normalizedCandidates) {
    const fuzzyMatch = clipEntries.find((clipEntry) => (
      clipEntry.normalizedName.includes(normalizedCandidate)
      || normalizedCandidate.includes(clipEntry.normalizedName)
    ));
    if (fuzzyMatch) {
      return fuzzyMatch;
    }
  }

  return options.allowFirstClipFallback
    ? (clipEntries[0] ?? null)
    : null;
}

function shouldAllowFirstClipFallback(frameState?: Avatar3DRuntimeFrameState) {
  const motionState = frameState?.motionState;
  if (!motionState) {
    return true;
  }

  if (motionState.clipPlaybackMode === 'native') {
    return true;
  }

  if (motionState.source === 'state-machine' && motionState.mode === 'preserve') {
    return false;
  }

  return motionState.motionKey !== 'idle';
}

function isMotionActionFinished(
  clipEntry: PreparedClipEntry | null,
  frameState?: Avatar3DRuntimeFrameState,
) {
  if (!clipEntry || frameState?.motionState?.loopMode !== 'once') {
    return false;
  }

  const clipDuration = clipEntry.clip.duration;
  if (!(clipDuration > 0)) {
    return false;
  }

  const actionTime = clipEntry.action.time;
  return actionTime >= clipDuration - 0.001;
}

function applyMotionSettings(
  clipEntry: PreparedClipEntry,
  frameState?: Avatar3DRuntimeFrameState,
) {
  const loopMode = frameState?.motionState?.loopMode === 'once'
    ? THREE.LoopOnce
    : THREE.LoopRepeat;
  const clipPlaybackMultiplier = frameState?.motionState?.clipPlaybackMode === 'native'
    ? 1
    : clipEntry.playbackRateMultiplier;
  const effectivePlaybackRate = Number(((
    frameState?.motionState?.playbackRate ?? 1
  ) * clipPlaybackMultiplier).toFixed(3));

  clipEntry.action.enabled = true;
  clipEntry.action.clampWhenFinished = Boolean(frameState?.motionState?.clampWhenFinished);
  clipEntry.action.setLoop(loopMode, loopMode === THREE.LoopOnce ? 1 : Infinity);
  clipEntry.action.setEffectiveTimeScale(effectivePlaybackRate);
  clipEntry.action.setEffectiveWeight(1);
}

function resolveMotionSignature(
  clipEntry: PreparedClipEntry | null,
  frameState?: Avatar3DRuntimeFrameState,
) {
  return [
    clipEntry?.normalizedName ?? 'none',
    frameState?.motionState?.loopMode ?? 'repeat',
    frameState?.motionState?.clampWhenFinished ? '1' : '0',
    String(frameState?.motionState?.playbackRate ?? 1),
  ].join('|');
}

export function createAnimatedAvatar3DRuntimeInstance({
  clips,
  dispose,
  object,
  sourceLabel,
  update = null,
}: CreateAnimatedAvatar3DRuntimeInstanceOptions): Avatar3DRuntimeInstance {
  const preparedClips = Array.isArray(clips)
    ? dedupeAnimationClipsByName(
      clips.filter((clip): clip is THREE.AnimationClip => clip instanceof THREE.AnimationClip),
    )
    : [];
  const debugSummary = {
    ...summarizeAvatar3DObjectForDebug(object),
    animationClipCount: preparedClips.length,
    animationClipNames: preparedClips.map((clip, index) => clip.name.trim() || `clip-${index + 1}`),
  };

  if (preparedClips.length === 0) {
    return createAvatar3DRuntimeInstance({
      debugSummary,
      dispose,
      object,
      sourceLabel,
      update,
    });
  }

  const mixer = new THREE.AnimationMixer(object);
  const clipEntries = createPreparedClipEntries(mixer, preparedClips);
  let activeClipEntry: PreparedClipEntry | null = null;
  let activeMotionSignature = '';
  let activeRequestedMotionSignature = '';
  let activeMotionAllowInterruption = true;
  let activeMotionPriority = 0;
  let activeMotionLockUntilMs = 0;
  let elapsedMs = 0;
  let completedOneShotRequestSignature = '';
  let fallbackActiveForCompletedRequest = false;

  function resolveRequestedMotionSignature(frameState?: Avatar3DRuntimeFrameState) {
    return [
      frameState?.motionState?.motionKey ?? 'idle',
      frameState?.motionState?.resolvedMotionKeys.join('|') ?? 'idle',
      frameState?.motionState?.candidateClipNames.join('|') ?? DEFAULT_MOTION_CANDIDATES.join('|'),
      frameState?.motionState?.loopMode ?? 'repeat',
      String(frameState?.motionState?.playbackRate ?? 1),
    ].join('::');
  }

  function resolveEffectiveCandidateClipNames(frameState?: Avatar3DRuntimeFrameState) {
    if (!frameState?.motionState) {
      return DEFAULT_MOTION_CANDIDATES;
    }

    const requestedMotionSignature = resolveRequestedMotionSignature(frameState);
    if (
      completedOneShotRequestSignature
      && completedOneShotRequestSignature === requestedMotionSignature
      && frameState.motionState.fallbackCandidateClipNames.length
    ) {
      return frameState.motionState.fallbackCandidateClipNames;
    }

    return frameState.motionState.candidateClipNames.length
      ? frameState.motionState.candidateClipNames
      : DEFAULT_MOTION_CANDIDATES;
  }

  function shouldSwitchMotion(
    nextMotionSignature: string,
    nextRequestedMotionSignature: string,
    frameState?: Avatar3DRuntimeFrameState,
  ) {
    if (!activeClipEntry || !frameState?.motionState) {
      return true;
    }

    if (nextMotionSignature === activeMotionSignature) {
      return false;
    }

    const nextPriority = frameState.motionState.priority;
    const isWithinLockWindow = elapsedMs < activeMotionLockUntilMs;
    if (
      isWithinLockWindow
      && nextPriority < activeMotionPriority
    ) {
      return false;
    }

    if (
      isWithinLockWindow
      && !activeMotionAllowInterruption
      && nextRequestedMotionSignature !== activeRequestedMotionSignature
      && nextPriority <= activeMotionPriority
    ) {
      return false;
    }

    return true;
  }

  function playClipEntry(
    nextClipEntry: PreparedClipEntry,
    nextMotionSignature: string,
    nextRequestedMotionSignature: string,
    frameState?: Avatar3DRuntimeFrameState,
  ) {
    const nextAction = nextClipEntry.action;
    applyMotionSettings(nextClipEntry, frameState);

    if (activeClipEntry && activeClipEntry !== nextClipEntry) {
      activeClipEntry.action.fadeOut(MOTION_CROSS_FADE_SECONDS);
      nextAction
        .reset()
        .fadeIn(MOTION_CROSS_FADE_SECONDS)
        .play();
    } else if (!nextAction.isRunning()) {
      nextAction.reset().play();
    } else {
      nextAction.play();
    }

    activeClipEntry = nextClipEntry;
    activeMotionAllowInterruption = frameState?.motionState?.allowInterruption ?? true;
    activeMotionSignature = nextMotionSignature;
    activeRequestedMotionSignature = nextRequestedMotionSignature;
    activeMotionPriority = frameState?.motionState?.priority ?? 0;
    activeMotionLockUntilMs = elapsedMs + (frameState?.motionState?.lockMs ?? 0);
  }

  function stopActiveClipEntry(
    nextMotionSignature: string,
    nextRequestedMotionSignature: string,
    frameState?: Avatar3DRuntimeFrameState,
  ) {
    if (activeClipEntry) {
      activeClipEntry.action.fadeOut(MOTION_CROSS_FADE_SECONDS);
    }

    activeClipEntry = null;
    activeMotionAllowInterruption = frameState?.motionState?.allowInterruption ?? true;
    activeMotionSignature = nextMotionSignature;
    activeRequestedMotionSignature = nextRequestedMotionSignature;
    activeMotionPriority = frameState?.motionState?.priority ?? 0;
    activeMotionLockUntilMs = elapsedMs + (frameState?.motionState?.lockMs ?? 0);
  }

  return createAvatar3DRuntimeInstance({
    debugSummary,
    dispose: () => {
      mixer.stopAllAction();
      mixer.uncacheRoot(object);
      dispose?.();
    },
    object,
    sourceLabel,
    update: (delta, frameState) => {
      elapsedMs += Math.max(0, delta * 1000);
      const requestedMotionSignature = resolveRequestedMotionSignature(frameState);
      if (requestedMotionSignature !== completedOneShotRequestSignature) {
        completedOneShotRequestSignature = '';
        fallbackActiveForCompletedRequest = false;
      }

      const candidateClipNames = resolveEffectiveCandidateClipNames(frameState);
      const nextClipEntry = resolveMatchingClipEntry(clipEntries, candidateClipNames, {
        allowFirstClipFallback: shouldAllowFirstClipFallback(frameState),
      });
      const nextMotionSignature = resolveMotionSignature(nextClipEntry, frameState);
      const canSwitchMotion = shouldSwitchMotion(
        nextMotionSignature,
        requestedMotionSignature,
        frameState,
      );

      if (nextClipEntry && canSwitchMotion) {
        playClipEntry(
          nextClipEntry,
          nextMotionSignature,
          requestedMotionSignature,
          frameState,
        );
      } else if (!nextClipEntry && canSwitchMotion) {
        stopActiveClipEntry(
          nextMotionSignature,
          requestedMotionSignature,
          frameState,
        );
      }

      mixer.update(Math.max(0, delta));

      if (
        isMotionActionFinished(activeClipEntry, frameState)
        && frameState?.motionState?.fallbackTransitionOnComplete
        && !fallbackActiveForCompletedRequest
      ) {
        completedOneShotRequestSignature = requestedMotionSignature;
        fallbackActiveForCompletedRequest = true;
        const fallbackClipEntry = resolveMatchingClipEntry(
          clipEntries,
          frameState.motionState.completionCandidateClipNames,
          {
            allowFirstClipFallback: shouldAllowFirstClipFallback(frameState),
          },
        );
        if (fallbackClipEntry) {
          const fallbackFrameState = {
            ...frameState,
            motionState: {
              ...frameState.motionState,
              candidateClipNames: frameState.motionState.completionCandidateClipNames,
              loopMode: 'repeat' as const,
              motionKey: frameState.motionState.completionMotionKey ?? frameState.motionState.motionKey,
              resolvedMotionKeys: frameState.motionState.completionResolvedMotionKeys.length
                ? frameState.motionState.completionResolvedMotionKeys
                : frameState.motionState.resolvedMotionKeys,
            },
          } satisfies Avatar3DRuntimeFrameState;
          const fallbackMotionSignature = resolveMotionSignature(
            fallbackClipEntry,
            fallbackFrameState,
          );
          playClipEntry(
            fallbackClipEntry,
            fallbackMotionSignature,
            requestedMotionSignature,
            fallbackFrameState,
          );
        }
      }

      update?.(delta, frameState);
    },
  });
}
