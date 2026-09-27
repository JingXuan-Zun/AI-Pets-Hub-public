import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export const BASELINE_VERSION = '1';

const BASELINE_KEYS = [
  'baseline_version',
  'baseline_package_manifest_hash',
  'baseline_package_lock_hash',
  'baseline_build_icon_ico_hash',
  'baseline_build_icon_png_hash',
  'baseline_dist_win_fresh_hash',
  'baseline_unity_runtime_assets_hash',
];

const REQUIRED_SHARED_DIRECTORY_NAMES = [
  'local-models',
  'python',
];

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

function hashText(text) {
  return createHash('sha256').update(text).digest('hex');
}

async function hashFileOrMissing(filePath) {
  if (!await pathExists(filePath)) {
    return 'missing';
  }

  const buffer = await readFile(filePath);
  return hashText(buffer);
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

async function hashPackageManifest(projectRoot) {
  const packageJsonPath = path.join(projectRoot, 'package.json');
  const rawPackage = JSON.parse(await readFile(packageJsonPath, 'utf8'));
  const relevantPackageFields = {
    name: rawPackage.name ?? null,
    version: rawPackage.version ?? null,
    main: rawPackage.main ?? null,
    dependencies: rawPackage.dependencies ?? {},
    optionalDependencies: rawPackage.optionalDependencies ?? {},
    devDependencies: rawPackage.devDependencies ?? {},
    build: rawPackage.build ?? {},
  };

  return hashText(stableStringify(relevantPackageFields));
}

export async function collectPackagingBaseline(projectRoot) {
  return {
    baseline_version: BASELINE_VERSION,
    baseline_package_manifest_hash: await hashPackageManifest(projectRoot),
    baseline_package_lock_hash: await hashFileOrMissing(path.join(projectRoot, 'package-lock.json')),
    baseline_build_icon_ico_hash: await hashFileOrMissing(path.join(projectRoot, 'build', 'icon.ico')),
    baseline_build_icon_png_hash: await hashFileOrMissing(path.join(projectRoot, 'build', 'icon.png')),
    baseline_dist_win_fresh_hash: await hashFileOrMissing(path.join(projectRoot, 'scripts', 'dist-win-fresh.mjs')),
    baseline_unity_runtime_assets_hash: await hashFileOrMissing(path.join(projectRoot, 'scripts', 'unity-runtime-assets.mjs')),
  };
}

export function formatBaselineLines(baseline) {
  return BASELINE_KEYS.map((key) => `${key}=${baseline[key] ?? ''}`);
}

function readBaselineFromInfo(info) {
  const baseline = {};
  for (const key of BASELINE_KEYS) {
    const value = info.get(key);
    if (!value) {
      return null;
    }

    baseline[key] = value;
  }

  return baseline;
}

export function getStoredBaselineLines(info, fallbackBaseline) {
  const storedBaseline = readBaselineFromInfo(info);
  return formatBaselineLines(storedBaseline ?? fallbackBaseline);
}

export function comparePackagingBaseline(info, currentBaseline) {
  const storedBaseline = readBaselineFromInfo(info);
  if (!storedBaseline) {
    return [
      'release/LATEST_BUILD.txt was created before packaging baseline guards existed. Run npm run dist:win:fresh once to create a guarded baseline.',
    ];
  }

  const issues = [];
  for (const key of BASELINE_KEYS) {
    if (storedBaseline[key] !== currentBaseline[key]) {
      issues.push(`${key} changed since the latest fresh build.`);
    }
  }

  return issues;
}

export function parseSharedDirectoryLines(sharedDirectoryLines) {
  const directories = new Map();
  for (const line of sharedDirectoryLines) {
    const payload = line.startsWith('shared_dir=') ? line.slice('shared_dir='.length) : line;
    const separatorIndex = payload.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    directories.set(payload.slice(0, separatorIndex), payload.slice(separatorIndex + 1));
  }

  return directories;
}

export async function findSharedDirectoryIssues(projectRoot, sharedDirectoryLines) {
  const sharedDirectories = parseSharedDirectoryLines(sharedDirectoryLines);
  const issues = [];

  for (const name of REQUIRED_SHARED_DIRECTORY_NAMES) {
    const sourcePath = path.join(projectRoot, name);
    if (!await pathExists(sourcePath)) {
      continue;
    }

    const linkedPath = sharedDirectories.get(name);
    if (!linkedPath) {
      issues.push(`shared_dir=${name} is missing from release/LATEST_BUILD.txt. Run npm run dist:win:fresh to recreate shared runtime links.`);
      continue;
    }

    if (!await pathExists(linkedPath)) {
      issues.push(`shared_dir=${name} target is missing: ${linkedPath}. Run npm run dist:win:fresh to recreate it.`);
    }
  }

  return issues;
}

export async function findRunningBuildProcesses(latestBuild) {
  if (process.platform !== 'win32') {
    return [];
  }

  const script = [
    '$prefix = [System.IO.Path]::GetFullPath($args[0])',
    '$items = Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase) } | Select-Object ProcessId,Name,ExecutablePath',
    'if ($null -eq $items) { "[]" } else { $items | ConvertTo-Json -Compress }',
  ].join('; ');

  try {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script, latestBuild],
      {
        timeout: 10000,
        windowsHide: true,
      },
    );
    const trimmedOutput = stdout.trim();
    if (!trimmedOutput) {
      return [];
    }

    const parsed = JSON.parse(trimmedOutput);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (error) {
    return null;
  }
}
