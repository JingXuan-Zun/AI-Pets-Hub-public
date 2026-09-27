const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const CHROME_SEARCH_URL_TEMPLATE = 'https://www.google.com/search?q={query}';
const EDGE_SEARCH_URL_TEMPLATE = 'https://www.bing.com/search?q={query}';
const SEARCH_URL_TEMPLATES = {
  baidu: 'https://www.baidu.com/s?wd={query}',
  bing: EDGE_SEARCH_URL_TEMPLATE,
  google: CHROME_SEARCH_URL_TEMPLATE,
  sogou: 'https://www.sogou.com/web?query={query}',
};
const DEFAULT_DEBUG_PORT = 9223;
const PAGE_LOAD_WAIT_MS = 4500;
const DEVTOOLS_CONNECT_TIMEOUT_MS = 8000;
const MAX_RESULT_TEXT_LENGTH = 6000;
const WINDOWS_BROWSER_ROOT_NAMES = ['Program Files', 'Program Files (x86)'];

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isExecutableFile(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    return false;
  }

  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean))];
}

function getWindowsDriveRoots() {
  if (process.platform !== 'win32') {
    return [];
  }

  const roots = [];
  for (let code = 65; code <= 90; code += 1) {
    const driveRoot = `${String.fromCharCode(code)}:\\`;
    try {
      if (fs.existsSync(driveRoot)) {
        roots.push(driveRoot);
      }
    } catch {
      // Ignore inaccessible drive roots.
    }
  }

  return roots;
}

function getBrowserSearchCandidateRoots() {
  if (process.platform !== 'win32') {
    return [];
  }

  const localAppData = process.env.LOCALAPPDATA || '';
  const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
  const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  const windowsDriveRoots = getWindowsDriveRoots();

  return uniqueStrings([
    programFiles,
    programFilesX86,
    localAppData,
    ...windowsDriveRoots.flatMap((driveRoot) => WINDOWS_BROWSER_ROOT_NAMES.map((rootName) => path.join(driveRoot, rootName))),
  ]);
}

function buildBrowserCandidateDescriptors() {
  return getBrowserSearchCandidateRoots()
    .flatMap((rootPath) => ([
      {
        browserLabel: 'Edge',
        exists: false,
        path: path.join(rootPath, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
        source: rootPath,
      },
      {
        browserLabel: 'Chrome',
        exists: false,
        path: path.join(rootPath, 'Google', 'Chrome', 'Application', 'chrome.exe'),
        source: rootPath,
      },
    ]))
    .map((candidate) => ({
      ...candidate,
      exists: isExecutableFile(candidate.path),
    }));
}

function getDetectedBrowserCandidates() {
  return buildBrowserCandidateDescriptors()
    .filter((candidate) => candidate.exists)
    .sort((left, right) => {
      if (left.browserLabel !== right.browserLabel) {
        return left.browserLabel.localeCompare(right.browserLabel, 'en-US');
      }

      return left.path.localeCompare(right.path, 'zh-CN');
    });
}

function getDefaultBrowserCandidates() {
  return getDetectedBrowserCandidates().map((candidate) => candidate.path);
}

function resolveBrowserPath(configuredPath) {
  const trimmedPath = typeof configuredPath === 'string' ? configuredPath.trim() : '';
  if (isExecutableFile(trimmedPath)) {
    return trimmedPath;
  }

  return getDefaultBrowserCandidates()[0] || '';
}

function resolveBrowserLabel(browserPath) {
  const basename = path.basename(browserPath || '').toLowerCase();
  if (basename.includes('msedge')) {
    return 'Edge';
  }

  if (basename.includes('chrome')) {
    return 'Chrome';
  }

  return browserPath ? path.basename(browserPath) : 'Browser';
}

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

function requestJson(url, timeoutMs = DEVTOOLS_CONNECT_TIMEOUT_MS, method = 'GET') {
  return new Promise((resolve, reject) => {
    const request = http.request(url, { method, timeout: timeoutMs }, (response) => {
      let body = '';

      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        body += chunk;
      });
      response.on('end', () => {
        if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`DevTools request failed (${response.statusCode || 'unknown'})`));
          return;
        }

        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    });

    request.on('timeout', () => {
      request.destroy(new Error('DevTools request timed out'));
    });
    request.on('error', reject);
    request.end();
  });
}

function requestText(url, timeoutMs = DEVTOOLS_CONNECT_TIMEOUT_MS, method = 'GET') {
  return new Promise((resolve, reject) => {
    const request = http.request(url, { method, timeout: timeoutMs }, (response) => {
      let body = '';

      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        body += chunk;
      });
      response.on('end', () => {
        if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`DevTools request failed (${response.statusCode || 'unknown'})`));
          return;
        }

        resolve(body);
      });
    });

    request.on('timeout', () => {
      request.destroy(new Error('DevTools request timed out'));
    });
    request.on('error', reject);
    request.end();
  });
}

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

function createDevToolsClient(webSocketDebuggerUrl) {
  return new Promise((resolve, reject) => {
    const WebSocketCtor = global.WebSocket;

    if (typeof WebSocketCtor !== 'function') {
      reject(new Error('This Electron runtime does not expose WebSocket in the main process.'));
      return;
    }

    const ws = new WebSocketCtor(webSocketDebuggerUrl);
    const pending = new Map();
    let messageId = 0;

    const cleanupPending = (error) => {
      pending.forEach(({ reject: rejectPending }) => rejectPending(error));
      pending.clear();
    };

    ws.onmessage = (event) => {
      let payload = null;
      try {
        payload = JSON.parse(String(event.data || ''));
      } catch {
        return;
      }

      if (!payload || typeof payload.id !== 'number' || !pending.has(payload.id)) {
        return;
      }

      const next = pending.get(payload.id);
      pending.delete(payload.id);
      if (payload.error) {
        next.reject(new Error(payload.error.message || 'DevTools command failed'));
        return;
      }

      next.resolve(payload.result);
    };

    ws.onerror = () => {
      cleanupPending(new Error('DevTools websocket error'));
      reject(new Error('DevTools websocket error'));
    };
    ws.onclose = () => {
      cleanupPending(new Error('DevTools websocket closed'));
    };
    ws.onopen = () => {
      resolve({
        send(method, params = {}) {
          if (ws.readyState !== WebSocketCtor.OPEN) {
            return Promise.reject(new Error('DevTools websocket is not open'));
          }

          messageId += 1;
          const id = messageId;
          const payload = JSON.stringify({ id, method, params });
          return new Promise((resolveCommand, rejectCommand) => {
            pending.set(id, {
              reject: rejectCommand,
              resolve: resolveCommand,
            });
            ws.send(payload);
          });
        },
        close() {
          try {
            ws.close();
          } catch {
            // Ignore close errors.
          }
        },
      });
    };
  });
}

function normalizeExtractedText(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_RESULT_TEXT_LENGTH);
}

function extractTextFromDocumentLike(documentLike) {
  const ignoredSelectors = 'script,style,noscript,svg,canvas,iframe,[aria-hidden="true"]';
  const title = typeof documentLike?.title === 'string' && documentLike.title.trim()
    ? `Title: ${documentLike.title.trim()}`
    : '';
  const body = documentLike?.body?.cloneNode ? documentLike.body.cloneNode(true) : null;

  if (body && typeof body.querySelectorAll === 'function') {
    Array.from(body.querySelectorAll(ignoredSelectors)).forEach((node) => {
      if (node && typeof node.remove === 'function') {
        node.remove();
      }
    });
  }

  const text = body && typeof body.innerText === 'string'
    ? body.innerText
    : '';

  return [title, text].filter(Boolean).join('\n');
}

async function extractPageText(webSocketDebuggerUrl) {
  const client = await createDevToolsClient(webSocketDebuggerUrl);

  try {
    await client.send('Runtime.enable');
    const result = await client.send('Runtime.evaluate', {
      awaitPromise: true,
      expression: `(${extractTextFromDocumentLike.toString()})(document)`,
      returnByValue: true,
    });

    return normalizeExtractedText(result?.result?.value ?? '');
  } finally {
    client.close();
  }
}

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

function createBrowserSearchService({ app, log }) {
  let browserProcess = null;
  let browserSessionState = {
    browserLabel: null,
    port: null,
    profilePath: null,
    manualCloseRequested: false,
    status: 'idle',
  };

  function detect(settings = {}) {
    const configuredPath = typeof settings.browserSearchBrowserPath === 'string'
      ? settings.browserSearchBrowserPath.trim()
      : '';
    const candidates = buildBrowserCandidateDescriptors();
    const resolvedPath = isExecutableFile(configuredPath)
      ? configuredPath
      : (candidates.find((candidate) => candidate.exists)?.path || '');

    return {
      ok: Boolean(resolvedPath),
      browserLabel: resolveBrowserLabel(resolvedPath),
      candidates,
      configuredPath,
      configuredPathValid: Boolean(configuredPath && isExecutableFile(configuredPath)),
      resolvedPath,
      scannedRootCount: getBrowserSearchCandidateRoots().length,
      detectedCount: candidates.filter((candidate) => candidate.exists).length,
    };
  }

  function launchBrowserIfNeeded({ browserPath, port, profilePath }) {
    if (browserProcess && !browserProcess.killed) {
      return;
    }

    browserSessionState.manualCloseRequested = false;
    fs.mkdirSync(profilePath, { recursive: true });
    browserProcess = spawn(browserPath, [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profilePath}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--new-window',
      'about:blank',
    ], {
      detached: true,
      stdio: 'ignore',
      windowsHide: false,
    });

    browserProcess.unref();
    browserProcess.on('exit', () => {
      browserProcess = null;
      browserSessionState = {
        browserLabel: null,
        port: null,
        profilePath: null,
        manualCloseRequested: true,
        status: 'closed',
      };
    });
  }

  async function ensureBrowserSession({ browserPath, port, profilePath, browserLabel }) {
    if (browserSessionState.manualCloseRequested && !browserProcess) {
      browserSessionState = {
        browserLabel: browserSessionState.browserLabel || browserLabel,
        port: browserSessionState.port || port,
        profilePath: browserSessionState.profilePath || profilePath,
        manualCloseRequested: true,
        status: 'closed',
      };
      return { launched: false, blockedByManualClose: true };
    }

    if (browserProcess && !browserProcess.killed) {
      browserSessionState = {
        browserLabel,
        port,
        profilePath,
        manualCloseRequested: false,
        status: 'running',
      };
      return { launched: false, blockedByManualClose: false };
    }

    launchBrowserIfNeeded({ browserPath, port, profilePath });
    browserSessionState = {
      browserLabel,
      port,
      profilePath,
      manualCloseRequested: false,
      status: 'starting',
    };
    await waitForDevTools(port);
    browserSessionState.status = 'running';
    return { launched: true, blockedByManualClose: false };
  }

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

  function resolveBrowserSessionOptions(settings = {}) {
    const browserPath = resolveBrowserPath(settings.browserSearchBrowserPath);
    const port = resolveDebugPort(settings.browserSearchDebugPort);
    const browserLabel = resolveBrowserLabel(browserPath);
    const profilePath = path.join(app.getPath('userData'), 'browser-search-profile');

    return {
      browserLabel,
      browserPath,
      port,
      profilePath,
    };
  }

  async function ensureControlBrowserSession(settings = {}, request = {}) {
    const sessionOptions = resolveBrowserSessionOptions(settings);
    if (!sessionOptions.browserPath) {
      return {
        ok: false,
        error: 'Chrome or Edge was not found. Set the browser executable path in System settings.',
        ...sessionOptions,
      };
    }

    const sessionResult = await ensureBrowserSession(sessionOptions);
    const forceOpenBrowser = Boolean(settings.browserSearchForceOpenBrowser || request.forceOpen || request.forceOpenBrowser);
    if (sessionResult.blockedByManualClose && !forceOpenBrowser) {
      return {
        ok: false,
        blockedByManualClose: true,
        error: 'The controlled browser was manually closed. Use forceOpen if the user explicitly wants to reopen it.',
        ...sessionOptions,
      };
    }

    if (sessionResult.blockedByManualClose && forceOpenBrowser) {
      browserSessionState.manualCloseRequested = false;
      await ensureBrowserSession(sessionOptions);
    }

    return {
      ok: true,
      sessionResult,
      ...sessionOptions,
    };
  }

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

  async function controlBrowser(request = {}, settings = {}) {
    const action = normalizeBrowserControlAction(request?.action ?? request?.browserAction ?? request?.operation);
    if (!action) {
      return {
        ok: false,
        error: 'Unsupported browser control action.',
        supportedActions: ['open_url', 'search_web', 'read_page', 'focus_tab', 'list_tabs', 'status'],
      };
    }

    if (action === 'status') {
      return {
        ...getSessionState(),
        action,
        ok: true,
      };
    }

    if (action === 'search_web') {
      const query = String(request?.query || request?.target || '').trim();
      const result = await search(query, {
        ...settings,
        browserSearchForceNewPage: Boolean(request?.forceNewPage ?? settings.browserSearchForceNewPage),
      });
      return {
        ...result,
        action,
      };
    }

    const session = action === 'open_url'
      ? await ensureControlBrowserSession(settings, request)
      : resolveBrowserSessionOptions(settings);
    if (session.ok === false) {
      return {
        ...session,
        action,
      };
    }

    const port = session.port;
    const browserLabel = session.browserLabel;

    if (action === 'open_url') {
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

    let pages = [];
    try {
      pages = await listDevToolsPages(port);
    } catch (error) {
      return {
        action,
        browserLabel,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        pageCount: 0,
      };
    }

    if (action === 'list_tabs') {
      return {
        action,
        browserLabel,
        ok: true,
        pageCount: pages.length,
        pages: pages.map(formatBrowserPage),
      };
    }

    const page = selectBrowserPage(pages, request);
    if (!page) {
      return {
        action,
        browserLabel,
        ok: false,
        error: 'No matching controlled browser tab was found.',
        pageCount: pages.length,
      };
    }

    if (action === 'focus_tab') {
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

  function getSessionState() {
    return {
      ...browserSessionState,
      isOpen: Boolean(browserProcess && !browserProcess.killed),
    };
  }

  function closeSession() {
    if (!browserProcess || browserProcess.killed) {
      browserSessionState = {
        browserLabel: null,
        port: null,
        profilePath: null,
        manualCloseRequested: true,
        status: 'closed',
      };
      return;
    }

    try {
      browserSessionState.manualCloseRequested = true;
      browserProcess.kill();
    } catch {
      // Ignore process cleanup errors.
    }

    browserProcess = null;
    browserSessionState = {
      browserLabel: null,
      port: null,
      profilePath: null,
      manualCloseRequested: true,
      status: 'closed',
    };
  }

  async function search(query, settings = {}) {
    const normalizedQuery = String(query || '').trim();
    if (!normalizedQuery) {
      return { ok: false, error: 'Search query is empty.' };
    }

    const browserPath = resolveBrowserPath(settings.browserSearchBrowserPath);
    if (!browserPath) {
      return {
        ok: false,
        error: 'Chrome or Edge was not found. Set the browser executable path in System settings.',
      };
    }

    const port = resolveDebugPort(settings.browserSearchDebugPort);
    const browserLabel = resolveBrowserLabel(browserPath);
    const searchUrl = buildSearchUrl(normalizedQuery, settings, browserLabel);
    const profilePath = path.join(app.getPath('userData'), 'browser-search-profile');
    const forceOpenBrowser = Boolean(settings.browserSearchForceOpenBrowser);

    log?.('browser-search launch', {
      browserLabel,
      port,
      query: normalizedQuery.slice(0, 80),
    });
    const sessionResult = await ensureBrowserSession({
      browserPath,
      browserLabel,
      port,
      profilePath,
    });

    if (sessionResult.blockedByManualClose && !forceOpenBrowser) {
      return {
        ok: false,
        browserLabel,
        error: 'The browser was manually closed. Reopen it from the system browser search controls or force this query.',
      };
    }

    if (sessionResult.blockedByManualClose && forceOpenBrowser) {
      browserSessionState.manualCloseRequested = false;
      await ensureBrowserSession({
        browserPath,
        browserLabel,
        port,
        profilePath,
      });
    }

    const forceNewPage = Boolean(settings.browserSearchForceNewPage);
    const createdTarget = await navigateOrOpenTarget(port, searchUrl, forceNewPage);

    const targetWebSocketUrl = createdTarget?.webSocketDebuggerUrl;
    const targetUrl = createdTarget?.url && createdTarget.url !== 'about:blank'
      ? createdTarget.url
      : searchUrl;

    if (!targetWebSocketUrl) {
      return {
        ok: false,
        browserLabel,
        opened: true,
        query: normalizedQuery,
        url: targetUrl,
        error: 'The browser page opened, but no readable DevTools page was found.',
      };
    }

    const text = await extractPageText(targetWebSocketUrl);
    if (!text) {
      return {
        ok: false,
        browserLabel,
        opened: true,
        query: normalizedQuery,
        url: targetUrl,
        error: 'The browser page opened, but no usable text was extracted.',
      };
    }

    return {
      ok: true,
      browserLabel,
      query: normalizedQuery,
      text,
      url: targetUrl,
    };
  }

  function dispose() {
    closeSession();
  }

  return {
    control: controlBrowser,
    detect,
    closeSession,
    dispose,
    getSessionState,
    search,
  };
}

module.exports = {
  createBrowserSearchService,
  extractTextFromDocumentLike,
  getDetectedBrowserCandidates,
};
