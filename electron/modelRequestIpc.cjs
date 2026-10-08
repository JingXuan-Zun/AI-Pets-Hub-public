const { createModelRequestService } = require('./modelRequestService.cjs');
const { isTrustedAppSender } = require('./ipcSenderGuard.cjs');

function registerModelRequestIpc({ ipcMain, persistedConfigStore, app }) {
  const service = createModelRequestService({ persistedConfigStore });
  const owners = new WeakSet();
  function owner(event) {
    // Subframes and remote pages may not use this credential-bearing bridge.
    if (!isTrustedAppSender(event, app)) throw new Error('模型请求不可用。');
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
