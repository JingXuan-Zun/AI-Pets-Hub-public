const { extractPageText } = require('./browserSearchPageText.cjs');
const { formatBrowserPage } = require('./browserSearchPages.cjs');

async function readBrowserControlPage(action, browserLabel, page, pages) {
  if (!page.webSocketDebuggerUrl) {
    return {
      action,
      browserLabel,
      ok: false,
      error: 'The selected tab does not expose a readable DevTools websocket.',
      page: formatBrowserPage(page),
      pageCount: pages.length,
    };
  }

  const text = await extractPageText(page.webSocketDebuggerUrl);
  return {
    action,
    browserLabel,
    ok: Boolean(text),
    page: formatBrowserPage(page),
    pageCount: pages.length,
    text,
    url: page.url || '',
    ...(text ? {} : { error: 'No usable page text was extracted.' }),
  };
}

module.exports = { readBrowserControlPage };
