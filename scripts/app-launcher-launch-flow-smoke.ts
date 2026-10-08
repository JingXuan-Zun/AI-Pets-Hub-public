import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { loadAppLauncherFixture } from './appLauncherFixture';

if (process.platform !== 'win32') {
  console.log('app launcher launch flow smoke skipped outside Windows');
  process.exit(0);
}

const require = createRequire(import.meta.url);
const json = (value: unknown) => JSON.parse(JSON.stringify(value));
const direct = { name: 'Direct', path: path.resolve('Direct.exe'), type: 'exe' };
const remembered = { name: 'Remembered', path: path.resolve('Remembered.exe'), type: 'exe', aliases: ['Remembered'], userDefined: true };
const packaged = { name: 'Packaged', path: 'shell:AppsFolder\\Fixture!App', type: 'aumid', appId: 'Fixture!App' };
const disk = { name: 'Disk', path: path.resolve('Disk.exe'), type: 'exe' };

// Also used by a temporary pre-extraction comparison. All effects are fixtures.
export async function exerciseLaunchFlows(entrySource?: string) {
  const results: unknown[] = [];
  const cases = [
    { query: 'Direct', focused: true, expected: 'focused-existing-window' },
    { query: 'Direct', expected: 'launched-new-process' },
    { query: 'Direct', forceNew: true, focused: true, expected: 'launched-new-process' },
    { query: 'Direct', unverified: true, expected: 'launched-unverified' },
    { query: 'Direct', pathError: 'fixture open failure', expected: 'launch-failed' },
    { query: 'Direct', noShell: true, expected: 'launch-failed' },
    { query: 'Remembered', expected: 'launched-new-process' },
    { query: 'Packaged', expected: 'launched-new-process' },
    { query: 'Packaged', packagedError: false, expected: 'launch-failed' },
    { query: 'Packaged', packagedError: 'fixture package failure', expected: 'launch-failed' },
    { query: 'Packaged', packagedError: { ok: false, error: 'fixture package object failure' }, expected: 'launch-failed' },
    { query: 'Packaged', packagedThrows: true, expected: 'launch-failed' },
    { query: 'Missing', focused: true, expected: 'focused-existing-window' },
    { query: 'Missing', expected: 'not-found' },
    { query: 'Disk', expected: 'launched-new-process' },
  ];
  for (const scenario of cases) {
    const calls: unknown[] = [];
    let launched = false, postLaunchProbes = 0, clock = 0;
    let memory = scenario.query === 'Remembered' ? [remembered] : [];
    const focusExistingAppWindow = async (query: string, selected: unknown) => {
      calls.push(['focus', query, selected]);
      if (launched) postLaunchProbes++;
      return { ok: Boolean(scenario.focused || (launched && !scenario.unverified && postLaunchProbes >= 2)), reason: 'fixture no window', processName: 'Fixture' };
    };
    const { createAppLauncherService } = loadAppLauncherFixture({
      'browserSearchService.cjs': { getDetectedBrowserCandidates: () => [] },
      'shortcutIndex.cjs': { walkShortcutRoot: async () => {} },
      'installedAppIndex.cjs': { createInstalledAppIndex: () => ({ createInstalledProgramRegistryEntries: async () => [] }) },
      'appMemory.cjs': {
        getUserAppMemoryPath: () => 'fixture memory', readRememberedApps: () => memory,
        writeRememberedApps: (_file: string, entries: any[]) => { memory = entries; return entries; },
        normalizeRememberedAppEntry: (entry: unknown) => entry,
      },
      'appFileEntries.cjs': { ...require('../electron/appLauncher/appFileEntries.cjs'), resolveDirectAppPath: (query: string) => query === 'Direct' ? direct : null },
      'diskFallbackIndex.cjs': { searchDiskFallbackApps: async (query: string) => { calls.push(['disk', query]); return query === 'Disk' ? [disk] : []; } },
      'windowFocusOperation.cjs': { createWindowFocusOperation: () => ({ focusExistingAppWindow, focusWindow: async () => ({ ok: true }) }) },
    }, {
      Date: class extends Date { static now() { clock += 100; return clock; } },
      setTimeout: (callback: () => void) => { queueMicrotask(callback); return 1; }, clearTimeout: () => {},
    }, entrySource);
    const service = createAppLauncherService({
      packagedAppProvider: async () => scenario.query === 'Packaged' ? [{ Name: packaged.name, AppID: packaged.appId }] : [],
      packagedAppLauncher: async (request: unknown) => {
        calls.push(['package', request]); launched = true;
        if (scenario.packagedThrows) throw new Error('fixture package exception');
        return scenario.packagedError;
      },
      shellApi: scenario.noShell ? {} : { openPath: async (target: string) => { calls.push(['path', target]); launched = true; return scenario.pathError || ''; } },
    });
    assert.equal(Object.keys(service).length, 18);
    const result = await service.launchLocalApp({ query: scenario.query, forceNew: scenario.forceNew });
    assert.equal(result.status, scenario.expected, JSON.stringify(scenario));
    if (scenario.expected === 'focused-existing-window' || scenario.expected === 'not-found') {
      assert.equal(launched, false, 'focusing or no match must not dispatch a launch');
    }
    if (scenario.expected === 'launched-new-process') assert.equal(result.verification.ok, true);
    if (scenario.unverified) assert.equal(result.ok, false);
    results.push(json({ result, calls }));
  }
  // URI/resource branches use the same public service assembly and executor.
  for (const mode of ['success', 'executor-error', 'invalid-json', 'shell-error']) {
    const calls: unknown[] = [];
    const { createAppLauncherService } = loadAppLauncherFixture({
      fs: {
        statSync: (target: string) => ({ isDirectory: () => target.endsWith('folder.exe') }),
        existsSync: () => true,
      },
      child_process: {
        execFile: (file: string, args: string[], options: unknown, callback: any) => {
          calls.push([file, args, options]);
          callback(mode === 'executor-error' ? new Error('fixture executor failure') : null,
            Buffer.from(mode === 'invalid-json' ? '{bad' : JSON.stringify({ ok: true, progId: 'ChromeHTML', command: '"C:\\Fixture\\chrome.exe" -- "%1"' })), Buffer.alloc(0));
        },
      },
    }, {}, entrySource);
    const service = createAppLauncherService({ shellApi: {
      openExternal: async (url: string) => { calls.push(['external', url]); if (mode === 'shell-error') throw new Error('fixture external failure'); },
      openPath: async (target: string) => { calls.push(['path', target]); return mode === 'shell-error' ? 'fixture path failure' : ''; },
    } });
    const uriResult = await service.getDefaultAppForUri({ scheme: 'HTTPS://example.com' });
    assert.equal(uriResult.ok, mode !== 'executor-error' && mode !== 'invalid-json');
    if (uriResult.ok) { assert.equal(uriResult.appName, 'Google Chrome'); assert.equal(uriResult.executablePath, 'C:\\Fixture\\chrome.exe'); }
    results.push(json({ uriResult, calls: [...calls] }));
    for (const request of [
      {}, { target: 'example.com' }, { target: 'https://example.com/a', resourceType: 'url' },
      { target: 'file:///C:/fixture.exe', resourceType: 'url' }, { target: 'bad url', resourceType: 'url' },
      { target: 'relative.txt', resourceType: 'file' }, { target: path.resolve('run.ps1') },
      { target: path.resolve('notes.txt') }, { target: path.resolve('folder.exe') },
    ]) {
      const count = calls.length;
      const result = await service.openResource(request);
      const shouldDispatch = [undefined, 'https://example.com/a', 'example.com', path.resolve('notes.txt'), path.resolve('folder.exe')].includes(request.target) && Boolean(request.target);
      assert.equal(calls.length - count, shouldDispatch ? 1 : 0, JSON.stringify({ request, result, mode }));
      results.push(json({ result, calls: calls.slice(count) }));
    }
  }
  return results;
}

await exerciseLaunchFlows();
console.log('app launcher launch flow smoke: PASS (focus, force-new, polling, memory/package/disk resolution, failures, public URI/resources; fixtures only)');
