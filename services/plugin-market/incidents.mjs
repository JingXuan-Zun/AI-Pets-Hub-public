// Incidents ("病例", 2026-11-18): problems the app ran into on users' computers, sent only with
// their consent and already cleaned on the computer (no chat, keys or paths). Stored in D1
// (binding RATE_DB, tables in incidents.sql), never public: reading needs ADMIN_TOKEN. The same
// problem from many computers is one row (fingerprint) with a total count, the number of
// computers (install ids, kept only as salted hashes) and the versions seen. The developer
// marks one fixed in a version; apps ask which of theirs are fixed.

const FINGERPRINT = /^[0-9a-f]{16}$/u;
const VERSION = /^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,4}$/u;
const SOURCES = new Set(['crash', 'main', 'window']);
const MAX_BODY_BYTES = 64 * 1024;
const MAX_ITEMS = 20;
const MAX_VERSIONS = 20;

const text = (value, max) => (typeof value === 'string' ? value.slice(0, max) : '');

/** One item from the app, checked and trimmed; null when it is not one. */
function cleanItem(raw) {
  if (!raw || !FINGERPRINT.test(raw.fingerprint) || !SOURCES.has(raw.source)) return null;
  const count = Number(raw.count);
  if (!Number.isInteger(count) || count < 1 || count > 100000) return null;
  const frames = (Array.isArray(raw.frames) ? raw.frames : []).slice(0, 8).map((frame) => ({ file: text(frame?.file, 200), fn: text(frame?.fn, 80), line: text(frame?.line, 16) }));
  const versions = (Array.isArray(raw.versions) ? raw.versions : []).filter((version) => VERSION.test(version)).slice(-5);
  return { count, fingerprint: raw.fingerprint, frames, kind: text(raw.kind, 80) || 'Error', source: raw.source, title: text(raw.title, 200) || '(无说明)', versions };
}

async function readJsonBody(request, MarketError) {
  const length = Number(request.headers.get('Content-Length') || 0);
  if (length > MAX_BODY_BYTES) throw new MarketError(413, 'too-large');
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) throw new MarketError(413, 'too-large');
  try {
    return JSON.parse(raw);
  } catch {
    throw new MarketError(400, 'bad-json');
  }
}

async function receive(request, env, now, { MarketError, json, sha256Hex }) {
  const body = await readJsonBody(request, MarketError);
  const items = (Array.isArray(body?.items) ? body.items : []).slice(0, MAX_ITEMS).map(cleanItem).filter(Boolean);
  const installId = text(body?.installId, 64);
  if (!items.length || installId.length < 8) throw new MarketError(400, 'bad-incident');
  const appVersion = VERSION.test(body?.appVersion) ? body.appVersion : '';
  const os = text(body?.os, 40);
  const reporter = (await sha256Hex(new TextEncoder().encode(`${env.RATE_SALT}:incident:${installId}`))).slice(0, 32);
  const db = env.RATE_DB;

  // Which of these problems this computer has reported before (counts each computer once).
  const fresh = await db.batch(items.map((item) => db.prepare('INSERT OR IGNORE INTO incident_reporters (fingerprint, reporter) VALUES (?, ?)').bind(item.fingerprint, reporter)));
  const placeholders = items.map(() => '?').join(',');
  const existing = await db.prepare(`SELECT fingerprint, versions, oses FROM incident_groups WHERE fingerprint IN (${placeholders})`).bind(...items.map((item) => item.fingerprint)).all();
  const known = new Map((existing.results ?? []).map((row) => [row.fingerprint, row]));

  await db.batch(items.map((item, index) => {
    const row = known.get(item.fingerprint);
    const versions = [...new Set([...(row ? JSON.parse(row.versions) : []), ...item.versions, ...(appVersion ? [appVersion] : [])])].slice(-MAX_VERSIONS);
    const oses = [...new Set([...(row ? JSON.parse(row.oses) : []), ...(os ? [os] : [])])].slice(-10);
    const newReporter = fresh[index]?.meta?.changes ? 1 : 0;
    return db.prepare(`INSERT INTO incident_groups (fingerprint, source, kind, title, frames, versions, oses, total, reporters, first_seen, last_seen)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (fingerprint) DO UPDATE SET title = excluded.title, frames = excluded.frames, versions = excluded.versions,
        oses = excluded.oses, total = incident_groups.total + excluded.total, reporters = incident_groups.reporters + excluded.reporters,
        last_seen = excluded.last_seen`)
      .bind(item.fingerprint, item.source, item.kind, item.title, JSON.stringify(item.frames), JSON.stringify(versions), JSON.stringify(oses), item.count, newReporter, now, now);
  }));
  return json({ ok: true, received: items.length });
}

async function status(request, env, { MarketError, json }) {
  const body = await readJsonBody(request, MarketError);
  const fingerprints = (Array.isArray(body?.fingerprints) ? body.fingerprints : []).filter((value) => FINGERPRINT.test(value)).slice(0, 100);
  if (!fingerprints.length) return json({ fixed: {} });
  const rows = await env.RATE_DB.prepare(`SELECT fingerprint, fixed_in FROM incident_groups WHERE fixed_in IS NOT NULL AND fingerprint IN (${fingerprints.map(() => '?').join(',')})`).bind(...fingerprints).all();
  return json({ fixed: Object.fromEntries((rows.results ?? []).map((row) => [row.fingerprint, row.fixed_in])) });
}

async function list(env, url, { json }) {
  const open = url.searchParams.get('open') === '1';
  const rows = await env.RATE_DB.prepare(`SELECT * FROM incident_groups ${open ? 'WHERE fixed_in IS NULL' : ''} ORDER BY last_seen DESC LIMIT 300`).all();
  return json({
    items: (rows.results ?? []).map((row) => ({
      ...row,
      first_seen: new Date(row.first_seen).toISOString(),
      frames: JSON.parse(row.frames),
      last_seen: new Date(row.last_seen).toISOString(),
      oses: JSON.parse(row.oses),
      versions: JSON.parse(row.versions),
    })),
  });
}

async function markFixed(request, env, fingerprint, { MarketError, json }) {
  const body = await readJsonBody(request, MarketError);
  const version = body?.version === null ? null : VERSION.test(body?.version) ? body.version : undefined;
  if (version === undefined) throw new MarketError(400, 'bad-version');
  const result = await env.RATE_DB.prepare('UPDATE incident_groups SET fixed_in = ?, note = ? WHERE fingerprint = ?').bind(version, text(body?.note, 500) || null, fingerprint).run();
  if (!result.meta?.changes) throw new MarketError(404, 'not-found');
  return json({ fingerprint, fixed_in: version, ok: true });
}

/**
 * The incident routes, or null when the path is not one of them. Helpers come from worker.mjs:
 * { MarketError, enforceQuota, json, requireAdmin, requireConfig, sha256Hex }.
 */
export async function routeIncidents(request, env, now, helpers) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (path === '/incidents' && request.method === 'POST') {
    helpers.requireConfig(env, false);
    await helpers.enforceQuota(request, env, 'incident', now);
    return receive(request, env, now, helpers);
  }
  if (path === '/incidents/status' && request.method === 'POST') {
    helpers.requireConfig(env, false);
    await helpers.enforceQuota(request, env, 'read', now);
    return status(request, env, helpers);
  }
  if (path === '/review/incidents' && request.method === 'GET') {
    helpers.requireConfig(env, false);
    helpers.requireAdmin(request, env);
    return list(env, url, helpers);
  }
  const fixed = /^\/review\/incidents\/([0-9a-f]{16})\/fixed$/u.exec(path);
  if (fixed && request.method === 'POST') {
    helpers.requireConfig(env, false);
    helpers.requireAdmin(request, env);
    return markFixed(request, env, fixed[1], helpers);
  }
  return null;
}
