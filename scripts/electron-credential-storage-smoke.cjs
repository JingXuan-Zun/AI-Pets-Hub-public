const { app, safeStorage, BrowserWindow, ipcMain, session } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createPersistedConfigStore } = require('../electron/persistedConfigStore.cjs');
const { registerModelRequestIpc } = require('../electron/modelRequestIpc.cjs');
const http = require('node:http');
const root = process.env.DESKTOP_PET_CREDENTIAL_PROBE_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'pet-electron-credential-'));
app.setPath('userData', root);
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  assert.equal(safeStorage.isEncryptionAvailable(), true);
  const options = { userDataPath: root, safeStorage };
  const store = createPersistedConfigStore(options);
  assert.equal(store.save({ settings: { geminiApiKey: 'native-test-only-key' } }).ok, true);
  const restarted = createPersistedConfigStore(options);
  assert.equal(restarted.load().config.settings.geminiApiKey, 'desktop-pet-credential:geminiApiKey');
  assert.equal(restarted.load({ includeModelSecrets: true }).config.settings.geminiApiKey, 'native-test-only-key');
  for (const file of [store.getPaths().primaryPath, store.getPaths().backupPath]) {
    assert.ok(!fs.readFileSync(file, 'utf8').includes('native-test-only-key'));
  }
  console.log('native Electron safeStorage smoke ok');
  const server = http.createServer((request, response) => {
    if (request.headers.authorization !== 'Bearer ipc-test-only-key') {
      response.writeHead(401); response.end(); return;
    }
    request.resume();
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({ choices: [{ message: { content: 'native IPC reply' } }] }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  let probeWindow;
  try {
    const endpoint = `http://127.0.0.1:${server.address().port}/v1/chat/completions`;
    assert.equal(store.save({ settings: { customApiKey: 'ipc-test-only-key', customApiUrl: endpoint,
      geminiApiKey: 'gemini-ipc-test-key' } }).ok, true);
    registerModelRequestIpc({ app, ipcMain, persistedConfigStore: store });
    const probeSession = session.fromPartition('credential-ipc-smoke');
    // Serve an empty test page under the trusted file URL in this isolated session.
    await probeSession.protocol.handle('file', () => new Response('<!doctype html><title>Credential test</title>', {
      headers: { 'content-type': 'text/html' },
    }));
    probeWindow = new BrowserWindow({ show: false, webPreferences: { session: probeSession,
      preload: path.resolve(__dirname, '../electron/preload.cjs'), contextIsolation: true, sandbox: false } });
    await probeWindow.loadFile(path.resolve(__dirname, '../dist/index.html'));
    const result = await probeWindow.webContents.executeJavaScript(`(async () => {
      const bridge = window.desktopPetShell;
      const id = 'native-ipc-probe';
      const metadata = await bridge.openModelRequest({ id, provider: 'openai', credentialField: 'customApiKey',
        credential: 'desktop-pet-credential:customApiKey', endpoint: ${JSON.stringify(endpoint)}, body: { messages: [] } });
      let text = '';
      const decoder = new TextDecoder();
      while (true) { const chunk = await bridge.readModelRequest(id); if (chunk.done) break; text += decoder.decode(chunk.value, { stream: true }); }
      return { status: metadata.status, text: JSON.parse(text).choices[0].message.content };
    })()`);
    assert.deepEqual(result, { status: 200, text: 'native IPC reply' });
    console.log('native isolated preload and model IPC smoke ok');
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async (input, init) => {
        const request = input instanceof Request ? input : new Request(input, init);
        assert.equal(request.headers.get('x-goog-api-key'), 'gemini-ipc-test-key');
        return Response.json({ candidates: [{ content: { role: 'model', parts: [{ text: 'native Gemini reply' }] }, finishReason: 'STOP' }] });
      };
      const geminiText = await probeWindow.webContents.executeJavaScript(`(async () => {
        const bridge = window.desktopPetShell;
        const id = 'native-gemini-probe';
        await bridge.openModelRequest({ id, provider: 'gemini', credentialField: 'geminiApiKey',
          credential: 'desktop-pet-credential:geminiApiKey', args: { model: 'test-model', contents: 'hello' } });
        const chunk = await bridge.readModelRequest(id);
        await bridge.cancelModelRequest(id);
        return JSON.parse(new TextDecoder().decode(chunk.value)).text;
      })()`);
      assert.equal(geminiText, 'native Gemini reply');
      console.log('native main-process Gemini SDK smoke ok');
    } finally { globalThis.fetch = originalFetch; }
  } finally {
    probeWindow?.destroy();
    await new Promise((resolve) => server.close(resolve));
  }
}).catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
}).finally(() => {
  // Chromium can hold files until process exit; the runner owns directory cleanup.
  app.exit(process.exitCode || 0);
});
