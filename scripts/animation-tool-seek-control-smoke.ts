import assert from 'node:assert/strict';
import { desktopPetChatStore } from '../src/chatStore';
import { type DesktopPetAnimationToolTrigger } from '../src/chatState';
import { handleAnimationToolTriggerPlayback } from '../src/components/pet/animationToolTriggerPlayback';
import {
  controlAnimationToolAudioRuntime,
  type AnimationToolAudioPlaybackRefs,
} from '../src/components/pet/animationToolAudioPlaybackRuntime';
import { createPlayableAnimationToolAudioPlaybackState } from '../src/components/pet/animationToolAudioPlaybackState';
import { createSeekedAnimationToolTrigger } from '../src/components/pet/animationToolScheduleSeek';
import { createAnimationTriggerSeekDriftSummary } from '../src/components/settings/animationTriggerSeekDriftCorrelation';
import { createAnimationTriggerSeekQaSummary } from '../src/components/settings/animationTriggerSeekQaSummary';
import { type PetModelMotionBinding } from '../src/types';

function installFakeWindowTimers() {
  const timeouts = new Map<number, { callback: () => void; delayMs: number }>();
  let nextTimeoutId = 1;
  const previousWindow = globalThis.window;
  (globalThis as typeof globalThis & { window: unknown }).window = {
    clearTimeout: (timeoutId: number) => {
      timeouts.delete(timeoutId);
    },
    setTimeout: (callback: () => void, delayMs: number) => {
      const timeoutId = nextTimeoutId;
      nextTimeoutId += 1;
      timeouts.set(timeoutId, { callback, delayMs });
      return timeoutId;
    },
  };

  return {
    delayFor(timeoutId: number) {
      return timeouts.get(timeoutId)?.delayMs ?? null;
    },
    restore() {
      if (previousWindow === undefined) {
        delete (globalThis as typeof globalThis & { window?: unknown }).window;
        return;
      }

      (globalThis as typeof globalThis & { window: unknown }).window = previousWindow;
    },
  };
}

function createRefs(trigger: DesktopPetAnimationToolTrigger): AnimationToolAudioPlaybackRefs {
  return {
    activeAudioTriggerRef: { current: trigger },
    activePlaybackTokenRef: { current: trigger.token },
    playbackSessionRef: {
      current: {
        done: Promise.resolve(),
        resume: (positionMs) => ({
          playbackPositionMs: positionMs ?? 0,
          playbackState: 'playing',
          resumeSupported: true,
        }),
        stop: () => undefined,
      },
    },
    startTimerRef: { current: null },
  };
}

const motionBindings = [
  {
    format: 'vrma',
    id: 'binding-intro',
    motionKey: 'happy',
    name: 'Intro Pose',
    sourceUrl: 'C:/motions/intro.vrma',
  },
  {
    format: 'vrma',
    id: 'binding-chorus',
    motionKey: 'happy',
    name: 'Chorus Dance',
    sourceUrl: 'C:/motions/chorus.vrma',
  },
] satisfies PetModelMotionBinding[];

const timelineTrigger = {
  animationIds: ['intro_pose', 'chorus_dance'],
  audio: {
    durationMs: 9000,
    playbackUrl: 'https://example.test/song.mp3',
    source: 'song',
    sourceRef: 'song:main-theme',
  },
  schedule: [
    { animationId: 'intro_pose', delayMs: 0 },
    { animationId: 'chorus_dance', delayMs: 4000 },
    { animationId: 'intro_pose', delayMs: 8000 },
  ],
  source: 'agent-skill',
  token: 30,
} satisfies DesktopPetAnimationToolTrigger;

assert.deepEqual(createSeekedAnimationToolTrigger(timelineTrigger, 2500)?.schedule, [
  { animationId: 'chorus_dance', delayMs: 1500 },
  { animationId: 'intro_pose', delayMs: 5500 },
]);
assert.equal(createSeekedAnimationToolTrigger(timelineTrigger, 9000), null);

const timers = installFakeWindowTimers();
try {
  const timeoutIdsRef = { current: [] as number[] };
  const seekTelemetrySamples: unknown[] = [];
  const seekResult = handleAnimationToolTriggerPlayback({
    animationToolTrigger: {
      animationIds: [],
      control: 'seek',
      seekPositionMs: 2500,
      source: 'user-direct',
      token: 31,
    },
    enqueueAnimationBindings: () => undefined,
    lastReplayableTrigger: timelineTrigger,
    motionBindings,
    reportSeek: (sample) => seekTelemetrySamples.push(sample),
    resetMotionPlayback: () => undefined,
    scheduledTriggerTimeoutsRef: timeoutIdsRef,
  });

  assert.deepEqual(seekResult, {
    handled: true,
    itemCount: 2,
    status: 'playing',
    triggerKind: 'scheduled',
  });
  assert.equal(timeoutIdsRef.current.length, 2);
  assert.equal(timers.delayFor(timeoutIdsRef.current[0]!), 1500);
  assert.equal(timers.delayFor(timeoutIdsRef.current[1]!), 5500);
  assert.deepEqual(seekTelemetrySamples[0], {
    controlToken: 31,
    firstDelayMs: 1500,
    lastDelayMs: 5500,
    originalItemCount: 3,
    outcome: 'applied',
    reason: 'rebased-schedule',
    remainingItemCount: 2,
    replayToken: 30,
    seekPositionMs: 2500,
    triggerSource: 'user-direct',
  });
} finally {
  timers.restore();
}

const emptySeekTelemetrySamples: unknown[] = [];
handleAnimationToolTriggerPlayback({
  animationToolTrigger: {
    animationIds: [],
    control: 'seek',
    seekPositionMs: 9000,
    source: 'user-direct',
    token: 32,
  },
  enqueueAnimationBindings: () => undefined,
  lastReplayableTrigger: timelineTrigger,
  motionBindings,
  reportSeek: (sample) => emptySeekTelemetrySamples.push(sample),
  resetMotionPlayback: () => undefined,
  scheduledTriggerTimeoutsRef: { current: [] },
});
assert.deepEqual(emptySeekTelemetrySamples[0], {
  controlToken: 32,
  firstDelayMs: 0,
  lastDelayMs: 0,
  originalItemCount: 3,
  outcome: 'empty',
  reason: 'no-future-schedule',
  remainingItemCount: 0,
  replayToken: 30,
  seekPositionMs: 9000,
  triggerSource: 'user-direct',
});

const appliedSeekLine = '[12:00:05][frontend][main/character-animation] skill animation schedule seek applied {controlToken: 31, firstDelayMs: 1500, lastDelayMs: 5500, originalItemCount: 3, outcome: applied, reason: rebased-schedule, remainingItemCount: 2, replayToken: 30, seekPositionMs: 2500, triggerSource: user-direct}';
const emptySeekLine = '[12:00:06][frontend][main/character-animation] skill animation schedule seek empty {controlToken: 32, firstDelayMs: 0, lastDelayMs: 0, originalItemCount: 3, outcome: empty, reason: no-future-schedule, remainingItemCount: 0, replayToken: 30, seekPositionMs: 9000, triggerSource: user-direct}';
const postSeekDriftLine = '[12:00:07][frontend][main/character-animation] skill animation schedule drift notice {absoluteDriftMs: 84, actualFiredAtMs: 1420, batchDelayMs: 1500, batchSize: 1, driftMs: 84, plannedDelayMs: 1500, plannedFireAtMs: 1336, scheduledAtMs: -164, scheduleBaseDelayMs: 0, scheduler: timer, token: 30, triggerSource: agent-skill}';
const unrelatedDriftLine = '[12:00:08][frontend][main/character-animation] skill animation schedule drift warn {absoluteDriftMs: 205, actualFiredAtMs: 1420, batchDelayMs: 400, batchSize: 2, driftMs: -205, plannedDelayMs: 550, plannedFireAtMs: 1625, scheduledAtMs: 1075, scheduleBaseDelayMs: 150, scheduler: clocked, token: 88, triggerSource: agent-skill}';
const seekSummary = createAnimationTriggerSeekQaSummary([appliedSeekLine, emptySeekLine]);
assert.equal(seekSummary.sampleCount, 2);
assert.equal(seekSummary.appliedCount, 1);
assert.equal(seekSummary.emptyCount, 1);
assert.equal(seekSummary.latestSample?.seekPositionMs, 2500);
assert.deepEqual(seekSummary.recentSamples.map((sample) => sample.outcome), ['applied', 'empty']);

const seekDriftSummary = createAnimationTriggerSeekDriftSummary([
  emptySeekLine,
  unrelatedDriftLine,
  postSeekDriftLine,
  appliedSeekLine,
]);
assert.equal(seekDriftSummary.sampleCount, 2);
assert.equal(seekDriftSummary.correlatedCount, 1);
assert.equal(seekDriftSummary.recentCorrelations[0]?.seek.outcome, 'empty');
assert.equal(seekDriftSummary.recentCorrelations[0]?.driftSampleCount, 0);
assert.equal(seekDriftSummary.recentCorrelations[1]?.status, 'notice');
assert.equal(seekDriftSummary.recentCorrelations[1]?.driftSampleCount, 1);
assert.equal(seekDriftSummary.recentCorrelations[1]?.maxAbsoluteDriftMs, 84);

desktopPetChatStore.reset();
desktopPetChatStore.seekAnimationToolTrigger('primary', 4321);
const seekStoreTrigger = desktopPetChatStore.getState().animationToolTriggersByPetId.primary;
assert.equal(seekStoreTrigger?.control, 'seek');
assert.equal(seekStoreTrigger?.seekPositionMs, 4321);

const publishedStatuses: string[] = [];
assert.equal(controlAnimationToolAudioRuntime(
  createRefs(timelineTrigger),
  (trigger, status, _errorMessage, snapshot) => {
    publishedStatuses.push(createPlayableAnimationToolAudioPlaybackState({
      controlSnapshot: snapshot,
      petId: 'primary',
      status,
      trigger,
    })?.status ?? '');
    assert.equal(snapshot?.playbackPositionMs, 4321);
  },
  seekStoreTrigger!,
), true);
assert.deepEqual(publishedStatuses, ['playing']);

console.log('animation tool seek control smoke ok');
