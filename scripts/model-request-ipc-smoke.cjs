const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const { registerModelRequestIpc } = require('../electron/modelRequestIpc.cjs');
const handlers = new Map();
registerModelRequestIpc({ ipcMain: { handle: (channel, handler) => handlers.set(channel, handler) },
  app: { isPackaged: true }, persistedConfigStore: {} });
const sender = new EventEmitter();
sender.id = 1;
const frame = { url: pathToFileURL(path.resolve(__dirname, '../dist/index.html')).href + '?view=settings' };
sender.mainFrame = frame;
const event = { sender, senderFrame: frame };
assert.doesNotThrow(() => handlers.get('desktop-pet:model-cancel')(event, 'none'));
assert.throws(() => handlers.get('desktop-pet:model-cancel')({ ...event, senderFrame: { ...frame } }, 'none'));
for (const url of ['https://attacker.example', 'http://127.0.0.1:3000/', pathToFileURL(path.resolve(__dirname, '../README.md')).href]) {
  frame.url = url;
  assert.throws(() => handlers.get('desktop-pet:model-cancel')(event, 'none'));
}
sender.emit('destroyed');
console.log('model request IPC rejects remote pages, other files and subframes');
