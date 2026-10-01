import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { X509Certificate } from 'node:crypto';
import https from 'node:https';
import { unzipSync } from 'fflate';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const directory = await mkdtemp(join(tmpdir(), 'pet-selfhost-windows-'));
let runtime;
async function httpsCall(url, ca, options = {}, body) {
  return new Promise((done, reject) => {
    const request = https.request(url, { ca, ...options }, (response) => {
      const chunks = []; response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => done({ status: response.statusCode, body: Buffer.concat(chunks) }));
      response.on('error', reject);
    });
    request.on('error', reject); request.setTimeout(5000, () => request.destroy(new Error('deadline')));
    request.end(body);
  });
}
try {
  const archive = unzipSync(await readFile(join(root, 'release/persona-community-selfhost.zip')));
  assert.ok(Object.keys(archive).every((name) => name.startsWith('persona-community-selfhost/')));
  assert.ok(!Object.keys(archive).some((name) => /(?:\.pfx|\.sqlite|password\.txt|server\.config\.json)$/.test(name)));
  for (const name of ['server.mjs', 'Setup-LanHttps.ps1', 'server.config.example.json']) {
    await writeFile(join(directory, name), archive[`persona-community-selfhost/${name}`]);
  }
  if (process.platform !== 'win32') throw new Error('Run this Windows certificate probe on Windows.');
  execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File',
    join(directory, 'Setup-LanHttps.ps1'), '-Address', '192.168.1.20'], { timeout: 30000, stdio: 'pipe' });
  const certificate = new X509Certificate(await readFile(join(directory, 'lan-server.cer')));
  const ca = certificate.toString();
  assert.equal(certificate.checkIP('127.0.0.1'), '127.0.0.1');
  assert.equal(certificate.checkIP('192.168.1.20'), '192.168.1.20');
  assert.equal(certificate.checkHost('localhost'), 'localhost');
  const config = JSON.parse(await readFile(join(directory, 'server.config.json'), 'utf8'));
  const { startPersonaServer } = await import(pathToFileURL(join(directory, 'server.mjs')));
  runtime = await startPersonaServer({ databasePath: join(directory, 'data/personas.sqlite'), host: '127.0.0.1', port: 0,
    uploadsEnabled: config.uploadsEnabled,
    tls: { pfx: await readFile(join(directory, config.tls.pfx)),
      passphrase: (await readFile(join(directory, config.tls.passwordFile), 'utf8')).trim() },
  });
  await assert.rejects(() => httpsCall(runtime.url + '/health'), /self.signed|certificate/i);
  const health = await httpsCall(runtime.url + '/health', ca);
  assert.equal(health.status, 200); assert.equal(JSON.parse(health.body).uploadsEnabled, true);
  const request = new Request(runtime.url + '/personas', { method: 'POST', headers: { 'X-Persona-Upload': '1' },
    body: (() => { const form = new FormData(); form.append('file', new File(['public HTTPS probe'], 'https.txt')); return form; })() });
  const uploaded = await httpsCall(runtime.url + '/personas', ca, { method: 'POST', headers: Object.fromEntries(request.headers) },
    Buffer.from(await request.arrayBuffer()));
  assert.equal(uploaded.status, 201);
  const entry = JSON.parse(uploaded.body);
  const download = await httpsCall(runtime.url + `/personas/${entry.id}/download`, ca);
  assert.equal(download.status, 200); assert.equal(download.body.toString(), 'public HTTPS probe');
  await writeFile(join(directory, 'parse-script.ps1'), 'param([string]$Target)\n$errors=$null; [System.Management.Automation.Language.Parser]::ParseFile($Target,[ref]$null,[ref]$errors) | Out-Null; if($errors.Count){exit 1}');
  execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(directory, 'parse-script.ps1'), '-Target',
    join(root, 'services/persona-community-selfhost/windows/Trust-LanCertificate.ps1')], { timeout: 10000 });
  console.log('Windows deployment ZIP and real HTTPS/PFX smoke passed; no root trust installed.');
} finally {
  if (runtime) await runtime.close();
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + '\\') || resolve(directory).startsWith(resolve(tmpdir()) + '/'));
  await rm(directory, { recursive: true, force: true });
}
