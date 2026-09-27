import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createTestD1, createTestGithub } from './fixtures/persona-community-test-backends.mjs';
import { createPersonaCommunityWorker } from '../services/persona-community/worker.bundle.mjs';
import { createPersonaCommunityClient, personaCommunityErrorMessage } from '../src/persona-community/personaCommunityClient.ts';
import { readPersonaBody } from '../src/persona-community/personaCommunityBody.ts';
import { PERSONA_MAX_FILE_BYTES, personaFilename, personaSha256 } from '../src/persona-community/personaCommunitySchema.ts';

const database = createTestD1();
const github = createTestGithub();
const env = { GITHUB_TOKEN: 'test-only-token', RATE_DB: database.binding, RATE_SALT: 'test-only-salt', UPLOADS_ENABLED: 'true' };
let now = Date.parse('2026-09-05T00:00:00Z');
const worker = createPersonaCommunityWorker({ fetchImpl: github.fetchImpl, now: () => now });
const base = 'https://test-personas.example';
const checks: string[] = [];
function pass(name: string) { checks.push(name); console.log(`PASS ${name}`); }

async function call(path: string, init: RequestInit = {}, bindings = env, ip = '192.0.2.1') {
  const headers = new Headers(init.headers);
  headers.set('CF-Connecting-IP', ip);
  return worker.fetch(new Request(`${base}${path}`, { ...init, headers }), bindings);
}
async function upload(name: string, text: string | Uint8Array, ip = '192.0.2.1') {
  const body = new FormData();
  body.append('file', new File([text], name));
  return call('/personas', { method: 'POST', body, headers: { 'X-Persona-Upload': '1' } }, env, ip);
}
const clientTransport: typeof fetch = async (input, init) => {
  const request = new Request(input, init);
  request.headers.set('CF-Connecting-IP', '192.0.2.2');
  return worker.fetch(request, env);
};
const client = createPersonaCommunityClient({ apiUrl: base }, clientTransport);

try {
  assert.deepEqual(await (await call('/health', {}, {})).json(), { ok: true, configured: false, uploadsEnabled: false });
  assert.equal((await call('/personas', {}, {})).status, 503);
  assert.equal((await call('/personas', { method: 'POST' }, { ...env, UPLOADS_ENABLED: 'false' })).status, 503);
  assert.equal(github.requests.length, 0);
  pass('unconfigured or paused service performs no GitHub operations');

  const options = await call('/personas', { method: 'OPTIONS', headers: { Origin: 'null' } }, {});
  assert.equal(options.status, 204);
  assert.equal(options.headers.get('access-control-allow-origin'), '*');
  assert.ok(options.headers.get('access-control-allow-headers')?.includes('X-Persona-Upload'));
  assert.equal((await call('/personas', { method: 'DELETE' })).status, 405);
  assert.equal((await call('/personas/../v1/publishers.json')).status, 404);
  pass('desktop CORS preflight and restricted routes');

  const originalFiles = new Map(github.currentFiles());
  const text = '\uFEFF友善的人格\r\n保留换行与原始内容。\r\n';
  const first = await client.upload(new File([text], '我的人格.txt'));
  assert.equal(first.filename, '我的人格.txt');
  const otherUser = createPersonaCommunityClient({ apiUrl: base }, clientTransport);
  assert.equal((await otherUser.list())[0].id, first.id);
  const saved = await otherUser.download(first);
  assert.equal(saved.filename, '我的人格.txt');
  assert.deepEqual(new Uint8Array(await saved.blob.arrayBuffer()), new TextEncoder().encode(text));
  const response = await call(`/personas/${first.id}/download`);
  assert.match(response.headers.get('content-disposition')!, /^attachment;/);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  for (const path of ['v1/publishers.json', 'README.md']) assert.deepEqual(github.currentFiles().get(path), originalFiles.get(path));
  pass('client upload → second client list → byte-exact download; existing v1 preserved');

  const duplicate = await client.upload(new File([text], '另一个文件名.txt'));
  assert.equal(duplicate.id, first.id);
  assert.equal(github.currentCatalog().items.length, 1);
  assert.equal(github.events.length, 1);
  pass('retry of identical file creates no duplicate commit');

  now += 60000;
  const markdown = await client.upload(new File(['# 人格\n理性、温和。'], '理性.MD'));
  const json = await client.upload(new File(['{"性格":"温和"}'], '人格.json'));
  assert.equal(markdown.format, 'md'); assert.equal(json.format, 'json');
  assert.equal(markdown.filename, '理性.md');
  assert.equal(github.currentCatalog().items.length, 3);
  pass('TXT, MD and arbitrary valid JSON need no persona-specific schema');

  now += 60000;
  const beforeInvalid = github.requests.length;
  for (const [name, content] of [['a.exe', 'binary'], ['a.txt', ''], ['a.json', '{bad'], ['a.txt', '\u0000']] as const) {
    assert.equal((await upload(name, content)).status, 400);
  }
  assert.equal((await upload('a.txt', new Uint8Array([0xff, 0xfe, 0x41]))).status, 400);
  assert.equal(github.requests.length, beforeInvalid);
  now += 60000;
  assert.equal((await upload('large.txt', 'a'.repeat(PERSONA_MAX_FILE_BYTES + 17000))).status, 413);
  assert.equal(github.requests.length, beforeInvalid);
  pass('invalid type/JSON/encoding/binary/empty/oversized uploads never reach GitHub');

  assert.equal(personaFilename('../../CON.txt'), '_CON.txt');
  assert.equal(personaFilename('bad\r\nname.txt'), 'bad__name.txt');
  assert.equal(personaFilename('evil.exe.txt'), 'evil.exe.txt');
  const beforeBadTransport = github.requests.length;
  const multi = new FormData(); multi.append('file', new File(['a'], 'a.txt')); multi.append('repo', 'other/repo');
  assert.equal((await call('/personas', { method: 'POST', body: multi, headers: { 'X-Persona-Upload': '1' } })).status, 400);
  assert.equal(github.requests.length, beforeBadTransport);
  pass('safe filenames and caller cannot select another repository or path');

  now += 60000;
  const concurrentBytes = new TextEncoder().encode('concurrent upload');
  const sha256 = await personaSha256(concurrentBytes);
  const otherEntry = { id: await personaSha256(new TextEncoder().encode(`txt:${sha256}`)), sha256,
    filename: 'concurrent.txt', title: 'concurrent', format: 'txt', sizeBytes: concurrentBytes.length, createdAt: new Date(now).toISOString() };
  github.controls.concurrent = { entry: otherEntry, bytes: concurrentBytes };
  const concurrent = await client.upload(new File(['another upload'], 'mine.txt'));
  assert.ok(github.currentCatalog().items.some((item) => item.id === otherEntry.id));
  assert.ok(github.currentCatalog().items.some((item) => item.id === concurrent.id));
  assert.equal(github.currentCatalog().items.length, 5);
  pass('non-fast-forward conflict retries preserve concurrent submissions');

  now += 60000;
  const savedCatalog = JSON.stringify(github.currentCatalog());
  github.controls.failPatch = true;
  assert.equal((await upload('rejected.txt', 'cannot commit')).status, 503);
  assert.equal(JSON.stringify(github.currentCatalog()), savedCatalog);
  github.controls.failPatch = false;
  github.controls.alwaysConflict = true;
  const conflictCount = github.requests.length;
  assert.equal((await upload('conflict.txt', 'conflict')).status, 409);
  assert.equal(github.requests.slice(conflictCount).filter((item) => item.method === 'PATCH').length, 3);
  github.controls.alwaysConflict = false;
  assert.equal(JSON.stringify(github.currentCatalog()), savedCatalog);
  pass('failed ref update leaves published files/catalog intact; retries bounded');

  now += 60000;
  github.controls.readCatalog = '{malformed';
  assert.equal((await upload('must-not-reset.txt', 'x')).status, 503);
  assert.equal(JSON.stringify(github.currentCatalog()), savedCatalog);
  github.controls.readCatalog = null;
  github.controls.tamperDownload = true;
  assert.equal((await call(`/personas/${first.id}/download`)).status, 502);
  github.controls.tamperDownload = false;
  pass('corrupt catalog never reset; damaged files are not downloaded');

  github.controls.fail = true;
  const safeFailure = await call('/personas');
  assert.deepEqual(await safeFailure.json(), { error: 'service-unavailable' });
  assert.equal(personaCommunityErrorMessage(new Error('test-only-token STACK'), 'safe fallback'), 'safe fallback');
  github.controls.fail = false;
  pass('upstream errors and secrets are absent from client-visible responses');

  now += 60000;
  for (let index = 0; index < 5; index++) assert.equal((await upload('bad.exe', 'bad', '192.0.2.90')).status, 400);
  const requestsBeforeRate = github.requests.length;
  const limited = await upload('ok.txt', 'valid', '192.0.2.90');
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('retry-after'), '60');
  assert.equal(github.requests.length, requestsBeforeRate);
  assert.ok(database.sqlite.prepare('SELECT bucket FROM persona_request_limits').all().every((row) => !String(row.bucket).includes('192.0.2')));
  now += 60000;
  assert.equal((await upload('ok.txt', 'valid', '192.0.2.90')).status, 201);
  pass('real SQLite quota caps work and expire without storing raw IP addresses');

  now += 60000;
  const noIp = await worker.fetch(new Request(`${base}/personas`), env);
  assert.equal(noIp.status, 403);
  const brokenDb = { ...env, RATE_DB: { batch: async () => { throw new Error('SQL credentials and stack'); }, prepare: database.binding.prepare } };
  assert.equal((await call('/personas', {}, brokenDb)).status, 503);
  const malformedDb = { ...env, RATE_DB: { batch: async () => [], prepare: database.binding.prepare } };
  assert.equal((await call('/personas', {}, malformedDb)).status, 503);
  pass('missing platform IP or failed/malformed quota database blocks requests');

  now += 60000;
  for (let index = 0; index < 10; index++) {
    assert.equal((await upload('bad.exe', 'bad', `192.0.2.${index + 100}`)).status, 400);
  }
  assert.equal((await upload('valid.txt', 'valid request', '192.0.2.201')).status, 429);
  pass('global quota blocks rotating-IP bursts');

  now += 60000;
  const maxFile = new File(['a'.repeat(PERSONA_MAX_FILE_BYTES)], 'maximum.txt');
  const maxEntry = await client.upload(maxFile);
  const maxDownload = await client.download(maxEntry);
  assert.equal(maxDownload.blob.size, PERSONA_MAX_FILE_BYTES);
  assert.equal(await personaSha256(new Uint8Array(await maxDownload.blob.arrayBuffer())), maxEntry.sha256);
  pass('full 2 MiB file survives upload, base64 storage, and download');

  const malformedClient = createPersonaCommunityClient({ apiUrl: base }, async () => Response.json({ items: [{ id: '../wrong' }] }));
  await assert.rejects(() => malformedClient.list(), /catalog-invalid/);
  const tamperedClient = createPersonaCommunityClient({ apiUrl: base }, async () => new Response('changed'));
  await assert.rejects(() => tamperedClient.download(first), /download-invalid/);
  pass('client rejects malformed directory and tampered download');

  await assert.rejects(() => readPersonaBody(new Response('too large'), 2), /response-size/);
  await assert.rejects(() => readPersonaBody(new Response(new ReadableStream({ start() {} })), 100, 5), /response-timeout/);
  const rejectTransport: typeof fetch = async () => { throw new Error('must not fetch'); };
  const invalidClient = createPersonaCommunityClient({ apiUrl: 'http://unsafe.example' }, rejectTransport);
  await assert.rejects(() => invalidClient.list(), /api-url-invalid/);
  await assert.rejects(() => client.upload(new File(['bad'], 'invalid.exe')), /file-format/);
  const abort = new AbortController(); abort.abort();
  await assert.rejects(() => client.upload(new File(['valid'], 'a.txt'), abort.signal));
  pass('response bounds/deadline, secure endpoint validation and cancellation');

  const bundle = readFileSync(new URL('../services/persona-community/worker.bundle.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(bundle, /test-only-token|test-only-salt|from ['"]\.\.?\//);
  pass('dashboard deployment bundle has no local imports or embedded credentials');
  console.log(`Persona community service: ${checks.length} checks passed (local; no public writes).`);
} finally { database.close(); }
