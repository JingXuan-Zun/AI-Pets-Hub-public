const { requestJson, DEVTOOLS_CONNECT_TIMEOUT_MS } = require('./browserSearchHttp.cjs');
const { createDevToolsClient } = require('./browserSearchDevToolsClient.cjs');
const { delay, PAGE_LOAD_WAIT_MS } = require('./browserSearchTiming.cjs');

async function openSearchTarget(port, searchUrl) {
  try {
    return await requestJson(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(searchUrl)}`, DEVTOOLS_CONNECT_TIMEOUT_MS, 'PUT');
  } catch (error) {
    const list = await requestJson(`http://127.0.0.1:${port}/json/list`);
    const fallbackTarget = Array.isArray(list)
      ? list.find((item) => item?.type === 'page' && item?.webSocketDebuggerUrl)
      : null;

    if (!fallbackTarget?.webSocketDebuggerUrl) {
      throw error;
    }

    const client = await createDevToolsClient(fallbackTarget.webSocketDebuggerUrl);
    try {
      await client.send('Page.enable');
      await client.send('Page.navigate', { url: searchUrl });
      await delay(PAGE_LOAD_WAIT_MS);
      return fallbackTarget;
    } finally {
      client.close();
    }
  }
}

module.exports = { openSearchTarget };
