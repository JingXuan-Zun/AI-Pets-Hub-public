// Plugin market Worker against in-memory R2/D1: upload → pending → owner approves → listed and
// downloadable; bad zips, missing header, wrong admin token and quotas are refused.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createPluginMarketWorker } from '../services/plugin-market/worker.mjs';

const require = createRequire(import.meta.url);
const { zipSync, strToU8, unzipSync } = require('fflate');

function memoryBucket() {
  const objects = new Map();
  let version = 0;
  const wrap = (key, value) => ({
    key, etag: value.etag, body: new Blob([value.bytes]).stream(),
    json: async () => JSON.parse(new TextDecoder().decode(value.bytes)),
    arrayBuffer: async () => value.bytes.buffer.slice(value.bytes.byteOffset, value.bytes.byteOffset + value.bytes.byteLength),
  });
  return {
    objects,
    async get(key) { const value = objects.get(key); return value ? wrap(key, value) : null; },
    async put(key, data, options = {}) {
      const current = objects.get(key);
      if (options.onlyIf?.etagMatches && current?.etag !== options.onlyIf.etagMatches) return null;
      const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
      objects.set(key, { bytes, etag: `e${version += 1}` });
      return { key };
    },
    async delete(keys) { for (const key of [].concat(keys)) objects.delete(key); },
    async list({ prefix }) { return { objects: [...objects.keys()].filter((key) => key.startsWith(prefix)).map((key) => ({ key })) }; },
  };
}

function memoryD1() {
  const counts = new Map();
  return {
    prepare: () => ({ bind: (key, window, limit) => ({ key, limit, window }) }),
    async batch(statements) {
      return statements.map(({ key, window, limit }) => {
        const id = `${key}@${window}`;
        const used = counts.get(id) ?? 0;
        if (used >= limit) return { results: [], success: true };
        counts.set(id, used + 1);
        return { results: [{ used: used + 1 }], success: true };
      });
    },
  };
}

const env = { ADMIN_TOKEN: 'review-token-0123456789', PLUGINS: memoryBucket(), RATE_DB: memoryD1(), RATE_SALT: 'salt', UPLOADS_ENABLED: 'true' };
const worker = createPluginMarketWorker({ now: () => Date.UTC(2026, 9, 31, 12) });
const call = (path, init = {}) => worker.fetch(new Request(`https://market.test${path}`, { ...init, headers: { 'CF-Connecting-IP': '203.0.113.7', ...(init.headers ?? {}) } }), env);
const upload = (bytes, headers = { 'X-Plugin-Upload': '1' }) => {
  const form = new FormData();
  form.append('file', new Blob([bytes]), 'plugin.zip');
  return call('/plugins', { body: form, headers, method: 'POST' });
};
const admin = (path, method = 'GET', token = env.ADMIN_TOKEN) => call(path, { headers: { Authorization: `Bearer ${token}` }, method });

assert.deepEqual(await (await call('/health')).json(), { configured: true, ok: true, reviewEnabled: true, uploadsEnabled: true });
assert.deepEqual((await (await call('/plugins')).json()).items, []);

// A skill zip in GitHub layout, with junk around it: only the plugin folder is kept.
const skillZip = zipSync({
  'repo-main/README.md': strToU8('readme'),
  'repo-main/drawing/SKILL.md': strToU8('---\nname: drawing-teacher\ndescription: 当绘画老师\n---\n# 绘画老师\n'),
  'repo-main/drawing/node_modules/x.js': strToU8('junk'),
});
const accepted = await upload(skillZip);
assert.equal(accepted.status, 202);
const { uploadId } = await accepted.json();
assert.deepEqual((await (await call('/plugins')).json()).items, [], 'not public before review');

assert.equal((await admin('/review/pending', 'GET', 'wrong-token-0123456789')).status, 401);
const pending = (await (await admin('/review/pending')).json()).items;
assert.equal(pending.length, 1);
assert.equal(pending[0].manifest.id, 'drawing-teacher');
assert.equal((await admin(`/review/${uploadId}/zip`)).status, 200, 'owner can download the upload to inspect it');

assert.equal((await admin(`/review/${uploadId}/approve`, 'POST')).status, 200);
const catalog = await (await call('/plugins')).json();
assert.deepEqual(catalog.items.map((item) => `${item.id}@${item.version}`), ['drawing-teacher@0.1.0']);
const download = await call('/plugins/drawing-teacher/download');
assert.equal(download.status, 200);
const files = unzipSync(new Uint8Array(await download.arrayBuffer()));
assert.deepEqual(Object.keys(files).sort(), ['SKILL.md', 'plugin.json'], 're-packed with only the plugin folder');
assert.equal((await admin('/review/pending')).status, 200);
assert.equal((await (await admin('/review/pending')).json()).items.length, 0);

// A second version shows what it replaces; rejecting removes it.
const v2 = await upload(zipSync({ 'plugin.json': strToU8(JSON.stringify({ id: 'drawing-teacher', kind: 'skill', name: '绘画老师', description: '新版', version: '0.2.0' })), 'SKILL.md': strToU8('# x') }));
const v2Id = (await v2.json()).uploadId;
assert.equal((await (await admin('/review/pending')).json()).items[0].replaces, '0.1.0');
await admin(`/review/${v2Id}/reject`, 'POST');
assert.equal((await (await call('/plugins')).json()).items[0].version, '0.1.0');

// Refusals.
assert.equal((await upload(strToU8('not a zip'))).status, 422);
assert.match((await (await upload(zipSync({ 'a/SKILL.md': strToU8('---\nname: a1\n---'), 'b/SKILL.md': strToU8('---\nname: b1\n---') }))).json()).message, /2 个插件/u);
assert.equal((await upload(skillZip, {})).status, 400, 'uploads need the header');
assert.equal((await call('/plugins/unknown-plugin/download')).status, 404);
assert.equal((await call('/review/pending')).status, 401);
env.UPLOADS_ENABLED = 'false';
assert.equal((await upload(skillZip)).status, 503);
env.UPLOADS_ENABLED = 'true';
let limited = 0;
for (let index = 0; index < 12; index += 1) if ((await upload(skillZip)).status === 429) limited += 1;
assert.ok(limited > 0, 'per-IP daily upload quota');

// End to end with the app's plugin service: publish an installed plugin, approve it, and
// install it on another computer from the market (checksum verified).
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createPluginPackageService } = require('../electron/pluginPackageService.cjs');
const viaWorker = (ip) => async (url, init = {}) => {
  const request = new Request(url, init);
  const headers = new Headers(request.headers);
  headers.set('CF-Connecting-IP', ip);
  return worker.fetch(new Request(request, { headers }), env);
};
const base = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-market-e2e-'));
const author = createPluginPackageService({ fetchImpl: viaWorker('198.51.100.1'), trashItem: async () => {}, userDataPath: path.join(base, 'author') });
fs.mkdirSync(path.join(base, 'src'), { recursive: true });
fs.writeFileSync(path.join(base, 'src', 'plugin.json'), JSON.stringify({ id: 'weather-tool', kind: 'mcp', name: '天气工具', description: '查天气', version: '1.0.0', mcp: { command: 'node', args: ['server.js'] }, permissions: ['network'] }));
fs.writeFileSync(path.join(base, 'src', 'server.js'), '// server');
assert.equal((await author.installFromFolder(path.join(base, 'src'))).ok, true);
const published = await author.publish({ apiUrl: 'https://market.test/', id: 'weather-tool' });
assert.equal(published.status, 'pending', published.error);
await admin(`/review/${published.uploadId}/approve`, 'POST');
const entry = (await (await call('/plugins')).json()).items.find((item) => item.id === 'weather-tool');
const user = createPluginPackageService({ fetchImpl: viaWorker('198.51.100.2'), trashItem: async () => {}, userDataPath: path.join(base, 'user') });
const installed = await user.installFromMarket({ sha256: entry.sha256, url: 'https://market.test/plugins/weather-tool/download' });
assert.equal(installed.ok, true, installed.error);
assert.deepEqual([installed.manifest.id, installed.manifest.version], ['weather-tool', '1.0.0']);
assert.ok(fs.existsSync(path.join(user.pluginsRoot, 'weather-tool', 'server.js')));
assert.match((await user.installFromMarket({ sha256: 'f'.repeat(64), url: 'https://market.test/plugins/weather-tool/download' })).error, /不一致/u, 'a tampered download is refused');
fs.rmSync(base, { recursive: true, force: true });

console.log('plugin market worker smoke passed');
