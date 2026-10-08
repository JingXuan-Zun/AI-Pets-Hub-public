const CHROME_SEARCH_URL_TEMPLATE = 'https://www.google.com/search?q={query}';

const EDGE_SEARCH_URL_TEMPLATE = 'https://www.bing.com/search?q={query}';

const SEARCH_URL_TEMPLATES = {
  baidu: 'https://www.baidu.com/s?wd={query}',
  bing: EDGE_SEARCH_URL_TEMPLATE,
  google: CHROME_SEARCH_URL_TEMPLATE,
  sogou: 'https://www.sogou.com/web?query={query}',
};

const DEFAULT_DEBUG_PORT = 9223;

function resolveDebugPort(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return DEFAULT_DEBUG_PORT;
  }

  return Math.min(65535, Math.max(1024, Math.round(numericValue)));
}

function resolveDefaultSearchUrlTemplate(browserLabel) {
  return browserLabel === 'Chrome'
    ? CHROME_SEARCH_URL_TEMPLATE
    : EDGE_SEARCH_URL_TEMPLATE;
}

function shouldPreferChineseSearch() {
  const localeText = [
    Intl.DateTimeFormat().resolvedOptions().locale,
    process.env.LANG,
    process.env.LANGUAGE,
    process.env.LC_ALL,
    process.env.LC_MESSAGES,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return /(?:^|[-_\s])zh(?:[-_\s]|$)|china|chinese|cn\b/.test(localeText);
}

function resolveBrowserSearchUrlTemplate(settings, browserLabel) {
  const engine = typeof settings?.browserSearchEngine === 'string'
    ? settings.browserSearchEngine.trim().toLowerCase()
    : 'auto';

  if (engine === 'custom') {
    const customTemplate = typeof settings?.browserSearchUrlTemplate === 'string'
      ? settings.browserSearchUrlTemplate.trim()
      : '';

    return customTemplate || resolveDefaultSearchUrlTemplate(browserLabel);
  }

  if (engine === 'auto') {
    return shouldPreferChineseSearch()
      ? SEARCH_URL_TEMPLATES.baidu
      : resolveDefaultSearchUrlTemplate(browserLabel);
  }

  return SEARCH_URL_TEMPLATES[engine] || resolveDefaultSearchUrlTemplate(browserLabel);
}

function buildSearchUrl(query, settings, browserLabel) {
  const defaultTemplate = resolveDefaultSearchUrlTemplate(browserLabel);
  const nextTemplate = resolveBrowserSearchUrlTemplate(settings, browserLabel);
  const encodedQuery = encodeURIComponent(query);

  if (nextTemplate.includes('{query}')) {
    return nextTemplate.replace(/\{query\}/g, encodedQuery);
  }

  try {
    const url = new URL(nextTemplate);
    url.searchParams.set('q', query);
    return url.toString();
  } catch {
    return defaultTemplate.replace('{query}', encodedQuery);
  }
}

function normalizeBrowserUrl(target) {
  const trimmedTarget = String(target || '').trim();
  if (!trimmedTarget) {
    return '';
  }

  try {
    const parsedUrl = new URL(trimmedTarget);
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:'
      ? parsedUrl.toString()
      : '';
  } catch {
    if (/^[^\s/]+\.[^\s]+$/u.test(trimmedTarget)) {
      return `https://${trimmedTarget}`;
    }
  }

  return '';
}

function normalizeBrowserControlAction(value) {
  const normalizedValue = String(value || '').trim().toLowerCase().replace(/[-\s]+/g, '_');
  switch (normalizedValue) {
    case 'open':
    case 'open_url':
    case 'navigate':
    case 'navigate_url':
      return 'open_url';
    case 'search':
    case 'search_web':
      return 'search_web';
    case 'read':
    case 'read_page':
    case 'extract_page':
    case 'get_page_text':
      return 'read_page';
    case 'focus':
    case 'focus_tab':
    case 'activate_tab':
      return 'focus_tab';
    case 'list':
    case 'list_tabs':
    case 'tabs':
      return 'list_tabs';
    case 'status':
    case 'session_status':
      return 'status';
    default:
      return '';
  }
}

module.exports = {
  resolveDebugPort,
  resolveDefaultSearchUrlTemplate,
  shouldPreferChineseSearch,
  resolveBrowserSearchUrlTemplate,
  buildSearchUrl,
  normalizeBrowserUrl,
  normalizeBrowserControlAction
};
