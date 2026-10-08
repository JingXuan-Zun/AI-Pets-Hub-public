const { waitUntilReady } = require('./browserTtsReadiness.cjs');
const { createBrowserTtsStartup } = require('./browserTtsStartup.cjs');
const { createBrowserTtsSpeakers } = require('./browserTtsSpeakers.cjs');
const { createBrowserTtsProcess } = require('./browserTtsProcess.cjs');
const { createBrowserTtsHealth } = require('./browserTtsHealth.cjs');
const { createBrowserTtsInstaller } = require('./browserTtsInstaller.cjs');
const { createBrowserTtsPython } = require('./browserTtsPython.cjs');
const fs = require('fs');
const path = require('path');
const {
  createPythonEnv,
} = require('./localVoiceRuntimeHostUtils.cjs');
const {
  ensureDir,
  pathExists,
  resolveRuntimeRoot,
} = require('./localVoiceRuntimePathUtils.cjs');

function createBrowserTtsService({ app, log, projectRoot }) {
  const runtimeRoot = resolveRuntimeRoot({ app, projectRoot });
  const serverSourcePath = path.join(__dirname, 'browser_tts_server.py');
  const serverRuntimePath = path.join(runtimeRoot, 'browser_tts_server.py');

  function writeLog(message, details) {
    if (typeof log === 'function') {
      log(message, details);
    }
  }

  function getSharedEnv() {
    return createPythonEnv();
  }

  function ensureServerScript() {
    ensureDir(runtimeRoot);
    const source = fs.readFileSync(serverSourcePath, 'utf8');
    if (!pathExists(serverRuntimePath) || fs.readFileSync(serverRuntimePath, 'utf8') !== source) {
      fs.writeFileSync(serverRuntimePath, source, 'utf8');
    }
    return serverRuntimePath;
  }

  const { getCandidate, probePackages } = createBrowserTtsPython({ projectRoot, runtimeRoot, getSharedEnv });

  const getHealth = createBrowserTtsHealth({ getCandidate, probePackages });

  const installDependencies = createBrowserTtsInstaller({ getCandidate, runtimeRoot, getSharedEnv, getHealth, writeLog });

  const { startProcess, dispose } = createBrowserTtsProcess({
    getCandidate, ensureServerScript, runtimeRoot, getSharedEnv, writeLog, waitUntilReady,
  });

  const ensureStarted = createBrowserTtsStartup({ getHealth, startProcess });
  const getSpeakers = createBrowserTtsSpeakers({ ensureStarted });

  return {
    dispose,
    ensureStarted,
    getHealth,
    getSpeakers,
    installDependencies,
  };
}

module.exports = {
  createBrowserTtsService,
};
