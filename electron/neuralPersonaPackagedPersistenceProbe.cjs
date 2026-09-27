const fs = require('fs');
const path = require('path');

const PROBE_VALUE = JSON.stringify({ kind: 'neural-persona-packaged-probe.v1', revision: 1 });
const PROBE_ROLE_ID = 'neural-persona-packaged-probe-role';

function argumentValue(args, prefix) {
  const entry = args.find((value) => value.startsWith(`${prefix}=`));
  return entry ? entry.slice(prefix.length + 1) : '';
}

function applyNeuralPersonaPackagedProbeArgs(env, args) {
  if (args.includes('--desktop-pet-neural-persona-persistence-probe')) {
    env.DESKTOP_PET_NEURAL_PERSONA_PERSISTENCE_PROBE = '1';
  }
  const mappings = [
    ['--desktop-pet-neural-persona-probe-phase', 'DESKTOP_PET_NEURAL_PERSONA_PROBE_PHASE'],
    ['--desktop-pet-neural-persona-probe-report', 'DESKTOP_PET_NEURAL_PERSONA_PROBE_REPORT_PATH'],
    ['--desktop-pet-neural-persona-probe-user-data-dir', 'DESKTOP_PET_NEURAL_PERSONA_PROBE_USER_DATA_DIR'],
  ];
  mappings.forEach(([prefix, key]) => {
    const value = argumentValue(args, prefix);
    if (value) env[key] = value;
  });
}

function isNeuralPersonaPackagedProbeEnabled(env) {
  return env.DESKTOP_PET_NEURAL_PERSONA_PERSISTENCE_PROBE === '1';
}

function writeReport(reportPath, report) {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

function runNeuralPersonaPackagedPersistenceProbe({ app, env, fileStore }) {
  const phase = env.DESKTOP_PET_NEURAL_PERSONA_PROBE_PHASE;
  const reportPath = env.DESKTOP_PET_NEURAL_PERSONA_PROBE_REPORT_PATH;
  if (!reportPath || !['read', 'write'].includes(phase)) {
    throw new Error('invalid-neural-persona-packaged-probe-configuration');
  }
  const operation = phase === 'write'
    ? fileStore.compareAndSwap(PROBE_ROLE_ID, null, PROBE_VALUE)
    : fileStore.read(PROBE_ROLE_ID);
  const ok = phase === 'write'
    ? operation.ok === true && operation.matched === true
    : operation.ok === true && operation.value === PROBE_VALUE;
  const report = {
    appIsPackaged: app.isPackaged,
    ok: ok && app.isPackaged,
    operation,
    phase,
    probeRoleId: PROBE_ROLE_ID,
    userDataPath: app.getPath('userData'),
  };
  writeReport(reportPath, report);
  return report;
}

module.exports = {
  PROBE_ROLE_ID,
  PROBE_VALUE,
  applyNeuralPersonaPackagedProbeArgs,
  isNeuralPersonaPackagedProbeEnabled,
  runNeuralPersonaPackagedPersistenceProbe,
};
