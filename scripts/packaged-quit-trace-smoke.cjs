const assert = require('node:assert/strict');
const {
  installPackagedQuitTrace,
  shouldInstallPackagedQuitTrace,
} = require('../electron/packagedQuitTrace.cjs');

assert.equal(shouldInstallPackagedQuitTrace({ app: {}, env: {} }), false);
assert.equal(shouldInstallPackagedQuitTrace({
  app: {},
  env: { DESKTOP_PET_PACKAGED_SOAK_QUIT_TRACE: '1' },
  isDev: true,
}), false);
assert.equal(shouldInstallPackagedQuitTrace({
  app: {},
  env: { DESKTOP_PET_PACKAGED_SOAK_QUIT_TRACE: '1' },
  isLocalTest: true,
}), false);
assert.equal(shouldInstallPackagedQuitTrace({
  app: {},
  env: { DESKTOP_PET_PACKAGED_SOAK_QUIT_TRACE: '1' },
}), true);

const calls = [];
const app = {
  quit: () => calls.push('quit'),
};

const result = installPackagedQuitTrace({
  app,
  env: { DESKTOP_PET_PACKAGED_SOAK_QUIT_TRACE: '1' },
  log: (message, details) => calls.push(`${message}:${details?.stack ? 'stack' : ''}`),
});

assert.equal(result.installed, true);
assert.deepEqual(calls, ['app.quit trace installed:']);
app.quit();
assert.deepEqual(calls, [
  'app.quit trace installed:',
  'app.quit requested:stack',
  'quit',
]);

console.log('packaged quit trace smoke passed');
