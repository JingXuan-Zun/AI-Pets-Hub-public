const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = path.resolve(__dirname, '../electron');
let completed = false;
process.once('beforeExit', () => {
  if (!process.exitCode) assert.ok(completed, 'Integration ended with an unresolved fixture gate');
});
const settle = promise => promise.then(value => ({ value }), error => ({ error: error.message }));
const tick = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

function nativeInfo(label) {
  return {
    cpu: { model: label + ' CPU', manufacturer: 'vendor', physicalCores: 4, logicalCores: 8, maxClockMHz: 3200 },
    computer: { model: label, manufacturer: 'maker', totalPhysicalMemoryBytes: 16384 },
    memory: { totalVisibleBytes: 12288, freePhysicalBytes: 4096 },
    os: { caption: 'Windows', displayVersion: 'fixture', version: '10.0', buildNumber: '123', architecture: 'native-arch', installDate: 'install', lastBootUpTime: 'boot' },
    gpu: { name: label + ' native GPU', adapterRamBytes: 8192 },
    errors: [' warning ', '', 7, 'warning'],
  };
}

async function scenario(nativeMode, gpuMode) {
  const cache = new Map(), files = new Map(), writes = [], cleanups = [], executions = [], nativePending = [], gpuPending = [], trace = [];
  let now = 100, random = 0, writeIndex = 0, featureIndex = 0, queryIndex = 0;
  const platform = nativeMode === 'linux' ? 'linux' : 'win32';
  const hostProcess = { platform, pid: 42, versions: { node: 'fixture-node', chrome: 'fixture-chrome', electron: 'fixture-electron' } };
  const os = {
    tmpdir: () => '/fixture/system-info',
    cpus: () => { trace.push('cpus'); return [{ model: ' Node CPU ', speed: 2000 }, { model: 'second', speed: 1 }]; },
    freemem: () => 128, totalmem: () => 1024, uptime: () => 3.5,
    arch: () => 'node-arch', release: () => 'node-release', type: () => 'node-type', version: () => 'node-version',
  };
  const fakeFs = {
    writeFileSync(file, text, encoding) {
      const index = writeIndex++;
      assert.ok(file.startsWith('/fixture/system-info/desktop-pet-system-info-42-'));
      assert.equal(encoding, 'utf8');
      assert.equal(text, production.getWindowsSystemInfoPowerShellScript());
      if (index === 0 && nativeMode === 'write-failure') throw new Error('fixture write failure');
      assert.ok(!files.has(file), 'Concurrent fixture paths must be distinct');
      files.set(file, text); writes.push(file);
    },
    unlink(file, callback) {
      assert.ok(files.has(file), 'Only fixture-backed scripts may be cleaned up');
      files.delete(file); cleanups.push(file); callback(null);
    },
  };
  function execFile(command, args, options, callback) {
    assert.equal(command, 'powershell.exe');
    assert.deepEqual(args.slice(0, 4), ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File']);
    assert.deepEqual(options, { windowsHide: true, encoding: 'utf8', timeout: 8000, maxBuffer: 1024 * 1024 });
    assert.ok(files.has(args[4]));
    const index = executions.length;
    executions.push(args[4]); trace.push('native-start');
    if (index === 0 && nativeMode === 'spawn-failure') throw new Error('fixture spawn failure');
    const complete = () => {
      let stdout = JSON.stringify(nativeInfo(index === (nativeMode === 'write-failure' ? 1 : 2) ? 'peer' : 'primary-' + index));
      let error = null, stderr = '';
      if (index === 0) {
        if (nativeMode === 'partial') stdout = JSON.stringify({ cpu: { model: 'partial CPU', physicalCores: 4 }, computer: { totalPhysicalMemoryBytes: 8192 }, gpu: [], errors: [' partial '] });
        if (nativeMode === 'empty') stdout = ' ';
        if (nativeMode === 'native-error') stdout = JSON.stringify({ error: ' denied ' });
        if (nativeMode === 'malformed') stdout = 'invalid-json';
        if (nativeMode === 'process-error') { error = new Error('fixture process failure'); stdout = ''; stderr = ' stderr '; }
        if (nativeMode === 'output-with-error') error = new Error('fixture nonzero exit');
      }
      callback(error, stdout, stderr);
    };
    if (index < (nativeMode === 'write-failure' ? 1 : 2)) nativePending.push(complete);
    else queueMicrotask(complete);
  }
  const boundaries = { fs: fakeFs, os, path: path.posix, child_process: { execFile } };
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    assert.equal(path.dirname(file), base);
    assert.match(path.basename(file), /^systemInfo.*\.cjs$/);
    const module = { exports: {} }; cache.set(file, module);
    const requireLocal = name => {
      if (name.startsWith('./')) return load(path.resolve(path.dirname(file), name));
      assert.ok(Object.hasOwn(boundaries, name), 'Unexpected host boundary: ' + name);
      return boundaries[name];
    };
    new Function('require', 'module', 'process', 'Date', 'Math', fs.readFileSync(file, 'utf8'))(requireLocal, module, hostProcess, { now: () => ++now }, { ...Math, max: Math.max, round: Math.round, random: () => (++random) / 100 });
    return module.exports;
  }
  const production = load(path.join(base, 'systemInfoService.cjs'));
  const statusA = { app: 'primary' }, statusB = { app: 'peer' };
  const appA = {
    getGPUFeatureStatus() {
      assert.equal(this, appA); trace.push('primary-feature');
      if (featureIndex++ === 0 && gpuMode === 'feature-throw') throw new Error('fixture feature failure');
      return statusA;
    },
    getGPUInfo(kind) {
      assert.equal(this, appA); assert.equal(kind, 'basic'); trace.push('primary-gpu-start');
      const index = queryIndex++;
      return new Promise((resolve, reject) => gpuPending.push(() => {
        if (index === 0 && gpuMode === 'reject') { reject(new Error('fixture GPU failure')); return; }
        if (index === 0 && gpuMode === 'invalid-device') { resolve({ gpuDevice: [{ deviceString: { toString() { throw new Error('fixture device conversion'); } } }] }); return; }
        resolve({ gpuDevice: [{ name: 'primary electron GPU ' + index, deviceId: index, active: true }] });
      }));
    },
  };
  const appB = {
    getGPUFeatureStatus() { assert.equal(this, appB); return statusB; },
    getGPUInfo(kind) { assert.equal(this, appB); assert.equal(kind, 'basic'); return Promise.resolve({ gpuDevice: [{ name: 'peer electron GPU' }] }); },
  };
  const primary = production.createSystemInfoService({ app: gpuMode === 'missing-api' ? undefined : appA });
  const peer = production.createSystemInfoService({ app: appB });
  assert.equal(writes.length, 0, 'Construction must not collect metrics');
  assert.equal(cache.size, 8, 'All actual production modules must run through the loader');
  let firstDone = false, secondDone = false;
  const first = settle(primary.getSystemInfo()).then(result => { firstDone = true; return result; });
  const second = settle(primary.getSystemInfo()).then(result => { secondDone = true; return result; });
  const peerPromise = settle(peer.getSystemInfo());
  await tick();
  assert.equal(nativePending.length, platform === 'linux' ? 0 : ['write-failure', 'spawn-failure'].includes(nativeMode) ? 1 : 2);
  assert.equal(gpuPending.length, gpuMode === 'missing-api' ? 0 : gpuMode === 'feature-throw' ? 1 : 2, 'Native and GPU queries must start before either gate is released');
  // The primary requests are gated; the peer must complete independently.
  if (nativeMode !== 'linux' || gpuMode !== 'missing-api') assert.equal(secondDone, false);
  if (!['write-failure'].includes(nativeMode) && gpuMode !== 'feature-throw' && !(nativeMode === 'linux' && gpuMode === 'missing-api')) assert.equal(firstDone, false);
  const peerResult = await peerPromise;
  assert.ok(peerResult.value);
  assert.equal(peerResult.value.gpu.featureStatus, statusB);
  assert.equal(peerResult.value.nodeVersion, 'fixture-node');
  assert.equal(peerResult.value.chromeVersion, 'fixture-chrome');
  assert.equal(peerResult.value.electronVersion, 'fixture-electron');
  assert.equal(peerResult.value.osRelease, 'node-release');
  assert.equal(peerResult.value.osType, 'node-type');
  assert.equal(peerResult.value.uptimeSeconds, 4);
  if (platform === 'win32') {
    assert.equal(executions.length, nativeMode === 'write-failure' ? 2 : 3, 'Each request collects separately');
    assert.equal(peerResult.value.cpu.source, 'windows-native');
    assert.equal(peerResult.value.computer.model, 'peer');
  } else {
    assert.equal(writes.length, 0); assert.equal(executions.length, 0);
    assert.equal(peerResult.value.cpu.model, 'Node CPU');
    assert.equal(peerResult.value.gpu.devices[0].deviceString, 'peer electron GPU');
  }
  for (const complete of nativePending) complete();
  for (const complete of gpuPending) complete();
  const [one, two] = await Promise.all([first, second]);
  if (nativeMode === 'write-failure') assert.equal(one.error, 'fixture write failure');
  else if (gpuMode === 'feature-throw') assert.equal(one.error, 'fixture feature failure');
  else {
    assert.ok(one.value);
    assert.equal(one.value.gpu.featureStatus, gpuMode === 'missing-api' ? null : statusA);
    if (['empty', 'native-error', 'malformed', 'process-error', 'spawn-failure', 'linux'].includes(nativeMode)) {
      assert.equal(one.value.cpu.model, 'Node CPU');
      assert.equal(one.value.cpu.source, 'node-os');
      assert.equal(one.value.memory.totalBytes, 1024);
      assert.equal(one.value.osVersion, 'node-version');
      assert.equal(one.value.gpu.source, 'electron');
      if (nativeMode === 'native-error') assert.equal(one.value.dataSources.nativeError, 'denied');
      if (nativeMode === 'process-error') assert.equal(one.value.dataSources.nativeError, 'fixture process failure: stderr');
      if (nativeMode === 'spawn-failure') assert.equal(one.value.dataSources.nativeError, 'fixture spawn failure');
      if (nativeMode === 'malformed') assert.ok(one.value.dataSources.nativeError.length > 0);
    } else if (nativeMode === 'partial') {
      assert.equal(one.value.cpu.model, 'partial CPU');
      assert.equal(one.value.cpu.logicalCores, 2);
      assert.equal(one.value.memory.totalBytes, 8192);
      assert.equal(one.value.gpu.source, 'electron');
      assert.deepEqual(one.value.dataSources.nativeWarnings, ['partial']);
    } else {
      assert.equal(one.value.cpu.model, 'primary-0 CPU');
      assert.equal(one.value.cpu.logicalCores, 8);
      assert.equal(one.value.cpu.physicalCores, 4);
      assert.equal(one.value.memory.totalBytes, 12288);
      assert.equal(one.value.memory.installedBytes, 16384);
      assert.equal(one.value.osVersion, '10.0 Build 123');
      assert.equal(one.value.gpu.source, 'windows-native');
      assert.deepEqual(one.value.dataSources.nativeWarnings, ['warning', 'warning']);
    }
    if (gpuMode === 'reject') assert.equal(one.value.gpu.error, 'fixture GPU failure');
    if (gpuMode === 'invalid-device') assert.equal(one.value.gpu.error, 'fixture device conversion');
  }
  assert.ok(two.value, 'Independent request must recover after first failure');
  assert.equal(two.value.gpu.featureStatus, gpuMode === 'missing-api' ? null : statusA);
  assert.equal(peerResult.value.gpu.featureStatus, statusB, 'Peer result must remain unchanged');
  const previousGates = gpuPending.length;
  const retryPromise = settle(primary.getSystemInfo());
  await tick();
  for (const complete of gpuPending.slice(previousGates)) complete();
  const retry = await retryPromise;
  assert.ok(retry.value, 'A later call must succeed after completion or failure');
  assert.equal(retry.value.gpu.featureStatus, gpuMode === 'missing-api' ? null : statusA);
  assert.equal(retry.value.cpu.source, platform === 'win32' ? 'windows-native' : 'node-os');
  assert.equal(retry.value.dataSources.nativeError, '');
  assert.equal(peerResult.value.gpu.featureStatus, statusB);
  await tick();
  assert.equal(files.size, 0, 'All written fixture scripts must be cleaned, including synchronous spawn failure');
  assert.equal(new Set(cleanups).size, cleanups.length, 'Each completed script cleaned once');
  assert.equal(cleanups.length, writes.length);
  assert.equal(trace.filter(value => value === 'cpus').length, (one.value ? 4 : 3) * 2);
  assert.equal(cache.size, 8);
}

(async () => {
  const scenarios = ['success', 'partial', 'empty', 'native-error', 'malformed', 'process-error', 'output-with-error', 'write-failure', 'spawn-failure', 'linux'].map(mode => [mode, 'success']);
  scenarios.push(['success', 'reject'], ['success', 'feature-throw'], ['success', 'invalid-device'], ['linux', 'missing-api']);
  for (const [native, gpu] of scenarios) await scenario(native, gpu);
  completed = true;
  console.log(`System info actual root integration passed: ${scenarios.length} scenarios, 8 actual production modules, concurrent independent collection, peer isolation, native/GPU fallbacks and failures; no real process, OS query or user data writes.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
