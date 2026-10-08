const { spawn } = require('child_process');
const { buildEndpoint, buildSpawnSpec } = require('./browserTtsRules.cjs');
const { requestJson } = require('./browserTtsHttp.cjs');
const { createLineReporter } = require('./localVoiceRuntimeCommandUtils.cjs');
const { buildJsonError, terminateChildProcess } = require('./localVoiceRuntimeProcessUtils.cjs');
const { buildGptSovitsServerArgs, normalizeGptSovitsDevice } = require('./gptSovitsRules.cjs');

const READY_TIMEOUT_MS = 90000;
const READY_POLL_MS = 500;

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// Model import and CUDA init take far longer than the Edge-TTS sidecar, hence the separate budget.
async function waitUntilReady(baseUrl, child, timeoutMs = READY_TIMEOUT_MS) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error('GPT-SoVITS 服务启动失败。');
    }
    try {
      const result = await requestJson(buildEndpoint(baseUrl, '/health'), { timeoutMs: 2000 });
      if (result.ok && result.body?.status === 'ok') return result;
    } catch {
      // Keep polling until the timeout.
    }
    await wait(READY_POLL_MS);
  }
  throw new Error('GPT-SoVITS 服务启动超时。');
}

function attachLogging(child, writeLog) {
  const stdoutReporter = createLineReporter((line) => writeLog(`GPT-SoVITS stdout: ${line}`));
  const stderrReporter = createLineReporter((line) => writeLog(`GPT-SoVITS stderr: ${line}`));
  child.stdout.on('data', (chunk) => stdoutReporter.push(chunk.toString('utf8')));
  child.stderr.on('data', (chunk) => stderrReporter.push(chunk.toString('utf8')));
  child.once('error', (error) => writeLog('GPT-SoVITS service spawn failed', buildJsonError(error)));
  return () => {
    stdoutReporter.flush();
    stderrReporter.flush();
  };
}

function createGptSovitsProcess(context) {
  const { paths, getModelsRoot, getCandidate, ensureServerScript, getSharedEnv, writeLog, spawnProcess = spawn } = context;
  const state = { child: null, device: null };

  function stop() {
    if (!state.child) return;
    writeLog('Stopping GPT-SoVITS service', { device: state.device });
    terminateChildProcess(state.child);
    state.child = null;
    state.device = null;
  }

  async function start(baseUrl, settings) {
    const candidate = getCandidate();
    if (!candidate) throw new Error('GPT-SoVITS 运行环境尚未安装。');
    const device = normalizeGptSovitsDevice(settings?.gptSovitsDevice);
    const args = buildGptSovitsServerArgs(ensureServerScript(), {
      baseUrl, sourceDir: paths.sourceDir, modelsRoot: getModelsRoot(), device,
    });
    const spec = buildSpawnSpec(candidate, args, { cwd: paths.sourceDir, env: getSharedEnv() });
    writeLog('Starting GPT-SoVITS service', { port: baseUrl.port, device });
    const child = spawnProcess(spec.command, spec.args, spec.options);
    state.child = child;
    state.device = device;
    const flush = attachLogging(child, writeLog);
    child.once('close', (exitCode, signal) => {
      flush();
      writeLog('GPT-SoVITS service exited', { exitCode, signal });
      if (state.child === child) {
        state.child = null;
        state.device = null;
      }
    });
    try {
      await waitUntilReady(baseUrl, child);
    } catch (error) {
      if (state.child === child) stop();
      throw error;
    }
    return true;
  }

  return {
    start,
    stop,
    getRunningDevice: () => (state.child ? state.device : null),
  };
}

module.exports = { createGptSovitsProcess, waitUntilReady };
