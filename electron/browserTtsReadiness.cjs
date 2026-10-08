const { buildEndpoint } = require('./browserTtsRules.cjs');
const { requestJson } = require('./browserTtsHttp.cjs');

const START_TIMEOUT_MS = 15000;

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
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

module.exports = { waitUntilReady };
