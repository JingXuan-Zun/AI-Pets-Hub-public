const { normalizeBrowserUrl } = require('./browserSearchRules.cjs');
const { navigateOrOpenTarget } = require('./browserSearchNavigation.cjs');
const { extractPageText } = require('./browserSearchPageText.cjs');
const { formatBrowserPage } = require('./browserSearchPages.cjs');

async function openBrowserControlPage(action, request, port, browserLabel) {
  const url = normalizeBrowserUrl(request?.url || request?.target || request?.query || request?.site || request?.website);
  if (!url) {
    return {
      action,
      browserLabel,
      ok: false,
      error: 'open_url needs an http(s) URL or a domain-like target.',
    };
  }

  const page = await navigateOrOpenTarget(port, url, Boolean(request?.forceNewPage));
  const shouldReadPage = request?.readPage !== false;
  const text = shouldReadPage && page?.webSocketDebuggerUrl
    ? await extractPageText(page.webSocketDebuggerUrl).catch(() => '')
    : '';

  return {
    action,
    browserLabel,
    ok: true,
    page: formatBrowserPage(page),
    text,
    url: page?.url && page.url !== 'about:blank' ? page.url : url,
  };
}

module.exports = { openBrowserControlPage };
