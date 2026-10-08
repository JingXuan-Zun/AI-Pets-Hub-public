const fs = require('fs');
const path = require('path');
const { createPythonEnv } = require('./localVoiceRuntimeHostUtils.cjs');
const { ensureDir, pathExists, resolveRuntimeRoot } = require('./localVoiceRuntimePathUtils.cjs');
const { createLocalVoiceCommandRunner } = require('./localVoiceRuntimeCommandRunner.cjs');
const { resolveVoiceRootPath } = require('./localVoiceLibrary.cjs');
const { resolveGptSovitsPaths } = require('./gptSovitsRules.cjs');
const { listGptSovitsModels } = require('./gptSovitsModels.cjs');
const { createGptSovitsPython } = require('./gptSovitsPython.cjs');
const { createGptSovitsHealth } = require('./gptSovitsHealth.cjs');
const { createGptSovitsProcess } = require('./gptSovitsProcess.cjs');
const { createGptSovitsStartup } = require('./gptSovitsStartup.cjs');
const { createGptSovitsInstaller } = require('./gptSovitsInstaller.cjs');

const SERVER_SCRIPT_NAME = 'gpt_sovits_server.py';
const INSTALL_SCRIPT_NAME = 'gpt_sovits_install.py';

function createGptSovitsService({ app, log, projectRoot }) {
  const paths = resolveGptSovitsPaths({ runtimeRoot: resolveRuntimeRoot({ app, projectRoot }) });
  const writeLog = (message, details) => {
    if (typeof log === 'function') log(message, details);
  };
  const getModelsRoot = () => {
    const voiceRoot = resolveVoiceRootPath({ app, projectRoot });
    return voiceRoot ? path.resolve(voiceRoot, 'gpt-sovits') : null;
  };

  // Copied next to the venv so packaged builds never execute Python from inside the asar.
  function ensureRuntimeScript(name) {
    ensureDir(paths.home);
    const runtimePath = path.join(paths.home, name);
    const source = fs.readFileSync(path.join(__dirname, name), 'utf8');
    if (!pathExists(runtimePath) || fs.readFileSync(runtimePath, 'utf8') !== source) {
      fs.writeFileSync(runtimePath, source, 'utf8');
    }
    return runtimePath;
  }

  const python = createGptSovitsPython({ paths, getSharedEnv: createPythonEnv });
  const getHealth = createGptSovitsHealth({ python, getModelsRoot, writeLog });
  const processControl = createGptSovitsProcess({
    paths, getModelsRoot, getCandidate: python.getCandidate, getSharedEnv: createPythonEnv, writeLog,
    ensureServerScript: () => {
      ensureRuntimeScript('gpt_sovits_synthesis.py');
      return ensureRuntimeScript(SERVER_SCRIPT_NAME);
    },
  });
  const ensureStarted = createGptSovitsStartup({ getHealth, processControl });
  const installRuntime = createGptSovitsInstaller({
    paths, projectRoot, python, getHealth, writeLog, getSharedEnv: createPythonEnv,
    ensureInstallScript: () => ensureRuntimeScript(INSTALL_SCRIPT_NAME),
    runCommand: createLocalVoiceCommandRunner().spawnCommand,
  });

  return {
    dispose: processControl.stop,
    ensureStarted,
    getHealth,
    installRuntime,
    listModels: () => listGptSovitsModels(getModelsRoot()),
  };
}

module.exports = { createGptSovitsService };
