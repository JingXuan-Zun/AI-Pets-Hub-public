// Start with Windows (2026-11-13). The pet knows what day it is and that it was restarted, so it
// can simply start when the computer does: users no longer have to open it by hand every day.
//
// The Windows "Run" entry (Electron's login item, HKCU) is the only record: the switch shows
// what Windows will actually do, and nothing is kept in the pet's own config. The build is a
// portable exe that unpacks itself to a temp folder, so the entry must point at the exe the
// user keeps (PORTABLE_EXECUTABLE_FILE), not at the unpacked copy. If the user moves the exe,
// the entry is pointed at the new place on the next start.

const path = require('node:path');
const { spawnSync } = require('node:child_process');

const LAUNCHED_AT_LOGIN_ARG = '--launched-at-login';
const LOGIN_ITEM_NAME = 'AI Desktop Pet';
const RUN_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';

/** Where Windows should start the pet from, or null in the dev app (it also needs Vite). */
function resolveAutoLaunchTarget({ env = process.env, execPath = process.execPath, isPackaged }) {
  if (!isPackaged) return null;
  const portable = String(env.PORTABLE_EXECUTABLE_FILE || '').trim();
  return { args: [LAUNCHED_AT_LOGIN_ARG], path: path.resolve(portable || execPath) };
}

function samePath(a, b) {
  return path.resolve(String(a || '')).toLowerCase() === path.resolve(String(b || '')).toLowerCase();
}

/** Our entries among the login items Electron reports (it only lists the ones for the path asked about). */
function findOwnLaunchItems(settings) {
  const items = Array.isArray(settings?.launchItems) ? settings.launchItems : [];
  return items.filter((item) => item && item.name === LOGIN_ITEM_NAME);
}

/** The exe in a `reg query` line for our Run value, or ''. */
function parseRunValueExe(output) {
  const line = String(output || '').split(/\r?\n/u).find((row) => row.includes(LOGIN_ITEM_NAME) && /REG_(?:EXPAND_)?SZ/u.test(row));
  const value = line ? (line.split(/REG_(?:EXPAND_)?SZ/u)[1] ?? '').trim() : '';
  const quoted = value.match(/^"([^"]+)"/u);
  return quoted ? quoted[1] : value.split(/\s+--/u)[0].trim();
}

/** The exe our Run value points at, whatever path it is (read-only), or ''. */
function readRunValueExe() {
  const result = spawnSync('reg.exe', ['query', RUN_KEY, '/v', LOGIN_ITEM_NAME], { encoding: 'utf8', timeout: 5000, windowsHide: true });
  return result.status === 0 ? parseRunValueExe(result.stdout) : '';
}

function createAutoLaunchService({ app, env = process.env, isPackaged, log = () => {}, platform = process.platform, readRunExe = readRunValueExe }) {
  const target = resolveAutoLaunchTarget({ env, execPath: process.execPath, isPackaged });
  const supported = platform === 'win32' && Boolean(target);
  const launchedAtLogin = process.argv.includes(LAUNCHED_AT_LOGIN_ARG);

  const read = () => {
    if (!supported) return { enabled: false, launchedAtLogin, supported: false };
    const settings = app.getLoginItemSettings({ args: target.args, path: target.path });
    const enabled = findOwnLaunchItems(settings).some((item) => item.enabled !== false && samePath(item.path, target.path));
    return { enabled, launchedAtLogin, path: target.path, supported: true };
  };

  const write = (enabled) => {
    if (!supported) return { error: '开发版不能设置开机自启动，打包后的版本才行。', ok: false };
    app.setLoginItemSettings({ args: target.args, enabled, name: LOGIN_ITEM_NAME, openAtLogin: enabled, path: target.path });
    const state = read();
    log(enabled ? 'auto-launch turned on' : 'auto-launch turned off', { enabled: state.enabled, path: target.path });
    return state.enabled === enabled ? { ok: true, ...state } : { error: 'Windows 没有接受这个设置。', ok: false, ...state };
  };

  /** On start: an entry left at an old path (the exe was moved) is pointed at this exe. */
  const refreshMovedEntry = () => {
    if (!supported) return;
    try {
      const registered = readRunExe();
      if (registered && !samePath(registered, target.path)) {
        write(true);
        log('auto-launch entry moved to the current exe', { path: target.path });
      }
    } catch (error) {
      log('auto-launch refresh failed', { error: String(error?.message || error) });
    }
  };

  return { read, refreshMovedEntry, write };
}

function registerAutoLaunchIpcHandlers({ ipcMain, service }) {
  ipcMain.handle('desktop-pet:auto-launch-get', async () => {
    try { return { ok: true, ...service.read() }; } catch (error) { return { error: String(error?.message || error), ok: false }; }
  });
  ipcMain.handle('desktop-pet:auto-launch-set', async (_event, enabled) => {
    try { return service.write(enabled === true); } catch (error) { return { error: String(error?.message || error), ok: false }; }
  });
}

module.exports = {
  LAUNCHED_AT_LOGIN_ARG,
  LOGIN_ITEM_NAME,
  createAutoLaunchService,
  findOwnLaunchItems,
  parseRunValueExe,
  registerAutoLaunchIpcHandlers,
  resolveAutoLaunchTarget,
};
