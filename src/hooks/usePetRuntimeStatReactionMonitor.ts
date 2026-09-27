import { useCallback, useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { type PetAction, type PetConfig, type PetStats } from '../types';
import {
  PET_STAT_REACTION_DURATION_MS,
  getReachedStatMilestones,
  resolveStatMilestoneReaction,
} from '../components/pet/petStatsMath';

interface UsePetRuntimeStatReactionMonitorOptions {
  config: PetConfig;
  enqueueTriggeredPetSpeech: (trigger: import('../types').PetAutoSpeechTrigger) => void;
  isFatigueSleeping: boolean;
  lastObservedStatsRef: MutableRefObject<PetStats>;
  setStatReactionAction: Dispatch<SetStateAction<PetAction | null>>;
  statReactionTimerRef: MutableRefObject<number | null>;
}

export function usePetRuntimeStatReactionMonitor({
  config,
  enqueueTriggeredPetSpeech,
  isFatigueSleeping,
  lastObservedStatsRef,
  setStatReactionAction,
  statReactionTimerRef,
}: UsePetRuntimeStatReactionMonitorOptions) {
  const triggerStatReaction = useCallback((action: PetAction | null) => {
    if (!action || isFatigueSleeping) {
      return;
    }

    if (statReactionTimerRef.current !== null) {
      window.clearTimeout(statReactionTimerRef.current);
    }

    setStatReactionAction(action);
    statReactionTimerRef.current = window.setTimeout(() => {
      statReactionTimerRef.current = null;
      setStatReactionAction(null);
    }, PET_STAT_REACTION_DURATION_MS);
  }, [isFatigueSleeping, setStatReactionAction, statReactionTimerRef]);

  useEffect(() => {
    const previousStats = lastObservedStatsRef.current;
    const nextStats = config.stats;

    const affectionMilestones = getReachedStatMilestones(previousStats.affection, nextStats.affection);
    const highestAffectionMilestone = affectionMilestones[affectionMilestones.length - 1];
    if (highestAffectionMilestone) {
      enqueueTriggeredPetSpeech({
        kind: 'affection-milestone',
        milestone: highestAffectionMilestone,
        stats: nextStats,
      });
    }

    const hungerMilestones = getReachedStatMilestones(previousStats.hunger, nextStats.hunger);
    const fatigueMilestones = getReachedStatMilestones(previousStats.fatigue, nextStats.fatigue);
    const highestHungerMilestone = hungerMilestones[hungerMilestones.length - 1] ?? 0;
    const highestFatigueMilestone = fatigueMilestones[fatigueMilestones.length - 1] ?? 0;

    if (highestHungerMilestone > 0 || highestFatigueMilestone > 0) {
      const nextReaction = highestFatigueMilestone >= highestHungerMilestone
        ? resolveStatMilestoneReaction('fatigue', highestFatigueMilestone)
        : resolveStatMilestoneReaction('hunger', highestHungerMilestone);

      triggerStatReaction(nextReaction);
    }

    lastObservedStatsRef.current = nextStats;
  }, [config.settings, config.stats, enqueueTriggeredPetSpeech, isFatigueSleeping, lastObservedStatsRef, triggerStatReaction]);
}
