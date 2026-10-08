const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  ensureDir,
  pathExists,
} = require('./localVoiceRuntimePathUtils.cjs');

function createTemporaryPythonScriptPath({ cwd }) {
  const targetDir = cwd || os.tmpdir();
  return path.join(
    targetDir,
    `desktop-pet-probe-${Date.now()}-${Math.random().toString(16).slice(2)}.py`,
  );
}

async function withTemporaryPythonScript({ cwd, execute, scriptContent }) {
  const scriptPath = createTemporaryPythonScriptPath({ cwd });
  fs.writeFileSync(scriptPath, scriptContent, 'utf8');

  try {
    return await execute(scriptPath);
  } finally {
    try {
      fs.unlinkSync(scriptPath);
    } catch {
      // Ignore temporary probe cleanup failures.
    }
  }
}

function ensureSyncedTextFile({ sourcePath, targetPath }) {
  ensureDir(path.dirname(targetPath));
  const source = fs.readFileSync(sourcePath, 'utf8');

  if (!pathExists(targetPath) || fs.readFileSync(targetPath, 'utf8') !== source) {
    fs.writeFileSync(targetPath, source, 'utf8');
  }

  return targetPath;
}

function createRunnerScriptResolver({ sourcePath, runtimeRoot }) {
  function ensureRunnerScriptPath() {
    return ensureSyncedTextFile({
      sourcePath,
      targetPath: path.join(runtimeRoot, 'local_voice_runner.py'),
    });
  }
  return ensureRunnerScriptPath;
}

module.exports = {
  createRunnerScriptResolver,
  createTemporaryPythonScriptPath,
  ensureSyncedTextFile,
  withTemporaryPythonScript,
};
