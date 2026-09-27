import { type DesktopPetAnimationToolTrigger } from '../../chatState';
import { pushFrontendRuntimeLog } from '../../frontendRuntimeLogger';

export type AnimationToolScheduleSeekOutcome = 'applied' | 'empty' | 'unavailable';

export interface AnimationToolScheduleSeekTelemetrySample {
  controlToken: number;
  firstDelayMs: number;
  lastDelayMs: number;
  originalItemCount: number;
  outcome: AnimationToolScheduleSeekOutcome;
  reason: string;
  remainingItemCount: number;
  replayToken: number;
  seekPositionMs: number;
  triggerSource: DesktopPetAnimationToolTrigger['source'];
}

function resolveFirstDelayMs(trigger: DesktopPetAnimationToolTrigger | null | undefined) {
  return trigger?.schedule?.[0]?.delayMs ?? 0;
}

function resolveLastDelayMs(trigger: DesktopPetAnimationToolTrigger | null | undefined) {
  const schedule = trigger?.schedule ?? [];
  return schedule.length > 0 ? schedule[schedule.length - 1]?.delayMs ?? 0 : 0;
}

export function createAnimationToolScheduleSeekTelemetrySample(options: {
  controlTrigger: DesktopPetAnimationToolTrigger;
  lastReplayableTrigger?: DesktopPetAnimationToolTrigger | null;
  outcome: AnimationToolScheduleSeekOutcome;
  reason: string;
  seekedTrigger?: DesktopPetAnimationToolTrigger | null;
  seekPositionMs: number;
}): AnimationToolScheduleSeekTelemetrySample {
  const originalSchedule = options.lastReplayableTrigger?.schedule ?? [];
  const remainingSchedule = options.seekedTrigger?.schedule ?? [];
  return {
    controlToken: options.controlTrigger.token,
    firstDelayMs: resolveFirstDelayMs(options.seekedTrigger),
    lastDelayMs: resolveLastDelayMs(options.seekedTrigger),
    originalItemCount: originalSchedule.length,
    outcome: options.outcome,
    reason: options.reason,
    remainingItemCount: remainingSchedule.length,
    replayToken: options.lastReplayableTrigger?.token ?? 0,
    seekPositionMs: Math.max(0, Math.round(Number(options.seekPositionMs) || 0)),
    triggerSource: options.controlTrigger.source,
  };
}

export type AnimationToolScheduleSeekTelemetryReporter = (
  sample: AnimationToolScheduleSeekTelemetrySample,
) => void;

export function reportAnimationToolScheduleSeekTelemetrySample(
  sample: AnimationToolScheduleSeekTelemetrySample,
) {
  pushFrontendRuntimeLog(
    'character-animation',
    `skill animation schedule seek ${sample.outcome}`,
    sample,
  );
}
