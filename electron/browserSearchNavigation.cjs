const { requestJson } = require('./browserSearchHttp.cjs');
const { createDevToolsClient } = require('./browserSearchDevToolsClient.cjs');
const { openSearchTarget } = require('./browserSearchTarget.cjs');
const { delay, PAGE_LOAD_WAIT_MS } = require('./browserSearchTiming.cjs');

async function navigateOrOpenTarget(port, searchUrl, forceNewPage) {
  if (!forceNewPage) {
    const list = await requestJson(`http://127.0.0.1:${port}/json/list`);
    const existingPage = Array.isArray(list)
      ? list.find((item) => item?.type === 'page' && item?.webSocketDebuggerUrl)
      : null;

    if (existingPage?.webSocketDebuggerUrl) {
      const client = await createDevToolsClient(existingPage.webSocketDebuggerUrl);
      try {
        await client.send('Page.enable');
        await client.send('Page.navigate', { url: searchUrl });
        await delay(PAGE_LOAD_WAIT_MS);
        const refreshedList = await requestJson(`http://127.0.0.1:${port}/json/list`).catch(() => null);
        const refreshedPage = Array.isArray(refreshedList)
          ? refreshedList.find((item) => item?.id === existingPage.id && item?.webSocketDebuggerUrl)
          : null;
        return {
          ...existingPage,
          ...(refreshedPage ?? {}),
          url: refreshedPage?.url && refreshedPage.url !== 'about:blank'
            ? refreshedPage.url
            : searchUrl,
          webSocketDebuggerUrl: refreshedPage?.webSocketDebuggerUrl ?? existingPage.webSocketDebuggerUrl,
        };
      } finally {
        client.close();
      }
    }
  }

  return openSearchTarget(port, searchUrl);
}

module.exports = { navigateOrOpenTarget };
