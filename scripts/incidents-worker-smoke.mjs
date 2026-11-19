// Incident routes of the plugin-market Worker against a real SQLite database shaped like D1:
// two computers report the same problem → one row with total and computer count; the same
// computer again does not add a computer; reading needs the admin key; marking fixed shows up
// in /incidents/status; bad input and quotas are refused.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { createPluginMarketWorker } from '../services/plugin-market/worker.mjs';

const read = (relative) => fs.readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

/** D1's prepare/bind/all/run/batch over node:sqlite. */
function sqliteD1() {
  const db = new DatabaseSync(':memory:');
  db.exec(read('../services/persona-community/schema.sql'));
  db.exec(read('../services/plugin-market/incidents.sql'));
  const bound = (sql, params) => ({
    async all() { return this.execute(); },
    async run() { return this.execute(); },
    execute() {
      const statement = db.prepare(sql);
      if (/^\s*select\b|\breturning\b/iu.test(sql)) return { meta: { changes: 0 }, results: statement.all(...params), success: true };
      const info = statement.run(...params);
      return { meta: { changes: Number(info.changes) }, results: [], success: true };
    },
  });
  return {
    db,
    prepare: (sql) => ({ ...bound(sql, []), bind: (...params) => bound(sql, params) }),
    async batch(statements) { return statements.map((statement) => statement.execute()); },
  };
}

const d1 = sqliteD1();
const env = { ADMIN_TOKEN: 'review-token-0123456789', PLUGINS: {}, RATE_DB: d1, RATE_SALT: 'salt' };
let clock = Date.UTC(2026, 10, 18, 12);
const worker = createPluginMarketWorker({ now: () => clock });
let checks = 0;
const check = (condition, label) => { assert.ok(condition, label); checks += 1; };

const call = (path, { body, ip = '203.0.113.7', method = 'POST', token } = {}) => worker.fetch(new Request(`https://market.test${path}`, {
  body: body === undefined ? undefined : JSON.stringify(body),
  headers: { 'CF-Connecting-IP': ip, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  method,
}), env);
const item = (fingerprint, count, extra = {}) => ({ count, fingerprint, frames: [{ file: 'electron/main.cjs', fn: 'boot', line: '12:3' }], kind: 'TypeError', source: 'main', title: 'x is undefined', versions: ['0.4.4'], ...extra });

let response = await call('/incidents', { body: { appVersion: '0.4.4', installId: 'install-aaaaaaaa', items: [item('aaaaaaaaaaaaaaaa', 3)], os: 'win32 10.0.26200' } });
check(response.status === 200 && (await response.json()).received === 1, 'first report accepted');
clock += 60_000;
await call('/incidents', { body: { appVersion: '0.4.5', installId: 'install-bbbbbbbb', items: [item('aaaaaaaaaaaaaaaa', 2, { title: 'x is undefined (newer)' })] }, ip: '203.0.113.8' });
await call('/incidents', { body: { appVersion: '0.4.5', installId: 'install-aaaaaaaa', items: [item('aaaaaaaaaaaaaaaa', 1)] } });

response = await call('/review/incidents', { method: 'GET' });
check(response.status === 401, 'reading needs the admin key');
response = await call('/review/incidents', { method: 'GET', token: 'wrong-token-0123456789' });
check(response.status === 401, 'a wrong admin key is refused');
response = await call('/review/incidents', { method: 'GET', token: env.ADMIN_TOKEN });
const [row] = (await response.json()).items;
check(row.total === 6, 'counts add up across computers');
check(row.reporters === 2, 'the same computer is counted once');
check(JSON.stringify(row.versions) === JSON.stringify(['0.4.4', '0.4.5']), 'versions seen are merged');
check(row.first_seen === new Date(Date.UTC(2026, 10, 18, 12)).toISOString() && row.title === 'x is undefined', 'first seen kept, latest title kept');
check(!JSON.stringify(d1.db.prepare('SELECT * FROM incident_reporters').all()).includes('install-'), 'install ids are only stored hashed');

response = await call('/incidents/status', { body: { fingerprints: ['aaaaaaaaaaaaaaaa', 'bbbbbbbbbbbbbbbb'] } });
check(JSON.stringify((await response.json()).fixed) === '{}', 'nothing fixed yet');
response = await call('/review/incidents/aaaaaaaaaaaaaaaa/fixed', { body: { note: 'guard added', version: '0.4.6' }, token: env.ADMIN_TOKEN });
check(response.status === 200, 'admin marks it fixed');
response = await call('/incidents/status', { body: { fingerprints: ['aaaaaaaaaaaaaaaa'] } });
check((await response.json()).fixed.aaaaaaaaaaaaaaaa === '0.4.6', 'apps learn the fixed version');
response = await call('/review/incidents?open=1', { method: 'GET', token: env.ADMIN_TOKEN });
check((await response.json()).items.length === 0, '"open only" hides fixed problems');
response = await call('/review/incidents/aaaaaaaaaaaaaaaa/fixed', { body: { version: 'soon' }, token: env.ADMIN_TOKEN });
check(response.status === 400, 'a bad version is refused');

response = await call('/incidents', { body: { installId: 'install-cccccccc', items: [item('NOT-A-FINGERPRINT', 1), item('cccccccccccccccc', 0)] } });
check(response.status === 400, 'bad items are refused');
response = await call('/incidents', { body: { installId: 'x', items: [item('cccccccccccccccc', 1)] } });
check(response.status === 400, 'an install id is required');

let limited = 0;
for (let index = 0; index < 65; index += 1) {
  const result = await call('/incidents', { body: { installId: 'install-dddddddd', items: [item('dddddddddddddddd', 1)] }, ip: '203.0.113.9' });
  if (result.status === 429) limited += 1;
}
check(limited > 0, 'one computer cannot flood the service');

console.log(`incidents worker smoke ok: ${checks} checks`);
