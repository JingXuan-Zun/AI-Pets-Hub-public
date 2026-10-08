const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.resolve(__dirname, '../electron/systemInfoWindowsCollector.cjs'), 'utf8');

async function scenario(mode, cleanup, asynchronous, customOptions) {
  const calls = [];
  const originalError = new Error('original collection failure');
  const fakeFs = {
    writeFileSync(file, text, encoding) { calls.push(['write', file, text, encoding]); },
    unlink(file, callback) {
      calls.push(['unlink', file]);
      if (cleanup === 'throw') throw new Error('cleanup synchronous failure');
      queueMicrotask(() => callback(cleanup === 'callback-error' ? new Error('cleanup callback failure') : null));
    },
  };
  const execFile = (command, args, options, callback) => {
    calls.push(['exec', command, args, options]);
    if (mode === 'spawn-throw') throw originalError;
    const finish = () => callback(mode === 'callback-error' ? originalError : null, mode === 'success' ? 'fixture output' : '', ' original stderr ');
    if (asynchronous) queueMicrotask(finish);
    else finish();
  };
  const module = { exports: {} };
  const boundary = {
    fs: fakeFs, child_process: { execFile }, os: { tmpdir: () => '/fixture' }, path: path.posix,
    './systemInfoWindowsScript.cjs': { getWindowsSystemInfoPowerShellScript: () => 'fixture script' },
  };
  new Function('require', 'module', 'process', 'Date', 'Math', source + '\nmodule.exports.runTemporaryPowerShellScript = runTemporaryPowerShellScript;')(
    name => { assert.ok(Object.hasOwn(boundary, name)); return boundary[name]; }, module,
    { pid: 42, platform: 'win32' }, { now: () => 123 }, { round: Math.round, random: () => 0.25 },
  );
  const options = customOptions ? { timeout: 8000, maxBuffer: 4096 } : undefined;
  const result = await module.exports.runTemporaryPowerShellScript('fixture script', options).then(value => ({ value }), error => ({ error }));
  if (mode === 'success') assert.equal(result.value, 'fixture output');
  else {
    assert.equal(result.error, originalError, 'Cleanup must preserve original error identity');
    assert.equal(originalError.stderr, mode === 'callback-error' ? ' original stderr ' : undefined);
  }
  assert.deepEqual(calls.map(call => call[0]), ['write', 'exec', 'unlink']);
  assert.equal(calls[0][1], '/fixture/desktop-pet-system-info-42-123-25000.ps1');
  assert.equal(calls[2][1], calls[0][1], 'Clean up only the written script');
  assert.deepEqual(calls[1].slice(1), [
    'powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', calls[0][1]],
    { windowsHide: true, encoding: 'utf8', timeout: customOptions ? 8000 : 5000, maxBuffer: customOptions ? 4096 : 1024 * 1024 },
  ]);
}

let completed = false;
process.once('beforeExit', () => { if (!process.exitCode) assert.ok(completed, 'Cleanup regression left a pending collection'); });
(async () => {
  let cases = 0;
  for (const mode of ['spawn-throw', 'success', 'callback-error']) {
    for (const cleanup of ['success', 'throw', 'callback-error']) {
      for (const asynchronous of [false, true]) {
        for (const customOptions of [false, true]) {
          await scenario(mode, cleanup, asynchronous, customOptions);
          cases++;
        }
      }
    }
  }
  completed = true;
  console.log(`System info cleanup passed: ${cases} launch/callback/cleanup failure cases; exactly one cleanup attempt, original result/error identity and default/custom options preserved; fixture boundaries only.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
