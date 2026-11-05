// Her browser gives the focus back after chrome-devtools switches tabs (user, 2026-11-05).
const assert = require('node:assert/strict');
const { createHerBrowserFocusGuard, restoreScript } = require('../electron/herBrowserFocusGuard.cjs');

(async () => {
  const scripts = [];
  const logs = [];
  const runPowerShellScript = async (script) => {
    scripts.push(script.includes('Start-Sleep') ? 'restore' : 'snapshot');
    return script.includes('Start-Sleep') ? '{"restored":true,"reason":"her-browser-took-focus"}' : '{"hwnd":4242,"pid":7}';
  };
  const guard = createHerBrowserFocusGuard({ log: (message, details) => logs.push(details), platform: 'win32', runPowerShellScript });

  assert.equal(await guard.guard({ name: 'take_snapshot' }, async () => 'ok'), 'ok');
  assert.deepEqual(scripts, [], 'tools that do not switch tabs run as they are');

  assert.equal(await guard.guard({ name: 'select_page' }, async () => 'switched'), 'switched');
  assert.deepEqual(scripts, ['snapshot', 'restore']);
  assert.deepEqual(logs, [{ reason: 'her-browser-took-focus', restored: true, tool: 'select_page' }]);

  const off = createHerBrowserFocusGuard({ platform: 'linux', runPowerShellScript: async () => { throw new Error('not on Windows'); } });
  assert.equal(await off.guard({ name: 'new_page' }, async () => 'ok'), 'ok', 'other systems skip it');

  const broken = createHerBrowserFocusGuard({ platform: 'win32', runPowerShellScript: async () => { throw new Error('powershell missing'); } });
  assert.equal(await broken.guard({ name: 'new_page' }, async () => 'still ran'), 'still ran', 'a failing check never blocks the call');

  const script = restoreScript(4242);
  assert.match(script, /\[IntPtr\]4242/u);
  assert.match(script, /browser-search-profile/u, 'only gives focus back when her browser took it');
  assert.match(script, /user-switched/u, 'leaves windows the user switched to alone');
  console.log('her browser focus guard smoke ok: 9 checks');
})();
