const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const path = require('path');
const {
  createPythonEnv,
} = require('./localVoiceRuntimeHostUtils.cjs');
const {
  createLineReporter,
  formatSpawnFailure,
} = require('./localVoiceRuntimeCommandUtils.cjs');
const {
  ensureDir,
  getPythonCandidates,
  pathExists,
  resolveRuntimeRoot,
} = require('./localVoiceRuntimePathUtils.cjs');
const {
  buildJsonError,
  isChildProcessRunning,
  terminateChildProcess,
} = require('./localVoiceRuntimeProcessUtils.cjs');

const DEFAULT_BROWSER_TTS_API_URL = 'http://127.0.0.1:9880';
const BROWSER_TTS_REQUIRED_PACKAGES = ['edge_tts'];
const START_TIMEOUT_MS = 15000;
const HEALTH_TIMEOUT_MS = 3000;

function normalizeApiBaseUrl(rawUrl) {
  const normalizedUrl = typeof rawUrl === 'string' && rawUrl.trim()
    ? rawUrl.trim()
    : DEFAULT_BROWSER_TTS_API_URL;
  try {
    const url = new URL(normalizedUrl);
    const pathName = url.pathname.replace(/\/+$/u, '');
    if (pathName.endsWith('/tts/generate')) {
      url.pathname = pathName.slice(0, -'/tts/generate'.length) || '/';
    }
    return url;
  } catch {
    return new URL(DEFAULT_BROWSER_TTS_API_URL);
  }
}

function buildEndpoint(baseUrl, pathname) {
  const url = new URL(baseUrl.toString());
  url.pathname = pathname;
  url.search = '';
  url.hash = '';
  return url;
}

function parsePort(baseUrl) {
  const parsedPort = Number(baseUrl.port || (baseUrl.protocol === 'https:' ? 443 : 80));
  return Number.isFinite(parsedPort) ? parsedPort : 9880;
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function requestJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const request = http.request(
      url,
      {
        method: options.method || 'GET',
        timeout: options.timeoutMs || HEALTH_TIMEOUT_MS,
        headers: options.headers || {},
      },
      (response) => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          body += chunk;
        });
        response.on('end', () => {
          let parsed = null;
          try {
            parsed = body ? JSON.parse(body) : null;
          } catch {
            parsed = { raw: body };
          }
          resolve({
            ok: response.statusCode >= 200 && response.statusCode < 300,
            statusCode: response.statusCode,
            body: parsed,
          });
        });
      },
    );

    request.on('timeout', () => {
      request.destroy(new Error('browser_tts_health_timeout'));
    });
    request.on('error', reject);
    request.end();
  });
}

function buildSpawnSpec(candidate, commandArgs, options = {}) {
  const candidateArgs = [...(candidate.args || []), ...commandArgs];
  return {
    command: candidate.executable,
    args: candidateArgs,
    options: {
      cwd: options.cwd,
      env: options.env,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  };
}

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

function createBrowserTtsService({ app, log, projectRoot }) {
  const runtimeRoot = resolveRuntimeRoot({ app, projectRoot });
  const serverSourcePath = path.join(__dirname, 'browser_tts_server.py');
  const serverRuntimePath = path.join(runtimeRoot, 'browser_tts_server.py');
  let child = null;
  let childBaseUrl = null;
  let startPromise = null;

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

  function getCandidate(settings) {
    const preferredPath = typeof settings?.localVoiceRuntimePath === 'string'
      ? settings.localVoiceRuntimePath.trim()
      : '';
    return getPythonCandidates(preferredPath, { projectRoot })[0] || null;
  }

  async function probePackages(candidate) {
    const script = [
      'import importlib.util',
      'missing = []',
      `packages = ${JSON.stringify(BROWSER_TTS_REQUIRED_PACKAGES)}`,
      'for package in packages:',
      '    if importlib.util.find_spec(package) is None:',
      '        missing.append(package)',
      'print("\\n".join(missing))',
    ].join('\n');
    const result = await spawnCommand(candidate, ['-c', script], {
      cwd: runtimeRoot,
      env: getSharedEnv(),
    });
    if (!result.ok) {
      return {
        ok: false,
        missingPackages: BROWSER_TTS_REQUIRED_PACKAGES,
        error: formatSpawnFailure(result),
      };
    }
    return {
      ok: true,
      missingPackages: result.stdout.split(/\r?\n/u).map((item) => item.trim()).filter(Boolean),
      error: null,
    };
  }

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

    pushMessage(`Python: ${candidate.executable}`);
    pushMessage('安装 edge-tts...');
    const result = await spawnCommand(candidate, ['-m', 'pip', 'install', '--upgrade', 'edge-tts'], {
      cwd: runtimeRoot,
      env: getSharedEnv(),
    });

    if (!result.ok) {
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

    const health = await getHealth(settings);
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

  async function getHealth(settings) {
    const baseUrl = normalizeApiBaseUrl(settings?.browserTtsApiUrl);
    const healthEndpoint = buildEndpoint(baseUrl, '/health');
    const candidate = getCandidate(settings);
    if (!candidate) {
      return {
        available: false,
        status: 'missing-runtime',
        running: false,
        url: baseUrl.toString().replace(/\/$/u, ''),
        executable: null,
        error: '未找到可用的 Python 运行环境。',
        missingPackages: BROWSER_TTS_REQUIRED_PACKAGES,
      };
    }

    const packageProbe = await probePackages(candidate);
    if (!packageProbe.ok || packageProbe.missingPackages.length > 0) {
      return {
        available: false,
        status: 'missing-dependencies',
        running: false,
        url: baseUrl.toString().replace(/\/$/u, ''),
        executable: candidate.executable,
        error: packageProbe.error,
        missingPackages: packageProbe.missingPackages.length > 0
          ? packageProbe.missingPackages
          : BROWSER_TTS_REQUIRED_PACKAGES,
      };
    }

    try {
      const result = await requestJson(healthEndpoint, { timeoutMs: HEALTH_TIMEOUT_MS });
      return {
        available: Boolean(result.ok && result.body?.status === 'ok'),
        status: result.ok && result.body?.status === 'ok' ? 'ready' : 'error',
        running: Boolean(result.ok),
        url: baseUrl.toString().replace(/\/$/u, ''),
        executable: candidate.executable,
        error: result.ok ? null : result.body?.error || result.body?.detail || `HTTP ${result.statusCode}`,
        missingPackages: [],
        voicesCount: Number(result.body?.voices_count || 0),
      };
    } catch (error) {
      return {
        available: false,
        status: 'stopped',
        running: false,
        url: baseUrl.toString().replace(/\/$/u, ''),
        executable: candidate.executable,
        error: buildJsonError(error),
        missingPackages: [],
      };
    }
  }

  async function waitUntilReady(baseUrl) {
    const startedAt = Date.now();
    const healthEndpoint = buildEndpoint(baseUrl, '/health');
    while (Date.now() - startedAt < START_TIMEOUT_MS) {
      try {
        const result = await requestJson(healthEndpoint, { timeoutMs: 2000 });
        if (result.ok && result.body?.status === 'ok') {
          return result;
        }
      } catch {
        // Retry until the startup timeout expires.
      }
      await wait(350);
    }
    throw new Error('Edge-TTS 本地服务启动超时。');
  }

  async function ensureStarted(settings) {
    const baseUrl = normalizeApiBaseUrl(settings?.browserTtsApiUrl);
    const existingHealth = await getHealth(settings);
    if (existingHealth.available) {
      return {
        ...existingHealth,
        started: false,
      };
    }
    if (existingHealth.status === 'missing-runtime' || existingHealth.status === 'missing-dependencies') {
      throw new Error(existingHealth.status === 'missing-dependencies'
        ? `Edge-TTS 依赖缺失：${existingHealth.missingPackages.join(', ')}。请先在语音设置里安装 Edge-TTS 依赖。`
        : existingHealth.error || '未找到可用的 Python 运行环境。');
    }

    if (startPromise) {
      await startPromise;
      const health = await getHealth(settings);
      return {
        ...health,
        started: false,
      };
    }

    startPromise = (async () => {
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
      child = spawn(spawnSpec.command, spawnSpec.args, spawnSpec.options);
      childBaseUrl = baseUrl.toString();
      child.stdout.on('data', (chunk) => stdoutReporter.push(chunk.toString('utf8')));
      child.stderr.on('data', (chunk) => stderrReporter.push(chunk.toString('utf8')));
      child.once('error', (error) => {
        writeLog('Browser TTS service spawn failed', buildJsonError(error));
      });
      child.once('close', (exitCode, signal) => {
        stdoutReporter.flush();
        stderrReporter.flush();
        writeLog('Browser TTS service exited', { exitCode, signal });
        if (child && child.exitCode === exitCode && child.signalCode === signal) {
          child = null;
          childBaseUrl = null;
        }
      });
      await waitUntilReady(baseUrl);
      return true;
    })();

    try {
      await startPromise;
      const health = await getHealth(settings);
      return {
        ...health,
        started: true,
      };
    } finally {
      startPromise = null;
    }
  }

  async function getSpeakers(settings) {
    await ensureStarted(settings);
    const baseUrl = normalizeApiBaseUrl(settings?.browserTtsApiUrl);
    const result = await requestJson(buildEndpoint(baseUrl, '/speakers'), { timeoutMs: 10000 });
    if (!result.ok) {
      throw new Error(result.body?.detail || result.body?.error || `HTTP ${result.statusCode}`);
    }
    return result.body;
  }

  function dispose() {
    if (!child) {
      return;
    }
    writeLog('Stopping Browser TTS service', { url: childBaseUrl });
    terminateChildProcess(child);
    child = null;
    childBaseUrl = null;
  }

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
