const { requestJson } = require('./browserSearchHttp.cjs');

async function listDevToolsPages(port) {
  const list = await requestJson(`http://127.0.0.1:${port}/json/list`);
  return Array.isArray(list)
    ? list.filter((item) => item?.type === 'page')
    : [];
}

function selectBrowserPage(pages, request = {}) {
  const requestedId = String(request?.tabId || request?.id || '').trim();
  if (requestedId) {
    const exactPage = pages.find((page) => page?.id === requestedId);
    if (exactPage) {
      return exactPage;
    }
  }

  const query = String(request?.query || request?.target || request?.title || request?.url || '').trim().toLowerCase();
  if (query) {
    return pages.find((page) => (
      String(page?.title || '').toLowerCase().includes(query)
      || String(page?.url || '').toLowerCase().includes(query)
    )) ?? null;
  }

  return pages.find((page) => page?.webSocketDebuggerUrl) ?? pages[0] ?? null;
}

function formatBrowserPage(page) {
  return {
    id: page?.id || '',
    title: page?.title || '',
    type: page?.type || '',
    url: page?.url || '',
    webSocketDebuggerUrl: page?.webSocketDebuggerUrl ? 'available' : '',
  };
}

module.exports = { listDevToolsPages, selectBrowserPage, formatBrowserPage };
