const { requestText, DEVTOOLS_CONNECT_TIMEOUT_MS } = require('./browserSearchHttp.cjs');
const { formatBrowserPage } = require('./browserSearchPages.cjs');

async function focusBrowserControlPage(action, browserLabel, port, page, pages) {
  try {
    await requestText(`http://127.0.0.1:${port}/json/activate/${encodeURIComponent(page.id)}`, DEVTOOLS_CONNECT_TIMEOUT_MS, 'PUT')
      .catch(() => requestText(`http://127.0.0.1:${port}/json/activate/${encodeURIComponent(page.id)}`));
    return {
      action,
      browserLabel,
      ok: true,
      page: formatBrowserPage(page),
      pageCount: pages.length,
    };
  } catch (error) {
    return {
      action,
      browserLabel,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      page: formatBrowserPage(page),
      pageCount: pages.length,
    };
  }
}

module.exports = { focusBrowserControlPage };
