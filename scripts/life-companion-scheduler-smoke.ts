import { strict as assert } from 'node:assert';
import { isLifeCompanionQuietHour } from '../src/life-companion/lifeCompanionScheduler.ts';
import { DEFAULT_LIFE_COMPANION_SETTINGS } from '../src/life-companion/lifeCompanionSettings.ts';

// Quiet hours, shared by proactive speech, desktop awareness and screen watch.
const settings = { ...DEFAULT_LIFE_COMPANION_SETTINGS, quietHoursEnabled: true, quietHoursEnd: '09:00', quietHoursStart: '23:00' };
assert.equal(isLifeCompanionQuietHour(settings, new Date('2026-07-01T23:30:00')), true);
assert.equal(isLifeCompanionQuietHour(settings, new Date('2026-07-01T08:59:00')), true);
assert.equal(isLifeCompanionQuietHour(settings, new Date('2026-07-01T09:00:00')), false);
assert.equal(isLifeCompanionQuietHour(settings, new Date('2026-07-01T15:00:00')), false);
assert.equal(isLifeCompanionQuietHour({ ...settings, quietHoursEnabled: false }, new Date('2026-07-01T23:30:00')), false);
const daytime = { ...settings, quietHoursEnd: '14:00', quietHoursStart: '12:00' };
assert.equal(isLifeCompanionQuietHour(daytime, new Date('2026-07-01T13:00:00')), true);
assert.equal(isLifeCompanionQuietHour(daytime, new Date('2026-07-01T15:00:00')), false);

console.log('life companion scheduler smoke passed');
