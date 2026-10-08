import { execFile } from 'node:child_process';
import { copyFile, cp, lstat, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { extractFile, listPackage } from '@electron/asar';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  collectPackagingBaseline,
  formatBaselineLines,
} from './dist-win-package-guards.mjs';
import { copyUnityRuntimeIfPresent } from './unity-runtime-assets.mjs';
import {
  assertMarketplaceProductionPackagingMode,
  createMarketplaceProductionExtraResources,
  loadMarketplaceProductionPackagingConfig,
} from './marketplace-production-packaging-config.mjs';

const projectRoot = process.cwd();
const releaseRoot = path.join(projectRoot, 'release');
const localCacheRoot = path.join(releaseRoot, '.cache');
const localElectronCache = path.join(localCacheRoot, 'electron');
const localElectronBuilderCache = path.join(localCacheRoot, 'electron-builder');
const localElectronDist = path.join(projectRoot, 'node_modules', 'electron', 'dist');
const freshRendererDist = path.join(releaseRoot, '.fresh-renderer-dist');
const packagingInputRoot = path.join(releaseRoot, '.fresh-package-input');
const packagingAppDir = path.join(packagingInputRoot, 'app');
const packagingConfigPath = path.join(packagingInputRoot, 'electron-builder.json');
const windowsIconPath = path.join(projectRoot, 'build', 'icon.ico');
const windowsIconSignaturePath = path.join(projectRoot, 'build', 'icon.png');
const execFileAsync = promisify(execFile);
const isMarketplaceProductionBuild = process.argv.includes('--require-marketplace-production');
const marketplaceProductionConfig = await loadMarketplaceProductionPackagingConfig({
  required: isMarketplaceProductionBuild,
});
assertMarketplaceProductionPackagingMode(
  marketplaceProductionConfig,
  isMarketplaceProductionBuild ? 'production-fresh' : 'ordinary-fresh',
);

process.env.ELECTRON_CACHE = process.env.ELECTRON_CACHE || localElectronCache;
process.env.ELECTRON_BUILDER_CACHE = process.env.ELECTRON_BUILDER_CACHE || localElectronBuilderCache;

const { build: buildElectronApp } = await import('electron-builder');

function pad(value) {
  return String(value).padStart(2, '0');
}

function createBuildStamp(date = new Date()) {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('');
}

const buildStamp = createBuildStamp();
const outputDir = path.join(releaseRoot, `build-${buildStamp}`);
const artifactFileName = `AI-Desktop-Pet-${buildStamp}.exe`;
const exePath = path.join(outputDir, artifactFileName);
const latestInfoPath = path.join(releaseRoot, 'LATEST_BUILD.txt');

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

async function prepareFreshPackagingInput() {
  if (
    !await pathExists(path.join(freshRendererDist, 'index.html'))
    || !await pathExists(path.join(freshRendererDist, 'assets'))
  ) {
    throw new Error('Fresh renderer staging is incomplete. Run the configured fresh packaging command.');
  }

  await rm(packagingInputRoot, { force: true, recursive: true });
  await mkdir(packagingAppDir, { recursive: true });
  await cp(freshRendererDist, path.join(packagingAppDir, 'dist'), { recursive: true });
  // public/models-3d is a local development library containing user-owned
  // models, archives, and installers. It must never enter a distributable EXE.
  await rm(path.join(packagingAppDir, 'dist', 'models-3d'), { force: true, recursive: true });
  await cp(path.join(projectRoot, 'electron'), path.join(packagingAppDir, 'electron'), { recursive: true });
  await cp(path.join(projectRoot, 'resources', 'system-expressions'), path.join(packagingAppDir, 'resources', 'system-expressions'), { recursive: true });
  await copyFile(path.join(projectRoot, 'package.json'), path.join(packagingAppDir, 'package.json'));
  const packageInfo = JSON.parse(await readFile(path.join(projectRoot, 'package.json'), 'utf8'));
  // The builder concatenates package.json build.files with API overrides. Load
  // an explicit config without those root patterns to avoid stale dist files.
  const { files: ignoredRootFiles, ...baseBuildConfig } = packageInfo.build;
  await writeFile(packagingConfigPath, JSON.stringify(baseBuildConfig, null, 2), 'utf8');
  await writeFile(
    path.join(packagingAppDir, 'build-info.json'),
    `${JSON.stringify({ buildId: buildStamp, builtAt: new Date().toISOString(), version: packageInfo.version ?? '0.0.1' }, null, 2)}\n`,
    'utf8',
  );
  if (
    !await pathExists(path.join(packagingAppDir, 'dist', 'index.html'))
    || !await pathExists(path.join(packagingAppDir, 'electron', 'main.cjs'))
    || !await pathExists(path.join(packagingAppDir, 'package.json'))
    || !await pathExists(path.join(packagingAppDir, 'build-info.json'))
  ) {
    throw new Error('Fresh packaging input snapshot is incomplete.');
  }
}

async function copyFileWithRetry(sourcePath, targetPath, attempts = 5) {
  await mkdir(path.dirname(targetPath), { recursive: true });
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await copyFile(sourcePath, targetPath);
      return;
    } catch (error) {
      const retryable = error?.code === 'EBUSY' || error?.code === 'EPERM';
      if (!retryable || attempt >= attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }
}

async function copyFreshExtraResources(context) {
  await verifyFreshArchive(context.appOutDir);
  const resourcesPath = path.join(context.appOutDir, 'resources');
  const entries = [
    { from: windowsIconPath, to: 'icon.ico' },
    { from: windowsIconSignaturePath, to: 'icon.png' },
    ...createMarketplaceProductionExtraResources(marketplaceProductionConfig),
  ];
  for (const entry of entries) {
    await copyFileWithRetry(entry.from, path.join(resourcesPath, entry.to));
  }
}

async function verifyFreshArchive(appOutDir) {
  const archivePath = path.join(appOutDir, 'resources', 'app.asar');
  const expectedFiles = new Set();
  async function verifyDirectory(relativeDir) {
    for (const entry of await readdir(path.join(packagingAppDir, relativeDir), { withFileTypes: true })) {
      const relativePath = path.join(relativeDir, entry.name);
      if (entry.isDirectory()) {
        await verifyDirectory(relativePath);
      } else {
        expectedFiles.add(relativePath);
        const expected = await readFile(path.join(packagingAppDir, relativePath));
        if (!extractFile(archivePath, relativePath).equals(expected)) {
          throw new Error(`Fresh package content mismatch: ${relativePath}`);
        }
      }
    }
  }
  for (const directory of ['dist', 'electron', 'resources']) {
    await verifyDirectory(directory);
  }
  const buildInfoPath = 'build-info.json';
  if (!extractFile(archivePath, buildInfoPath).equals(await readFile(path.join(packagingAppDir, buildInfoPath)))) {
    throw new Error('Fresh package build information mismatch.');
  }
  for (const entry of listPackage(archivePath)) {
    const relativePath = entry.replace(/^[\\/]+/u, '');
    if (relativePath.startsWith(`dist${path.sep}`) && path.extname(relativePath) && !expectedFiles.has(relativePath)) {
      throw new Error(`Unexpected renderer file in fresh package: ${relativePath}`);
    }
  }
  console.log(`Verified fresh archive: ${expectedFiles.size} files and build information`);
}

function projectRelative(targetPath) {
  return path.relative(projectRoot, targetPath).replaceAll('\\', '/');
}

function quotePowerShellString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

async function linkSharedDirectory(name) {
  const sourcePath = path.join(projectRoot, name);
  const targetPath = path.join(outputDir, name);

  if (!await pathExists(sourcePath) || await pathExists(targetPath)) {
    return null;
  }

  await symlink(sourcePath, targetPath, 'junction');
  return targetPath;
}

async function readIconAverageSignature(targetPath, kind) {
  if (process.platform !== 'win32') {
    return null;
  }

  const script = [
    '$ErrorActionPreference = "Stop"',
    `$target = ${quotePowerShellString(targetPath)}`,
    `$kind = ${quotePowerShellString(kind)}`,
    'Add-Type -AssemblyName System.Drawing',
    '$icon = $null',
    '$bitmap = $null',
    'try {',
    '  if ($kind -eq "png") {',
    '    $bitmap = [System.Drawing.Bitmap]::new($target)',
    '  } else {',
    '    $icon = [System.Drawing.Icon]::ExtractAssociatedIcon($target)',
    '    if ($null -eq $icon) { throw "No associated icon: $target" }',
    '    $bitmap = $icon.ToBitmap()',
    '  }',
    '  $sumR = 0L; $sumG = 0L; $sumB = 0L; $count = 0L',
    '  for ($y = 0; $y -lt $bitmap.Height; $y++) {',
    '    for ($x = 0; $x -lt $bitmap.Width; $x++) {',
    '      $pixel = $bitmap.GetPixel($x, $y)',
    '      if ($pixel.A -gt 0) {',
    '        $sumR += $pixel.R; $sumG += $pixel.G; $sumB += $pixel.B; $count++',
    '      }',
    '    }',
    '  }',
    '  if ($count -le 0) { throw "Icon has no visible pixels: $target" }',
    '  [pscustomobject]@{',
    '    path = $target',
    '    width = $bitmap.Width',
    '    height = $bitmap.Height',
    '    visible = $count',
    '    r = [int][Math]::Round($sumR / $count)',
    '    g = [int][Math]::Round($sumG / $count)',
    '    b = [int][Math]::Round($sumB / $count)',
    '  } | ConvertTo-Json -Compress',
    '} finally {',
    '  if ($null -ne $bitmap) { $bitmap.Dispose() }',
    '  if ($null -ne $icon) { $icon.Dispose() }',
    '}',
  ].join('\n');
  const encodedScript = Buffer.from(script, 'utf16le').toString('base64');

  const { stdout } = await execFileAsync(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encodedScript],
    {
      timeout: 30000,
      windowsHide: true,
    },
  );

  return JSON.parse(stdout.trim());
}

function getIconSignatureDistance(expected, actual) {
  return Math.abs(expected.r - actual.r)
    + Math.abs(expected.g - actual.g)
    + Math.abs(expected.b - actual.b);
}

async function verifyPackagedWindowsIcons() {
  if (process.platform !== 'win32') {
    return;
  }

  const expected = await readIconAverageSignature(windowsIconSignaturePath, 'png');
  const targets = [
    path.join(outputDir, 'win-unpacked', 'AI Desktop Pet.exe'),
    exePath,
  ];
  const maximumAllowedDistance = 45;

  for (const targetPath of targets) {
    const actual = await readIconAverageSignature(targetPath, 'exe');
    const distance = getIconSignatureDistance(expected, actual);
    if (distance > maximumAllowedDistance) {
      throw new Error(
        [
          `Packaged executable icon does not match project icon: ${targetPath}`,
          `expected avg rgb ${expected.r},${expected.g},${expected.b} from ${windowsIconSignaturePath}`,
          `actual avg rgb ${actual.r},${actual.g},${actual.b}; distance=${distance}`,
          'Keep win.icon pointing at build/icon.ico and keep signAndEditExecutable enabled.',
        ].join('\n'),
      );
    }

    console.log(
      `Verified packaged icon: ${targetPath} avg=${actual.r},${actual.g},${actual.b} distance=${distance}`,
    );
  }
}

await mkdir(outputDir, { recursive: true });
await mkdir(localElectronCache, { recursive: true });
await mkdir(localElectronBuilderCache, { recursive: true });
// electron-builder also reads the package.json build.files patterns from the
// project root. Remove only the generated dist copy so the local development
// model library under public/models-3d cannot leak into the distributable.
await rm(path.join(projectRoot, 'dist', 'models-3d'), { force: true, recursive: true });
await prepareFreshPackagingInput();

await buildElectronApp({
  config: {
    extends: packagingConfigPath,
    afterPack: copyFreshExtraResources,
    directories: {
      output: outputDir,
    },
    electronDist: localElectronDist,
    files: [
      {
        from: projectRelative(packagingAppDir),
        to: '.',
        filter: ['dist/**/*', 'electron/**/*', 'resources/**/*', 'package.json', 'build-info.json'],
      },
    ],
    forceCodeSigning: false,
    win: {
      artifactName: artifactFileName,
      icon: windowsIconPath,
      // Keep resource editing enabled so win-unpacked/AI Desktop Pet.exe receives build/icon.ico.
      signAndEditExecutable: true,
      target: [
        {
          arch: ['x64'],
          target: 'portable',
        },
      ],
      verifyUpdateCodeSignature: false,
    },
  },
  projectDir: projectRoot,
  publish: 'never',
});

const sharedDirectoryLinks = [];
for (const name of ['local-models', 'python']) {
  const linkedPath = await linkSharedDirectory(name);
  if (linkedPath) {
    sharedDirectoryLinks.push(`${name}=${linkedPath}`);
  }
}

const copiedUnityRuntimeDir = await copyUnityRuntimeIfPresent(path.join(outputDir, 'win-unpacked', 'resources'));
await verifyPackagedWindowsIcons();
const packagingBaseline = await collectPackagingBaseline(projectRoot);

await writeFile(
  latestInfoPath,
  [
    `latest_build=${outputDir}`,
    `portable_exe=${exePath}`,
    ...sharedDirectoryLinks.map((entry) => `shared_dir=${entry}`),
    ...formatBaselineLines(packagingBaseline),
    `generated_at=${new Date().toISOString()}`,
    '',
  ].join('\n'),
  'utf8',
);

if (copiedUnityRuntimeDir) {
  console.log(`Unity runtime resources: ${copiedUnityRuntimeDir}`);
}
if (marketplaceProductionConfig.enabled) {
  console.log(`Marketplace production config: ${marketplaceProductionConfig.summary.transportOrigin}`);
}

console.log('');
console.log(`Latest build folder: ${outputDir}`);
console.log(`Portable exe: ${exePath}`);
