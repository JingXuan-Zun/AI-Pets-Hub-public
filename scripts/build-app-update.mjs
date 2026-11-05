// Publishing side of hot updates (see docs/hot-update-design-20261105.md).
//
// Full release (after electron-builder made the exe): record what is inside it, so later hot
// updates know which files changed, and list the full version:
//   node scripts/build-app-update.mjs --full --asar release/<dir>/win-unpacked/resources/app.asar --notes "…"
// Hot update (after `npm run build` for the new version): zip only the files that differ from the
// installed exe's, and list it:
//   node scripts/build-app-update.mjs --hot --base 0.4.0 --notes "…"
// Both rewrite release/app-update/latest.json, signed with the private key that stays outside
// the repositories (--key <path>, or the APP_UPDATE_SIGNING_KEY environment variable). Upload
// latest.json (+ the zip) to R2 under updates/ and to the GitHub release.
import asar from '@electron/asar';
import { createHash, createPrivateKey, sign } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { zipSync } from 'fflate';

const args = process.argv.slice(2);
const option = (name, fallback = '') => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : fallback;
};
const root = process.cwd();
const out = path.join(root, 'release', 'app-update');
const keyPath = option('key', process.env.APP_UPDATE_SIGNING_KEY ?? '');
const notes = option('notes').replace(/\\n/gu, '\n');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = pkg.version;
const REPO = 'https://github.com/JingXuan-Zun/AI-Pets-Hub-public';
const R2 = 'https://ai-desktop-pet-plugin-api.qianxuanlian.workers.dev/updates';
// The same folders electron-builder packs ("files" in package.json).
const INCLUDED = ['dist', 'electron', 'resources'];
const SKIPPED = /(?:^|\/)(?:__pycache__\/|[^/]*\.pyc$)/u;

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

function shellFingerprint(packageJson, electronVersion) {
  const dependencies = Object.entries(packageJson?.dependencies ?? {}).sort(([a], [b]) => a.localeCompare(b));
  return `${electronVersion}:${createHash('sha256').update(JSON.stringify(dependencies)).digest('hex').slice(0, 16)}`;
}
const electronVersion = JSON.parse(fs.readFileSync(path.join(root, 'node_modules', 'electron', 'package.json'), 'utf8')).version;

/** The app's files in this checkout, as packed into the exe: { 'dist/index.html': bytes }. */
function workingFiles() {
  const files = { 'package.json': fs.readFileSync(path.join(root, 'package.json')) };
  const walk = (folder) => {
    for (const entry of fs.readdirSync(path.join(root, folder), { withFileTypes: true })) {
      const relative = `${folder}/${entry.name}`;
      if (SKIPPED.test(entry.isDirectory() ? `${relative}/` : relative)) continue;
      if (entry.isDirectory()) walk(relative);
      else if (entry.isFile()) files[relative] = fs.readFileSync(path.join(root, relative));
    }
  };
  INCLUDED.filter((folder) => fs.existsSync(path.join(root, folder))).forEach(walk);
  return files;
}

/** What the exe holds: hashes of every file in its app.asar under the packed folders. */
function asarHashes(asarPath) {
  const hashes = {};
  for (const listed of asar.listPackage(asarPath, { isPack: false })) {
    const relative = listed.replace(/\\/gu, '/').replace(/^\//u, '');
    if (relative !== 'package.json' && !INCLUDED.some((folder) => relative.startsWith(`${folder}/`))) continue;
    let bytes;
    try {
      bytes = asar.extractFile(asarPath, relative.replace(/\//gu, path.sep));
    } catch {
      continue; // a folder
    }
    if (bytes) hashes[relative] = sha256(bytes);
  }
  return hashes;
}

function readCatalog() {
  try {
    return JSON.parse(fs.readFileSync(path.join(out, 'catalog.json'), 'utf8'));
  } catch {
    return { versions: [] };
  }
}

function publish(entry) {
  const catalog = readCatalog();
  catalog.versions = [...catalog.versions.filter((item) => item.version !== entry.version), entry];
  fs.writeFileSync(path.join(out, 'catalog.json'), `${JSON.stringify(catalog, null, 2)}\n`);
  // Every version goes out, so people can go back to one they liked better. Hot updates made for
  // an older installer are listed without their files (only that installer can take them): the
  // list stays small, and their page points at the installer they need.
  const newestFull = [...catalog.versions].filter((item) => item.kind === 'full').sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1))[0]?.version;
  const latest = [...catalog.versions]
    .sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1))
    .map((item) => (item.kind === 'hot' && item.base !== newestFull ? { base: item.base, kind: 'hot', notes: item.notes, page: `${REPO}/releases/tag/v${item.base}`, publishedAt: item.publishedAt, shell: item.shell, version: item.version } : item));
  const payload = JSON.stringify({ publishedAt: new Date().toISOString(), versions: latest });
  const signature = sign(null, Buffer.from(payload, 'utf8'), createPrivateKey(fs.readFileSync(keyPath))).toString('base64');
  fs.writeFileSync(path.join(out, 'latest.json'), `${JSON.stringify({ payload, signature })}\n`);
  console.log(`latest.json written (${latest.length} versions).`);
}

fs.mkdirSync(out, { recursive: true });
if (!keyPath || !fs.existsSync(keyPath)) throw new Error('Signing key not found: pass --key <path> or set APP_UPDATE_SIGNING_KEY (the key stays outside the repositories).');
const publishedAt = new Date().toISOString();

if (args.includes('--full')) {
  const asarPath = option('asar');
  if (!asarPath || !fs.existsSync(asarPath)) throw new Error('--full needs --asar <path to the built app.asar>');
  const hashes = asarHashes(asarPath);
  fs.writeFileSync(path.join(out, `files-${version}.json`), `${JSON.stringify({ electronVersion, files: hashes, shell: shellFingerprint(pkg, electronVersion), version }, null, 2)}\n`);
  console.log(`files-${version}.json: ${Object.keys(hashes).length} files in the exe.`);
  publish({ kind: 'full', notes, page: `${REPO}/releases/tag/v${version}`, publishedAt, version });
} else if (args.includes('--hot')) {
  const baseVersion = option('base');
  const base = JSON.parse(fs.readFileSync(path.join(out, `files-${baseVersion}.json`), 'utf8'));
  const shell = shellFingerprint(pkg, electronVersion);
  if (base.shell !== shell) throw new Error(`Electron or the dependencies changed since v${baseVersion} (${base.shell} → ${shell}): this needs a full release.`);
  const files = workingFiles();
  const hashes = Object.fromEntries(Object.entries(files).map(([relative, bytes]) => [relative, sha256(bytes)]));
  const changed = Object.fromEntries(Object.entries(files).filter(([relative]) => hashes[relative] !== base.files[relative]));
  const zip = zipSync(changed, { level: 9 });
  const name = `app-update-${version}.zip`;
  fs.writeFileSync(path.join(out, name), zip);
  console.log(`${name}: ${Object.keys(changed).length} of ${Object.keys(files).length} files changed, ${(zip.byteLength / 1024 / 1024).toFixed(2)} MB.`);
  publish({
    base: baseVersion,
    files: hashes,
    kind: 'hot',
    notes,
    publishedAt,
    shell,
    version,
    zip: { name, sha256: sha256(zip), size: zip.byteLength, urls: [`${R2}/${name}`, `${REPO}/releases/download/v${version}/${name}`] },
  });
} else if (args.includes('--history')) {
  // A full release from before hot updates existed, listed so its installer can be downloaded.
  const old = option('version');
  if (!old) throw new Error('--history needs --version <x.y.z> [--date YYYY-MM-DD] [--notes …]');
  publish({ kind: 'full', notes, page: `${REPO}/releases/tag/v${old}`, publishedAt: new Date(option('date', publishedAt)).toISOString(), version: old });
} else {
  console.log('Use --full --asar <app.asar>, --hot --base <version>, or --history --version <x.y.z>.');
  process.exit(1);
}
