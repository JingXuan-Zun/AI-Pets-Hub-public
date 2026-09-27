const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createNeuralPersonaFileStore } = require('../electron/neuralPersonaFileStore.cjs');
const {
  applyNeuralPersonaPackagedProbeArgs,
  isNeuralPersonaPackagedProbeEnabled,
  runNeuralPersonaPackagedPersistenceProbe,
} = require('../electron/neuralPersonaPackagedPersistenceProbe.cjs');

const env = {};
applyNeuralPersonaPackagedProbeArgs(env, [
  '--desktop-pet-neural-persona-persistence-probe',
  '--desktop-pet-neural-persona-probe-phase=write',
  '--desktop-pet-neural-persona-probe-report=C:\\probe\\report.json',
]);
assert.equal(isNeuralPersonaPackagedProbeEnabled(env), true);
assert.equal(env.DESKTOP_PET_NEURAL_PERSONA_PROBE_PHASE, 'write');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'neural-persona-packaged-probe-smoke-'));
try {
  const reportPath = path.join(root, 'write-report.json');
  const app = { getPath: () => root, isPackaged: true };
  const fileStore = createNeuralPersonaFileStore({ userDataPath: root });
  const writeReport = runNeuralPersonaPackagedPersistenceProbe({
    app,
    env: { DESKTOP_PET_NEURAL_PERSONA_PROBE_PHASE: 'write', DESKTOP_PET_NEURAL_PERSONA_PROBE_REPORT_PATH: reportPath },
    fileStore,
  });
  assert.equal(writeReport.ok, true);
  const readReport = runNeuralPersonaPackagedPersistenceProbe({
    app,
    env: { DESKTOP_PET_NEURAL_PERSONA_PROBE_PHASE: 'read', DESKTOP_PET_NEURAL_PERSONA_PROBE_REPORT_PATH: path.join(root, 'read-report.json') },
    fileStore: createNeuralPersonaFileStore({ userDataPath: root }),
  });
  assert.equal(readReport.ok, true);
} finally {
  fs.rmSync(root, { force: true, recursive: true });
}

console.log('neural persona packaged persistence probe smoke ok');
