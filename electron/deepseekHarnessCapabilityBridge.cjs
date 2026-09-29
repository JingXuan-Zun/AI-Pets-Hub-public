const http = require('http');
const path = require('path');
const crypto = require('crypto');

function isPathInside(targetPath, workspace) {
  const relative = path.relative(workspace, targetPath);
  return !relative || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function readJson(request) {
  return new Promise((resolve) => {
    let body = '';
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch { resolve({}); } });
  });
}

function sendJson(response, status, value) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(value));
}

function createRequestHandler({ localFileSystemService, token, workspace }) {
  return async (request, response) => {
    if (request.method !== 'POST' || request.headers.authorization !== `Bearer ${token}`) return sendJson(response, 403, { error: 'capability-bridge-denied', ok: false });
    const input = await readJson(request);
    const targetPath = path.resolve(workspace, String(input.path || '.'));
    if (!isPathInside(targetPath, workspace)) return sendJson(response, 400, { error: 'workspace-boundary-denied', ok: false });
    const result = request.url === '/list'
      ? localFileSystemService.listDirectory({ limit: 80, path: targetPath })
      : request.url === '/read'
        ? localFileSystemService.readTextFile({ maxBytes: 96 * 1024, path: targetPath })
        : { error: 'capability-not-supported', ok: false };
    return sendJson(response, result.ok ? 200 : 400, result);
  };
}

function createDeepSeekHarnessCapabilityBridge({ localFileSystemService, workspace }) {
  const token = crypto.randomUUID();
  const server = http.createServer(createRequestHandler({ localFileSystemService, token, workspace }));
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({ close: () => new Promise((done) => server.close(done)), token, url: `http://127.0.0.1:${address.port}` });
    });
  });
}

module.exports = { createDeepSeekHarnessCapabilityBridge };
