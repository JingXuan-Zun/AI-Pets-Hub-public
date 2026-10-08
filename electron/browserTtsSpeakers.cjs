const { normalizeApiBaseUrl, buildEndpoint } = require('./browserTtsRules.cjs');
const { requestJson } = require('./browserTtsHttp.cjs');

function createBrowserTtsSpeakers(context) {
  const { ensureStarted } = context;

  async function getSpeakers(settings) {
    await ensureStarted(settings);
    const baseUrl = normalizeApiBaseUrl(settings?.browserTtsApiUrl);
    const result = await requestJson(buildEndpoint(baseUrl, '/speakers'), { timeoutMs: 10000 });
    if (!result.ok) {
      throw new Error(result.body?.detail || result.body?.error || `HTTP ${result.statusCode}`);
    }
    return result.body;
  }

  return getSpeakers;
}

module.exports = { createBrowserTtsSpeakers };
