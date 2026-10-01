import http from 'node:http';
import https from 'node:https';
import { readFileSync } from 'node:fs';
import { Readable } from 'node:stream';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLocalPersonaStore } from './localStore.mjs';
import { createLocalPersonaHandler } from './localHandler.mjs';
import { jsonResponse } from '../persona-community/http.mjs';
import { PERSONA_MAX_FILE_BYTES } from '../../src/persona-community/personaCommunitySchema.ts';

const BODY_LIMIT = PERSONA_MAX_FILE_BYTES + 16384;

async function sendResponse(response, outgoing) {
  outgoing.writeHead(response.status, Object.fromEntries(response.headers));
  if (!response.body) { outgoing.end(); return; }
  await new Promise((done, reject) => {
    const body = Readable.fromWeb(response.body);
    outgoing.on('close', () => { body.destroy(); done(); });
    outgoing.on('error', reject);
    body.on('error', reject);
    outgoing.on('finish', done);
    body.pipe(outgoing);
  });
}

function requestListener(handler) {
  return async (incoming, outgoing) => {
    const abort = new AbortController();
    incoming.on('aborted', () => abort.abort());
    outgoing.on('close', () => { if (!outgoing.writableFinished) abort.abort(); });
    try {
      const length = incoming.headers['content-length'];
      if (length && (!/^\d+$/.test(length) || Number(length) > BODY_LIMIT)) {
        outgoing.setHeader('Connection', 'close');
        await sendResponse(jsonResponse({ error: 'file-size' }, 413), outgoing);
        return;
      }
      const target = incoming.url ?? '/';
      if (!target.startsWith('/') || target.startsWith('//')) {
        await sendResponse(jsonResponse({ error: 'request-rejected' }, 400), outgoing);
        return;
      }
      const headers = new Headers();
      for (const [name, value] of Object.entries(incoming.headers)) {
        if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(', ') : value);
      }
      const bodyMethod = !['GET', 'HEAD'].includes(incoming.method ?? 'GET');
      const request = new Request(`http://localhost${target}`, {
        method: incoming.method, headers, signal: abort.signal,
        ...(bodyMethod ? { body: Readable.toWeb(incoming), duplex: 'half' } : {}),
      });
      await sendResponse(await handler(request, incoming.socket.remoteAddress), outgoing);
    } catch {
      if (!outgoing.headersSent) await sendResponse(jsonResponse({ error: 'service-unavailable' }, 503), outgoing).catch(() => {});
      else outgoing.destroy();
    }
  };
}

export async function startPersonaServer({ databasePath, host = '127.0.0.1', port = 8787, uploadsEnabled = false, tls, now, maxTotalBytes }) {
  if (!tls && !['127.0.0.1', '::1', 'localhost'].includes(host)) {
    throw new Error('HTTP must bind to loopback; configure HTTPS for LAN access.');
  }
  const store = createLocalPersonaStore(databasePath, { maxTotalBytes });
  const handler = createLocalPersonaHandler({ store, uploadsEnabled, now });
  const listener = requestListener(handler);
  let server;
  try {
    server = tls ? https.createServer(tls, listener) : http.createServer(listener);
    server.requestTimeout = 30000;
    server.headersTimeout = 10000;
    server.keepAliveTimeout = 5000;
    server.maxConnections = 32;
    await new Promise((done, reject) => { server.once('error', reject); server.listen(port, host, done); });
  } catch (error) { store.close(); throw error; }
  return { server, store, url: `${tls ? 'https' : 'http'}://${host.includes(':') ? `[${host}]` : host}:${server.address().port}`,
    async close() {
      await new Promise((done) => { server.close(done); server.closeIdleConnections(); });
      store.close();
    },
  };
}

async function main() {
  if (Number(process.versions.node.split('.')[0]) < 24) throw new Error('Node.js 24 or newer is required.');
  const base = dirname(fileURLToPath(import.meta.url));
  const configPath = resolve(base, process.argv[2] ?? 'server.config.json');
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535
    || typeof config.host !== 'string' || !config.host
    || typeof config.uploadsEnabled !== 'boolean' || typeof config.dataDirectory !== 'string') {
    throw new Error('Server configuration is invalid.');
  }
  const relative = (name) => resolve(dirname(configPath), name);
  const tls = config.tls ? {
    pfx: readFileSync(relative(config.tls.pfx)),
    passphrase: readFileSync(relative(config.tls.passwordFile), 'utf8').trim(),
    minVersion: 'TLSv1.2',
  } : undefined;
  const runtime = await startPersonaServer({
    databasePath: resolve(relative(config.dataDirectory), 'personas.sqlite'),
    host: config.host, port: config.port, uploadsEnabled: config.uploadsEnabled, tls,
  });
  console.log(`Persona sharing server listening at ${runtime.url}`);
  console.log(`Uploads: ${config.uploadsEnabled ? 'enabled' : 'paused'}. Stop with Ctrl+C.`);
  let closing = false;
  const stop = () => { if (closing) return; closing = true; runtime.close().catch(() => { process.exitCode = 1; }); };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => { console.error('Server startup failed. Check Node version, configuration, certificate and data directory.'); process.exitCode = 1; });
}
