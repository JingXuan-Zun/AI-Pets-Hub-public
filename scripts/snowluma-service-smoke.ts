import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import net from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { normalizeQqBridgeSettings } from '../src/qq-bridge/qqBridgeSettings';

const require = createRequire(import.meta.url);
const { createSnowLumaService, inspectSnowLumaDir, isPortOpen, portFromWsUrl, resolveSnowLumaWebuiUrl } = require('../electron/snowLumaService.cjs') as {
  resolveSnowLumaWebuiUrl: (dir: string) => { error?: string; ok: boolean; url?: string };
  createSnowLumaService: (options: { logDirectory: string }) => {
    ensureRunning: (request: { dir: string; wsUrl?: string }) => Promise<{ error?: string; ok: boolean; owned?: boolean; started?: boolean }>;
    logPath: string;
    readInitialCredentials: () => { ok: boolean; password?: string; user?: string };
    status: () => { ownedRunning: boolean };
    stop: () => { stopped: boolean };
  };
  inspectSnowLumaDir: (dir: string) => { error?: string; ok: boolean };
  isPortOpen: (port: number) => Promise<boolean>;
  portFromWsUrl: (url: string) => number;
};

const sleep = (ms: number) => new Promise((resolve) => { setTimeout(resolve, ms); });
const freePort = () => new Promise<number>((resolve) => {
  const server = net.createServer();
  server.listen(0, '127.0.0.1', () => {
    const { port } = server.address() as net.AddressInfo;
    server.close(() => resolve(port));
  });
});

// Settings: auto-start is on by default; the folder is empty until picked.
assert.equal(normalizeQqBridgeSettings(undefined).autoStartSnowLuma, true);
assert.equal(normalizeQqBridgeSettings({ autoStartSnowLuma: false }).autoStartSnowLuma, false);
assert.equal(normalizeQqBridgeSettings(undefined).snowLumaDir, '');
assert.equal(portFromWsUrl('ws://127.0.0.1:3005/'), 3005);
assert.equal(portFromWsUrl('nonsense'), 3001);

// A folder without SnowLuma is refused.
const empty = mkdtempSync(path.join(tmpdir(), 'snowluma-empty-'));
assert.match(inspectSnowLumaDir(empty).error ?? '', /找不到 index\.mjs/u);
assert.match(inspectSnowLumaDir('').error ?? '', /还没选/u);

assert.match(inspectSnowLumaDir('snowluma').error ?? '', /完整路径/u, 'a relative folder is refused');

// A stand-in SnowLuma: prints a line and listens on the WebSocket port.
const port = await freePort();
const fake = mkdtempSync(path.join(tmpdir(), 'snowluma-fake-'));
writeFileSync(path.join(fake, 'index.mjs'), `import net from 'node:net';\nconsole.log('fake snowluma up');\nnet.createServer(() => {}).listen(${port}, '127.0.0.1');\n`);
const logs = mkdtempSync(path.join(tmpdir(), 'snowluma-logs-'));
const service = createSnowLumaService({ logDirectory: logs });
const wsUrl = `ws://127.0.0.1:${port}`;

// Two requests at once share one start (React runs effects twice in development).
const [first, twin] = await Promise.all([service.ensureRunning({ dir: fake, wsUrl }), service.ensureRunning({ dir: fake, wsUrl })]);
assert.deepEqual(first, { ok: true, owned: true, started: true }, 'started in the background');
assert.equal(twin, first, 'the second request waited for the same start');
for (let i = 0; i < 40 && !(await isPortOpen(port)); i += 1) await sleep(100);
assert.equal(await isPortOpen(port), true, 'it is listening');
assert.deepEqual(await service.ensureRunning({ dir: fake, wsUrl }), { ok: true, owned: true, started: false }, 'no second copy');
assert.equal(service.status().ownedRunning, true);
assert.ok(existsSync(service.logPath));
for (let i = 0; i < 20 && !readFileSync(service.logPath, 'utf8').includes('fake snowluma up'); i += 1) await sleep(100);
assert.match(readFileSync(service.logPath, 'utf8'), /fake snowluma up/u, 'console output goes to the log file');

assert.equal(service.stop().stopped, true);
for (let i = 0; i < 40 && (await isPortOpen(port)); i += 1) await sleep(100);
assert.equal(await isPortOpen(port), false, 'stopped');
assert.equal(service.stop().stopped, false, 'stopping twice is harmless');

// Already running (started by hand): the pet doesn't start or stop it.
const external = net.createServer(() => {}).listen(port, '127.0.0.1');
await sleep(100);
const other = createSnowLumaService({ logDirectory: logs });
assert.deepEqual(await other.ensureRunning({ dir: fake, wsUrl }), { ok: true, owned: false, started: false });
assert.equal(other.stop().stopped, false, 'a copy started by hand is left alone');
external.close();

// The first-start WebUI login, read from the console log; the latest one wins.
writeFileSync(service.logPath, 'x\n[WebUI] initial credentials: user=admin password=Old-1\n...\n[WebUI] initial credentials: user=admin password=New-2\n');
assert.deepEqual(service.readInitialCredentials(), { ok: true, password: 'New-2', user: 'admin' });
writeFileSync(service.logPath, 'no password this time\n');
assert.deepEqual(service.readInitialCredentials(), { ok: false }, 'already changed: nothing to show');

// The admin page address comes from SnowLuma's config and stays on this computer.
mkdirSync(path.join(fake, 'config'), { recursive: true });
assert.equal(resolveSnowLumaWebuiUrl(fake).url, 'http://127.0.0.1:5099', 'default port');
writeFileSync(path.join(fake, 'config', 'runtime.json'), JSON.stringify({ webuiHost: '127.0.0.1', webuiPort: 6000 }));
assert.equal(resolveSnowLumaWebuiUrl(fake).url, 'http://127.0.0.1:6000');
writeFileSync(path.join(fake, 'config', 'runtime.json'), JSON.stringify({ webuiHost: '0.0.0.0', webuiPort: 6000 }));
assert.equal(resolveSnowLumaWebuiUrl(fake).ok, false, 'not opened when exposed beyond this computer');

console.log('snowluma service smoke ok');
