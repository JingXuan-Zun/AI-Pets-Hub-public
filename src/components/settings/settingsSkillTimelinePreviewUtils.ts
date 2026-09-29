import { runCharacterAnimationSkill } from '../../agent/agentCharacterSkillRuntime';
import {
  resolveAgentCharacterAnimationTimelineSync,
  type AgentCharacterAnimationTimelineSync,
} from '../../agent/agentCharacterAnimationTimelineSync';
import { PRIMARY_DESKTOP_PET_SLOT_ID } from '../../multiPetRoster';
import { isPetModelExpressionBinding } from '../../pet-runtime/content/petModelMotionBindingKinds';
import { type PetConfig, type PetModelMotionBinding } from '../../types';
import {
  resolveSettingsSkillTimelineCandidate,
  resolveSettingsSkillTimelineMotionBindings,
} from './settingsSkillTimelineBindingOptions';

export interface SkillTimelinePreviewStepRow {
  delayMs: number | null;
  expressionCandidates: string[];
  label: string;
  motionCandidates: string[];
}

export interface SkillTimelinePreviewResult {
  animationIds: string[];
  audioLabel: string;
  error: string | null;
  observationLines: string[];
  ok: boolean;
  scheduleCount: number;
  stepRows: SkillTimelinePreviewStepRow[];
  summary: string;
}

function parseTimelinePreviewInput(inputJson: string) {
  try {
    const value = JSON.parse(inputJson) as unknown;
    return value && typeof value === 'object' && !Array.isArray(value)
      ? { input: value as Record<string, unknown>, ok: true }
      : { input: null, ok: false };
  } catch {
    return { input: null, ok: false };
  }
}

function createDefaultTimelineSteps(motionBindings: PetModelMotionBinding[]) {
  const motionBindingsOnly = motionBindings.filter((binding) => !isPetModelExpressionBinding(binding));
  const expressionBinding = motionBindings.find(isPetModelExpressionBinding);
  const motions = motionBindingsOnly.slice(0, 3);

  return motions.length > 0
    ? motions.map((binding, index) => ({
        animationId: resolveSettingsSkillTimelineCandidate(binding),
        ...(index === 0 && expressionBinding ? {
          expressionId: resolveSettingsSkillTimelineCandidate(expressionBinding),
        } : {}),
        beat: (index * 2) + 1,
        label: binding.name,
      }))
    : [
        { animationId: 'wave', beat: 1 },
        { animationId: 'spin', beat: 3 },
        { animationId: 'clap', beat: 5 },
      ];
}

export function createDefaultSkillTimelinePreviewInput(
  config: PetConfig,
  targetPetId?: string | null,
) {
  const motionBindings = resolveSettingsSkillTimelineMotionBindings(
    config,
    targetPetId?.trim() || PRIMARY_DESKTOP_PET_SLOT_ID,
  );
  return JSON.stringify({
    beatCount: 8,
    bpm: 120,
    offsetMs: 0,
    timeline: createDefaultTimelineSteps(motionBindings),
  }, null, 2);
}

function resolveStepBeatDelayMs(
  step: ReturnType<typeof runCharacterAnimationSkill>['timelineSteps'][number],
  sync: AgentCharacterAnimationTimelineSync | null,
) {
  if (!step.sync?.beat || !sync?.bpm) {
    return null;
  }

  const beatDurationMs = 60_000 / sync.bpm;
  const barOffsetBeats = step.sync.bar && step.sync.bar > 1
    ? (step.sync.bar - 1) * 4
    : 0;
  return Math.max(0, Math.round((sync.audioOffsetMs ?? 0) + ((barOffsetBeats + step.sync.beat - 1) * beatDurationMs)));
}

function resolveStepPreviewDelayMs(
  step: ReturnType<typeof runCharacterAnimationSkill>['timelineSteps'][number],
  sync: AgentCharacterAnimationTimelineSync | null,
) {
  if (step.atMs !== undefined) {
    return step.atMs;
  }

  return resolveStepBeatDelayMs(step, sync);
}

function createStepRows(
  result: ReturnType<typeof runCharacterAnimationSkill>,
  sync: AgentCharacterAnimationTimelineSync | null,
): SkillTimelinePreviewStepRow[] {
  return result.timelineSteps.map((step, index) => ({
    delayMs: resolveStepPreviewDelayMs(step, sync),
    expressionCandidates: step.expressionCandidates,
    label: step.label ?? `Step ${index + 1}`,
    motionCandidates: [...step.motionCandidates, ...step.textCandidates],
  }));
}

function createAudioLabel(result: ReturnType<typeof runCharacterAnimationSkill>) {
  if (!result.audio) {
    return 'none';
  }

  const parts = [
    result.audio.source,
    result.audio.sourceRef,
    result.audio.offsetMs === undefined ? '' : `offset ${result.audio.offsetMs}ms`,
    result.audio.startDelayMs === undefined ? '' : `start ${result.audio.startDelayMs}ms`,
  ].filter(Boolean);
  return parts.join(' / ');
}

export function createSkillTimelinePreview(
  options: {
    config: PetConfig;
    inputJson: string;
    targetPetId?: string | null;
  },
): SkillTimelinePreviewResult {
  const parsedInput = parseTimelinePreviewInput(options.inputJson);
  if (!parsedInput.ok || !parsedInput.input) {
    return {
      animationIds: [],
      audioLabel: 'none',
      error: 'Input must be a JSON object.',
      observationLines: [],
      ok: false,
      scheduleCount: 0,
      stepRows: [],
      summary: 'Timeline preview could not parse the input.',
    };
  }

  const targetPetId = options.targetPetId?.trim() || PRIMARY_DESKTOP_PET_SLOT_ID;
  const sync = resolveAgentCharacterAnimationTimelineSync(parsedInput.input);
  const result = runCharacterAnimationSkill({
    config: options.config,
    dryRun: true,
    input: { ...parsedInput.input, targetPetId },
    resolveMotionBindings: () => resolveSettingsSkillTimelineMotionBindings(
      options.config,
      targetPetId,
    ) as PetModelMotionBinding[],
  });

  return {
    animationIds: result.animationIds,
    audioLabel: createAudioLabel(result),
    error: result.ok ? null : result.summary,
    observationLines: result.observations.slice(0, 8),
    ok: result.ok,
    scheduleCount: result.schedule.length,
    stepRows: createStepRows(result, sync),
    summary: result.summary,
  };
}
