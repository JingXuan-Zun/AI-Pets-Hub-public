import { strict as assert } from 'node:assert';

import { resolveObserveWindowsAndAppsColdStartSnapshotForTest } from '../src/agent/agentRuntimeDesktopObservationTools';

const firstGoodSnapshot = {
  activeWindow: {
    hwnd: 1001,
    processName: 'AI Desktop Pet',
    title: 'AI Desktop Pet',
  },
  installedApps: [
    {
      name: 'WeGame',
      path: 'C:\\Program Files\\WeGame\\wegame.exe',
    },
  ],
  installedCount: 40,
  ok: true,
  query: 'WeGame',
  runningApps: [
    {
      hwnd: 1001,
      pid: 4321,
      processName: 'AI Desktop Pet',
      title: 'AI Desktop Pet',
    },
  ],
  runningCount: 7,
  taskbarPinnedApps: [
    {
      name: 'WeGame',
      path: 'C:\\Users\\example\\AppData\\Roaming\\Microsoft\\Internet Explorer\\Quick Launch\\User Pinned\\TaskBar\\WeGame.lnk',
      taskbarPinned: true,
    },
  ],
  taskbarPinnedCount: 13,
};

const coldStartEmptySnapshot = {
  activeWindow: {
    hwnd: 1002,
    processName: 'AI Desktop Pet',
    title: 'AI Desktop Pet',
  },
  installedApps: [],
  installedCount: 0,
  ok: true,
  query: 'WeGame',
  runningApps: [],
  runningCount: 0,
  taskbarPinnedApps: [],
  taskbarPinnedCount: 0,
};

const resolved = resolveObserveWindowsAndAppsColdStartSnapshotForTest({
  current: coldStartEmptySnapshot,
  previous: firstGoodSnapshot,
});

assert.equal(resolved.usedFallback, true);
assert.match(resolved.fallbackNotes.join('\n'), /last good window\/app snapshot/u);
assert.equal(resolved.result.installedCount, 40);
assert.equal(resolved.result.taskbarPinnedCount, 13);
assert.equal(resolved.result.runningCount, 7);
assert.equal(resolved.result.activeWindow?.hwnd, 1002);
assert.equal(resolved.result.observationFallback, true);
assert.equal(resolved.result.installedApps?.[0]?.name, 'WeGame');
assert.equal(resolved.result.taskbarPinnedApps?.[0]?.name, 'WeGame');

const realEmptyDesktop = resolveObserveWindowsAndAppsColdStartSnapshotForTest({
  current: {
    installedApps: [],
    installedCount: 0,
    ok: true,
    runningApps: [],
    runningCount: 0,
    taskbarPinnedApps: [],
    taskbarPinnedCount: 0,
  },
  previous: firstGoodSnapshot,
});

assert.equal(realEmptyDesktop.usedFallback, false);
assert.equal(realEmptyDesktop.result.installedCount, 0);

console.log('agent observe windows cold-start fallback smoke ok');
