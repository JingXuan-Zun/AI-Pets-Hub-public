const { createModelRequestService } = require('./modelRequestService.cjs');
const path = require('node:path');
const { fileURLToPath } = require('node:url');

function registerModelRequestIpc({ ipcMain, persistedConfigStore, app }) {
  const service = createModelRequestService({ persistedConfigStore });
  const owners = new WeakSet();
  function owner(event) {
    // Subframes and remote pages may not use this credential-bearing bridge.
    const frame = event.senderFrame;
    if (!frame || frame !== event.sender.mainFrame) throw new Error('模型请求不可用。');
    const url = new URL(frame.url);
    const trustedFile = url.protocol === 'file:' && path.resolve(fileURLToPath(url))
      === path.resolve(__dirname, '..', 'dist', 'index.html');
    const trustedDev = !app.isPackaged && url.origin === 'http://127.0.0.1:3000' && url.pathname === '/';
    if (!trustedFile && !trustedDev) throw new Error('模型请求不可用。');
    if (!owners.has(event.sender)) {
      owners.add(event.sender);
      event.sender.once('destroyed', () => service.cancelOwner(event.sender.id));
      event.sender.on('did-start-navigation', (_event, _url, _inPlace, isMainFrame) => {
        if (isMainFrame) service.cancelOwner(event.sender.id);
      });
    }
    return event.sender.id;
  }
  ipcMain.handle('desktop-pet:model-open', (event, request) => service.open(owner(event), request));
  ipcMain.handle('desktop-pet:model-read', (event, id) => service.read(owner(event), id));
  ipcMain.handle('desktop-pet:model-cancel', (event, id) => service.cancel(owner(event), id));
}

module.exports = { registerModelRequestIpc };
