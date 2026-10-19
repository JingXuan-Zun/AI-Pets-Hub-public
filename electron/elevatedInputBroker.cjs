const crypto = require('node:crypto');
const net = require('node:net');
const { execFile } = require('node:child_process');
const { createElevatedInputBrokerScript } = require('./elevatedInputBrokerScript.cjs');
const { normalizeButton, normalizeNumber, splitHotkey, virtualKeyFromToken } = require('./desktopInputRules.cjs');

// Starts and talks to the elevated input helper (see elevatedInputBrokerScript.cjs). The
// app itself stays unelevated; while the helper runs, every desktop input goes through it.

const IDLE_MS = 3 * 60_000;
const CONNECT_TIMEOUT_MS = 90_000;
const COMMAND_TIMEOUT_MS = 10_000;

function runPowerShell(args, timeout) {
  return new Promise((resolve) => {
    execFile('powershell.exe', args, { encoding: 'utf8', timeout, windowsHide: true }, (error, stdout, stderr) => {
      resolve({ error, stdout: String(stdout ?? ''), stderr: String(stderr ?? '') });
    });
  });
}

async function readCurrentUserSid() {
  const result = await runPowerShell(['-NoProfile', '-Command', '[Security.Principal.WindowsIdentity]::GetCurrent().User.Value'], 15_000);
  const sid = result.stdout.trim();
  if (!/^S-1-[0-9-]+$/u.test(sid)) throw new Error('读取当前用户失败。');
  return sid;
}

/** Turns a native-screen input request into one of the helper's fixed commands, or null. */
function toBrokerCommand(action, request) {
  const expectedHwnd = normalizeNumber(request.expectedForegroundHwnd ?? request.expectedHwnd ?? request.hwnd ?? request.windowHandle) ?? 0;
  const x = normalizeNumber(request.nativeScreenX);
  const y = normalizeNumber(request.nativeScreenY);
  const point = x === null || y === null ? null : { x: Math.round(x), y: Math.round(y) };
  switch (action) {
    case 'click':
    case 'double_click':
    case 'right_click':
      if (!point) return null;
      return {
        button: action === 'right_click' ? 'right' : normalizeButton(request.button),
        clicks: action === 'double_click' ? 2 : Math.max(1, Math.min(4, Math.round(normalizeNumber(request.repeat ?? request.clickCount) ?? 1))),
        expectedHwnd, kind: 'click', ...point,
      };
    case 'move_mouse':
      return point ? { expectedHwnd, kind: 'move', ...point } : null;
    case 'drag': {
      const coords = ['fromNativeScreenX', 'fromNativeScreenY', 'toNativeScreenX', 'toNativeScreenY'].map((key) => normalizeNumber(request[key]));
      if (coords.some((value) => value === null)) return null;
      const [fromX, fromY, toX, toY] = coords.map(Math.round);
      return { expectedHwnd, fromX, fromY, kind: 'drag', steps: normalizeNumber(request.steps) ?? 20, toX, toY };
    }
    case 'scroll': {
      const notches = normalizeNumber(request.notches);
      return point && notches ? { expectedHwnd, horizontal: Boolean(request.horizontal), kind: 'scroll', notches: Math.round(notches), ...point } : null;
    }
    case 'type_text': {
      const text = String(request.text ?? request.value ?? '').slice(0, 2000);
      return text ? { expectedHwnd, kind: 'text', text } : null;
    }
    case 'send_keys': {
      const keys = String(request.keys ?? request.sequence ?? '').trim().slice(0, 400);
      return keys ? { expectedHwnd, keys, kind: 'sendkeys' } : null;
    }
    case 'hotkey': {
      const tokens = splitHotkey(request.hotkey ?? request.keys ?? request.sequence);
      const vks = tokens.map(virtualKeyFromToken);
      return tokens.length && vks.every((value) => value !== null) ? { expectedHwnd, kind: 'hotkey', vks } : null;
    }
    default:
      return null;
  }
}

function createElevatedInputBroker({ log } = {}) {
  let socket = null;
  let token = '';
  let starting = null;
  let nextId = 1;
  const pending = new Map();

  const reset = () => {
    socket = null;
    token = '';
    for (const { reject } of pending.values()) reject(new Error('elevated_helper_closed'));
    pending.clear();
  };

  const attach = (connection) => {
    let buffer = '';
    connection.setEncoding('utf8');
    connection.on('data', (chunk) => {
      buffer += chunk;
      let newline = buffer.indexOf('\n');
      while (newline !== -1) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf('\n');
        if (!line) continue;
        try {
          const reply = JSON.parse(line);
          const entry = pending.get(reply.id);
          if (entry) {
            pending.delete(reply.id);
            entry.resolve(reply);
          }
        } catch {
          // A malformed reply leaves that command to its timeout.
        }
      }
    });
    connection.on('close', () => {
      if (socket === connection) {
        log?.('elevated input helper closed');
        reset();
      }
    });
    connection.on('error', () => {});
  };

  const connect = (pipeName) => new Promise((resolve, reject) => {
    const deadline = Date.now() + CONNECT_TIMEOUT_MS;
    const attempt = () => {
      const connection = net.connect(`\\\\.\\pipe\\${pipeName}`);
      connection.once('connect', () => resolve(connection));
      connection.once('error', () => {
        connection.destroy();
        if (Date.now() > deadline) reject(new Error('管理员助手没有启动。'));
        else setTimeout(attempt, 300);
      });
    };
    attempt();
  });

  async function start() {
    if (process.platform !== 'win32') return { error: '只有 Windows 需要管理员助手。', ok: false };
    if (socket) return { ok: true };
    if (starting) return starting;
    starting = (async () => {
      const pipeName = `desktop-pet-elevated-input-${crypto.randomBytes(16).toString('hex')}`;
      const nextToken = crypto.randomBytes(32).toString('hex');
      const script = createElevatedInputBrokerScript({
        idleMs: IDLE_MS, parentPid: process.pid, pipeName, token: nextToken, userSid: await readCurrentUserSid(),
      });
      const encoded = Buffer.from(script, 'utf16le').toString('base64');
      // Start-Process -Verb RunAs shows the UAC prompt and fails when the user says no.
      const launch = await runPowerShell([
        '-NoProfile', '-Command',
        `Start-Process -FilePath powershell.exe -Verb RunAs -WindowStyle Hidden -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-WindowStyle','Hidden','-EncodedCommand','${encoded}'`,
      ], CONNECT_TIMEOUT_MS);
      if (launch.error) {
        const declined = /cancel|取消/iu.test(launch.stderr);
        log?.('elevated input helper not started', { declined });
        return { declined, error: declined ? '你在 Windows 弹窗里选择了“否”，没有开启管理员助手。' : '管理员助手启动失败。', ok: false };
      }
      const connection = await connect(pipeName);
      socket = connection;
      token = nextToken;
      attach(connection);
      log?.('elevated input helper started');
      return { ok: true };
    })().catch((error) => ({ error: error instanceof Error ? error.message : String(error), ok: false }))
      .finally(() => { starting = null; });
    return starting;
  }

  function send(command) {
    if (!socket) return Promise.reject(new Error('elevated_helper_closed'));
    const id = nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error('elevated_helper_timeout'));
      }, COMMAND_TIMEOUT_MS);
      pending.set(id, {
        reject: (error) => { clearTimeout(timer); reject(error); },
        resolve: (reply) => { clearTimeout(timer); resolve(reply); },
      });
      socket.write(`${JSON.stringify({ ...command, id, token })}\n`);
    });
  }

  async function execute(action, nativeRequest) {
    const command = toBrokerCommand(action, nativeRequest);
    if (!command) return { action, error: 'Missing or invalid desktop input parameters.', ok: false };
    try {
      const reply = await send(command);
      if (reply.ok) return { action, method: 'elevated-helper', ok: true };
      const error = String(reply.error ?? 'elevated_helper_failed');
      return error === 'target_window_not_foreground'
        ? { action, error, expectedForeground: { hwnd: command.expectedHwnd }, inputDiagnostics: { failureClassification: error }, ok: false }
        : { action, error, ok: false };
    } catch (error) {
      return { action, error: error instanceof Error ? error.message : String(error), ok: false };
    }
  }

  function stop() {
    if (!socket) return { ok: true };
    try {
      socket.write(`${JSON.stringify({ kind: 'stop', token })}\n`);
      socket.end();
    } catch {
      // Already gone.
    }
    reset();
    return { ok: true };
  }

  return { execute, isActive: () => Boolean(socket), start, stop };
}

function registerElevatedInputIpcHandlers({ ipcMain, broker }) {
  ipcMain.handle('desktop-pet:elevated-input-start', () => broker.start());
  ipcMain.handle('desktop-pet:elevated-input-stop', () => broker.stop());
  ipcMain.handle('desktop-pet:elevated-input-status', () => ({ active: broker.isActive(), ok: true }));
}

module.exports = { createElevatedInputBroker, registerElevatedInputIpcHandlers, toBrokerCommand };
