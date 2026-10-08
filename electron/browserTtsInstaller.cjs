const { BROWSER_TTS_REQUIRED_PACKAGES } = require('./browserTtsPython.cjs');
const { spawnCommand } = require('./browserTtsCommands.cjs');
const { formatSpawnFailure } = require('./localVoiceRuntimeCommandUtils.cjs');

function createInstallReporter(candidate, messages, options, writeLog) {
  const pushMessage = (message) => {
    const normalized = String(message || '').trim();
    if (!normalized) {
      return;
    }
    messages.push(normalized);
    if (typeof options.onProgress === 'function') {
      options.onProgress({
        stage: 'running',
        currentStep: normalized,
        executable: candidate.executable,
        messages: [...messages],
        error: null,
        missingPackages: [],
      });
    }
    writeLog(`Browser TTS install: ${normalized}`);
  };

  if (typeof options.onProgress === 'function') {
    options.onProgress({
      stage: 'starting',
      currentStep: '正在准备 Edge-TTS 依赖安装...',
      executable: candidate.executable,
      messages: ['正在准备 Edge-TTS 依赖安装...'],
      error: null,
      missingPackages: [],
    });
  }
  return pushMessage;
}

function installFailed(result, candidate, messages, options) {
  const error = formatSpawnFailure(result);
  if (typeof options.onProgress === 'function') {
    options.onProgress({
      stage: 'failed',
      currentStep: error,
      executable: candidate.executable,
      messages,
      error,
      missingPackages: BROWSER_TTS_REQUIRED_PACKAGES,
    });
  }
  return {
    ok: false,
    executable: candidate.executable,
    messages,
    error,
    missingPackages: BROWSER_TTS_REQUIRED_PACKAGES,
  };
}

function installFinished(health, candidate, messages, options) {
  const ok = health.status !== 'missing-dependencies' && health.status !== 'missing-runtime';
  const error = ok ? null : health.error || 'Edge-TTS 依赖安装后仍不可用。';
  if (typeof options.onProgress === 'function') {
    options.onProgress({
      stage: ok ? 'completed' : 'failed',
      currentStep: ok ? 'Edge-TTS 依赖安装完成。' : error,
      executable: candidate.executable,
      messages: [...messages, ok ? 'Edge-TTS 依赖安装完成。' : error],
      error,
      missingPackages: health.missingPackages,
    });
  }
  return {
    ok,
    executable: candidate.executable,
    messages: [...messages, ok ? 'Edge-TTS 依赖安装完成。' : error],
    error,
    missingPackages: health.missingPackages,
  };
}

function createBrowserTtsInstaller(context) {
  const { getCandidate, runtimeRoot, getSharedEnv, getHealth, writeLog } = context;

  async function installDependencies(settings, options = {}) {
    const candidate = getCandidate(settings);
    const messages = [];
    if (!candidate) {
      return {
        ok: false,
        executable: null,
        messages,
        error: '未找到可用的 Python 运行环境。',
        missingPackages: BROWSER_TTS_REQUIRED_PACKAGES,
      };
    }

    const pushMessage = createInstallReporter(candidate, messages, options, writeLog);
    pushMessage(`Python: ${candidate.executable}`);
    pushMessage('安装 edge-tts...');
    const result = await spawnCommand(candidate, ['-m', 'pip', 'install', '--upgrade', '--no-cache-dir', 'edge-tts'], {
      cwd: runtimeRoot,
      env: getSharedEnv(),
    });
    if (!result.ok) return installFailed(result, candidate, messages, options);
    const health = await getHealth(settings);
    return installFinished(health, candidate, messages, options);
  }

  return installDependencies;
}

module.exports = { createBrowserTtsInstaller };
