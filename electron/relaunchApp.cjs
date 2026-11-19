const path = require('node:path');
const { portableExePath } = require('./appUpdateFullInstall.cjs');

// Restarting the app (found 11-19: after an update users had to open the pet again by hand).
// The release is a portable exe: a launcher that unpacks the app to a fixed temp folder, runs it,
// and deletes that folder once it quits. Plain app.relaunch() restarts the unpacked copy, which
// is being deleted; restarting the launcher at once would race its cleanup of the same folder.
// So for the portable build a hidden PowerShell waits until the old launcher has exited
// (it is this process's parent), then starts the exe the user keeps. The dev app and unpacked
// folders use Electron's own relaunch as before.

const WAIT_SECONDS = 120;

const quote = (value) => `'${String(value).replace(/'/gu, "''")}'`;

/** The PowerShell that waits for the launcher (only if it really is that exe), then starts the target. */
function waitThenStartScript({ args, launcherPid, launcherPath, target }) {
  const argList = args.length ? ` -ArgumentList @(${args.map((arg) => quote(arg.includes(' ') ? `"${arg}"` : arg)).join(',')})` : '';
  return [
    `$p = Get-Process -Id ${Number(launcherPid) || 0} -ErrorAction SilentlyContinue`,
    `if ($p -and $p.Path -and ($p.Path -ieq ${quote(launcherPath)})) { Wait-Process -Id $p.Id -Timeout ${WAIT_SECONDS} -ErrorAction SilentlyContinue }`,
    `Start-Process -FilePath ${quote(target)}${argList}`,
  ].join('; ');
}

/** Plans the restart: a given exe (a downloaded new version), else the kept portable exe, else this process. */
function relaunchPlan({ args = process.argv.slice(1), env = process.env, execPath = null, ppid = process.ppid } = {}) {
  const launcher = portableExePath(env);
  if (!launcher) return { args, execPath, kind: 'electron' };
  const target = execPath || launcher;
  const script = waitThenStartScript({ args, launcherPid: ppid, launcherPath: launcher, target });
  const powershell = path.join(env.SystemRoot || process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  return { args: ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-EncodedCommand', encoded], execPath: powershell, kind: 'portable', script, target };
}

function relaunchApp(app, options = {}) {
  const plan = relaunchPlan(options);
  if (plan.kind === 'electron') {
    app.relaunch(plan.execPath ? { args: plan.args, execPath: plan.execPath } : { args: plan.args });
    return plan;
  }
  // Electron's own relauncher starts the waiter once this process has quit. (A child spawned
  // from Node dies with this process, and a detached PowerShell quits without running: both
  // tried 11-19.)
  app.relaunch({ args: plan.args, execPath: plan.execPath });
  return plan;
}

module.exports = { relaunchApp, relaunchPlan };
