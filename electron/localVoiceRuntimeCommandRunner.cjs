const { spawn } = require('child_process');
const {
  buildPowerShellEncodedCommand,
  buildSpawnCommandSpec,
  buildSpawnCloseResult,
  buildSpawnErrorResult,
  createLineReporter,
} = require('./localVoiceRuntimeCommandUtils.cjs');
const {
  createLocalVoiceCancelledError,
  terminateChildProcess,
} = require('./localVoiceRuntimeProcessUtils.cjs');
const { withTemporaryPythonScript } = require('./localVoiceRuntimeScriptUtils.cjs');

function createCommandSettlement({ child, signal, resolve, state, reporters, terminate }) {
  return (kind, value) => {
    if (state.settled) return;
    state.settled = true;
    if (signal && state.abortListener) {
      signal.removeEventListener('abort', state.abortListener);
      state.abortListener = null;
    }
    if (kind === 'cancel') terminate(child);
    reporters.stdout.flush();
    reporters.stderr.flush();
    const output = { stdout: state.stdout, stderr: state.stderr };
    resolve(kind === 'close'
      ? buildSpawnCloseResult({ ...output, exitCode: value })
      : buildSpawnErrorResult({
        ...output,
        error: kind === 'cancel' ? createLocalVoiceCancelledError() : value,
        canceled: kind === 'cancel',
      }));
  };
}

function attachCommandAbort(signal, state, settle) {
  if (!signal) return;
  if (signal.aborted) {
    settle('cancel');
    return;
  }
  state.abortListener = () => settle('cancel');
  signal.addEventListener('abort', state.abortListener, { once: true });
}

function observeCommand(child, options, resolve, terminate) {
  const state = { stdout: '', stderr: '', settled: false, abortListener: null };
  const reporters = {
    stdout: createLineReporter(options.onStdoutLine),
    stderr: createLineReporter(options.onStderrLine),
  };
  const signal = options.signal;
  const settle = createCommandSettlement({ child, signal, resolve, state, reporters, terminate });
  child.stdout.on('data', (chunk) => {
    const text = chunk.toString('utf8');
    state.stdout += text;
    reporters.stdout.push(text);
  });
  child.stderr.on('data', (chunk) => {
    const text = chunk.toString('utf8');
    state.stderr += text;
    reporters.stderr.push(text);
  });
  child.once('error', (error) => settle('error', error));
  child.once('close', (exitCode) => settle('close', exitCode));
  attachCommandAbort(signal, state, settle);
}

function createLocalVoiceCommandRunner({
  spawnProcess = spawn,
  platform = process.platform,
  terminate = terminateChildProcess,
  executeTemporaryScript = withTemporaryPythonScript,
} = {}) {
  function spawnCommand(candidate, commandArgs, options = {}) {
    return new Promise((resolve) => {
      let child;
      try {
        const spec = buildSpawnCommandSpec({
          buildPowerShellEncodedCommand, candidate, commandArgs, options, platform,
        });
        child = spawnProcess(spec.command, spec.args, spec.options);
      } catch (error) {
        resolve(buildSpawnErrorResult({ error }));
        return;
      }
      observeCommand(child, options, resolve, terminate);
    });
  }

  async function runInlinePythonScript(candidate, scriptContent, options = {}) {
    return executeTemporaryScript({
      cwd: options.cwd,
      execute: (scriptPath) => spawnCommand(candidate, [scriptPath], options),
      scriptContent,
    });
  }

  return { spawnCommand, runInlinePythonScript };
}

module.exports = { createLocalVoiceCommandRunner };
