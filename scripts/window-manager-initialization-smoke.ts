import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const managerPath = path.resolve('electron/windowManager.cjs');
const require = createRequire(managerPath);
export function loadWindowManager(source = fs.readFileSync(managerPath, 'utf8')) {
  const effects: string[] = [];
  const unavailable = (name: string) => (..._args: unknown[]) => { effects.push(name); throw new Error('unexpected native action: ' + name); };
  const electron = { app: {}, BrowserWindow: unavailable('BrowserWindow'), Menu: {}, Tray: unavailable('Tray'),
    nativeImage: { createFromPath: unavailable('icon') }, screen: {}, shell: {} };
  const module = { exports: {} as any };
  vm.runInNewContext(source, { module, exports: module.exports, __dirname: path.dirname(managerPath),
    process, console, URL, setTimeout, clearTimeout, setInterval, clearInterval,
    require(name: string) {
      if (name === 'electron') return electron;
      if (name === './windowsDwmBorderService.cjs') return { disableDwmSystemBorderForWindow: unavailable('DWM') };
      if (name === './ipcSenderGuard.cjs') return { openExternalSafely: unavailable('external') };
      return require(name);
    },
  }, { filename: managerPath });
  return { api: module.exports, effects };
}
for (const isDev of [false, true]) for (const sessionPartition of [undefined, 'persist:test']) {
  const { api, effects } = loadWindowManager();
  const first = api.createWindowManager({ isDev, sessionPartition, captureService: {} });
  const second = api.createWindowManager({ isDev, sessionPartition, captureService: {} });
  assert.equal(first.getMainWindow(), null); assert.equal(first.getChatWindow(), null); assert.equal(first.getSettingsWindow(), null);
  assert.equal(first.getIsChatWindowOpen(), false); assert.equal(first.getIsSettingsWindowOpen(), false);
  assert.equal(first.getSharedState(), null); assert.deepEqual([...first.getShellRendererWindows()], []);
  assert.notEqual(first.openChatWindow, second.openChatWindow); assert.notEqual(first.showSettingsWindow, second.showSettingsWindow);
  first.setQuitting(true); first.closeChatWindow(); first.closeSettingsWindow();
  assert.deepEqual(effects, [], 'management construction must not create windows or run native actions');
}
console.log('Window manager initialization smoke passed (4 configurations, two independent managers each).');
