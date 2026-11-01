// A pip step that security software freezes must end with a plain error instead of "安装中" forever,
// a slow download that keeps writing files must not be cut off, and "access denied" is explained.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { describeBlockedInstall, runWatchedInstallCommand } = require('../electron/localVoiceRuntimeInstallWatchdog.cjs');

const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'voice-watchdog-'));
const hanging = (candidate, args, options) => new Promise((resolve) => {
  options.signal.addEventListener('abort', () => resolve({ ok: false, exitCode: null, stdout: '', stderr: '' }), { once: true });
});

(async () => {
  await assert.rejects(
    runWatchedInstallCommand({ spawnCommand: hanging, candidate: {}, args: [], options: {}, watchFolders: [folder], runtimeRoot: 'E:\\pet\\python\\local-voice-runtime', label: '安装 PyTorch', stallMs: 300, checkMs: 50 }),
    /安装 PyTorch卡住了.*白名单.*E:\\pet\\python\\local-voice-runtime/su,
  );

  // Silent but still writing (a long download): not stalled.
  let writes = 0;
  const writing = setInterval(() => { fs.writeFileSync(path.join(folder, `part-${writes += 1}`), 'x'.repeat(10)); }, 40);
  const slowDownload = (candidate, args, options) => new Promise((resolve) => {
    const done = setTimeout(() => resolve({ ok: true, exitCode: 0, stdout: '', stderr: '' }), 900);
    options.signal.addEventListener('abort', () => { clearTimeout(done); resolve({ ok: false, exitCode: null, stdout: '', stderr: '' }); }, { once: true });
  });
  const result = await runWatchedInstallCommand({ spawnCommand: slowDownload, candidate: {}, args: [], options: {}, watchFolders: [folder], runtimeRoot: 'E:\\x', label: '下载', stallMs: 300, checkMs: 50 });
  clearInterval(writing);
  assert.equal(result.ok, true, 'growing files keep a quiet step alive');

  assert.match(describeBlockedInstall('Installing torch failed: ERROR: [WinError 5] 拒绝访问。', 'E:\\x'), /被拦截.*白名单.*E:\\x/su);
  assert.equal(describeBlockedInstall('No matching distribution found for torch', 'E:\\x'), 'No matching distribution found for torch');

  fs.rmSync(folder, { recursive: true, force: true });
  console.log('local voice install watchdog smoke passed');
})().catch((error) => { console.error(error); process.exit(1); });
