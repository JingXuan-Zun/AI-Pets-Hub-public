import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createAppLauncherService } = require('../electron/appLauncherService.cjs') as {
  createAppLauncherService: (options?: {
    app?: { getPath?: (name: string) => string };
    packagedAppLauncher?: (request: {
      appId: string;
      target: string;
    }) => Promise<string | { error?: string; ok: boolean } | void>;
    packagedAppProvider?: () => Promise<Array<{ AppID: string; Name: string }>>;
    shellApi?: {
      openExternal?: (target: string) => Promise<void>;
      openPath?: (target: string) => Promise<string>;
    };
  }) => {
    launchLocalApp: (request?: { forceNew?: boolean; query?: string }) => Promise<{
      action?: string;
      app?: { appId?: string; category?: string; name?: string; path?: string; type?: string } | null;
      error?: string;
      ok: boolean;
      status?: string;
    }>;
    searchLocalApps: (query: string, options?: { forceRefresh?: boolean; limit?: number }) => Promise<Array<{
      appId?: string;
      category?: string;
      name: string;
      path: string;
      type: string;
    }>>;
  };
};

if (process.platform !== 'win32') {
  console.log('app launch packaged Windows app smoke skipped outside Windows');
  process.exit(0);
}

const tempRoot = mkdtempSync(path.join(tmpdir(), 'ai-desktop-pet-packaged-app-'));
const directExePath = path.join(tempRoot, 'DirectFixture.exe');
writeFileSync(directExePath, 'fixture executable', 'utf8');

const fixtureAppId = 'Contoso.RuntimeFixture_1234567890abc!App';
const fixtureAppName = 'ZqxPackagedRuntimeFixture987654';
let packagedLaunchError = '';
const packagedLaunches: Array<{ appId: string; target: string }> = [];
const openedPaths: string[] = [];

try {
  const service = createAppLauncherService({
    app: {
      getPath: (name: string) => path.join(tempRoot, name),
    },
    packagedAppLauncher: async (request) => {
      packagedLaunches.push(request);
      return packagedLaunchError;
    },
    packagedAppProvider: async () => [{
      AppID: fixtureAppId,
      Name: fixtureAppName,
    }],
    shellApi: {
      openExternal: async () => undefined,
      openPath: async (target: string) => {
        openedPaths.push(target);
        return '';
      },
    },
  });

  const matches = await service.searchLocalApps(fixtureAppName, {
    forceRefresh: true,
    limit: 5,
  });
  assert.equal(matches[0]?.appId, fixtureAppId);
  assert.equal(matches[0]?.category, 'packaged-app');
  assert.equal(matches[0]?.type, 'aumid');

  const packagedResult = await service.launchLocalApp({
    forceNew: true,
    query: fixtureAppName,
  });
  assert.equal(packagedResult.action, 'launched');
  assert.equal(packagedResult.app?.appId, fixtureAppId);
  assert.equal(packagedLaunches.length, 1);
  assert.deepEqual(packagedLaunches[0], {
    app: packagedResult.app,
    appId: fixtureAppId,
    target: `shell:AppsFolder\\${fixtureAppId}`,
  });
  assert.equal(openedPaths.length, 0, 'packaged apps must not be sent to shell.openPath');

  packagedLaunchError = 'fixture packaged launch failure';
  const failedPackagedResult = await service.launchLocalApp({
    forceNew: true,
    query: fixtureAppName,
  });
  assert.equal(failedPackagedResult.ok, false);
  assert.notEqual(failedPackagedResult.status, 'launched-new-process');
  assert.equal(failedPackagedResult.error, packagedLaunchError);

  const directResult = await service.launchLocalApp({
    forceNew: true,
    query: directExePath,
  });
  assert.equal(directResult.action, 'launched');
  assert.equal(directResult.app?.path, directExePath);
  assert.deepEqual(openedPaths, [directExePath], 'normal executables must keep using shell.openPath');
} finally {
  rmSync(tempRoot, { force: true, recursive: true });
}

console.log('app launch packaged Windows app smoke ok');
