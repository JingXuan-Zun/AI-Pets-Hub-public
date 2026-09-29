import {
  resolveCharacterAnimationToolOptionId,
  resolveDirectCharacterAnimationTriggerIds,
} from '../components/chat/characterAnimationToolProtocol';
import { isPetModelExpressionBinding } from '../pet-runtime/content/petModelMotionBindingKinds';
import { type PetModelMotionBinding } from '../types';
import {
  createAgentCharacterAnimationTimelineSource,
  normalizeAgentCharacterAnimationTimelineStep,
  type AgentCharacterAnimationTimelineStep,
} from './agentCharacterAnimationTimelineInput';
import {
  createAgentCharacterAnimationTimelineSyncObservations,
  resolveAgentCharacterAnimationTimelineSync,
  type AgentCharacterAnimationTimelineSync,
} from './agentCharacterAnimationTimelineSync';
import {
  createAgentCharacterAnimationTimelineSchedule,
  type AgentCharacterAnimationTimelineStepResult,
} from './agentCharacterAnimationTimelineSchedule';
import { CHARACTER_ANIMATION_TRIGGER_ID_LIMIT } from '../characterAnimationChoreographyLimits';

export type { AgentCharacterAnimationTimelineStep } from './agentCharacterAnimationTimelineInput';

export interface AgentCharacterAnimationTimelineResolution {
  animationIds: string[];
  audio: AgentCharacterAnimationTimelineSync | null;
  hasTimeline: boolean;
  observations: string[];
  schedule: ReturnType<typeof createAgentCharacterAnimationTimelineSchedule>;
  steps: AgentCharacterAnimationTimelineStep[];
}

const DEFAULT_TIMELINE_QUEUE_LIMIT = CHARACTER_ANIMATION_TRIGGER_ID_LIMIT;

function resolveDirectTimelineCandidate(
  candidate: string,
  motionBindings: PetModelMotionBinding[],
) {
  return resolveCharacterAnimationToolOptionId(candidate, motionBindings);
}

function resolveFallbackTimelineCandidate(
  candidate: string,
  motionBindings: PetModelMotionBinding[],
) {
  return resolveDirectCharacterAnimationTriggerIds(candidate, motionBindings, 1)[0] ?? null;
}

function resolveTimelineCandidates(
  candidates: string[],
  motionBindings: PetModelMotionBinding[],
) {
  for (const candidate of candidates) {
    const animationId = resolveDirectTimelineCandidate(candidate, motionBindings);
    if (animationId) {
      return animationId;
    }
  }

  for (const candidate of candidates) {
    const animationId = resolveFallbackTimelineCandidate(candidate, motionBindings);
    if (animationId) {
      return animationId;
    }
  }

  return null;
}

function filterBindingsByKind(
  motionBindings: PetModelMotionBinding[],
  kind: 'expression' | 'motion',
) {
  return motionBindings.filter((binding) => (
    kind === 'expression'
      ? isPetModelExpressionBinding(binding)
      : !isPetModelExpressionBinding(binding)
  ));
}

function resolveTimelineStepAnimationId(
  step: AgentCharacterAnimationTimelineStep,
  motionBindings: PetModelMotionBinding[],
) {
  return resolveTimelineCandidates(
    [...step.motionCandidates, ...step.textCandidates],
    filterBindingsByKind(motionBindings, 'motion'),
  );
}

function resolveTimelineStepExpressionId(
  step: AgentCharacterAnimationTimelineStep,
  motionBindings: PetModelMotionBinding[],
) {
  return resolveTimelineCandidates(
    [...step.expressionCandidates, ...step.textCandidates],
    filterBindingsByKind(motionBindings, 'expression'),
  );
}

function createUniqueTimelineAnimationIds(
  stepResults: Array<{ animationId: string | null; expressionId: string | null }>,
  maxQueueLength: number,
) {
  const seen = new Set<string>();
  const animationIds: string[] = [];

  stepResults.forEach((result) => {
    [result.animationId, result.expressionId].forEach((animationId) => {
      if (!animationId || seen.has(animationId) || animationIds.length >= maxQueueLength) {
        return;
      }

      seen.add(animationId);
      animationIds.push(animationId);
    });
  });

  return animationIds;
}

function createTimelineMetadataSummary(steps: AgentCharacterAnimationTimelineStep[]) {
  return steps
    .map((step, index) => {
      const timings = [
        step.atMs === undefined ? '' : `at=${step.atMs}ms`,
        step.durationMs === undefined ? '' : `duration=${step.durationMs}ms`,
      ].filter(Boolean);

      return timings.length > 0 ? `${index + 1}:${timings.join('/')}` : '';
    })
    .filter(Boolean)
    .slice(0, 6)
    .join(', ');
}

function createTimelineObservations(
  options: {
    animationIds: string[];
    maxQueueLength: number;
    steps: AgentCharacterAnimationTimelineStep[];
    stepResults: AgentCharacterAnimationTimelineStepResult[];
    sync: AgentCharacterAnimationTimelineSync | null;
    timelineJsonInvalid: boolean;
  },
) {
  const resolvedText = options.stepResults
    .slice(0, 6)
    .map((result) => [
      `${result.index + 1}`,
      `motion=${result.animationId ?? 'unresolved'}`,
      result.expressionId ? `expression=${result.expressionId}` : '',
    ].filter(Boolean).join(':'))
    .join(', ');
  const expressionCount = options.stepResults.filter((result) => result.expressionId).length;
  const metadataText = createTimelineMetadataSummary(options.steps);

  return [
    'Timeline input: present',
    options.timelineJsonInvalid ? 'Timeline JSON: invalid' : '',
    `Timeline steps: ${options.steps.length}`,
    `Timeline resolved: ${resolvedText || 'none'}`,
    `Timeline expressions: ${expressionCount}`,
    ...createAgentCharacterAnimationTimelineSyncObservations(options.sync, options.steps),
    `Timeline queued unique ids: ${options.animationIds.length}/${options.maxQueueLength}`,
    metadataText ? `Timeline metadata: ${metadataText}` : '',
  ].filter(Boolean);
}

export function resolveAgentCharacterAnimationTimelineInput(
  input: Record<string, unknown>,
  motionBindings: PetModelMotionBinding[],
  maxQueueLength = DEFAULT_TIMELINE_QUEUE_LIMIT,
): AgentCharacterAnimationTimelineResolution {
  const source = createAgentCharacterAnimationTimelineSource(input);
  if (!source.hasTimeline) {
    return { animationIds: [], audio: null, hasTimeline: false, observations: [], schedule: [], steps: [] };
  }

  const steps = source.items
    .map(normalizeAgentCharacterAnimationTimelineStep)
    .filter((step): step is AgentCharacterAnimationTimelineStep => Boolean(step));
  const stepResults = steps.map((step, index) => ({
    animationId: resolveTimelineStepAnimationId(step, motionBindings),
    expressionId: resolveTimelineStepExpressionId(step, motionBindings),
    index,
  }));
  const sync = resolveAgentCharacterAnimationTimelineSync(input);
  const schedule = createAgentCharacterAnimationTimelineSchedule({
    stepResults,
    steps,
    sync,
  });
  const animationIds = createUniqueTimelineAnimationIds(stepResults, maxQueueLength);

  return {
    animationIds,
    audio: sync,
    hasTimeline: true,
    observations: createTimelineObservations({
      animationIds,
      maxQueueLength,
      stepResults,
      steps,
      sync,
      timelineJsonInvalid: source.timelineJsonInvalid,
    }),
    schedule,
    steps,
  };
}
