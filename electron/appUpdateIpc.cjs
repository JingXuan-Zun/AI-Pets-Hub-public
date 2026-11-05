const { createAppUpdateService } = require('./appUpdateService.cjs');

// Hot updates in the running app: the settings page's version list (check, download one,
// restart, go back to the exe's own code), a look for a new version a minute after start and
// once a day, and asking before restarting when one has been downloaded by itself.

const FIRST_CHECK_MS = 60_000;
const DAILY_MS = 24 * 60 * 60_000;
/** The window has stayed up this long after loading: the running version works. */
const HEALTHY_AFTER_MS = 10_000;

function startAppUpdates({ app, dialog, getMainWindow, ipcMain, log, enabled }) {
  const service = createAppUpdateService({ app, log });
  const restart = () => {
    app.relaunch();
    app.exit(0);
  };
  const handle = (channel, handler) => ipcMain.handle(channel, async (_event, request) => {
    try {
      return await handler(request ?? {});
    } catch (error) {
      return { error: error?.message || String(error), ok: false };
    }
  });
  handle('desktop-pet:app-update-status', () => service.status());
  handle('desktop-pet:app-update-check', () => service.check());
  handle('desktop-pet:app-update-download', ({ version }) => service.download(String(version ?? '')));
  handle('desktop-pet:app-update-restart', () => { setTimeout(restart, 200); return { ok: true }; });
  handle('desktop-pet:app-update-revert', () => service.revert());
  handle('desktop-pet:app-update-stay', () => service.stay());
  handle('desktop-pet:app-update-set-auto', ({ enabled: on }) => service.setAutoDownload(on));

  const ask = async (title, message, detail, buttons) => {
    const window = getMainWindow();
    const options = { buttons, cancelId: buttons.length - 1, defaultId: buttons.length - 1, detail, message, noLink: true, title, type: 'info' };
    return (window && !window.isDestroyed() ? dialog.showMessageBox(window, options) : dialog.showMessageBox(options)).then((result) => result.response);
  };

  const window = getMainWindow();
  window?.webContents.once('did-finish-load', () => {
    setTimeout(() => global.__appUpdateBoot?.markGood?.(), HEALTHY_AFTER_MS);
    const notice = global.__appUpdateBoot?.notice;
    if (notice) void ask('更新没装好', notice, '可以到 设置 → 总览 → 当前版本 里再试一次，或者下载完整安装包。', ['知道了']);
  });

  if (!enabled) return service;
  const autoUpdate = async () => {
    const ready = await service.autoUpdate().catch((error) => { log?.('app update check failed', { error: error?.message }); return null; });
    if (!ready) return;
    const choice = await ask('有新版本', `v${ready.version} 已经下载好了，重启后生效。`, ready.notes || '', ['现在重启', '稍后']);
    if (choice === 0) restart();
  };
  setTimeout(() => { void autoUpdate(); }, FIRST_CHECK_MS);
  setInterval(() => { void autoUpdate(); }, DAILY_MS);
  return service;
}

module.exports = { startAppUpdates };
