import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { createWindowObservationGeometry } = require('../electron/appLauncher/windowObservationGeometry.cjs');
const { createRunningAppObservation } = require('../electron/appLauncher/runningAppObservation.cjs');
const { createInstalledAppObservation } = require('../electron/appLauncher/installedAppObservation.cjs');
const { createWindowsAndAppsObservation } = require('../electron/appLauncher/windowsAndAppsObservation.cjs');
const { getTaskbarPinnedRoot } = require('../electron/appLauncher/appIndexRoots.cjs');
const displays = [
  { id: 1, bounds: { x: -1000, y: 0, width: 1000, height: 800 }, label: 'Left', scaleFactor: 2 },
  { id: 2, bounds: { x: 0, y: 0, width: 1000, height: 800 }, label: 'Main', scaleFactor: 1 },
];
const geometry = createWindowObservationGeometry({
  screen: {
    screenToDipPoint: ({ x, y }: { x: number; y: number }) => ({ x: x / 2, y: y / 2 }),
    getAllDisplays: () => displays, getPrimaryDisplay: () => displays[1],
  },
  logMessage: () => {},
});
const rawWindow = { pid: 123, processName: 'Editor', title: 'Project', hwnd: 456,
  bounds: { x: -1000, y: 0, width: 400, height: 200 }, active: true, visible: true };
const normalized = geometry.enrichWindowDisplay(geometry.normalizeRunningAppWindow(rawWindow));
assert.deepEqual(normalized.bounds, { x: -500, y: 0, width: 200, height: 100, coordinateSpace: 'dip' });
assert.deepEqual(normalized.nativeBounds, rawWindow.bounds);
assert.equal(normalized.displayId, '1');
assert.equal(normalized.coordinateSpace, 'dip');
assert.equal(normalized.nativeCoordinateSpace, 'native-screen');
assert.equal(geometry.normalizeRunningAppWindow({ pid: 'bad', title: 'Invalid' }), null);
assert.equal(geometry.normalizeRectLike({ x: Infinity, y: 0, width: 1, height: 1 }), null);
assert.equal(createWindowObservationGeometry({ screen: null, logMessage: () => {} }).getDisplaySnapshots().length, 0);

let windowCalls = 0;
let activeCalls = 0;
let rejectScan = false;
const running = createRunningAppObservation({ ...geometry,
  runPowerShellScript: async (script: string) => {
    if (rejectScan) throw new Error('fixture enumeration failed');
    if (script.includes('$windowDiagnostics =')) {
      windowCalls++;
      return JSON.stringify({ windows: [rawWindow, { ...rawWindow, hwnd: 457, title: 'Second', active: false }], enumeratedCount: 3, filteredOut: [{ reason: 'hidden' }] });
    }
    activeCalls++;
    return JSON.stringify({ ...rawWindow, ok: true, source: 'fixture-active' });
  },
});
if (process.platform === 'win32') {
  const grouped = await running.listRunningApps({ includeWindows: false });
  assert.equal(grouped.apps.length, 1);
  assert.equal(grouped.apps[0].windowCount, 2);
  assert.deepEqual(grouped.apps[0].displayIds, ['1']);
  assert.equal(grouped.windowEnumeration.enumeratedCount, 3);
  assert.equal((await running.getActiveWindowInfo()).hwnd, 456);
  rejectScan = true;
  assert.equal((await running.listRunningApps()).ok, false);
  assert.equal((await running.getActiveWindowInfo()).error, 'fixture enumeration failed');
  rejectScan = false;
}

let indexCalls = 0;
let shortcutCalls = 0;
const pinnedPath = path.join(getTaskbarPinnedRoot(), 'Fixture.lnk');
const appIndex = [{ name: 'Fixture', path: pinnedPath, aliases: ['Fixture'], type: 'lnk' }];
const installed = createInstalledAppObservation({
  listApps: async () => { indexCalls++; return appIndex; },
  searchLocalApps: async () => appIndex,
  readShortcutTargetPath: async () => { shortcutCalls++; return 'Fixture.exe'; },
});
const appLists = await installed.listObservedInstalledAndTaskbarPinnedApps({});
assert.equal(indexCalls, 1, 'installed and pinned observations must share one index read');
assert.equal(shortcutCalls, 1, 'the same shortcut must be normalized once per observation');
assert.equal(appLists.installed.apps[0].shortcutTargetPath, 'Fixture.exe');
assert.equal(appLists.taskbarPinned.apps[0].taskbarPinned, true);
const observation = createWindowsAndAppsObservation({ ...installed, ...running, ...geometry });
const before = { indexCalls, windowCalls, activeCalls };
const empty = await observation.observeWindowsAndApps({ includeInstalledApps: false, includeTaskbarPinned: false,
  includeRunningApps: false, includeActiveWindow: false, includeDisplays: false });
assert.equal(empty.ok, true);
assert.deepEqual(empty.runningApps, []);
assert.deepEqual(empty.displays, []);
assert.deepEqual({ indexCalls, windowCalls, activeCalls }, before, 'disabled observation sources must not execute');
if (process.platform === 'win32') {
  const result = await observation.observeWindowsAndApps({ includeInstalledApps: false, includeTaskbarPinned: false });
  assert.equal(result.ok, true);
  assert.equal(result.activeWindow.source, 'running-window-list');
  assert.equal(activeCalls, before.activeCalls, 'reuse the foreground window from the running list');
  assert.equal(windowCalls, before.windowCalls + 1);
}
console.log('window observation module smoke: PASS (DIP/native bounds, displays, grouping, failure, source flags, index reuse, foreground reuse)');
