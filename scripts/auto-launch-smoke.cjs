// Start with Windows (2026-11-13): the Run entry points at the exe the user keeps, is read back
// from Windows, and is moved along when the exe is moved.
const assert = require('node:assert/strict');
const path = require('node:path');
const { createAutoLaunchService, LAUNCHED_AT_LOGIN_ARG, LOGIN_ITEM_NAME, parseRunValueExe, resolveAutoLaunchTarget } = require('../electron/autoLaunchService.cjs');

let checks = 0;
const check = (condition, message) => { assert.ok(condition, message); checks += 1; };
const same = (a, b) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();

check(resolveAutoLaunchTarget({ env: {}, execPath: 'C:/x/electron.exe', isPackaged: false }) === null, 'dev app: not supported');
const portable = resolveAutoLaunchTarget({ env: { PORTABLE_EXECUTABLE_FILE: 'D:/Pet/AI-Desktop-Pet.exe' }, execPath: 'C:/Temp/unpacked/AI Desktop Pet.exe', isPackaged: true });
check(same(portable.path, 'D:/Pet/AI-Desktop-Pet.exe'), 'portable build: the kept exe, not the unpacked copy');
check(portable.args.includes(LAUNCHED_AT_LOGIN_ARG), 'started with the at-login flag');

// What `reg query` prints for our value.
const regOutput = `\r\nHKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run\r\n    ${LOGIN_ITEM_NAME}    REG_SZ    "E:\\old\\AI-Desktop-Pet.exe" --launched-at-login\r\n\r\n`;
check(parseRunValueExe(regOutput) === 'E:\\old\\AI-Desktop-Pet.exe', 'reads the exe from reg query');
check(parseRunValueExe('') === '', 'no value');

// A fake Windows: one Run value per name; like Electron, it only reports entries for the path asked about.
function fakeApp(initial = []) {
  const items = new Map(initial.map((item) => [item.name, item]));
  return {
    items,
    getLoginItemSettings: (options) => ({ launchItems: [...items.values()].filter((item) => same(item.path, options.path)) }),
    setLoginItemSettings: (options) => {
      if (options.openAtLogin) items.set(options.name, { args: options.args, enabled: options.enabled !== false, name: options.name, path: options.path });
      else items.delete(options.name);
    },
  };
}
const env = { PORTABLE_EXECUTABLE_FILE: 'D:/Pet/AI-Desktop-Pet.exe' };
const runExeOf = (app) => () => app.items.get(LOGIN_ITEM_NAME)?.path ?? '';

const app = fakeApp();
const service = createAutoLaunchService({ app, env, isPackaged: true, platform: 'win32', readRunExe: runExeOf(app) });
check(service.read().enabled === false, 'off at first');
check(service.write(true).ok && service.read().enabled, 'turned on');
check(same(app.items.get(LOGIN_ITEM_NAME).path, env.PORTABLE_EXECUTABLE_FILE), 'entry points at the exe');
service.refreshMovedEntry();
check(app.items.size === 1, 'nothing to move when the path is right');
check(service.write(false).ok && !service.read().enabled && app.items.size === 0, 'turned off removes the entry');

// Turned off in Task Manager: shows as off.
const disabledApp = fakeApp([{ enabled: false, name: LOGIN_ITEM_NAME, path: env.PORTABLE_EXECUTABLE_FILE }]);
const disabled = createAutoLaunchService({ app: disabledApp, env, isPackaged: true, platform: 'win32', readRunExe: runExeOf(disabledApp) });
check(disabled.read().enabled === false, 'disabled in Task Manager = off');

// The exe was moved: the entry follows it on start.
const movedApp = fakeApp([{ enabled: true, name: LOGIN_ITEM_NAME, path: 'E:/old/AI-Desktop-Pet.exe' }]);
const moved = createAutoLaunchService({ app: movedApp, env, isPackaged: true, platform: 'win32', readRunExe: runExeOf(movedApp) });
check(moved.read().enabled === false, 'old path: not on for this exe');
moved.refreshMovedEntry();
check(moved.read().enabled && same(movedApp.items.get(LOGIN_ITEM_NAME).path, env.PORTABLE_EXECUTABLE_FILE), 'refreshed to the current exe');

// Dev app: switch unavailable, nothing written or read.
const devApp = fakeApp();
const dev = createAutoLaunchService({ app: devApp, env: {}, isPackaged: false, platform: 'win32', readRunExe: () => { throw new Error('must not read'); } });
dev.refreshMovedEntry();
check(dev.read().supported === false && dev.write(true).ok === false && devApp.items.size === 0, 'dev app writes nothing');

console.log(`auto launch smoke ok: ${checks} checks`);
