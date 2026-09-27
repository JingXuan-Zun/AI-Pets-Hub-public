import assert from 'node:assert/strict';
import { createAnimationTriggerDriftQaSummary } from '../src/components/settings/animationTriggerDriftQaSummary';

const firstTokenWarnLine = '[12:00:03][frontend][main/character-animation] skill animation schedule drift warn {absoluteDriftMs: 205, actualFiredAtMs: 1420, batchDelayMs: 400, batchSize: 2, driftMs: -205, plannedDelayMs: 550, plannedFireAtMs: 1625, scheduledAtMs: 1075, scheduleBaseDelayMs: 150, scheduler: clocked, token: 78, triggerSource: agent-skill}';
const firstTokenOkLine = '[12:00:04][frontend][main/character-animation] skill animation schedule drift ok {absoluteDriftMs: 35, actualFiredAtMs: 1510, batchDelayMs: 600, batchSize: 1, driftMs: 35, plannedDelayMs: 600, plannedFireAtMs: 1475, scheduledAtMs: 875, scheduleBaseDelayMs: 0, scheduler: clocked, token: 78, triggerSource: agent-skill}';
const secondTokenLine = '[12:00:02][frontend][main/character-animation] skill animation schedule drift notice {absoluteDriftMs: 81, actualFiredAtMs: 1306, batchDelayMs: 500, batchSize: 1, driftMs: 81, plannedDelayMs: 1125, plannedFireAtMs: 1225, scheduledAtMs: 100, scheduleBaseDelayMs: 625, scheduler: fallback, token: 42, triggerSource: agent-skill}';
const thirdTokenLine = '[12:00:01][frontend][main/character-animation] skill animation schedule drift ok {absoluteDriftMs: 15, actualFiredAtMs: 1335, batchDelayMs: 320, batchSize: 1, driftMs: 15, plannedDelayMs: 320, plannedFireAtMs: 1320, scheduledAtMs: 1000, scheduleBaseDelayMs: 0, scheduler: timer, token: 77, triggerSource: agent-skill}';

const summary = createAnimationTriggerDriftQaSummary([
  firstTokenOkLine,
  firstTokenWarnLine,
  secondTokenLine,
  thirdTokenLine,
]);

assert.equal(summary.sampleCount, 4);
assert.equal(summary.tokenCount, 3);
assert.deepEqual(summary.tokenGroups.map((group) => group.token), [78, 77, 42]);
assert.deepEqual(summary.tokenGroups[0], {
  averageAbsoluteDriftMs: 120,
  maxAbsoluteDriftMs: 205,
  sampleCount: 2,
  scheduler: 'clocked',
  token: 78,
  warnCount: 1,
});
assert.deepEqual(summary.tokenGroups[1], {
  averageAbsoluteDriftMs: 15,
  maxAbsoluteDriftMs: 15,
  sampleCount: 1,
  scheduler: 'timer',
  token: 77,
  warnCount: 0,
});

console.log('animation trigger drift token groups smoke ok');
