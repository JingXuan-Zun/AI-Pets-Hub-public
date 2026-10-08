const { spawn } = require('child_process');
const { buildSpawnSpec } = require('./browserTtsRules.cjs');

function spawnCommand(candidate, commandArgs, options = {}) {
  return new Promise((resolve) => {
    let child = null;
    try {
      const spawnSpec = buildSpawnSpec(candidate, commandArgs, options);
      child = spawn(spawnSpec.command, spawnSpec.args, spawnSpec.options);
    } catch (error) {
      resolve({ ok: false, stdout: '', stderr: '', exitCode: null, error });
      return;
    }

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });
    child.once('error', (error) => {
      resolve({ ok: false, stdout, stderr, exitCode: null, error });
    });
    child.once('close', (exitCode) => {
      resolve({ ok: exitCode === 0, stdout, stderr, exitCode, error: null });
    });
  });
}

module.exports = { spawnCommand };
