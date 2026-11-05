// Hot updates end to end, without packaging: a fake "installed exe" (app.asar of v0.4.0), a full
// release recorded from it, a v0.4.1 hot update built from changed files, and the app side
// checking the signed list, downloading only the changes and putting v0.4.1 together.
import asar from '@electron/asar';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { createAppUpdateService, verifyCatalog } = require(path.join(project, 'electron', 'appUpdateService.cjs'));
const { checkVersionFolder, readState } = require(path.join(project, 'electron', 'appUpdateShell.cjs'));

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'app-update-smoke-'));
const checkout = path.join(work, 'checkout');
const write = (relative, text) => {
  fs.mkdirSync(path.dirname(path.join(checkout, relative)), { recursive: true });
  fs.writeFileSync(path.join(checkout, relative), text);
};
const pkg = (version) => JSON.stringify({ dependencies: { fflate: '^0.8.2' }, main: 'electron/bootstrap.cjs', name: 'pet', version });
const electronVersion = process.versions.electron ?? '37.0.0';

try {
  // v0.4.0 as built.
  write('package.json', pkg('0.4.0'));
  write('node_modules/electron/package.json', JSON.stringify({ version: electronVersion }));
  write('dist/index.html', '<html>0.4.0</html>');
  write('dist/assets/big-model.bin', 'unchanged asset '.repeat(1000));
  write('electron/main.cjs', '// main 0.4.0');
  write('electron/preload.cjs', '// preload');
  write('resources/readme.txt', 'resources');
  const appDir = path.join(work, 'app-src');
  fs.mkdirSync(appDir);
  for (const item of ['package.json', 'dist', 'electron', 'resources']) fs.cpSync(path.join(checkout, item), path.join(appDir, item), { recursive: true });
  const asarPath = path.join(work, 'app.asar');
  await asar.createPackage(appDir, asarPath);

  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const keyPath = path.join(work, 'key.pem');
  fs.writeFileSync(keyPath, privateKey.export({ format: 'pem', type: 'pkcs8' }));
  const run = (...args) => execFileSync(process.execPath, [path.join(project, 'scripts', 'build-app-update.mjs'), ...args, '--key', keyPath], { cwd: checkout, encoding: 'utf8' });

  // A release from before hot updates, listed so its installer can still be fetched.
  run('--history', '--version', '0.3.3', '--date', '2026-10-28', '--notes', '旧版');
  run('--full', '--asar', asarPath, '--notes', '完整版');
  // v0.4.1: one page and the main process changed, the big asset did not.
  write('package.json', pkg('0.4.1'));
  write('dist/index.html', '<html>0.4.1</html>');
  write('electron/main.cjs', '// main 0.4.1');
  const hotLog = run('--hot', '--base', '0.4.0', '--notes', '修好了一些问题');
  assert.match(hotLog, /3 of 6 files changed/u, 'only the changed files are zipped');

  const out = path.join(checkout, 'release', 'app-update');
  const latest = JSON.parse(fs.readFileSync(path.join(out, 'latest.json'), 'utf8'));
  const publicPem = publicKey.export({ format: 'pem', type: 'spki' });
  assert.ok(verifyCatalog(latest, publicPem), 'the list is signed');
  assert.equal(verifyCatalog({ ...latest, payload: latest.payload.replace('修好了', '换掉了') }, publicPem), null, 'a changed list is refused');

  // The installed app: the exe's code in app.asar, user data elsewhere.
  const userData = path.join(work, 'user-data');
  const zipBytes = fs.readFileSync(path.join(out, 'app-update-0.4.1.zip'));
  let served = zipBytes;
  const fakeFetch = async (url) => {
    if (url === 'mem://latest') return { json: async () => latest, ok: true, status: 200 };
    if (url.endsWith('app-update-0.4.1.zip')) return { arrayBuffer: async () => served.buffer.slice(served.byteOffset, served.byteOffset + served.byteLength), ok: true, status: 200 };
    return { ok: false, status: 404 };
  };
  globalThis.__appUpdateBoot = { builtIn: true, version: '0.4.0' };
  const fakeApp = { getAppPath: () => asarPath, getPath: () => userData, getVersion: () => '0.4.0' };
  // Reading inside app.asar needs Electron; outside it, read the same files from the folder.
  const service = createAppUpdateService({ app: { ...fakeApp, getAppPath: () => appDir }, electronVersion, fetchImpl: fakeFetch, publicKey: publicPem, sources: ['mem://latest'] });

  const listed = await service.check();
  assert.deepEqual(listed.versions.map((item) => [item.version, item.kind, item.action]), [['0.4.1', 'hot', 'download'], ['0.4.0', 'full', 'current'], ['0.3.3', 'full', 'full']], 'every version, with what can be done');
  assert.match(listed.versions[2].page, /releases\/tag\/v0\.3\.3$/u, 'an old installer to download');

  // A download that does not match the list is not used.
  served = Buffer.from('not the zip');
  const tampered = await service.download('0.4.1');
  assert.equal(tampered.ok, false, 'a changed download is refused');
  assert.equal(readState(path.join(userData, 'app-updates')).pending, undefined);

  served = zipBytes;
  const done = await service.download('0.4.1');
  assert.equal(done.ok, true, 'downloaded and put together');
  const folder = path.join(userData, 'app-updates', 'v0.4.1');
  assert.equal(fs.readFileSync(path.join(folder, 'dist', 'index.html'), 'utf8'), '<html>0.4.1</html>', 'changed file from the zip');
  assert.equal(fs.readFileSync(path.join(folder, 'dist', 'assets', 'big-model.bin'), 'utf8'), 'unchanged asset '.repeat(1000), 'unchanged file from the exe');
  assert.equal(readState(path.join(userData, 'app-updates')).pending, '0.4.1', 'runs from the next launch');
  assert.equal(checkVersionFolder(folder, { builtInPackage: JSON.parse(pkg('0.4.0')), electronVersion, version: '0.4.1' }), null, 'the boot loader would accept it');
  assert.equal(checkVersionFolder(folder, { builtInPackage: { ...JSON.parse(pkg('0.4.0')), dependencies: { other: '1' } }, electronVersion, version: '0.4.1' }), 'other-shell', 'not on an exe with other dependencies');
  assert.equal((await service.status()).versions[0].action, 'pending', 'shown as waiting for a restart');

  // Running 0.4.1: going back to the installer's 0.4.0, and forward again without a new download.
  fs.writeFileSync(path.join(userData, 'app-updates', 'state.json'), JSON.stringify({ active: '0.4.1', good: '0.4.1' }));
  globalThis.__appUpdateBoot = { builtIn: false, version: '0.4.1' };
  const running = createAppUpdateService({ app: { ...fakeApp, getAppPath: () => appDir }, electronVersion, fetchImpl: fakeFetch, publicKey: publicPem, sources: ['mem://latest'] });
  const now = await running.check();
  assert.deepEqual(now.versions.map((item) => item.action), ['current', 'builtin', 'full'], 'the installer version can be gone back to');
  running.revert();
  assert.equal(running.status().pending, '0.4.0', 'a restart goes back to 0.4.0');
  assert.equal(running.stay().pending, null, '"不换了" keeps 0.4.1');
  served = Buffer.from('must not be downloaded again');
  running.revert();
  globalThis.__appUpdateBoot = { builtIn: true, version: '0.4.0' };
  const back = createAppUpdateService({ app: { ...fakeApp, getAppPath: () => appDir }, electronVersion, fetchImpl: fakeFetch, publicKey: publicPem, sources: ['mem://latest'] });
  await back.check();
  assert.equal((await back.download('0.4.1')).ok, true, 'a version used before comes back without downloading');
  served = zipBytes;

  // An exe of another version cannot take this update.
  globalThis.__appUpdateBoot = { builtIn: true, version: '0.3.9' };
  const older = createAppUpdateService({ app: { ...fakeApp, getAppPath: () => {
    const otherDir = path.join(work, 'other-app');
    if (!fs.existsSync(otherDir)) { fs.cpSync(appDir, otherDir, { recursive: true }); fs.writeFileSync(path.join(otherDir, 'package.json'), pkg('0.3.9')); }
    return otherDir;
  }, getPath: () => path.join(work, 'user-data-2') }, electronVersion, fetchImpl: fakeFetch, publicKey: publicPem, sources: ['mem://latest'] });
  assert.equal((await older.check()).versions.find((item) => item.version === '0.4.1').action, 'needs-full', 'made for another exe → full download');

  console.log('app update smoke ok: 18 checks');
} finally {
  fs.rmSync(work, { force: true, recursive: true });
}
