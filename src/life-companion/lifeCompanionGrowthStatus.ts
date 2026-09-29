import type { PetStats } from '../types';
import {
  isLifeCompanionExhausted,
  isLifeCompanionHungry,
  LIFE_COMPANION_FATIGUE_SLEEP_THRESHOLD,
  LIFE_COMPANION_HUNGER_TRIGGER_THRESHOLD,
} from './lifeCompanionGrowthController';

export type LifeCompanionGrowthPriority = 'critical' | 'normal' | 'watch';

export interface LifeCompanionGrowthStatus {
  affectionLabel: string;
  fatigueLabel: string;
  hungerLabel: string;
  priority: LifeCompanionGrowthPriority;
  summary: string;
}

function formatStat(value: number) {
  return `${Math.round(value)}%`;
}

function resolveGrowthPriority(stats: PetStats): LifeCompanionGrowthPriority {
  if (isLifeCompanionExhausted(stats.fatigue) || stats.hunger >= 95) {
    return 'critical';
  }

  if (isLifeCompanionHungry(stats.hunger) || stats.affection <= 30 || stats.fatigue >= 80) {
    return 'watch';
  }

  return 'normal';
}

function resolveGrowthSummary(stats: PetStats, priority: LifeCompanionGrowthPriority) {
  if (priority === 'critical') {
    return 'needs immediate care';
  }

  if (isLifeCompanionHungry(stats.hunger)) {
    return `hunger over ${LIFE_COMPANION_HUNGER_TRIGGER_THRESHOLD}%`;
  }

  if (stats.fatigue >= 80) {
    return `fatigue near ${LIFE_COMPANION_FATIGUE_SLEEP_THRESHOLD}%`;
  }

  if (stats.affection <= 30) {
    return 'affection needs attention';
  }

  return 'growth state stable';
}

export function createLifeCompanionGrowthStatus(stats: PetStats): LifeCompanionGrowthStatus {
  const priority = resolveGrowthPriority(stats);

  return {
    affectionLabel: formatStat(stats.affection),
    fatigueLabel: formatStat(stats.fatigue),
    hungerLabel: formatStat(stats.hunger),
    priority,
    summary: resolveGrowthSummary(stats, priority),
  };
}
