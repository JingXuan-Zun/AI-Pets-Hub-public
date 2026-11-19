// Opening an installed app must not "find" it in a browser tab that only shares its name (README
// known issue, fixed 2026-11-18): the focus script skips browser windows that match by title
// alone when there is an installed app to launch; with no installed app, a matching page still counts.
// Checked against real windows once (a throwaway Edge window titled "记事本…": msedge before, no match after).
const assert = require('node:assert/strict');
const { createWindowFocusOperation } = require('../electron/appLauncher/windowFocusOperation.cjs');

let checks = 0;
const check = (condition, label) => { assert.ok(condition, label); checks += 1; };

(async () => {
  const scripts = [];
  const operation = createWindowFocusOperation({
    buildFocusCandidates: async () => ({ processNames: ['notepad'], titleQueries: ['记事本'] }),
    runPowerShellScript: async (script) => { scripts.push(script); return '{"ok":false,"reason":"no-window-match"}'; },
  });
  if (process.platform !== 'win32') { console.log('app launch browser title smoke skipped (not Windows)'); return; }

  await operation.focusExistingAppWindow('记事本', { name: '记事本', path: 'C:\\Windows\\notepad.exe', type: 'exe' });
  check(/\$skipBrowserTitleOnly = \$true/u.test(scripts[0]), 'an installed app to launch: browser title-only matches are skipped');
  check(/'msedge'/u.test(scripts[0]) && /'chrome'/u.test(scripts[0]), 'the common browsers are listed');
  check(/\$skipBrowserTitleOnly -and \$titleMatch -and -not \(\$handleMatch -or \$pidMatch -or \$processMatch\)/u.test(scripts[0]), 'only title-only matches are skipped (a browser asked for by name still matches)');

  await operation.focusExistingAppWindow('哔哩哔哩', null);
  check(/\$skipBrowserTitleOnly = \$false/u.test(scripts[1]), 'no installed app: a matching page may be what was meant');

  await operation.focusExistingAppWindow('记事本', { name: '记事本' }, { hwnd: 1234 });
  check(/\$skipBrowserTitleOnly = \$false/u.test(scripts[2]), 'an exact window handle is never skipped');

  console.log(`app launch browser title smoke ok: ${checks} checks`);
})().catch((error) => { console.error(error); process.exit(1); });
