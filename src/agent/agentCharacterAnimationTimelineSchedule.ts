import { type DesktopPetAnimationToolTriggerScheduleItem } from '../chatState';
import { type AgentCharacterAnimationTimelineStep } from './agentCharacterAnimationTimelineInput';
import { type AgentCharacterAnimationTimelineSync } from './agentCharacterAnimationTimelineSync';

export interface AgentCharacterAnimationTimelineStepResult {
  animationId: string | null;
  expressionId: string | null;
  index: number;
}

function resolveBeatDelayMs(
  step: AgentCharacterAnimationTimelineStep,
  sync: AgentCharacterAnimationTimelineSync | null,
) {
  if (!sync?.bpm || !step.sync?.beat) {
    return null;
  }

  const beatDurationMs = 60_000 / sync.bpm;
  const barOffsetBeats = step.sync.bar && step.sync.bar > 1
    ? (step.sync.bar - 1) * 4
    : 0;
  return Math.max(0, Math.round(
    (sync.audioOffsetMs ?? 0) + ((barOffsetBeats + step.sync.beat - 1) * beatDurationMs),
  ));
}

function resolveStepDelayMs(
  step: AgentCharacterAnimationTimelineStep,
  sync: AgentCharacterAnimationTimelineSync | null,
) {
  if (step.atMs !== undefined) {
    return step.atMs;
  }

  return resolveBeatDelayMs(step, sync);
}

function pushScheduleItem(
  schedule: DesktopPetAnimationToolTriggerScheduleItem[],
  animationId: string | null,
  delayMs: number | null,
) {
  if (!animationId || delayMs === null) {
    return;
  }

  schedule.push({ animationId, delayMs });
}

export function createAgentCharacterAnimationTimelineSchedule(
  options: {
    stepResults: AgentCharacterAnimationTimelineStepResult[];
    steps: AgentCharacterAnimationTimelineStep[];
    sync: AgentCharacterAnimationTimelineSync | null;
  },
) {
  const schedule: DesktopPetAnimationToolTriggerScheduleItem[] = [];
  options.stepResults.forEach((result) => {
    const step = options.steps[result.index];
    if (!step) {
      return;
    }

    const delayMs = resolveStepDelayMs(step, options.sync);
    pushScheduleItem(schedule, result.animationId, delayMs);
    pushScheduleItem(schedule, result.expressionId, delayMs);
  });

  return schedule;
}
