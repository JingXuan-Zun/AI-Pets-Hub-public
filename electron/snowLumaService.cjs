const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');

// Runs SnowLuma (the OneBot service the phone-QQ chat goes through) in the background with no
// console window, so the user only flips the QQ switch. Starts it only when nothing answers
// on its WebSocket port yet, stops only the copy it started, and keeps its console output in
// a log file (the first-start admin password is printed there).

const PORT_PROBE_TIMEOUT_MS = 800;

function isFile(filePath) {
  try { return fs.statSync(filePath).isFile(); } catch { return false; }
}

/** Whether a folder looks like an unpacked SnowLuma release. */
function inspectSnowLumaDir(dir) {
  const folder = String(dir || '').trim();
  if (!folder) return { ok: false, error: '还没选 SnowLuma 文件夹。' };
  if (!path.isAbsolute(folder)) return { ok: false, error: `SnowLuma 文件夹要写完整路径：${folder}` };
  if (!isFile(path.join(folder, 'index.mjs'))) return { ok: false, error: '这个文件夹里没有 SnowLuma（找不到 index.mjs）。' };
  const bundledNode = path.join(folder, 'node.exe');
  return { bundledNode: isFile(bundledNode) ? bundledNode : null, folder, ok: true };
}

/** Whether something already listens on the port (SnowLuma started by hand, or by us). */
function isPortOpen(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (open) => { socket.destroy(); resolve(open); };
    socket.setTimeout(PORT_PROBE_TIMEOUT_MS, () => done(false));
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
  });
}

function portFromWsUrl(wsUrl) {
  try { return Number(new URL(String(wsUrl)).port) || 3001; } catch { return 3001; }
}

function createSnowLumaService({ logDirectory, log = () => undefined }) {
  let child = null;
  // Two requests at once (React runs effects twice in development) must not start two copies.
  let starting = null;
  const logPath = path.join(logDirectory, 'snowluma.log');

  function status() {
    return { logPath, ownedRunning: Boolean(child && child.exitCode === null) };
  }

  function ensureRunning(request = {}) {
    starting = starting ?? startIfNeeded(request).finally(() => { starting = null; });
    return starting;
  }

  async function startIfNeeded(request) {
    const inspected = inspectSnowLumaDir(request.dir);
    if (!inspected.ok) return inspected;
    if (child && child.exitCode === null) return { ok: true, started: false, owned: true };
    if (await isPortOpen(portFromWsUrl(request.wsUrl))) return { ok: true, started: false, owned: false };
    fs.mkdirSync(logDirectory, { recursive: true });
    const out = fs.openSync(logPath, 'w');
    // The release bundles node.exe; the lite one doesn't, then Electron's own Node runs it.
    const [command, env] = inspected.bundledNode
      ? [inspected.bundledNode, process.env]
      : [process.execPath, { ...process.env, ELECTRON_RUN_AS_NODE: '1' }];
    try {
      child = spawn(command, ['./index.mjs'], { cwd: inspected.folder, env, stdio: ['ignore', out, out], windowsHide: true });
    } catch (error) {
      fs.closeSync(out);
      return { ok: false, error: error.message };
    }
    fs.closeSync(out);
    const started = child;
    started.once('exit', (code) => {
      log('exited', { code });
      if (child === started) child = null;
    });
    // A start that fails (bad folder, missing program) reports here, not as a crash.
    const failed = await new Promise((resolve) => {
      started.once('error', (error) => resolve(error));
      started.once('spawn', () => resolve(null));
    });
    if (failed) {
      if (child === started) child = null;
      log('start failed', { error: failed.message });
      return { ok: false, error: `SnowLuma 没能启动：${failed.message}` };
    }
    log('started', { folder: inspected.folder, pid: started.pid });
    return { ok: true, started: true, owned: true };
  }

  function stop() {
    if (!child || child.exitCode !== null) return { ok: true, stopped: false };
    // SnowLuma runs its real work in a child process: end the whole tree of the copy we
    // started (only that tree; nothing else the pet launched).
    if (process.platform === 'win32' && child.pid) {
      spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true });
    } else {
      child.kill();
    }
    log('stopped');
    child = null;
    return { ok: true, stopped: true };
  }

  /**
   * The WebUI login SnowLuma prints on a fresh start (console only, so it lands in our log).
   * Until the user changes it, every start prints a new one; afterwards there is none.
   */
  function readInitialCredentials() {
    let text = '';
    try { text = fs.readFileSync(logPath, 'utf8'); } catch { return { ok: false }; }
    const matches = [...text.matchAll(/initial credentials: user=(\S+) password=(\S+)/gu)];
    const last = matches.at(-1);
    return last ? { ok: true, password: last[2], user: last[1] } : { ok: false };
  }

  return { ensureRunning, inspect: inspectSnowLumaDir, logPath, readInitialCredentials, status, stop };
}

/**
 * The access token of SnowLuma's WebSocket server on this port. A fresh SnowLuma makes its
 * server with a random token (and a new one per account after login, in onebot_<uin>.json),
 * so without it the pet is refused forever. Per-account files (newest first) win over the
 * shared onebot.json. The owner's own account (the main account, which must not be the bot)
 * is skipped. Returns found:false when no server on that port is configured.
 */
function readSnowLumaWsToken(dir, port, ownerQq = '') {
  const inspected = inspectSnowLumaDir(dir);
  if (!inspected.ok) return { found: false };
  const configDir = path.join(inspected.folder, 'config');
  const ownerFile = /^\d+$/u.test(String(ownerQq)) ? `onebot_${ownerQq}.json` : '';
  let files = [];
  try {
    files = fs.readdirSync(configDir)
      .filter((name) => /^onebot_\d+\.json$/u.test(name) && name !== ownerFile)
      .map((name) => ({ name, time: fs.statSync(path.join(configDir, name)).mtimeMs }))
      .sort((left, right) => right.time - left.time)
      .map((entry) => entry.name);
  } catch { return { found: false }; }
  for (const name of [...files, 'onebot.json']) {
    let config = null;
    try { config = JSON.parse(fs.readFileSync(path.join(configDir, name), 'utf8')); } catch { continue; }
    const server = (config?.networks?.wsServers ?? []).find((entry) => entry && entry.enabled !== false && Number(entry.port) === Number(port));
    if (server) return { found: true, source: name, token: typeof server.accessToken === 'string' ? server.accessToken : '' };
  }
  return { found: false };
}

const SETUP_DOWNLOAD_URLS = {
  qq: 'https://im.qq.com/pcqq/index.shtml',
  snowluma: 'https://github.com/SnowLuma/SnowLuma/releases/latest',
};

/** The SnowLuma admin page address, from its config (loopback only). */
function resolveSnowLumaWebuiUrl(dir) {
  const inspected = inspectSnowLumaDir(dir);
  if (!inspected.ok) return inspected;
  let config = {};
  try { config = JSON.parse(fs.readFileSync(path.join(inspected.folder, 'config', 'runtime.json'), 'utf8')); } catch { /* defaults */ }
  const port = Number(config.webuiPort) || 5099;
  const host = ['127.0.0.1', 'localhost', '::1'].includes(String(config.webuiHost || '127.0.0.1')) ? '127.0.0.1' : null;
  if (!host) return { ok: false, error: 'SnowLuma 管理页没有只开在本机，请检查它的设置。' };
  return { ok: true, url: `${config.webuiTls?.enabled ? 'https' : 'http'}://${host}:${port}` };
}

// A picture the user sent on QQ: SnowLuma only gives Tencent's download address, which the
// page itself cannot fetch (cross-origin). Only Tencent image hosts, only images, size-capped.
const QQ_IMAGE_HOST_PATTERN = /(^|\.)(qq\.com\.cn|qpic\.cn|qq\.com)$/iu;
const QQ_IMAGE_MAX_BYTES = 12 * 1024 * 1024;
const QQ_IMAGE_TIMEOUT_MS = 20 * 1000;

async function fetchQqImage(url, fetchImpl = fetch) {
  let parsed;
  try { parsed = new URL(String(url || '')); } catch { return { ok: false, error: '图片地址无效' }; }
  if (!/^https?:$/u.test(parsed.protocol) || !QQ_IMAGE_HOST_PATTERN.test(parsed.hostname)) return { ok: false, error: '不是 QQ 的图片地址' };
  try {
    const response = await fetchImpl(parsed.href, { redirect: 'follow', signal: AbortSignal.timeout(QQ_IMAGE_TIMEOUT_MS) });
    if (!response.ok) return { ok: false, error: `下载失败（${response.status}）` };
    const mimeType = String(response.headers.get('content-type') || '').split(';')[0].trim();
    if (!mimeType.startsWith('image/')) return { ok: false, error: '下载到的不是图片' };
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > QQ_IMAGE_MAX_BYTES) return { ok: false, error: '图片太大' };
    return { dataUrl: `data:${mimeType};base64,${bytes.toString('base64')}`, mimeType, ok: true, sizeBytes: bytes.length };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

function registerSnowLumaIpcHandlers({ ipcMain, service, dialog, shell }) {
  ipcMain.handle('desktop-pet:qq-fetch-image', (_event, url) => fetchQqImage(url));
  ipcMain.handle('desktop-pet:snowluma-initial-credentials', () => service.readInitialCredentials());
  ipcMain.handle('desktop-pet:snowluma-ws-token', (_event, request) => readSnowLumaWsToken(request?.dir, portFromWsUrl(request?.wsUrl), request?.ownerQq));
  // Download pages for first-time setup: only these fixed official addresses can be opened.
  ipcMain.handle('desktop-pet:snowluma-open-download', async (_event, target) => {
    const url = SETUP_DOWNLOAD_URLS[String(target)];
    if (!url) return { ok: false, error: '不认识的下载页。' };
    await shell.openExternal(url);
    return { ok: true, url };
  });
  ipcMain.handle('desktop-pet:snowluma-open-webui', async (_event, dir) => {
    const resolved = resolveSnowLumaWebuiUrl(dir);
    if (!resolved.ok) return resolved;
    await shell.openExternal(resolved.url);
    return { ok: true, url: resolved.url };
  });
  ipcMain.handle('desktop-pet:snowluma-ensure-running', (_event, request) => service.ensureRunning(request ?? {}));
  ipcMain.handle('desktop-pet:snowluma-stop', () => service.stop());
  ipcMain.handle('desktop-pet:snowluma-status', () => service.status());
  ipcMain.handle('desktop-pet:snowluma-inspect', (_event, dir) => service.inspect(dir));
  ipcMain.handle('desktop-pet:snowluma-open-log', async () => {
    if (!isFile(service.logPath)) return { ok: false, error: '还没有日志（SnowLuma 还没由桌宠启动过）。' };
    const error = await shell.openPath(service.logPath);
    return error ? { ok: false, error } : { ok: true };
  });
  // A folder picker for settings pages (SnowLuma folder, dev assistant projects).
  ipcMain.handle('desktop-pet:pick-directory', async (_event, title) => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'], title: String(title || '选择文件夹') });
    return result.canceled || !result.filePaths[0] ? { ok: false } : { ok: true, path: result.filePaths[0] };
  });
}

module.exports = { createSnowLumaService, fetchQqImage, inspectSnowLumaDir, isPortOpen, portFromWsUrl, readSnowLumaWsToken, registerSnowLumaIpcHandlers, resolveSnowLumaWebuiUrl };
