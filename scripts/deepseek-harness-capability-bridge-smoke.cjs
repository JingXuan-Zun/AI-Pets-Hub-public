const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createDeepSeekHarnessCapabilityBridge } = require('../electron/deepseekHarnessCapabilityBridge.cjs');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-pets-harness-bridge-'));
void (async () => {
try {
  const workspace = path.join(root, 'workspace');
  fs.mkdirSync(workspace);
  fs.writeFileSync(path.join(workspace, 'note.txt'), 'hello', 'utf8');
  const calls = [];
  const bridge = await createDeepSeekHarnessCapabilityBridge({
    localFileSystemService: {
      listDirectory: (request) => { calls.push(['list', request.path]); return { entries: [], ok: true, path: request.path }; },
      readTextFile: (request) => { calls.push(['read', request.path]); return { ok: true, path: request.path, text: 'hello' }; },
    },
    workspace,
  });
  const request = (route, token, body) => fetch(`${bridge.url}${route}`, {
    body: JSON.stringify(body), headers: token ? { Authorization: `Bearer ${bridge.token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' }, method: 'POST',
  });
  assert.equal((await request('/list', true, { path: '.' })).status, 200);
  assert.equal((await request('/read', true, { path: '..\\outside.txt' })).status, 400);
  assert.equal((await request('/list', false, { path: '.' })).status, 403);
  assert.deepEqual(calls, [['list', workspace]]);
  await bridge.close();
  console.log('deepseek harness capability bridge smoke passed');
} finally { fs.rmSync(root, { force: true, recursive: true }); }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
