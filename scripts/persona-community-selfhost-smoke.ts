import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createLocalPersonaStore } from '../services/persona-community-selfhost/localStore.mjs';
import { createLocalPersonaHandler } from '../services/persona-community-selfhost/localHandler.mjs';
import { startPersonaServer } from '../services/persona-community-selfhost/server.mjs';
import { createPersonaCommunityClient } from '../src/persona-community/personaCommunityClient.ts';
import { readPersonaUpload } from '../services/persona-community/files.mjs';

const directory = await mkdtemp(join(tmpdir(), 'pet-persona-selfhost-'));
const databasePath = join(directory, 'personas.sqlite');
let runtime;
let clock = Date.UTC(2026, 8, 30, 12);
const advance = () => { clock += 60000; };
const form = (text: string, name = 'test.txt') => {
  const body = new FormData(); body.append('file', new File([text], name)); return body;
};
try {
  await assert.rejects(() => startPersonaServer({ databasePath, host: '0.0.0.0' }), /loopback/);
  runtime = await startPersonaServer({ databasePath, port: 0, uploadsEnabled: true, now: () => clock });
  const origin = runtime.url;
  // Exercise the unchanged HTTPS-only client over a real local HTTP socket. TLS is tested separately.
  const transport: typeof fetch = (input, options) => fetch(origin + new URL(String(input)).pathname, options);
  const clientA = createPersonaCommunityClient({ apiUrl: 'https://local-test.invalid' }, transport);
  const clientB = createPersonaCommunityClient({ apiUrl: 'https://local-test.invalid' }, transport);
  const original = 'A public test persona.\r\n保留换行和字符。\r\n';
  const entry = await clientA.upload(new File([original], '测试人格.txt'));
  const items = await clientB.list();
  assert.equal(items.length, 1); assert.equal(items[0].id, entry.id);
  assert.equal(await (await clientB.download(items[0])).blob.text(), original);
  const duplicate = await clientA.upload(new File([original], 'renamed.txt'));
  assert.equal(duplicate.id, entry.id); assert.equal(duplicate.filename, entry.filename);
  await Promise.all(['one', 'two'].map((text) => clientA.upload(new File([text], `${text}.md`))));
  assert.equal((await clientB.list()).length, 3);
  advance();
  const invalid = await fetch(origin + '/personas', {
    method: 'POST', headers: { 'X-Persona-Upload': '1' }, body: form('{invalid', 'bad.json'),
  });
  assert.equal(invalid.status, 400); assert.equal((await invalid.json()).error, 'file-json');
  assert.equal((await clientB.list()).length, 3);
  const noHeader = await fetch(origin + '/personas', { method: 'POST', body: form('public') });
  assert.equal(noHeader.status, 400);
  const large = await fetch(origin + '/personas', {
    method: 'POST', headers: { 'X-Persona-Upload': '1' }, body: form('x'.repeat(2 * 1024 * 1024 + 1)),
  });
  assert.equal(large.status, 400);
  assert.equal((await fetch(origin + '/data/personas.sqlite')).status, 404);
  assert.equal((await fetch(origin + '/personas', { method: 'DELETE' })).status, 405);
  const preflight = await fetch(origin + '/personas', { method: 'OPTIONS' });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('Access-Control-Allow-Headers'), 'Content-Type, X-Persona-Upload');
  await runtime.close(); runtime = undefined;
  runtime = await startPersonaServer({ databasePath, port: 0, uploadsEnabled: false, now: () => clock });
  assert.equal((await (await fetch(runtime.url + '/personas')).json()).items.length, 3);
  const paused = await fetch(runtime.url + '/personas', {
    method: 'POST', headers: { 'X-Persona-Upload': '1' }, body: form('paused'),
  });
  assert.equal(paused.status, 503); assert.equal((await paused.json()).error, 'uploads-paused');
  await runtime.close(); runtime = undefined;

  // Quotas use socket identity, ignore spoofed IPs, and survive restart.
  advance();
  runtime = await startPersonaServer({ databasePath, port: 0, uploadsEnabled: true, now: () => clock });
  for (let index = 0; index < 5; index++) {
    const result = await fetch(runtime.url + '/personas', { method: 'POST',
      headers: { 'X-Persona-Upload': '1', 'CF-Connecting-IP': `203.0.113.${index}`, 'X-Forwarded-For': `203.0.113.${index}` },
      body: form('quota same content'),
    });
    assert.equal(result.status, 201);
  }
  await runtime.close(); runtime = undefined;
  runtime = await startPersonaServer({ databasePath, port: 0, uploadsEnabled: true, now: () => clock });
  const capped = await fetch(runtime.url + '/personas', { method: 'POST',
    headers: { 'X-Persona-Upload': '1', 'CF-Connecting-IP': '198.51.100.99' }, body: form('quota sixth') });
  assert.equal(capped.status, 429); assert.equal(capped.headers.get('Retry-After'), '60');
  advance();
  const validJson = await fetch(runtime.url + '/personas', { method: 'POST',
    headers: { 'X-Persona-Upload': '1' }, body: form('{"hello":"world"}', 'arbitrary.json') });
  assert.equal(validJson.status, 201);
  await runtime.close(); runtime = undefined;

  const damaged = new DatabaseSync(databasePath);
  damaged.prepare('UPDATE personas SET content = ? WHERE id = ?').run(Buffer.from('tampered'), entry.id);
  damaged.close();
  runtime = await startPersonaServer({ databasePath, port: 0, now: () => clock });
  const download = await fetch(runtime.url + `/personas/${entry.id}/download`);
  assert.equal(download.status, 502); assert.equal((await download.json()).error, 'download-invalid');
  await runtime.close(); runtime = undefined;

  const smallStore = createLocalPersonaStore(':memory:', { maxTotalBytes: 2 });
  const payload = await readPersonaUpload(new Request('http://localhost/personas', {
    method: 'POST', headers: { 'X-Persona-Upload': '1' }, body: form('three'),
  }), clock);
  assert.throws(() => smallStore.publish(payload.entry, payload.bytes), /catalog-full/);
  assert.deepEqual(smallStore.catalog(), { items: [] }); smallStore.close();
  const brokenStore = { getOrCreateSecret: () => 'fake-test-salt', quotaBinding: { prepare: () => { throw new Error('PRIVATE PATH SECRET'); } } };
  const broken = await createLocalPersonaHandler({ store: brokenStore })(new Request('http://localhost/personas'), '127.0.0.1');
  assert.equal(broken.status, 503); assert.equal(await broken.text(), '{"error":"service-unavailable"}');
  console.log('Selfhost persona smoke passed: two clients, exact bytes, concurrent uploads, dedup, pause, restart, durable quotas, spoofed IPs, bounds, tamper and sanitized errors.');
} finally {
  if (runtime) await runtime.close();
  await rm(directory, { recursive: true, force: true });
}
