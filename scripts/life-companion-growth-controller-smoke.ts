import { strict as assert } from 'node:assert';
import {
  LIFE_COMPANION_FOOD_AFFECTION_REWARD,
  LIFE_COMPANION_FOOD_FATIGUE_RECOVERY,
  LIFE_COMPANION_FOOD_HUNGER_RECOVERY,
  LIFE_COMPANION_HUNGER_PENALTY_DELAY_MS,
  LIFE_COMPANION_HUNGER_TRIGGER_THRESHOLD,
  LIFE_COMPANION_STATS_TICK_MS,
  applyLifeCompanionFoodConsumedGrowth,
  applyLifeCompanionPassiveGrowthTick,
  getLifeCompanionReachedStatMilestones,
  isLifeCompanionExhausted,
  isLifeCompanionHungry,
} from '../src/life-companion/lifeCompanionGrowthController.ts';
import { createLifeCompanionGrowthStatus } from '../src/life-companion/lifeCompanionGrowthStatus.ts';
import {
  PET_FOOD_AFFECTION_REWARD,
  PET_FOOD_FATIGUE_RECOVERY,
  PET_FOOD_HUNGER_RECOVERY,
  PET_HUNGER_TRIGGER_THRESHOLD,
  PET_STATS_TICK_MS,
  applyFoodConsumedStats,
  applyPassivePetStatsTick,
} from '../src/components/pet/petStatsMath.ts';
import { readProjectSources } from './smokeTestHarness.ts';

assert.equal(PET_HUNGER_TRIGGER_THRESHOLD, LIFE_COMPANION_HUNGER_TRIGGER_THRESHOLD);
assert.equal(PET_STATS_TICK_MS, LIFE_COMPANION_STATS_TICK_MS);
assert.equal(PET_FOOD_HUNGER_RECOVERY, LIFE_COMPANION_FOOD_HUNGER_RECOVERY);
assert.equal(PET_FOOD_AFFECTION_REWARD, LIFE_COMPANION_FOOD_AFFECTION_REWARD);
assert.equal(PET_FOOD_FATIGUE_RECOVERY, LIFE_COMPANION_FOOD_FATIGUE_RECOVERY);

assert.equal(isLifeCompanionHungry(79), false);
assert.equal(isLifeCompanionHungry(80), true);
assert.equal(isLifeCompanionExhausted(95), false);
assert.equal(isLifeCompanionExhausted(96), true);

const passiveGrowth = applyLifeCompanionPassiveGrowthTick({
  stats: { affection: 60, fatigue: 10, hunger: 20 },
  tickMs: LIFE_COMPANION_STATS_TICK_MS,
});
assert.equal(passiveGrowth.event, 'passive-tick');
assert.deepEqual(passiveGrowth.nextStats, {
  affection: 60,
  fatigue: 10.5,
  hunger: 20.0083,
});
assert.deepEqual(
  applyPassivePetStatsTick({ affection: 60, fatigue: 10, hunger: 20 }),
  passiveGrowth.nextStats,
);

const penaltyGrowth = applyLifeCompanionPassiveGrowthTick({
  hungryDurationMs: LIFE_COMPANION_HUNGER_PENALTY_DELAY_MS,
  stats: { affection: 50, fatigue: 30, hunger: 90 },
  tickMs: 60 * 1000,
});
assert.equal(penaltyGrowth.nextStats.affection, 45);
assert.equal(penaltyGrowth.nextStats.fatigue, 41);

const foodGrowth = applyLifeCompanionFoodConsumedGrowth({
  affection: 98,
  fatigue: 2,
  hunger: 3,
});
assert.equal(foodGrowth.event, 'food-consumed');
assert.deepEqual(foodGrowth.nextStats, {
  affection: 100,
  fatigue: 0,
  hunger: 0,
});
assert.deepEqual(applyFoodConsumedStats({ affection: 98, fatigue: 2, hunger: 3 }), foodGrowth.nextStats);
assert.deepEqual(getLifeCompanionReachedStatMilestones(39, 81), [40, 60, 80]);
assert.deepEqual(createLifeCompanionGrowthStatus({ affection: 64, fatigue: 20, hunger: 10 }), {
  affectionLabel: '64%',
  fatigueLabel: '20%',
  hungerLabel: '10%',
  priority: 'normal',
  summary: 'growth state stable',
});
assert.equal(createLifeCompanionGrowthStatus({ affection: 64, fatigue: 20, hunger: 82 }).priority, 'watch');
assert.equal(createLifeCompanionGrowthStatus({ affection: 64, fatigue: 96, hunger: 82 }).priority, 'critical');

const {
  controllerSource,
  growthStatusSource,
  mathSource,
  tickerSource,
  panelSource,
  growthStatusRowSource,
  progressSource,
} = readProjectSources({
  controllerSource: 'src/life-companion/lifeCompanionGrowthController.ts',
  growthStatusSource: 'src/life-companion/lifeCompanionGrowthStatus.ts',
  mathSource: 'src/components/pet/petStatsMath.ts',
  tickerSource: 'src/hooks/usePassivePetStatsTicker.ts',
  panelSource: 'src/components/settings/SettingsLifeCompanionPanel.tsx',
  growthStatusRowSource: 'src/components/settings/SettingsLifeCompanionGrowthStatusRow.tsx',
  progressSource: 'PROJECT_FEATURE_PROGRESS.md',
});

assert.match(controllerSource, /LifeCompanionGrowthResult/u);
assert.doesNotMatch(controllerSource, /speakText|queueAnimationToolTrigger|enqueueTriggeredPetSpeech|mcp/iu);
assert.match(growthStatusSource, /createLifeCompanionGrowthStatus/u);
assert.doesNotMatch(growthStatusSource, /speakText|queueAnimationToolTrigger|enqueueTriggeredPetSpeech|mcp/iu);
assert.match(mathSource, /applyLifeCompanionPassiveGrowthTick/u);
assert.match(mathSource, /applyLifeCompanionFoodConsumedGrowth/u);
assert.match(tickerSource, /applyLifeCompanionPassiveGrowthTick/u);
assert.match(panelSource, /SettingsLifeCompanionGrowthStatusRow/u);
assert.match(growthStatusRowSource, /createLifeCompanionGrowthStatus/u);
assert.match(progressSource, /lifeCompanionGrowthController/u);
assert.match(progressSource, /SettingsLifeCompanionGrowthStatusRow/u);
assert.ok(controllerSource.split(/\r?\n/u).length <= 140);
assert.ok(growthStatusSource.split(/\r?\n/u).length <= 90);
assert.ok(growthStatusRowSource.split(/\r?\n/u).length <= 80);
assert.ok(mathSource.split(/\r?\n/u).length <= 130);

console.log('life companion growth controller smoke passed');
