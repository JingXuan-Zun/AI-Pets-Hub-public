const { requestJson, DEVTOOLS_CONNECT_TIMEOUT_MS } = require('./browserSearchHttp.cjs');
const { delay } = require('./browserSearchTiming.cjs');

async function waitForDevTools(port) {
  const endpoint = `http://127.0.0.1:${port}/json/version`;
  const startedAt = Date.now();
  let lastError = null;

  while (Date.now() - startedAt < DEVTOOLS_CONNECT_TIMEOUT_MS) {
    try {
      return await requestJson(endpoint, 1500);
    } catch (error) {
      lastError = error;
      await delay(300);
    }
  }

  throw lastError || new Error('DevTools endpoint is not ready');
}

module.exports = { waitForDevTools };
