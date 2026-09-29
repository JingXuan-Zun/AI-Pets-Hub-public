import { desktopPetChatStore } from '../chatStore';
import {
  DEFAULT_CHAT_ACTIVE_PET_ID,
  type DesktopPetAnimationToolTriggerAudio,
  type DesktopPetAnimationToolTriggerScheduleItem,
} from '../chatState';
import {
  getDesktopPetSlot,
  getRenderableDesktopPetSlots,
  PRIMARY_DESKTOP_PET_SLOT_ID,
} from '../multiPetRoster';
import { canModelTypeUseMotionBindings } from '../pet-runtime/live2d/live2dModelSupport';
import {
  resolveCharacterAnimationToolOptionId,
  resolveDirectCharacterAnimationTriggerIds,
} from '../components/chat/characterAnimationToolProtocol';
import { type ModelType, type PetConfig, type PetModelMotionBinding, type PetModelPreset } from '../types';
import {
  resolveAgentCharacterAnimationTimelineInput,
  type AgentCharacterAnimationTimelineStep,
} from './agentCharacterAnimationTimeline';
import { resolveAgentCharacterAnimationTriggerAudio } from './agentCharacterAnimationAudioLibrary';
import { type AgentSkillExecutionResult } from './agentSkillRegistry';
import { CHARACTER_ANIMATION_TRIGGER_ID_LIMIT } from '../characterAnimationChoreographyLimits';

export type AgentCharacterMotionBindingResolver = (options: {
  customModelPresets: PetModelPreset[];
  modelType: ModelType;
  modelUrl: string;
}) => PetModelMotionBinding[];

export interface AgentCharacterAnimationSkillRequest {
  config: PetConfig;
  dryRun?: boolean | null;
  intent?: string | null;
  input: Record<string, unknown>;
  resolveMotionBindings?: AgentCharacterMotionBindingResolver;
  target?: string | null;
}

export interface AgentCharacterAnimationSkillResult {
  animationIds: string[];
  audio: DesktopPetAnimationToolTriggerAudio | null;
  observations: string[];
  ok: boolean;
  petId: string | null;
  petName: string | null;
  schedule: DesktopPetAnimationToolTriggerScheduleItem[];
  summary: string;
  timelineSteps: AgentCharacterAnimationTimelineStep[];
}

function getStringInput(input: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = input[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

function getStringArrayInput(input: Record<string, unknown>, key: string) {
  const value = input[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
    : [];
}

function resolveTargetPetSlot(config: PetConfig, targetPetId?: string | null) {
  const chatState = desktopPetChatStore.getState();
  const requestedPetId = targetPetId?.trim()
    || chatState.activePetId
    || DEFAULT_CHAT_ACTIVE_PET_ID
    || PRIMARY_DESKTOP_PET_SLOT_ID;
  const targetSlot = getDesktopPetSlot(config, requestedPetId);

  return targetSlot ?? getRenderableDesktopPetSlots(config)[0] ?? null;
}

function resolveRequestedAnimationTexts(
  input: Record<string, unknown>,
  intent?: string | null,
  target?: string | null,
) {
  return [
    getStringInput(input, ['animationId', 'motionId', 'expressionId']),
    ...getStringArrayInput(input, 'animationIds'),
    getStringInput(input, ['name', 'query']),
    intent?.trim() ?? '',
    target?.trim() ?? '',
  ].filter(Boolean);
}

function resolveAnimationIdsFromText(text: string, motionBindings: Parameters<typeof resolveCharacterAnimationToolOptionId>[1]) {
  const directOptionId = resolveCharacterAnimationToolOptionId(text, motionBindings);
  return directOptionId
    ? [directOptionId]
    : resolveDirectCharacterAnimationTriggerIds(text, motionBindings);
}

function resolveMotionBindingsForSkillRequest(
  options: AgentCharacterAnimationSkillRequest,
  targetSlot: NonNullable<ReturnType<typeof resolveTargetPetSlot>>,
) {
  return options.resolveMotionBindings?.({
    customModelPresets: options.config.customModelPresets,
    modelType: targetSlot.modelType,
    modelUrl: targetSlot.modelUrl,
  }) ?? [];
}

function resolveAnimationIdsForRequest(options: AgentCharacterAnimationSkillRequest) {
  const targetSlot = resolveTargetPetSlot(
    options.config,
    getStringInput(options.input, ['targetPetId', 'petId']),
  );
  if (!targetSlot) {
    return {
      animationIds: [],
      audio: null,
      motionBindingCount: 0,
      schedule: [],
      targetSlot: null,
      timelineObservations: [],
      timelineSteps: [],
    };
  }

  const motionBindings = resolveMotionBindingsForSkillRequest(options, targetSlot);
  const timelineResult = resolveAgentCharacterAnimationTimelineInput(options.input, motionBindings);
  const requestedTexts = resolveRequestedAnimationTexts(options.input, options.intent, options.target);
  const resolvedIds = requestedTexts.flatMap((text) => (
    resolveAnimationIdsFromText(text, motionBindings)
  ));
  const allResolvedIds = [
    ...timelineResult.animationIds,
    ...resolvedIds,
  ];
  const audioResult = resolveAgentCharacterAnimationTriggerAudio(timelineResult.audio, options.config);

  return {
    animationIds: Array.from(new Set(allResolvedIds)).slice(0, CHARACTER_ANIMATION_TRIGGER_ID_LIMIT),
    audio: audioResult.audio,
    motionBindingCount: motionBindings.length,
    schedule: timelineResult.schedule,
    targetSlot,
    timelineObservations: [
      ...timelineResult.observations,
      ...audioResult.observations,
    ],
    timelineSteps: timelineResult.steps,
  };
}

function createCharacterAnimationObservations(
  targetSlot: ReturnType<typeof resolveTargetPetSlot>,
  animationIds: string[],
  dryRun: boolean,
  motionBindingCount: number,
  timelineObservations: string[],
) {
  return [
    targetSlot ? `Target pet: ${targetSlot.id}` : 'Target pet: unresolved',
    targetSlot ? `Target model: ${targetSlot.modelType}` : '',
    `Motion bindings: ${motionBindingCount}`,
    ...timelineObservations,
    `Animation ids: ${animationIds.join(', ') || 'none'}`,
    dryRun ? 'Mode: dry-run' : 'Mode: execute',
  ].filter(Boolean);
}

export function runCharacterAnimationSkill(
  request: AgentCharacterAnimationSkillRequest,
): AgentCharacterAnimationSkillResult {
  const dryRun = request.dryRun !== false;
  const {
    animationIds,
    audio,
    motionBindingCount,
    schedule,
    targetSlot,
    timelineObservations,
    timelineSteps,
  } = resolveAnimationIdsForRequest(request);
  const observations = createCharacterAnimationObservations(
    targetSlot,
    animationIds,
    dryRun,
    motionBindingCount,
    timelineObservations,
  );

  if (!targetSlot) {
    return {
      animationIds,
      audio,
      observations,
      ok: false,
      petId: null,
      petName: null,
      schedule,
      summary: 'No renderable desktop pet was available for this animation skill.',
      timelineSteps,
    };
  }

  if (!canModelTypeUseMotionBindings(targetSlot.modelType) || motionBindingCount === 0) {
    return {
      animationIds,
      audio,
      observations,
      ok: false,
      petId: targetSlot.id,
      petName: targetSlot.personality.name,
      schedule,
      summary: `Pet ${targetSlot.id} has no playable motion bindings for Skill animation.`,
      timelineSteps,
    };
  }

  if (animationIds.length === 0) {
    return {
      animationIds,
      audio,
      observations,
      ok: false,
      petId: targetSlot.id,
      petName: targetSlot.personality.name,
      schedule,
      summary: 'No matching character animation was found for this Skill request.',
      timelineSteps,
    };
  }

  if (!dryRun) {
    desktopPetChatStore.queueAnimationToolTrigger(targetSlot.id, animationIds, 'agent-skill', schedule, audio);
  }

  return {
    animationIds,
    audio,
    observations,
    ok: true,
    petId: targetSlot.id,
    petName: targetSlot.personality.name,
    schedule,
    summary: dryRun
      ? `Resolved ${animationIds.length} animation(s) for ${targetSlot.id}.`
      : `Queued ${animationIds.length} animation(s) for ${targetSlot.id}.`,
    timelineSteps,
  };
}

export function mergeCharacterAnimationSkillResult(
  skillResult: AgentSkillExecutionResult,
  animationResult: AgentCharacterAnimationSkillResult,
): AgentSkillExecutionResult {
  return {
    ...skillResult,
    observations: [
      ...skillResult.observations,
      ...animationResult.observations,
    ],
    ok: skillResult.ok && animationResult.ok,
    summary: animationResult.summary,
  };
}
