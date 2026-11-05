import { readPluginZip } from '../../electron/pluginZipRules.cjs';
import { REVIEW_PAGE_HTML } from './reviewPage.mjs';

// The plugin market (docs/plugin-system-design-20261028.md §6). Files live in R2 (binding PLUGINS):
//   catalog/index.json            published plugins, newest version of each
//   plugins/<id>/<version>.zip    every published version (re-packed, only the plugin's own folder)
//   pending/<uploadId>.zip|.json  uploads waiting for review
// Anyone can list, download and upload; uploads only become public when the owner approves them
// on /review (ADMIN_TOKEN). Request quotas reuse the persona service's D1 table (RATE_DB).

const CATALOG_KEY = 'catalog/index.json';
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024 + 4096;
const MAX_CATALOG_ENTRIES = 5000;

class MarketError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}

const PUBLIC_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Plugin-Upload, Authorization',
  'Access-Control-Expose-Headers': 'Content-Disposition, Retry-After',
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'none'; sandbox",
};

function json(value, status = 200, cache = 'no-store') {
  return new Response(JSON.stringify(value), { status, headers: { ...PUBLIC_HEADERS, 'Cache-Control': cache, 'Content-Type': 'application/json; charset=utf-8' } });
}

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function requireConfig(env, write) {
  if (!env.PLUGINS || !env.RATE_DB || !env.RATE_SALT) throw new MarketError(503, 'service-unavailable');
  if (write && env.UPLOADS_ENABLED !== 'true') throw new MarketError(503, 'uploads-paused');
}

const QUOTA_SQL = `INSERT INTO persona_request_limits (bucket, window_start, used)
  VALUES (?, ?, 1) ON CONFLICT (bucket, window_start)
  DO UPDATE SET used = used + 1 WHERE used < ? RETURNING used`;

/** Per-IP (salted daily hash, never the IP itself) and global quotas, shared with the persona service. */
async function enforceQuota(request, env, kind, now) {
  const ip = request.headers.get('CF-Connecting-IP');
  if (!ip || ip.length > 64) throw new MarketError(403, 'request-rejected');
  const minute = Math.floor(now / 60000) * 60;
  const day = Math.floor(now / 86400000) * 86400;
  const hash = await sha256Hex(new TextEncoder().encode(`${env.RATE_SALT}:${day}:${ip}`));
  const rules = kind === 'upload'
    ? [[`plugin-up:${hash}`, day, 10], ['plugin-up:global', day, 200]]
    : kind === 'download'
      ? [[`plugin-dl:${hash}`, minute, 30], ['plugin-dl:global', minute, 600]]
      : [[`plugin-read:${hash}`, minute, 60]];
  const results = await env.RATE_DB.batch(rules.map(([key, window, limit]) => env.RATE_DB.prepare(QUOTA_SQL).bind(key, window, limit)));
  if (results.some((result) => result.success !== true)) throw new MarketError(503, 'service-unavailable');
  if (results.some((result) => result.results?.length !== 1)) throw new MarketError(429, 'rate-limited');
}

async function readCatalog(env) {
  const object = await env.PLUGINS.get(CATALOG_KEY);
  if (!object) return { catalog: { items: [], updatedAt: null }, etag: null };
  return { catalog: await object.json(), etag: object.etag };
}

/** Read-modify-write with the object's etag, retried when another write came in between. */
async function updateCatalog(env, change) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const { catalog, etag } = await readCatalog(env);
    const next = change(catalog);
    const written = await env.PLUGINS.put(CATALOG_KEY, JSON.stringify(next), {
      httpMetadata: { contentType: 'application/json; charset=utf-8' },
      ...(etag ? { onlyIf: { etagMatches: etag } } : {}),
    });
    if (written) return next;
  }
  throw new MarketError(409, 'catalog-busy');
}

function catalogEntry(manifest, meta) {
  return {
    author: manifest.author, description: manifest.description, examples: manifest.examples, homepage: manifest.homepage,
    id: manifest.id, kind: manifest.kind, name: manifest.name, permissions: manifest.permissions, publishedAt: meta.publishedAt,
    requires: manifest.requires, sha256: meta.sha256, size: meta.size, useWhen: manifest.useWhen, version: manifest.version,
  };
}

async function handleUpload(request, env, now) {
  if (request.headers.get('X-Plugin-Upload') !== '1') throw new MarketError(400, 'missing-upload-header');
  const length = Number(request.headers.get('Content-Length') || 0);
  if (length > MAX_UPLOAD_BYTES) throw new MarketError(413, 'too-large');
  const form = await request.formData();
  const file = form.get('file');
  if (!file || typeof file === 'string') throw new MarketError(400, 'missing-file');
  const checked = readPluginZip(new Uint8Array(await file.arrayBuffer()));
  if (checked.error) return json({ error: 'invalid-plugin', message: checked.error }, 422);
  const sha256 = await sha256Hex(checked.zip);
  const uploadId = `${new Date(now).toISOString().replace(/[-:.TZ]/gu, '').slice(0, 14)}-${sha256.slice(0, 12)}`;
  const meta = { manifest: checked.manifest, sha256, size: checked.zip.byteLength, uploadId, uploadedAt: new Date(now).toISOString() };
  await env.PLUGINS.put(`pending/${uploadId}.zip`, checked.zip, { httpMetadata: { contentType: 'application/zip' } });
  await env.PLUGINS.put(`pending/${uploadId}.json`, JSON.stringify(meta), { httpMetadata: { contentType: 'application/json' } });
  return json({ id: checked.manifest.id, status: 'pending', uploadId, version: checked.manifest.version }, 202);
}

async function handleDownload(env, id) {
  const { catalog } = await readCatalog(env);
  const entry = catalog.items.find((item) => item.id === id);
  if (!entry) throw new MarketError(404, 'not-found');
  const object = await env.PLUGINS.get(`plugins/${entry.id}/${entry.version}.zip`);
  if (!object) throw new MarketError(404, 'not-found');
  return new Response(object.body, {
    headers: {
      ...PUBLIC_HEADERS,
      'Cache-Control': 'public, max-age=300',
      'Content-Disposition': `attachment; filename="${entry.id}-${entry.version}.zip"`,
      'Content-Type': 'application/zip',
      'X-Plugin-Sha256': entry.sha256,
    },
  });
}

function timingSafeEqual(left, right) {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  let diff = a.length ^ b.length;
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) diff |= (a[index] ?? 0) ^ (b[index] ?? 0);
  return diff === 0;
}

function requireAdmin(request, env) {
  const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/u, '');
  if (!env.ADMIN_TOKEN || env.ADMIN_TOKEN.length < 16 || !token || !timingSafeEqual(token, env.ADMIN_TOKEN)) throw new MarketError(401, 'unauthorized');
}

async function listPending(env) {
  const listed = await env.PLUGINS.list({ prefix: 'pending/', limit: 200 });
  const metas = await Promise.all(listed.objects.filter((object) => object.key.endsWith('.json')).map(async (object) => (await env.PLUGINS.get(object.key))?.json()));
  const { catalog } = await readCatalog(env);
  return metas.filter(Boolean).map((meta) => ({
    ...meta,
    replaces: catalog.items.find((item) => item.id === meta.manifest.id)?.version ?? null,
  })).sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt));
}

async function review(env, uploadId, decision, now) {
  if (!/^[0-9]{14}-[a-f0-9]{12}$/u.test(uploadId)) throw new MarketError(400, 'bad-upload-id');
  const metaObject = await env.PLUGINS.get(`pending/${uploadId}.json`);
  const zipObject = await env.PLUGINS.get(`pending/${uploadId}.zip`);
  if (!metaObject || !zipObject) throw new MarketError(404, 'not-found');
  const meta = await metaObject.json();
  if (decision === 'approve') {
    const { id, version } = meta.manifest;
    await env.PLUGINS.put(`plugins/${id}/${version}.zip`, await zipObject.arrayBuffer(), { httpMetadata: { contentType: 'application/zip' } });
    const entry = catalogEntry(meta.manifest, { publishedAt: new Date(now).toISOString(), sha256: meta.sha256, size: meta.size });
    await updateCatalog(env, (catalog) => {
      const items = [entry, ...catalog.items.filter((item) => item.id !== id)];
      if (items.length > MAX_CATALOG_ENTRIES) throw new MarketError(507, 'catalog-full');
      return { items, updatedAt: entry.publishedAt };
    });
  }
  await env.PLUGINS.delete([`pending/${uploadId}.zip`, `pending/${uploadId}.json`]);
  return json({ decision, ok: true, uploadId });
}

async function route(request, env, now) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: PUBLIC_HEADERS });
  if (request.method === 'GET' && (path === '/' || path === '/health')) {
    const configured = Boolean(env.PLUGINS && env.RATE_DB && env.RATE_SALT);
    return json({ configured, ok: true, reviewEnabled: Boolean(env.ADMIN_TOKEN), uploadsEnabled: configured && env.UPLOADS_ENABLED === 'true' });
  }
  // Hot updates of the app itself (signed list + zips), uploaded by hand to R2 under updates/.
  const update = /^\/updates\/(latest\.json|app-update-[0-9]+\.[0-9]+\.[0-9]+\.zip)$/u.exec(path);
  if (request.method === 'GET' && update) {
    requireConfig(env, false);
    const object = await env.PLUGINS.get(`updates/${update[1]}`);
    if (!object) throw new MarketError(404, 'not-found');
    const isList = update[1] === 'latest.json';
    return new Response(object.body, { headers: { ...PUBLIC_HEADERS, 'Cache-Control': isList ? 'public, max-age=300' : 'public, max-age=86400, immutable', 'Content-Type': isList ? 'application/json; charset=utf-8' : 'application/zip' } });
  }
  if (request.method === 'GET' && path === '/review') {
    return new Response(REVIEW_PAGE_HTML, { headers: { 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'", 'Content-Type': 'text/html; charset=utf-8', 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY' } });
  }
  if (path.startsWith('/review/')) {
    requireConfig(env, false);
    requireAdmin(request, env);
    if (request.method === 'GET' && path === '/review/pending') return json({ items: await listPending(env) });
    const pendingZip = /^\/review\/([0-9]{14}-[a-f0-9]{12})\/zip$/u.exec(path);
    if (request.method === 'GET' && pendingZip) {
      const object = await env.PLUGINS.get(`pending/${pendingZip[1]}.zip`);
      if (!object) throw new MarketError(404, 'not-found');
      return new Response(object.body, { headers: { ...PUBLIC_HEADERS, 'Cache-Control': 'no-store', 'Content-Type': 'application/zip' } });
    }
    const match = /^\/review\/([^/]+)\/(approve|reject)$/u.exec(path);
    if (request.method === 'POST' && match) return review(env, match[1], match[2], now);
    throw new MarketError(404, 'not-found');
  }
  if (path === '/plugins' && request.method === 'GET') {
    requireConfig(env, false);
    await enforceQuota(request, env, 'read', now);
    const { catalog } = await readCatalog(env);
    return json(catalog, 200, 'public, max-age=60');
  }
  if (path === '/plugins' && request.method === 'POST') {
    requireConfig(env, true);
    await enforceQuota(request, env, 'upload', now);
    return handleUpload(request, env, now);
  }
  const download = /^\/plugins\/([a-z0-9][a-z0-9._-]{1,62})\/download$/u.exec(path);
  if (download && request.method === 'GET') {
    requireConfig(env, false);
    await enforceQuota(request, env, 'download', now);
    return handleDownload(env, download[1]);
  }
  throw new MarketError(404, 'not-found');
}

export function createPluginMarketWorker({ now = Date.now } = {}) {
  return {
    async fetch(request, env) {
      try {
        return await route(request, env, now());
      } catch (error) {
        // Never echo R2/D1 errors, tokens or stack traces.
        const known = error instanceof MarketError;
        console.error('plugin-market request failed', JSON.stringify({ code: known ? error.code : 'internal-error', path: new URL(request.url).pathname }));
        const response = json({ error: known ? error.code : 'service-unavailable' }, known ? error.status : 503);
        if (known && error.status === 429) response.headers.set('Retry-After', '60');
        return response;
      }
    },
  };
}

export default createPluginMarketWorker();
