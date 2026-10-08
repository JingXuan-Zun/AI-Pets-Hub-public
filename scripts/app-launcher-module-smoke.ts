import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { assertImplementationModuleGraph } from './implementationModuleGuard';
import { loadAppLauncherFixture } from './appLauncherFixture';

const require = createRequire(import.meta.url);
const { createPackagedAppIndex } = require('../electron/appLauncher/packagedAppIndex.cjs');
const { createInstalledAppIndex } = require('../electron/appLauncher/installedAppIndex.cjs');
const { scoreIndexedAppMatch } = require('../electron/appLauncher/appSearchMatching.cjs');
assertImplementationModuleGraph({
  entry: 'electron/appLauncherService.cjs', directory: 'electron/appLauncher',
});
let scans = 0;
const packaged = createPackagedAppIndex({
  packagedAppProvider: async () => [
    { Name: 'Fixture', AppID: 'Fixture!App' },
    { Name: 'Duplicate', AppID: 'fixture!app' },
    { Name: 'Invalid', AppID: 'not-packaged' },
    { Name: '', AppID: 'Empty!App' },
  ],
  runPowerShellScript: async () => { scans++; throw new Error('provider must own this scan'); },
  logMessage: () => {},
});
const entries = await packaged.createPackagedAppEntries();
if (process.platform === 'win32') {
  assert.equal(entries.length, 1);
  assert.equal(entries[0].appId, 'Fixture!App');
  assert.equal(entries[0].type, 'aumid');
}
assert.equal(scans, 0);
const logs: string[] = [];
const registry = createInstalledAppIndex({
  runPowerShellScript: async () => { throw new Error('fixture registry failure'); },
  logMessage: (message: string) => logs.push(message),
});
assert.deepEqual(await registry.createInstalledProgramRegistryEntries(), []);
if (process.platform === 'win32') assert.deepEqual(logs, ['installed app registry scan failed']);
assert.equal(scoreIndexedAppMatch({name:'Fixture',aliases:['测试别名'],userDefined:true},'测试别名'),120);
assert.equal(scoreIndexedAppMatch({name:'Chrome',aliases:[],category:'browser'},'浏览器',{browserCategoryQuery:true}),96);
// Verify the public cache owner using isolated providers, without real registry
// scans, application launches or user-memory writes.
const serviceRequire = createRequire(path.resolve('electron/appLauncherService.cjs'));
let builds = 0;
let memory: unknown[] = [];
const { createAppLauncherService } = loadAppLauncherFixture({
  'browserSearchService.cjs': { getDetectedBrowserCandidates: () => [] },
  'shortcutIndex.cjs': { walkShortcutRoot: async () => {} },
  'installedAppIndex.cjs': { createInstalledAppIndex: () => ({ createInstalledProgramRegistryEntries: async () => [] }) },
  'packagedAppIndex.cjs': { createPackagedAppIndex: () => ({ createPackagedAppEntries: async () => { builds++; return []; } }) },
  'appMemory.cjs': {
    getUserAppMemoryPath: () => 'fixture-memory',
    readRememberedApps: () => memory,
    writeRememberedApps: (_file: string, entries: unknown[]) => { memory = entries; return entries; },
    normalizeRememberedAppEntry: (entry: unknown) => entry,
  },
  'appFileEntries.cjs': { ...serviceRequire('./appLauncher/appFileEntries.cjs'), isExistingLocalAppFile: () => true },
});
const service = createAppLauncherService({ app: { getPath: () => process.cwd() } });
await service.listApps();
await service.listApps();
if (process.platform === 'win32') assert.equal(builds, 1, 'normal reads must reuse the cache');
await service.listApps({ forceRefresh: true });
if (process.platform === 'win32') assert.equal(builds, 2, 'forceRefresh must rebuild');
assert.equal(service.rememberLocalApp({ path: path.resolve('Fixture.exe'), name: 'Fixture' }).ok, true);
assert.equal((await service.listApps())[0]?.name, 'Fixture');
if (process.platform === 'win32') assert.equal(builds, 3, 'remembering an app must invalidate the cache');
console.log('app launcher module smoke: PASS (providers, registry failure, matching, cache refresh/invalidation, budgets, dependency graph)');
