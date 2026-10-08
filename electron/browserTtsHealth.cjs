const { BROWSER_TTS_REQUIRED_PACKAGES } = require('./browserTtsPython.cjs');
const { normalizeApiBaseUrl, buildEndpoint } = require('./browserTtsRules.cjs');
const { HEALTH_TIMEOUT_MS, requestJson } = require('./browserTtsHttp.cjs');
const { buildJsonError } = require('./localVoiceRuntimeProcessUtils.cjs');

function missingRuntimeHealth(baseUrl) {
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

function missingDependencyHealth(baseUrl, candidate, packageProbe) {
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

function responseHealth(baseUrl, candidate, result) {
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
}

function stoppedHealth(baseUrl, candidate, error) {
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

function createBrowserTtsHealth(context) {
  const { getCandidate, probePackages } = context;

  async function getHealth(settings) {
    const baseUrl = normalizeApiBaseUrl(settings?.browserTtsApiUrl);
    const healthEndpoint = buildEndpoint(baseUrl, '/health');
    const candidate = getCandidate(settings);
    if (!candidate) return missingRuntimeHealth(baseUrl);

    const packageProbe = await probePackages(candidate);
    if (!packageProbe.ok || packageProbe.missingPackages.length > 0) {
      return missingDependencyHealth(baseUrl, candidate, packageProbe);
    }

    try {
      const result = await requestJson(healthEndpoint, { timeoutMs: HEALTH_TIMEOUT_MS });
      return responseHealth(baseUrl, candidate, result);
    } catch (error) {
      return stoppedHealth(baseUrl, candidate, error);
    }
  }

  return getHealth;
}

module.exports = { createBrowserTtsHealth };
