const assert = require('node:assert/strict');
const {
  parsePositiveMs,
  schedulePackagedSoakAutoQuit,
} = require('../electron/packagedSoakAutoQuit.cjs');

assert.equal(parsePositiveMs('3000'), 3000);
assert.equal(parsePositiveMs('0'), 0);
assert.equal(parsePositiveMs('bad'), 0);

function createHarness(options = {}) {
  const calls = [];
  const timers = [];
  const result = schedulePackagedSoakAutoQuit({
    app: { quit: () => calls.push('quit') },
    env: options.env,
    isDev: Boolean(options.isDev),
    isLocalTest: Boolean(options.isLocalTest),
    log: (message, details) => calls.push(`${message}:${details?.delayMs ?? ''}`),
    setTimeoutFn: (callback, delayMs) => {
      timers.push({ callback, delayMs });
      return { unref: () => calls.push('unref') };
    },
  });
  return { calls, result, timers };
}

assert.equal(createHarness({ env: {} }).result.scheduled, false);
assert.equal(createHarness({ env: { DESKTOP_PET_PACKAGED_SOAK_AUTO_QUIT_MS: '1000' }, isDev: true }).result.scheduled, false);
assert.equal(createHarness({ env: { DESKTOP_PET_PACKAGED_SOAK_AUTO_QUIT_MS: '1000' }, isLocalTest: true }).result.scheduled, false);

const scheduled = createHarness({ env: { DESKTOP_PET_PACKAGED_SOAK_AUTO_QUIT_MS: '1000' } });
assert.equal(scheduled.result.scheduled, true);
assert.equal(scheduled.result.delayMs, 1000);
assert.equal(scheduled.timers[0].delayMs, 1000);
assert.deepEqual(scheduled.calls, ['packaged soak auto quit scheduled:1000', 'unref']);
scheduled.timers[0].callback();
assert.deepEqual(scheduled.calls, [
  'packaged soak auto quit scheduled:1000',
  'unref',
  'packaged soak auto quit triggered:1000',
  'quit',
]);

console.log('packaged soak auto quit smoke passed');
