import type { PetStats } from '../types';

export const LIFE_COMPANION_HUNGER_TRIGGER_THRESHOLD = 80;
export const LIFE_COMPANION_HUNGER_AUTO_EAT_STOP_THRESHOLD = 60;
export const LIFE_COMPANION_STATS_TICK_MS = 5000;
export const LIFE_COMPANION_HUNGER_INCREASE_PER_10_MINUTES = 1;
export const LIFE_COMPANION_BASE_FATIGUE_INCREASE_PER_TICK = 0.5;
export const LIFE_COMPANION_HUNGER_PENALTY_DELAY_MS = 5 * 60 * 1000;
export const LIFE_COMPANION_HUNGER_COAX_DELAY_MS = 5 * 60 * 1000;
export const LIFE_COMPANION_HUNGER_PENALTY_PER_MINUTE = 5;
export const LIFE_COMPANION_FOOD_HUNGER_RECOVERY = 5;
export const LIFE_COMPANION_FOOD_AFFECTION_REWARD = 5;
export const LIFE_COMPANION_FOOD_FATIGUE_RECOVERY = 5;
export const LIFE_COMPANION_FATIGUE_SLEEP_THRESHOLD = 95;
export const LIFE_COMPANION_FATIGUE_SLEEP_DURATION_MS = 6000;
export const LIFE_COMPANION_STAT_REACTION_DURATION_MS = 1800;
export const LIFE_COMPANION_STAT_MILESTONES = [20, 40, 60, 80, 100] as const;

export type LifeCompanionGrowthEvent = 'food-consumed' | 'passive-tick';

export interface LifeCompanionGrowthResult {
  event: LifeCompanionGrowthEvent;
  nextStats: PetStats;
  previousStats: PetStats;
}

function clampGrowthStat(value: number, digits = 2) {
  return Math.max(0, Math.min(100, Number(value.toFixed(digits))));
}

export function isLifeCompanionHungry(
  hunger: number,
  threshold = LIFE_COMPANION_HUNGER_TRIGGER_THRESHOLD,
) {
  return hunger >= threshold;
}

export function isLifeCompanionExhausted(
  fatigue: number,
  threshold = LIFE_COMPANION_FATIGUE_SLEEP_THRESHOLD,
) {
  return fatigue > threshold;
}

export function applyLifeCompanionPassiveGrowthTick(options: {
  hungryDurationMs?: number;
  stats: PetStats;
  tickMs?: number;
}): LifeCompanionGrowthResult {
  const tickMs = options.tickMs ?? LIFE_COMPANION_STATS_TICK_MS;
  const tickRatio = tickMs / LIFE_COMPANION_STATS_TICK_MS;
  const hungerIncrease = LIFE_COMPANION_HUNGER_INCREASE_PER_10_MINUTES * (tickMs / (10 * 60 * 1000));
  const hunger = clampGrowthStat(options.stats.hunger + hungerIncrease, 4);
  let fatigue = clampGrowthStat(
    options.stats.fatigue + LIFE_COMPANION_BASE_FATIGUE_INCREASE_PER_TICK * tickRatio,
    4,
  );
  let affection = clampGrowthStat(options.stats.affection, 4);

  if ((options.hungryDurationMs ?? 0) >= LIFE_COMPANION_HUNGER_PENALTY_DELAY_MS) {
    const hungerPenalty = LIFE_COMPANION_HUNGER_PENALTY_PER_MINUTE * (tickMs / 60000);

    affection = clampGrowthStat(affection - hungerPenalty, 4);
    fatigue = clampGrowthStat(fatigue + hungerPenalty, 4);
  }

  return {
    event: 'passive-tick',
    nextStats: { affection, fatigue, hunger },
    previousStats: options.stats,
  };
}

export function applyLifeCompanionFoodConsumedGrowth(stats: PetStats): LifeCompanionGrowthResult {
  return {
    event: 'food-consumed',
    nextStats: {
      ...stats,
      affection: clampGrowthStat(stats.affection + LIFE_COMPANION_FOOD_AFFECTION_REWARD),
      fatigue: clampGrowthStat(stats.fatigue - LIFE_COMPANION_FOOD_FATIGUE_RECOVERY),
      hunger: clampGrowthStat(stats.hunger - LIFE_COMPANION_FOOD_HUNGER_RECOVERY),
    },
    previousStats: stats,
  };
}

export function getLifeCompanionReachedStatMilestones(previousValue: number, nextValue: number) {
  if (nextValue <= previousValue) {
    return [];
  }

  return LIFE_COMPANION_STAT_MILESTONES.filter((milestone) => (
    previousValue < milestone && nextValue >= milestone
  ));
}
