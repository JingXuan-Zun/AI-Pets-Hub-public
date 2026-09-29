import { copyFile, cp, lstat, mkdir, readFile, readdir, rm, stat, utimes, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  collectPackagingBaseline,
  comparePackagingBaseline,
  findRunningBuildProcesses,
  findSharedDirectoryIssues,
  getStoredBaselineLines,
} from './dist-win-package-guards.mjs';
import {
  assertMarketplaceProductionPackagingMode,
  loadMarketplaceProductionPackagingConfig,
} from './marketplace-production-packaging-config.mjs';

const projectRoot = process.cwd();
const releaseRoot = path.join(projectRoot, 'release');
const latestInfoPath = path.join(releaseRoot, 'LATEST_BUILD.txt');
const stagingRoot = path.join(releaseRoot, '.incremental-app');
const stagingAppDir = path.join(stagingRoot, 'app');
const stagingAsarPath = path.join(stagingRoot, 'app.asar');
const isDryRun = process.argv.includes('--dry-run');
const isForced = process.argv.includes('--force');

function createBuildStamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

const {
  createPackage,
  extractAll,
  extractFile,
  listPackage,
} = await import('@electron/asar');
const { copyUnityRuntimeIfPresent } = await import('./unity-runtime-assets.mjs');
const marketplaceProductionConfig = await loadMarketplaceProductionPackagingConfig();

async function pathExists(targetPath) {
  try {
    await lstat(targetPath);
    return true;
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return false;
    }

    throw error;
  }
}

async function readLatestBuildInfo() {
  if (!await pathExists(latestInfoPath)) {
    throw new Error('No release/LATEST_BUILD.txt found. Run npm run dist:win:fresh once before incremental packaging.');
  }

  const info = new Map();
  const sharedDirectoryLines = [];
  const content = await readFile(latestInfoPath, 'utf8');
  for (const line of content.split(/\r?\n/u)) {
    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex);
    const value = line.slice(separatorIndex + 1);
    if (key === 'shared_dir') {
      sharedDirectoryLines.push(line);
      continue;
    }

    info.set(key, value);
  }

  const latestBuild = info.get('latest_build');
  if (!latestBuild) {
    throw new Error('release/LATEST_BUILD.txt does not contain latest_build. Run npm run dist:win:fresh to regenerate it.');
  }

  return { latestBuild, info, sharedDirectoryLines };
}

async function copyDirectoryContents(sourceDir, targetDir) {
  await rm(targetDir, { recursive: true, force: true });
  await mkdir(path.dirname(targetDir), { recursive: true });
  await cp(sourceDir, targetDir, {
    force: true,
    recursive: true,
  });
  await assertDirectoryReadable(targetDir);
}

async function collectFileManifest(rootDir, currentDir = rootDir, result = new Map()) {
  const entries = await readdir(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      await collectFileManifest(rootDir, entryPath, result);
      continue;
    }
    if (entry.isFile()) {
      const stat = await lstat(entryPath);
      result.set(path.relative(rootDir, entryPath).replaceAll('\\', '/'), stat.size);
    }
  }
  return result;
}

async function assertDirectoryMirror(sourceDir, targetDir) {
  const sourceManifest = await collectFileManifest(sourceDir);
  const targetManifest = await collectFileManifest(targetDir);
  const issues = [];
  for (const [relativePath, sourceSize] of sourceManifest) {
    const targetSize = targetManifest.get(relativePath);
    if (targetSize === undefined) issues.push(`missing ${relativePath}`);
    else if (targetSize !== sourceSize) issues.push(`size mismatch ${relativePath}`);
  }
  for (const relativePath of targetManifest.keys()) {
    if (!sourceManifest.has(relativePath)) issues.push(`unexpected ${relativePath}`);
  }
  if (issues.length) {
    throw new Error(`Directory mirror validation failed: ${issues.slice(0, 12).join(', ')}`);
  }
  return sourceManifest;
}

async function copyElectronSourcesWithRetry() {
  const sourceDir = path.join(projectRoot, 'electron');
  const targetDir = path.join(stagingAppDir, 'electron');
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await copyDirectoryContents(sourceDir, targetDir);
      return await assertDirectoryMirror(sourceDir, targetDir);
    } catch (error) {
      if (attempt >= 3) throw error;
      console.warn(`Electron source copy was incomplete (attempt ${attempt}/3); retrying in 1 second.`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  throw new Error('Electron source copy is incomplete after 3 attempts.');
}

async function rendererDistReady(distDir) {
  return await pathExists(path.join(distDir, 'index.html'))
    && await pathExists(path.join(distDir, 'assets'));
}

async function waitForRendererDistReady(distDir, attempts = 20) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (await rendererDistReady(distDir)) return true;
    if (attempt < attempts) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  return false;
}

async function copyRendererDistWithRetry() {
  const sourceDir = path.join(projectRoot, 'dist');
  const targetDir = path.join(stagingAppDir, 'dist');
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    if (await rendererDistReady(sourceDir)) {
      await copyDirectoryContents(sourceDir, targetDir);
      if (await waitForRendererDistReady(targetDir)) return;
    }
    if (attempt < 3) {
      console.warn(`Renderer dist copy was incomplete (attempt ${attempt}/3); retrying in 1 second.`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  throw new Error('Renderer dist is incomplete after 3 copy attempts; expected index.html and assets.');
}

async function assertDirectoryReadable(targetPath) {
  const stat = await lstat(targetPath);
  if (stat.isDirectory()) {
    const entries = await readdir(targetPath);
    for (const entry of entries) {
      await assertDirectoryReadable(path.join(targetPath, entry));
    }
  }
}

async function copyMissingRendererPublicRootReferences() {
  const distDir = path.join(stagingAppDir, 'dist');
  const indexPath = path.join(distDir, 'index.html');
  if (!await pathExists(indexPath)) {
    return;
  }

  const indexHtml = await readFile(indexPath, 'utf8');
  const referencePattern = /(?:src|href)="\.\/([^"?#]+)(?:[?#][^"]*)?"/gu;
  let match = referencePattern.exec(indexHtml);
  while (match) {
    const relativePath = match[1]?.replaceAll('\\', '/') ?? '';
    const isRootReference = relativePath
      && !relativePath.includes('/')
      && !relativePath.startsWith('.')
      && !path.isAbsolute(relativePath);

    if (isRootReference) {
      const targetPath = path.join(distDir, relativePath);
      const sourcePath = path.join(projectRoot, 'public', relativePath);
      if (!await pathExists(targetPath) && await pathExists(sourcePath)) {
        await copyFile(sourcePath, targetPath);
        console.log(`Copied missing renderer public asset: ${relativePath}`);
      }
    }

    match = referencePattern.exec(indexHtml);
  }
}

async function ensureRequiredSource(name) {
  const sourcePath = path.join(projectRoot, name);
  if (!await pathExists(sourcePath)) {
    throw new Error(`Missing ${name}. Run npm run build first or use npm run dist:win.`);
  }

  return sourcePath;
}

async function assertPackagedRendererEntrypoint(asarPath) {
  const normalizeAsarPath = (entryPath) => entryPath.replace(/^[\\/]+/u, '').replaceAll('\\', '/');
  const packagedFiles = new Set(listPackage(asarPath).map(normalizeAsarPath));
  const indexPath = 'dist/index.html';

  if (!packagedFiles.has(indexPath)) {
    throw new Error(`Incremental package integrity check failed: missing ${indexPath} in app.asar.`);
  }

  const indexHtml = extractFile(asarPath, indexPath).toString('utf8');
  const referencedPaths = [];
  const referencePattern = /(?:src|href)="\.\/([^"]+)"/gu;
  let match = referencePattern.exec(indexHtml);
  while (match) {
    referencedPaths.push(`dist/${match[1]}`);
    match = referencePattern.exec(indexHtml);
  }

  const missingReferences = referencedPaths.filter((referencePath) => !packagedFiles.has(referencePath));
  if (missingReferences.length) {
    throw new Error([
      'Incremental package integrity check failed: missing renderer assets referenced by dist/index.html.',
      ...missingReferences.map((referencePath) => `- ${referencePath}`),
    ].join('\n'));
  }
}

function assertPackagedElectronSources(asarPath, electronManifest) {
  const normalizeAsarPath = (entryPath) => entryPath.replace(/^[\\/]+/u, '').replaceAll('\\', '/');
  const packagedFiles = new Set(listPackage(asarPath).map(normalizeAsarPath));
  const missingSources = [...electronManifest.keys()]
    .map((relativePath) => `electron/${relativePath}`)
    .filter((relativePath) => !packagedFiles.has(relativePath));
  if (missingSources.length) {
    throw new Error([
      'Incremental package integrity check failed: missing Electron sources in app.asar.',
      ...missingSources.slice(0, 20).map((relativePath) => `- ${relativePath}`),
    ].join('\n'));
  }
}

function assertPackagedAppResources(asarPath, resourceManifest) {
  const normalizeAsarPath = (entryPath) => entryPath.replace(/^[\\/]+/u, '').replaceAll('\\', '/');
  const packagedFiles = new Set(listPackage(asarPath).map(normalizeAsarPath));
  const missingResources = [...resourceManifest.keys()]
    .map((relativePath) => `resources/${relativePath}`)
    .filter((relativePath) => !packagedFiles.has(relativePath));
  if (missingResources.length) {
    throw new Error([
      'Incremental package integrity check failed: missing application resources in app.asar.',
      ...missingResources.slice(0, 20).map((relativePath) => `- ${relativePath}`),
    ].join('\n'));
  }
}

async function createStagingAsarWithRetry(electronManifest, resourceManifest) {
  let currentManifest = electronManifest;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await assertDirectoryMirror(path.join(projectRoot, 'electron'), path.join(stagingAppDir, 'electron'));
      await rm(stagingAsarPath, { force: true });
      await createPackage(stagingAppDir, stagingAsarPath);
      await assertPackagedRendererEntrypoint(stagingAsarPath);
      assertPackagedElectronSources(stagingAsarPath, currentManifest);
      assertPackagedAppResources(stagingAsarPath, resourceManifest);
      return;
    } catch (error) {
      if (error?.code !== 'ENOENT' || attempt >= 3) throw error;
      console.warn(`ASAR staging input changed during packing (attempt ${attempt}/3); recopying Electron sources.`);
      currentManifest = await copyElectronSourcesWithRetry();
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

const { latestBuild, info, sharedDirectoryLines } = await readLatestBuildInfo();
const appAsarPath = path.join(latestBuild, 'win-unpacked', 'resources', 'app.asar');
const appUnpackedPath = path.join(latestBuild, 'win-unpacked', 'resources', 'app.asar.unpacked');
const resourcesDir = path.join(latestBuild, 'win-unpacked', 'resources');
const launcherPath = path.join(latestBuild, 'win-unpacked', 'AI Desktop Pet.exe');
const marketplaceProductionResourceDir = path.join(resourcesDir, 'marketplace-production');
assertMarketplaceProductionPackagingMode(marketplaceProductionConfig, 'incremental');
if (await pathExists(marketplaceProductionResourceDir)) {
  throw new Error('Incremental packaging is disabled for a build containing marketplace production trust resources. Run a fresh production build.');
}
const currentBaseline = await collectPackagingBaseline(projectRoot);
const baselineIssues = comparePackagingBaseline(info, currentBaseline);
const sharedDirectoryIssues = await findSharedDirectoryIssues(projectRoot, sharedDirectoryLines);
const runningBuildProcesses = await findRunningBuildProcesses(latestBuild);
const runningBuildIssues = Array.isArray(runningBuildProcesses) && runningBuildProcesses.length > 0
  ? runningBuildProcesses.map((processInfo) => (
    `running packaged process ${processInfo.ProcessId ?? '?'} still uses ${processInfo.ExecutablePath ?? latestBuild}`
  ))
  : [];
const blockingIssues = [
  ...baselineIssues,
  ...sharedDirectoryIssues,
  ...runningBuildIssues,
];

if (!await pathExists(appAsarPath)) {
  throw new Error(`Cannot find existing app.asar at ${appAsarPath}. Run npm run dist:win:fresh first.`);
}

await ensureRequiredSource('dist');
await ensureRequiredSource('electron');
await ensureRequiredSource('resources');
await ensureRequiredSource('package.json');

if (isDryRun) {
  console.log(`Latest build: ${latestBuild}`);
  console.log(`Existing app.asar: ${appAsarPath}`);
  console.log(`Would update app from: ${path.join(projectRoot, 'dist')}`);
  console.log(`Would update electron from: ${path.join(projectRoot, 'electron')}`);
  console.log(`Would update application resources from: ${path.join(projectRoot, 'resources')}`);
  if (blockingIssues.length) {
    console.log('');
    console.log('Incremental package guard issues:');
    for (const issue of blockingIssues) {
      console.log(`- ${issue}`);
    }
  }
  process.exit(0);
}

if (blockingIssues.length && !isForced) {
  throw new Error([
    'Incremental package guard refused to reuse the latest fresh build.',
    '',
    ...blockingIssues.map((issue) => `- ${issue}`),
    '',
    'Run npm run dist:win:fresh to create a new complete build baseline.',
    'If you intentionally accept these risks for a one-off local test, run:',
    '  node scripts/dist-win-incremental.mjs --force',
  ].join('\n'));
}

if (blockingIssues.length && isForced) {
  console.warn('WARNING: forcing incremental package despite guard issues:');
  for (const issue of blockingIssues) {
    console.warn(`- ${issue}`);
  }
  console.warn('');
}

await rm(stagingRoot, { recursive: true, force: true });
await mkdir(stagingRoot, { recursive: true });

console.log(`Extracting existing app.asar from ${appAsarPath}`);
await extractAll(appAsarPath, stagingAppDir);

console.log('Applying changed app files');
await copyRendererDistWithRetry();
await copyMissingRendererPublicRootReferences();
const electronManifest = await copyElectronSourcesWithRetry();
await copyDirectoryContents(path.join(projectRoot, 'resources'), path.join(stagingAppDir, 'resources'));
const resourceManifest = await collectFileManifest(path.join(projectRoot, 'resources'));
await copyFile(path.join(projectRoot, 'package.json'), path.join(stagingAppDir, 'package.json'));
const packageInfo = JSON.parse(await readFile(path.join(projectRoot, 'package.json'), 'utf8'));
await writeFile(
  path.join(stagingAppDir, 'build-info.json'),
  `${JSON.stringify({ buildId: `incremental-${createBuildStamp()}`, builtAt: new Date().toISOString(), version: packageInfo.version ?? '0.0.1' }, null, 2)}\n`,
  'utf8',
);

console.log('Repacking app.asar');
await createStagingAsarWithRetry(electronManifest, resourceManifest);
await copyFile(stagingAsarPath, appAsarPath);
const copiedUnityRuntimeDir = await copyUnityRuntimeIfPresent(resourcesDir);
const incrementalGeneratedAt = new Date();
const launcherStat = await stat(launcherPath);
await utimes(launcherPath, launcherStat.atime, incrementalGeneratedAt);

await writeFile(
  latestInfoPath,
  [
    `latest_build=${latestBuild}`,
    `portable_exe=${info.get('portable_exe') ?? path.join(latestBuild, 'AI-Desktop-Pet-0.0.1.exe')}`,
    ...sharedDirectoryLines,
    ...getStoredBaselineLines(info, currentBaseline),
    `incremental_asar=${appAsarPath}`,
    `incremental_generated_at=${incrementalGeneratedAt.toISOString()}`,
    '',
  ].join('\n'),
  'utf8',
);

if (await pathExists(appUnpackedPath)) {
  console.log(`Kept existing unpacked resources: ${appUnpackedPath}`);
}

if (copiedUnityRuntimeDir) {
  console.log(`Updated Unity runtime resources: ${copiedUnityRuntimeDir}`);
}

console.log('');
console.log(`Incremental package updated: ${appAsarPath}`);
console.log(`Run app from: ${launcherPath}`);
