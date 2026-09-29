const assert = require('node:assert/strict');
const { resolvePreferredTorchPackages } = require('../electron/localVoiceRuntimeInstallUtils.cjs');

async function main() {
  let sharedOptionsCalls = 0;
  let observedCandidate = null;
  let observedOptions = null;

  const result = await resolvePreferredTorchPackages({
    baseRuntime: {
      candidate: {
        executable: 'python.exe',
      },
    },
    defaultTorchVersion: 'fallback-torch',
    defaultTorchaudioVersion: 'fallback-torchaudio',
    getSharedOptions() {
      sharedOptionsCalls += 1;
      return {
        cwd: 'runtime-root',
        env: {
          PYTHONUTF8: '1',
        },
      };
    },
    parseJsonFromCommandOutput(stdout) {
      return JSON.parse(stdout);
    },
    async runInlinePythonScript(candidate, _script, options) {
      observedCandidate = candidate;
      observedOptions = options;
      return {
        ok: true,
        stdout: JSON.stringify({
          torch: '2.6.0+cu124',
          torchaudio: '2.6.0+cu124',
        }),
      };
    },
  });

  assert.equal(sharedOptionsCalls, 1);
  assert.deepEqual(observedCandidate, { executable: 'python.exe' });
  assert.deepEqual(observedOptions, {
    cwd: 'runtime-root',
    env: {
      PYTHONUTF8: '1',
    },
  });
  assert.deepEqual(result, {
    torchVersion: '2.6.0+cu124',
    torchaudioVersion: '2.6.0+cu124',
  });

  console.log('localVoiceRuntime install utils smoke ok');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
