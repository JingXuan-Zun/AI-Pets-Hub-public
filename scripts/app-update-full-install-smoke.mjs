// Full versions installed from inside the app (2026-11-18): the release script lists the exe,
// the app downloads it next to the exe the user keeps (checked against the signed list), a
// restart starts the new exe, and the new exe removes the old one.
import asar from '@electron/asar';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { createAppUpdateService } = require(path.join(project, 'electron', 'appUpdateService.cjs'));
const { finishFullInstall } = require(path.join(project, 'electron', 'appUpdateFullInstall.cjs'));
const { readState, writeState } = require(path.join(project, 'electron', 'appUpdateShell.cjs'));

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'app-update-full-'));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const electronVersion = process.versions.electron ?? '45.0.0';
let checks = 0;
const check = (...args) => { assert.ok(...args); checks += 1; };
const same = (...args) => { assert.equal(...args); checks += 1; };

try {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const publicPem = publicKey.export({ format: 'pem', type: 'spki' });

  // The release script lists the exe when given --exe.
  const checkout = path.join(work, 'checkout');
  const appSrc = path.join(checkout, 'app');
  fs.mkdirSync(path.join(appSrc, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(appSrc, 'dist', 'index.html'), '<html>0.4.4</html>');
  fs.writeFileSync(path.join(appSrc, 'package.json'), JSON.stringify({ name: 'pet', version: '0.4.4' }));
  fs.copyFileSync(path.join(appSrc, 'package.json'), path.join(checkout, 'package.json'));
  fs.mkdirSync(path.join(checkout, 'node_modules', 'electron'), { recursive: true });
  fs.writeFileSync(path.join(checkout, 'node_modules', 'electron', 'package.json'), JSON.stringify({ version: electronVersion }));
  const asarPath = path.join(work, 'app.asar');
  await asar.createPackage(appSrc, asarPath);
  const newExeBytes = Buffer.from('MZ new exe 0.4.4 '.repeat(5000));
  const builtExe = path.join(work, 'AI-Desktop-Pet-0.4.4.exe');
  fs.writeFileSync(builtExe, newExeBytes);
  const keyPath = path.join(work, 'key.pem');
  fs.writeFileSync(keyPath, privateKey.export({ format: 'pem', type: 'pkcs8' }));
  execFileSync(process.execPath, [path.join(project, 'scripts', 'build-app-update.mjs'), '--full', '--asar', asarPath, '--exe', builtExe, '--notes', '新安装包', '--key', keyPath], { cwd: checkout, encoding: 'utf8' });
  const built = JSON.parse(JSON.parse(fs.readFileSync(path.join(checkout, 'release', 'app-update', 'latest.json'), 'utf8')).payload).versions[0];
  same(built.exe.sha256, sha256(newExeBytes), 'the list carries the exe checksum');
  same(built.exe.size, newExeBytes.byteLength, 'and its size');
  check(built.exe.urls[0].endsWith('/updates/AI-Desktop-Pet-0.4.4.exe') && built.exe.urls[1].endsWith('/releases/download/v0.4.4/AI-Desktop-Pet-0.4.4.exe'), 'R2 first, GitHub second');

  // The installed 0.4.3: its exe in the user's folder, its code, a signed list with 0.4.4.
  const petFolder = path.join(work, 'my pet');
  fs.mkdirSync(petFolder);
  const oldExe = path.join(petFolder, 'AI-Desktop-Pet-0.4.3.exe');
  fs.writeFileSync(oldExe, 'MZ old exe 0.4.3');
  const appDir = path.join(work, 'installed-app');
  fs.mkdirSync(appDir);
  fs.writeFileSync(path.join(appDir, 'package.json'), JSON.stringify({ name: 'pet', version: '0.4.3' }));
  const exeEntry = { ...built.exe, urls: ['mem://exe-r2', 'mem://exe-github'] };
  const listFor = (exe) => {
    const payload = JSON.stringify({ versions: [{ exe, kind: 'full', notes: '新安装包', page: 'https://example.com/v0.4.4', version: '0.4.4' }, { kind: 'full', version: '0.4.3' }] });
    return { payload, signature: sign(null, Buffer.from(payload), privateKey).toString('base64') };
  };
  let list = listFor(exeEntry);
  let r2Bytes = Buffer.from('broken mirror');
  const fetchImpl = async (url) => {
    if (url === 'mem://latest') return { json: async () => list, ok: true, status: 200 };
    if (url === 'mem://exe-r2') return new Response(r2Bytes);
    if (url === 'mem://exe-github') return new Response(newExeBytes);
    return { ok: false, status: 404 };
  };
  const userData = path.join(work, 'user-data');
  const root = path.join(userData, 'app-updates');
  globalThis.__appUpdateBoot = { builtIn: true, version: '0.4.3' };
  const make = (portableExe) => createAppUpdateService({ app: { getAppPath: () => appDir, getPath: () => userData, getVersion: () => '0.4.3' }, electronVersion, fetchImpl, portableExe, publicKey: publicPem, sources: ['mem://latest'] });

  same((await make(null).check()).versions[0].action, 'full', 'the dev app (no exe of its own) still opens the release page');
  const service = make(oldExe);
  const listed = await service.check();
  same(listed.versions[0].action, 'install', 'the portable build downloads it itself');
  same(listed.versions[0].size, newExeBytes.byteLength, 'with its size shown');

  // A mirror serving something else is skipped; the next address is used.
  const done = await service.download('0.4.4');
  same(done.ok, true, 'downloaded and checked');
  const newExe = path.join(petFolder, 'AI-Desktop-Pet-0.4.4.exe');
  check(fs.readFileSync(newExe).equals(newExeBytes), 'the new exe sits next to the old one');
  check(!fs.readdirSync(petFolder).some((name) => name.endsWith('.download')), 'no half-downloaded file left');
  same(fs.readFileSync(oldExe, 'utf8'), 'MZ old exe 0.4.3', 'the running exe is not touched');
  same(service.status().pending, '0.4.4', 'a restart switches to it');
  same(service.status().versions[0].action, 'pending', 'shown as waiting for a restart');

  // "不换了" removes the downloaded exe; a broken download on every address is refused.
  service.stay();
  check(!fs.existsSync(newExe) && !readState(root).fullInstall, '"不换了" removes the new exe');
  r2Bytes = Buffer.from('broken');
  list = listFor({ ...exeEntry, urls: ['mem://exe-r2'] });
  await service.check();
  same((await service.download('0.4.4')).ok, false, 'a download that does not match is refused');
  check(!fs.existsSync(newExe) && !readState(root).fullInstall, 'and nothing is kept');
  list = listFor(exeEntry);
  await service.check();
  same((await service.download('0.4.4')).ok, true, 'downloads again');

  // Restart: the new exe is the one to start; hot updates of the old exe are left behind.
  writeState(root, { ...readState(root), active: '0.4.2', pending: null });
  same(service.restartTarget(), newExe, 'restart starts the new exe');
  same(readState(root).active, null, 'hot updates of the old exe are dropped');

  // The new exe's first start removes the old exe (only the one the old app wrote down).
  finishFullInstall({ portableExe: oldExe, readState, root, writeState, retries: 0 });
  check(fs.existsSync(oldExe), 'the old exe started again does not delete itself');
  finishFullInstall({ portableExe: newExe, readState, root, writeState, retries: 0 });
  check(!fs.existsSync(oldExe), 'the new exe removes the old one');
  check(!readState(root).fullInstall, 'install finished');

  // Same file name as the running exe: the new one gets the version in its name.
  fs.writeFileSync(oldExe, 'MZ old exe 0.4.3');
  list = listFor({ ...exeEntry, name: 'AI-Desktop-Pet-0.4.3.exe' });
  const clash = make(oldExe);
  await clash.check();
  same((await clash.download('0.4.4')).ok, true, 'a name clash still installs');
  check(fs.existsSync(path.join(petFolder, 'AI-Desktop-Pet-0.4.3 (v0.4.4).exe')) && fs.readFileSync(oldExe, 'utf8') === 'MZ old exe 0.4.3', 'without overwriting the running exe');

  console.log(`app update full install smoke ok: ${checks} checks`);
} finally {
  fs.rmSync(work, { force: true, recursive: true });
}
