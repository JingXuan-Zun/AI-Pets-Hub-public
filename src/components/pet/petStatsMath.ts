import { type PetAction, type PetStats } from '../../types';
import {
  LIFE_COMPANION_BASE_FATIGUE_INCREASE_PER_TICK,
  LIFE_COMPANION_FATIGUE_SLEEP_DURATION_MS,
  LIFE_COMPANION_FATIGUE_SLEEP_THRESHOLD,
  LIFE_COMPANION_FOOD_AFFECTION_REWARD,
  LIFE_COMPANION_FOOD_FATIGUE_RECOVERY,
  LIFE_COMPANION_FOOD_HUNGER_RECOVERY,
  LIFE_COMPANION_HUNGER_AUTO_EAT_STOP_THRESHOLD,
  LIFE_COMPANION_HUNGER_COAX_DELAY_MS,
  LIFE_COMPANION_HUNGER_INCREASE_PER_10_MINUTES,
  LIFE_COMPANION_HUNGER_PENALTY_DELAY_MS,
  LIFE_COMPANION_HUNGER_PENALTY_PER_MINUTE,
  LIFE_COMPANION_HUNGER_TRIGGER_THRESHOLD,
  LIFE_COMPANION_STATS_TICK_MS,
  LIFE_COMPANION_STAT_MILESTONES,
  LIFE_COMPANION_STAT_REACTION_DURATION_MS,
  applyLifeCompanionFoodConsumedGrowth,
  applyLifeCompanionPassiveGrowthTick,
  getLifeCompanionReachedStatMilestones,
  isLifeCompanionExhausted,
  isLifeCompanionHungry,
} from '../../life-companion/lifeCompanionGrowthController';

export const PET_HUNGER_TRIGGER_THRESHOLD = LIFE_COMPANION_HUNGER_TRIGGER_THRESHOLD;
export const PET_HUNGER_AUTO_EAT_STOP_THRESHOLD = LIFE_COMPANION_HUNGER_AUTO_EAT_STOP_THRESHOLD;
export const PET_STATS_TICK_MS = LIFE_COMPANION_STATS_TICK_MS;
export const PET_HUNGER_INCREASE_PER_10_MINUTES = LIFE_COMPANION_HUNGER_INCREASE_PER_10_MINUTES;
export const PET_BASE_FATIGUE_INCREASE_PER_TICK = LIFE_COMPANION_BASE_FATIGUE_INCREASE_PER_TICK;
export const PET_HUNGER_PENALTY_DELAY_MS = LIFE_COMPANION_HUNGER_PENALTY_DELAY_MS;
export const PET_HUNGER_COAX_DELAY_MS = LIFE_COMPANION_HUNGER_COAX_DELAY_MS;
export const PET_HUNGER_PENALTY_PER_MINUTE = LIFE_COMPANION_HUNGER_PENALTY_PER_MINUTE;
export const PET_FOOD_HUNGER_RECOVERY = LIFE_COMPANION_FOOD_HUNGER_RECOVERY;
export const PET_FOOD_AFFECTION_REWARD = LIFE_COMPANION_FOOD_AFFECTION_REWARD;
export const PET_FOOD_FATIGUE_RECOVERY = LIFE_COMPANION_FOOD_FATIGUE_RECOVERY;
export const PET_FATIGUE_SLEEP_THRESHOLD = LIFE_COMPANION_FATIGUE_SLEEP_THRESHOLD;
export const PET_FATIGUE_SLEEP_DURATION_MS = LIFE_COMPANION_FATIGUE_SLEEP_DURATION_MS;
export const PET_STAT_REACTION_DURATION_MS = LIFE_COMPANION_STAT_REACTION_DURATION_MS;
export const PET_STAT_MILESTONES = LIFE_COMPANION_STAT_MILESTONES;

export type PetTrackedStatKey = 'affection' | 'fatigue' | 'hunger';

export function isPetHungry(hunger: number, threshold = PET_HUNGER_TRIGGER_THRESHOLD) {
  return isLifeCompanionHungry(hunger, threshold);
}

export function isPetExhausted(fatigue: number, threshold = PET_FATIGUE_SLEEP_THRESHOLD) {
  return isLifeCompanionExhausted(fatigue, threshold);
}

export function applyPassivePetStatsTick(
  stats: PetStats,
  tickMs = PET_STATS_TICK_MS,
  hungryDurationMs = 0,
): PetStats {
  return applyLifeCompanionPassiveGrowthTick({ hungryDurationMs, stats, tickMs }).nextStats;
}

export function applyFoodConsumedStats(stats: PetStats): PetStats {
  return applyLifeCompanionFoodConsumedGrowth(stats).nextStats;
}

export function getReachedStatMilestones(previousValue: number, nextValue: number) {
  return getLifeCompanionReachedStatMilestones(previousValue, nextValue);
}

export function buildAffectionMilestoneMessage(milestone: number) {
  switch (milestone) {
    case 20:
      return '我开始慢慢喜欢上待在你身边了。';
    case 40:
      return '和你相处的感觉越来越好了。';
    case 60:
      return '你对我来说已经是很重要的人了。';
    case 80:
      return '最喜欢这样一直陪着你了。';
    case 100:
      return '好感度已经满满的啦，我会一直陪着你。';
    default:
      return '我现在的心情变得更靠近你了一点。';
  }
}

export function resolveStatMilestoneReaction(
  statKey: Exclude<PetTrackedStatKey, 'affection'>,
  milestone: number,
): PetAction {
  if (statKey === 'hunger') {
    if (milestone >= 80) {
      return 'RUNNING';
    }

    if (milestone >= 60) {
      return 'SAD';
    }

    return 'WALKING';
  }

  if (milestone >= 80) {
    return 'SLEEPING';
  }

  if (milestone >= 60) {
    return 'SAD';
  }

  return 'SWIMMING';
}

export function buildHighHungerPromptMessage() {
  return '我已经饿到想吃东西啦，给我做点好吃的嘛。';
}

export function buildHighHungerCoaxMessage() {
  return '我已经饿了好久了，快投喂我一下嘛，我会更乖的。';
}
