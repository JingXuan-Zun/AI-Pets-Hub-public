import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { readProjectFile } from './smokeTestHarness.ts';

const require = createRequire(import.meta.url);
const { createAppLauncherService } = require('../electron/appLauncherService.cjs') as {
  createAppLauncherService: (options?: {
    app?: { getPath?: (name: string) => string };
  }) => {
    launchLocalApp: (request?: { forceRefresh?: boolean; query?: string }) => Promise<{
      app?: { category?: string; name?: string; path?: string; type?: string } | null;
      matchCount?: number;
      matches?: Array<{ category?: string; path?: string }>;
      ok: boolean;
      status?: string;
    }>;
    searchLocalApps: (query: string, options?: { forceRefresh?: boolean; limit?: number }) => Promise<Array<{
      aliases?: string[];
      category?: string;
      name: string;
      path: string;
      score?: number;
      type: string;
    }>>;
  };
};

const tempRoot = mkdtempSync(path.join(tmpdir(), 'ai-desktop-pet-browser-app-'));
const launcherSource = readProjectFile('electron/appLauncherService.cjs');
const diskFallbackFunctionSource = launcherSource.match(
  /async function searchDiskFallbackApps[\s\S]*?\n  function resolveDirectAppPath/u,
)?.[0] ?? '';
const originalProgramFiles = process.env.ProgramFiles;
const originalProgramFilesX86 = process.env['ProgramFiles(x86)'];
const originalLocalAppData = process.env.LOCALAPPDATA;

assert.match(launcherSource, /createInstalledProgramRegistryEntries/u);
assert.match(launcherSource, /Windows\\CurrentVersion\\Uninstall/u);
assert.match(launcherSource, /findInstalledAppExecutableInDirectory/u);
assert.match(launcherSource, /async function findInstalledAppExecutableInDirectory/u);
assert.doesNotMatch(
  launcherSource,
  /readdirSync\(directory/u,
  'app launcher should not synchronously scan variable app directories on the Electron main process',
);
assert.doesNotMatch(launcherSource, /Get-ChildItem\s+-Path\s+[A-Z]:\\\s+-Recurse/iu);
assert.match(launcherSource, /searchDiskFallbackApps/u);
assert.match(launcherSource, /async function searchDiskFallbackApps/u);
assert.match(launcherSource, /await fs\.promises\.readdir/u);
assert.ok(diskFallbackFunctionSource, 'bounded disk fallback app search function should be present');
assert.doesNotMatch(
  diskFallbackFunctionSource,
  /\breaddirSync\b/u,
  'bounded disk fallback app search should not synchronously scan directories on the Electron main process',
);
assert.match(launcherSource, /APP_DISK_FALLBACK_MAX_DIRECTORIES/u);
assert.match(launcherSource, /remembered apps, running windows, taskbar\/start shortcuts, installed programs, and bounded local disk candidates/u);

function createFakeExecutable(filePath: string) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, 'fake exe for app launcher smoke', 'utf8');
}

try {
  const programFiles = path.join(tempRoot, 'Program Files');
  const programFilesX86 = path.join(tempRoot, 'Program Files (x86)');
  const localAppData = path.join(tempRoot, 'LocalAppData');
  const edgePath = path.join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe');
  const chromePath = path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe');
  const fallbackAppName = 'ZqxFallbackProbe987654';
  const fallbackAppPath = path.join(programFiles, fallbackAppName, `${fallbackAppName}.exe`);

  createFakeExecutable(edgePath);
  createFakeExecutable(chromePath);
  createFakeExecutable(fallbackAppPath);

  process.env.ProgramFiles = programFiles;
  process.env['ProgramFiles(x86)'] = programFilesX86;
  process.env.LOCALAPPDATA = localAppData;

  const service = createAppLauncherService({
    app: {
      getPath: (name: string) => path.join(tempRoot, name),
    },
  });

  const browserMatches = await service.searchLocalApps('\u6d4f\u89c8\u5668', {
    forceRefresh: true,
    limit: 5,
  });
  assert.ok(browserMatches.length >= 1, 'generic browser query should return a detected browser app');
  assert.equal(browserMatches[0]?.category, 'browser');
  assert.match(browserMatches[0]?.path ?? '', /(?:msedge|chrome)\.exe$/iu);
  assert.ok((browserMatches[0]?.score ?? 0) > 0);

  const chromeMatches = await service.searchLocalApps('Chrome', {
    forceRefresh: true,
    limit: 5,
  });
  assert.ok(
    chromeMatches.some((match) => match.path === chromePath),
    'Chrome query should also resolve detected Chrome when no shortcut exists',
  );

  const browserTextMatches = await service.searchLocalApps('browser', {
    forceRefresh: true,
    limit: 5,
  });
  assert.ok(
    browserTextMatches.some((match) => match.category === 'browser'),
    'English browser category query should return detected browser apps',
  );

  const fallbackLaunchResult = await service.launchLocalApp({
    forceRefresh: true,
    query: fallbackAppName,
  });
  assert.equal(fallbackLaunchResult.app?.category, 'disk-fallback');
  assert.equal(fallbackLaunchResult.app?.path, fallbackAppPath);
  assert.ok(['launch-failed', 'launched-new-process', 'launched-unverified'].includes(String(fallbackLaunchResult.status)));
} finally {
  if (originalProgramFiles === undefined) {
    delete process.env.ProgramFiles;
  } else {
    process.env.ProgramFiles = originalProgramFiles;
  }

  if (originalProgramFilesX86 === undefined) {
    delete process.env['ProgramFiles(x86)'];
  } else {
    process.env['ProgramFiles(x86)'] = originalProgramFilesX86;
  }

  if (originalLocalAppData === undefined) {
    delete process.env.LOCALAPPDATA;
  } else {
    process.env.LOCALAPPDATA = originalLocalAppData;
  }

  rmSync(tempRoot, { force: true, recursive: true });
}

console.log('app launch browser category smoke ok');
