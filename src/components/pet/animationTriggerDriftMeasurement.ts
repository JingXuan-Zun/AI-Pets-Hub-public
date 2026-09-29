import { type DesktopPetAnimationToolTrigger } from '../../chatState';
import { pushFrontendRuntimeLog } from '../../frontendRuntimeLogger';
import { type AnimationToolAudioScheduleSyncScheduler } from './animationToolAudioScheduleSync';

export type AnimationTriggerDriftScheduler = AnimationToolAudioScheduleSyncScheduler | 'timer';
export type AnimationTriggerDriftSeverity = 'ok' | 'notice' | 'warn';

export interface AnimationTriggerDriftSample {
  absoluteDriftMs: number;
  actualFiredAtMs: number;
  batchDelayMs: number;
  batchSize: number;
  driftMs: number;
  plannedDelayMs: number;
  plannedFireAtMs: number;
  scheduledAtMs: number;
  scheduleBaseDelayMs: number;
  scheduler: AnimationTriggerDriftScheduler;
  severity: AnimationTriggerDriftSeverity;
  token: number;
  triggerSource: DesktopPetAnimationToolTrigger['source'];
}

const DRIFT_NOTICE_THRESHOLD_MS = 80;
const DRIFT_WARN_THRESHOLD_MS = 180;

function roundMs(value: number) {
  return Math.round(Number.isFinite(value) ? value : 0);
}

export function getAnimationTriggerDriftNowMs() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

export function resolveAnimationTriggerDriftSeverity(absoluteDriftMs: number): AnimationTriggerDriftSeverity {
  if (absoluteDriftMs >= DRIFT_WARN_THRESHOLD_MS) {
    return 'warn';
  }

  return absoluteDriftMs >= DRIFT_NOTICE_THRESHOLD_MS ? 'notice' : 'ok';
}

export function createAnimationTriggerDriftSample(options: {
  actualFiredAtMs: number;
  batchDelayMs: number;
  batchSize: number;
  plannedDelayMs: number;
  scheduledAtMs: number;
  scheduleBaseDelayMs: number;
  scheduler: AnimationTriggerDriftScheduler;
  token: number;
  triggerSource: DesktopPetAnimationToolTrigger['source'];
}): AnimationTriggerDriftSample {
  const scheduledAtMs = roundMs(options.scheduledAtMs);
  const plannedDelayMs = roundMs(options.plannedDelayMs);
  const actualFiredAtMs = roundMs(options.actualFiredAtMs);
  const plannedFireAtMs = scheduledAtMs + plannedDelayMs;
  const driftMs = actualFiredAtMs - plannedFireAtMs;
  const absoluteDriftMs = Math.abs(driftMs);

  return {
    absoluteDriftMs,
    actualFiredAtMs,
    batchDelayMs: roundMs(options.batchDelayMs),
    batchSize: Math.max(0, Math.round(options.batchSize)),
    driftMs,
    plannedDelayMs,
    plannedFireAtMs,
    scheduledAtMs,
    scheduleBaseDelayMs: roundMs(options.scheduleBaseDelayMs),
    scheduler: options.scheduler,
    severity: resolveAnimationTriggerDriftSeverity(absoluteDriftMs),
    token: options.token,
    triggerSource: options.triggerSource,
  };
}

export type AnimationTriggerDriftReporter = (sample: AnimationTriggerDriftSample) => void;

export function reportAnimationTriggerDriftSample(sample: AnimationTriggerDriftSample) {
  pushFrontendRuntimeLog(
    'character-animation',
    `skill animation schedule drift ${sample.severity}`,
    sample,
  );
}
