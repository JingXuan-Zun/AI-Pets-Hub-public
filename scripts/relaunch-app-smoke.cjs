// Restart after an update (11-19): the portable build restarts the exe the user keeps, and only
// once the old launcher has exited (it deletes the temp folder the new one unpacks into).
// Checked by hand 11-19 that Electron's relauncher really starts it after the app quits.
const assert = require('node:assert/strict');
const { execFileSync, spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { relaunchPlan } = require('../electron/relaunchApp.cjs');

let checks = 0;
const check = (condition, label) => { assert.ok(condition, label); checks += 1; };
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

async function main() {
  // Dev app / unpacked folder: Electron's own relaunch.
  let plan = relaunchPlan({ args: ['--x'], env: {} });
  check(plan.kind === 'electron' && plan.args[0] === '--x' && !plan.execPath, 'dev app: plain relaunch');

  // Portable: the kept exe, never the temp copy.
  const kept = 'D:\\Apps\\AI Pets Hub\\AI-Pets-Hub-0.5.0.exe';
  plan = relaunchPlan({ args: [], env: { PORTABLE_EXECUTABLE_FILE: kept }, ppid: 1234 });
  check(plan.kind === 'portable' && plan.target === kept, 'portable: restarts the exe the user keeps');
  check(/powershell\.exe$/iu.test(plan.execPath) && plan.args.includes('-EncodedCommand'), 'through Electron relaunching a hidden PowerShell');
  check(plan.script.includes('Get-Process -Id 1234') && plan.script.includes("'D:\\Apps\\AI Pets Hub\\AI-Pets-Hub-0.5.0.exe'"), 'waits for its own launcher');
  plan = relaunchPlan({ args: [], env: { PORTABLE_EXECUTABLE_FILE: kept }, execPath: 'D:\\Apps\\new.exe', ppid: 1 });
  check(plan.target === 'D:\\Apps\\new.exe', 'a downloaded new exe is started instead');
  plan = relaunchPlan({ args: [], env: { PORTABLE_EXECUTABLE_FILE: "D:\\it's\\a.exe" }, ppid: 1 });
  check(plan.script.includes("'D:\\it''s\\a.exe'"), 'quotes in paths are escaped');

  if (process.platform !== 'win32') return;
  // Real run: a stand-in launcher (ping, ~3 s) and a target that leaves a mark when started.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'relaunch-smoke-'));
  const mark = path.join(dir, 'started.txt');
  const ping = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'PING.EXE');
  const launcher = spawn(ping, ['-n', '4', '127.0.0.1'], { stdio: 'ignore', windowsHide: true });
  let launcherDone = false;
  launcher.on('exit', () => { launcherDone = true; });
  // The target: a batch file that leaves the mark (no arguments, like a real restart).
  const cmd = path.join(dir, 'target.cmd');
  fs.writeFileSync(cmd, `@echo started> "${mark}"\r\n`);
  plan = relaunchPlan({ args: [], env: { PORTABLE_EXECUTABLE_FILE: ping }, execPath: cmd, ppid: launcher.pid });
  // Exactly what Electron's relauncher will run (it outlives the app; here the smoke stays alive).
  spawn(plan.execPath, plan.args, { stdio: 'ignore', windowsHide: true });
  await sleep(1200);
  check(!fs.existsSync(mark), 'nothing starts while the old launcher is still running');
  for (let i = 0; i < 40 && !fs.existsSync(mark); i += 1) await sleep(250);
  check(launcherDone && fs.existsSync(mark), 'it starts right after the launcher has exited');

  // A parent that is not the launcher (path differs): start at once, no waiting.
  fs.rmSync(mark, { force: true });
  const other = spawn(ping, ['-n', '30', '127.0.0.1'], { stdio: 'ignore', windowsHide: true });
  plan = relaunchPlan({ args: [], env: { PORTABLE_EXECUTABLE_FILE: 'C:\\nowhere\\x.exe' }, execPath: cmd, ppid: other.pid });
  execFileSync(plan.execPath, plan.args, { stdio: 'ignore', windowsHide: true });
  for (let i = 0; i < 20 && !fs.existsSync(mark); i += 1) await sleep(250);
  check(fs.existsSync(mark), 'an unrelated parent is not waited for');
  other.kill();
  fs.rmSync(dir, { force: true, recursive: true });
}

main().then(() => console.log(`relaunch app smoke ok: ${checks} checks`)).catch((error) => { console.error(error); process.exit(1); });
