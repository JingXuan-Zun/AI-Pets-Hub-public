const DEFAULT_BROWSER_TTS_API_URL = 'http://127.0.0.1:9880';

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

module.exports = { normalizeApiBaseUrl, buildEndpoint, parsePort, buildSpawnSpec };
