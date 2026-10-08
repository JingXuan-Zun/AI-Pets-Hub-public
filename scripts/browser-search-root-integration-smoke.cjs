const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const directory = path.resolve(__dirname, '../electron');

function fixture(browser, reuse) {
  const cache = new Map(), pages = new Map(), processes = [], sockets = [], trace = [];
  let mode = 'normal', clock = 0, pageId = 0, versionAttempts = 0;
  const executable = browser === 'Chrome' ? 'chrome.exe' : 'msedge.exe';
  function page(port, url = 'about:blank') {
    return { id: 'page-' + ++pageId, type: 'page', title: 'Controlled page', url, webSocketDebuggerUrl: `ws://127.0.0.1:${port}/page/${pageId}` };
  }
  function list(port) {
    if (!pages.has(port)) pages.set(port, reuse ? [page(port)] : []);
    return pages.get(port);
  }
  const fakeFs = {
    existsSync() { return false; },
    statSync(name) { if (mode === 'missing' || !name.endsWith(executable)) throw Error('fixture missing'); return { isFile: () => true }; },
    mkdirSync(name, options) { trace.push(['mkdir', name, options]); },
  };
  function spawn(name, args, options) {
    trace.push(['spawn', name, args, options]);
    if (mode === 'spawn') throw Error('fixture spawn failure');
    const child = new EventEmitter(); child.killed = false;
    child.unref = () => { trace.push(['unref']); };
    child.kill = () => { trace.push(['kill']); if (mode === 'kill') throw Error('fixture kill failure'); child.killed = true; child.emit('exit', 0); };
    processes.push(child); return child;
  }
  const http = { request(url, options, callback) {
    trace.push(['http', url, options]);
    const req = new EventEmitter();
    req.destroy = error => req.emit('error', error);
    req.end = () => queueMicrotask(() => {
      const parsed = new URL(url), port = Number(parsed.port), pathname = parsed.pathname;
      let status = 200, value;
      if (pathname === '/json/version') {
        versionAttempts++;
        status = mode === 'version' || mode === 'retry' && versionAttempts === 1 ? 503 : 200;
        value = { Browser: browser };
      } else if (pathname === '/json/list') {
        status = mode === 'list' ? 503 : 200;
        value = [...list(port), { id: 'worker', type: 'worker' }];
      } else if (pathname === '/json/new') {
        status = mode === 'new' ? 503 : 200;
        value = page(port, decodeURIComponent(parsed.search.slice(1)));
        if (mode === 'no-socket') delete value.webSocketDebuggerUrl;
        if (status === 200) list(port).push(value);
      } else if (pathname.startsWith('/json/activate/')) {
        status = mode === 'activate' || mode === 'activate-put' && options.method === 'PUT' ? 503 : 200;
        value = 'activated';
      } else throw Error('Unexpected fixture HTTP ' + url);
      const response = new EventEmitter(); response.statusCode = status;
      response.setEncoding = encoding => assert.equal(encoding, 'utf8');
      callback(response);
      const body = typeof value === 'string' ? value : JSON.stringify(value);
      response.emit('data', body.slice(0, 3)); response.emit('data', body.slice(3)); response.emit('end');
    });
    return req;
  } };
  class WebSocket {
    static OPEN = 1;
    constructor(url) {
      this.url = url; this.readyState = 1; sockets.push(this); trace.push(['connect', url]);
      queueMicrotask(() => mode === 'socket' ? this.onerror() : this.onopen());
    }
    send(text) {
      const payload = JSON.parse(text); trace.push(['command', payload.method, payload.params]);
      let result = {}, error;
      if (payload.method === 'Page.navigate') {
        if (mode === 'navigate') error = { message: 'fixture navigation failure' };
        else {
          const target = [...pages.values()].flat().find(p => p.webSocketDebuggerUrl === this.url);
          assert.ok(target); target.url = payload.params.url;
        }
      } else if (payload.method === 'Runtime.evaluate') {
        assert.equal(payload.params.awaitPromise, true); assert.equal(payload.params.returnByValue, true);
        assert.ok(payload.params.expression.includes('extractTextFromDocumentLike'));
        if (mode === 'extract') error = { message: 'fixture extraction failure' };
        result = { result: { value: mode === 'empty-text' ? '  ' : ' Title: Controlled\n  page text ' } };
      } else assert.ok(['Page.enable', 'Runtime.enable'].includes(payload.method));
      queueMicrotask(() => this.onmessage({ data: JSON.stringify({ id: payload.id, result, error }) }));
    }
    close() { this.readyState = 3; trace.push(['socket-close']); this.onclose?.(); }
  }
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file, module);
    const requireControlled = id => {
      if (id === 'fs') return fakeFs;
      if (id === 'path') return path;
      if (id === 'http') return http;
      if (id === 'child_process') return { spawn };
      assert.ok(id.startsWith('./browserSearch'), 'Unexpected production dependency ' + id);
      return load(path.resolve(path.dirname(file), id));
    };
    new Function('require', 'module', 'process', 'global', 'setTimeout', 'Date', fs.readFileSync(file, 'utf8'))(
      requireControlled, module, { platform: 'win32', env: { ProgramFiles: 'C:\\fixture', 'ProgramFiles(x86)': 'C:\\fixture-x86', LOCALAPPDATA: 'C:\\fixture-local' } }, { WebSocket },
      (callback, ms) => { trace.push(['delay', ms]); clock += ms; queueMicrotask(callback); return 1; }, { now: () => clock });
    return module.exports;
  }
  const api = load(path.join(directory, 'browserSearchService.cjs'));
  return { api, trace, processes, sockets, cache, setMode(value) { mode = value; versionAttempts = 0; } };
}

async function run(browser, reuse, failureMode) {
  const f = fixture(browser, reuse);
  const settings = { browserSearchBrowserPath: `C:\\fixture\\${browser === 'Chrome' ? 'chrome.exe' : 'msedge.exe'}`, browserSearchDebugPort: 9223, browserSearchEngine: 'bing' };
  const first = f.api.createBrowserSearchService({ app: { getPath: () => 'C:\\fixture-profile-a' } });
  const second = f.api.createBrowserSearchService({ app: { getPath: () => 'C:\\fixture-profile-b' } });
  assert.equal((await first.search('  ', settings)).ok, false); assert.equal(f.trace.length, 0);
  assert.equal((await first.control({ action: 'status' }, settings)).status, 'idle');
  assert.equal((await first.control({ action: 'unsupported' }, settings)).ok, false);
  const detected = first.detect(settings); assert.equal(detected.ok, true); assert.equal(detected.browserLabel, browser);
  const result = await first.search('查询 a&b', settings);
  assert.equal(result.ok, true); assert.equal(result.text, 'Title: Controlled page text');
  assert.equal(result.url, 'https://www.bing.com/search?q=' + encodeURIComponent('查询 a&b'));
  assert.equal(f.processes.length, 1); assert.equal(first.getSessionState().status, 'running');
  assert.equal(second.getSessionState().status, 'idle');
  const tabs = await first.control({ action: 'list_tabs' }, settings);
  assert.equal(tabs.ok, true); assert.ok(tabs.pages.every(p => p.webSocketDebuggerUrl === 'available'));
  assert.ok(!JSON.stringify(tabs).includes('ws://'));
  const id = tabs.pages[0].id;
  assert.equal((await first.control({ action: 'read_page', tabId: id }, settings)).text, result.text);
  f.setMode('activate-put');
  assert.equal((await first.control({ action: 'focus_tab', tabId: id }, settings)).ok, true);
  assert.ok(f.trace.some(row => row[0] === 'http' && row[1].includes('/activate/') && row[2].method === 'GET'));
  f.setMode('normal');
  assert.equal((await first.control({ action: 'open_url', url: 'https://open.example' }, settings)).ok, true);
  assert.equal((await first.control({ action: 'search_web', query: 'second', forceNewPage: true }, settings)).action, 'search_web');
  assert.equal((await second.search('independent', { ...settings, browserSearchDebugPort: 9224 })).ok, true);
  assert.equal(f.processes.length, 2);
  first.closeSession();
  assert.equal(first.getSessionState().status, 'closed'); assert.equal(second.getSessionState().isOpen, true);
  assert.equal((await first.search('blocked', settings)).ok, false); assert.equal(f.processes.length, 2);
  assert.equal((await first.control({ action: 'open_url', url: 'https://reopen.example', forceOpen: true }, settings)).ok, true);
  assert.equal(f.processes.length, 3);
  f.processes.at(-1).emit('exit', 0);
  assert.equal(first.getSessionState().manualCloseRequested, true);
  assert.equal((await first.search('forced', { ...settings, browserSearchForceOpenBrowser: true })).ok, true);
  f.setMode(failureMode);
  if (['spawn', 'version', 'retry'].includes(failureMode)) {
    first.closeSession();
    const operation = first.search('failure', { ...settings, browserSearchForceOpenBrowser: true });
    if (failureMode === 'retry') { assert.equal((await operation).ok, true); assert.ok(f.trace.some(row => row[0] === 'delay' && row[1] === 300)); }
    else await assert.rejects(operation, failureMode === 'spawn' ? /fixture spawn failure/ : /503/);
  } else if (['new', 'no-socket', 'missing'].includes(failureMode)) {
    const outcome = await first.search('failure', { ...settings, browserSearchForceNewPage: true });
    assert.equal(outcome.ok, failureMode === 'new');
    if (failureMode === 'no-socket') assert.equal(outcome.opened, true);
  } else if (failureMode === 'list') assert.equal((await first.control({ action: 'list_tabs' }, settings)).pageCount, 0);
  else if (failureMode === 'activate') assert.equal((await first.control({ action: 'focus_tab', tabId: id }, settings)).ok, false);
  else if (failureMode === 'empty-text') assert.equal((await first.control({ action: 'read_page', tabId: id }, settings)).ok, false);
  else if (failureMode === 'extract' || failureMode === 'socket') await assert.rejects(first.control({ action: 'read_page', tabId: id }, settings), /fixture extraction failure|websocket error/);
  else if (failureMode === 'navigate') await assert.rejects(first.control({ action: 'open_url', url: 'https://failure.example' }, settings), /fixture navigation failure/);
  else if (failureMode === 'kill') { first.closeSession(); assert.equal(first.getSessionState().isOpen, false); }
  else assert.equal(failureMode, 'normal');
  f.setMode('normal'); first.dispose(); second.dispose();
  assert.equal(first.getSessionState().isOpen, false); assert.equal(second.getSessionState().isOpen, false);
  assert.ok(f.sockets.every(socket => socket.readyState === 3 || failureMode === 'socket'));
  assert.equal(f.cache.size, 19, 'All real browser implementation modules loaded');
  assert.ok(f.trace.some(row => row[0] === 'mkdir' && row[1].includes('fixture-profile-a')));
  assert.ok(f.trace.some(row => row[0] === 'mkdir' && row[1].includes('fixture-profile-b')));
}
async function main() {
  let cases = 0;
  for (const browser of ['Chrome', 'Edge']) for (const reuse of [false, true])
    for (const mode of ['normal', 'missing', 'spawn', 'version', 'retry', 'new', 'no-socket', 'list', 'activate', 'empty-text', 'extract', 'socket', 'navigate', 'kill']) {
      await run(browser, reuse, mode); cases++;
    }
  console.log('Browser root integration passed: ' + cases + ' two-instance Chrome/Edge/new/reused-page success and failure sequences; all 19 real modules; external IO controlled.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
