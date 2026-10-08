const { spawn } = require('child_process');
const { parsePort, buildSpawnSpec } = require('./browserTtsRules.cjs');
const { createLineReporter } = require('./localVoiceRuntimeCommandUtils.cjs');
const { buildJsonError, terminateChildProcess } = require('./localVoiceRuntimeProcessUtils.cjs');

async function startBrowserTtsProcess(context, state, baseUrl, settings) {
  const { getCandidate, ensureServerScript, runtimeRoot, getSharedEnv, writeLog, waitUntilReady } = context;
  const candidate = getCandidate(settings);
  if (!candidate) {
    throw new Error('未找到可用的 Python 运行环境。');
  }
  const serverScript = ensureServerScript();
  const port = parsePort(baseUrl);
  const host = baseUrl.hostname || '127.0.0.1';
  const stdoutReporter = createLineReporter((line) => writeLog(`Browser TTS stdout: ${line}`));
  const stderrReporter = createLineReporter((line) => writeLog(`Browser TTS stderr: ${line}`));
  const spawnSpec = buildSpawnSpec(
    candidate,
    [serverScript, '--host', host, '--port', String(port)],
    {
      cwd: runtimeRoot,
      env: getSharedEnv(),
    },
  );
  writeLog('Starting Browser TTS service', {
    executable: candidate.executable,
    host,
    port,
  });
  state.child = spawn(spawnSpec.command, spawnSpec.args, spawnSpec.options);
  state.childBaseUrl = baseUrl.toString();
  state.child.stdout.on('data', (chunk) => stdoutReporter.push(chunk.toString('utf8')));
  state.child.stderr.on('data', (chunk) => stderrReporter.push(chunk.toString('utf8')));
  state.child.once('error', (error) => {
    writeLog('Browser TTS service spawn failed', buildJsonError(error));
  });
  state.child.once('close', (exitCode, signal) => {
    stdoutReporter.flush();
    stderrReporter.flush();
    writeLog('Browser TTS service exited', { exitCode, signal });
    if (state.child && state.child.exitCode === exitCode && state.child.signalCode === signal) {
      state.child = null;
      state.childBaseUrl = null;
    }
  });
  await waitUntilReady(baseUrl);
  return true;
}

function stopBrowserTtsProcess(context, state) {
  const { writeLog } = context;
  if (!state.child) {
    return;
  }
  writeLog('Stopping Browser TTS service', { url: state.childBaseUrl });
  terminateChildProcess(state.child);
  state.child = null;
  state.childBaseUrl = null;
}

function createBrowserTtsProcess(context) {
  const state = { child: null, childBaseUrl: null };
  return {
    startProcess: (baseUrl, settings) => startBrowserTtsProcess(context, state, baseUrl, settings),
    dispose: () => stopBrowserTtsProcess(context, state),
  };
}

module.exports = { createBrowserTtsProcess };
