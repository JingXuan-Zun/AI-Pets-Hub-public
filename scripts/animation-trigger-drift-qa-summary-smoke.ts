import assert from 'node:assert/strict';
import {
  createAnimationTriggerDriftQaSummary,
  parseAnimationTriggerDriftQaSample,
} from '../src/components/settings/animationTriggerDriftQaSummary';

const warnLine = '[12:00:03][frontend][主界面/character-animation] skill animation schedule drift warn {absoluteDriftMs: 205, actualFiredAtMs: 1420, batchDelayMs: 400, batchSize: 2, driftMs: -205, plannedDelayMs: 550, plannedFireAtMs: 1625, scheduledAtMs: 1075, scheduleBaseDelayMs: 150, scheduler: clocked, token: 78, triggerSource: agent-skill}';
const noticeLine = '[12:00:02][frontend][主界面/character-animation] skill animation schedule drift notice {absoluteDriftMs: 81, actualFiredAtMs: 1306, batchDelayMs: 500, batchSize: 1, driftMs: 81, plannedDelayMs: 1125, plannedFireAtMs: 1225, scheduledAtMs: 100, scheduleBaseDelayMs: 625, scheduler: fallback, token: 42, triggerSource: agent-skill}';
const okLine = '[12:00:01][frontend][主界面/character-animation] skill animation schedule drift ok {absoluteDriftMs: 15, actualFiredAtMs: 1335, batchDelayMs: 320, batchSize: 1, driftMs: 15, plannedDelayMs: 320, plannedFireAtMs: 1320, scheduledAtMs: 1000, scheduleBaseDelayMs: 0, scheduler: timer, token: 77, triggerSource: agent-skill}';

assert.equal(parseAnimationTriggerDriftQaSample('plain runtime log'), null);
assert.deepEqual(
  parseAnimationTriggerDriftQaSample(warnLine),
  {
    absoluteDriftMs: 205,
    batchSize: 2,
    driftMs: -205,
    line: warnLine,
    plannedDelayMs: 550,
    scheduler: 'clocked',
    severity: 'warn',
    token: 78,
  },
);

const summary = createAnimationTriggerDriftQaSummary([
  warnLine,
  'unrelated character-animation log',
  noticeLine,
  okLine,
]);

assert.equal(summary.sampleCount, 3);
assert.equal(summary.warnCount, 1);
assert.equal(summary.noticeCount, 1);
assert.equal(summary.okCount, 1);
assert.equal(summary.maxAbsoluteDriftMs, 205);
assert.equal(summary.averageAbsoluteDriftMs, 100);
assert.equal(summary.tokenCount, 3);
assert.equal(summary.latestSample?.token, 78);
assert.deepEqual(summary.recentSamples.map((sample) => sample.token), [78, 42, 77]);

console.log('animation trigger drift QA summary smoke ok');
