const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'electron/systemInfoMerge.cjs'), 'utf8');
const parse = text => ts.createSourceFile('fixture.cjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const ast = parse(source);
const functions = ast.statements.filter(ts.isFunctionDeclaration);
const names = ['mergeCpuInfo', 'mergeMemoryInfo', 'mergeOsInfo', 'mergeGpuInfo', 'getOsVersion'];
assert.deepEqual(functions.map(n => n.name.text), names);
assert.ok(source.split('\n').length <= 300);
for (const node of functions) assert.ok(ast.getLineAndCharacterOfPosition(node.end).line - ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1 <= 50);
let previousSource;
if (process.argv[2]) {
  const oldAst = parse(fs.readFileSync(process.argv[2], 'utf8'));
  const moved = oldAst.statements.filter(n => ts.isFunctionDeclaration(n) && names.includes(n.name.text));
  assert.deepEqual(moved.map(n => n.getText(oldAst)), functions.map(n => n.getText(ast)));
  previousSource = "const os = require('os');\n" + moved.map(n => n.getText(oldAst)).join('\n') + '\nmodule.exports = { mergeCpuInfo, mergeMemoryInfo, mergeOsInfo, mergeGpuInfo };';
  const nextAst = parse(fs.readFileSync(path.join(root, 'electron/systemInfoService.cjs'), 'utf8'));
  const printer = ts.createPrinter();
  const imports = n => ts.isVariableStatement(n) && n.getText().includes('require(');
  const print = (n, parent) => printer.printNode(ts.EmitHint.Unspecified, n, parent);
  assert.deepEqual(oldAst.statements.filter(n => !moved.includes(n) && !imports(n)).map(n => print(n, oldAst)), nextAst.statements.filter(n => !imports(n)).map(n => print(n, nextAst)));
}

function run(text, name, args, versionMode = 'available') {
  const calls = [];
  const os = {};
  for (const key of ['arch', 'release', 'type']) os[key] = () => { calls.push(key); return 'fixture-' + key; };
  if (versionMode !== 'absent') os.version = () => {
    calls.push('version');
    if (versionMode === 'throw') throw new Error('version failure');
    return versionMode === 'empty' ? '' : 'fixture-version';
  };
  const module = { exports: {} };
  new Function('require', 'module', 'process', text)(name => { assert.equal(name, 'os'); return os; }, module, { platform: 'fixture-platform' });
  let result;
  try {
    const value = module.exports[name](...args);
    const identities = name === 'mergeGpuInfo' ? {
      nativeArray: value.devices === args[1]?.gpu,
      electronArray: value.devices === args[0]?.devices,
      firstElectronDevice: Boolean(value.devices.length && value.devices[0] === args[0]?.devices?.[0]),
      featureStatus: value.featureStatus === args[0]?.featureStatus,
    } : undefined;
    result = { value, identities };
  } catch (error) { result = { error: error.name, message: error.message }; }
  return { result, calls };
}
const results = [];
function check(name, args, versionMode) {
  const before = JSON.stringify(args);
  const result = run(source, name, args, versionMode);
  if (previousSource) assert.deepEqual(result, run(previousSource, name, args, versionMode));
  assert.equal(JSON.stringify(args), before, 'merge must not mutate inputs');
  results.push(result);
  return result;
}

const nodeCpu = { logicalCores: 8, model: 'node CPU', speedMHz: 2000 };
const nodeMemory = { freeBytes: 128, totalBytes: 1024 };
const numbers = [undefined, null, 0, -1, 0.5, 2, NaN, Infinity, '4'];
const strings = [undefined, null, '', ' ', 'native', 0, 7, false];
for (const model of strings) {
  for (const count of numbers) {
    for (const speed of numbers) check('mergeCpuInfo', [nodeCpu, { cpu: { model, manufacturer: model, logicalCores: count, physicalCores: count, maxClockMHz: speed } }]);
  }
}
for (const visible of numbers) {
  for (const installed of numbers) {
    for (const free of numbers) check('mergeMemoryInfo', [nodeMemory, { memory: { totalVisibleBytes: visible, freePhysicalBytes: free }, computer: { totalPhysicalMemoryBytes: installed } }]);
  }
}
for (const caption of strings) {
  for (const version of strings) {
    for (const build of [undefined, '', '123', 0]) {
      for (const mode of ['available', 'absent', 'empty', 'throw']) check('mergeOsInfo', [{ os: { caption, version, buildNumber: build, architecture: caption, displayVersion: build, installDate: version, lastBootUpTime: version } }], mode);
    }
  }
}
const devices = [undefined, null, false, {}, [], [{ deviceString: 'GPU', source: 'old' }], [null, { deviceId: '2' }]];
for (const native of devices) {
  for (const electron of devices) {
    for (const error of ['', 'GPU failure']) check('mergeGpuInfo', [{ devices: electron, featureStatus: { fixture: true }, error, source: 'old' }, { gpu: native }]);
  }
}
for (const native of [undefined, null, {}, { error: 'native failure' }]) {
  check('mergeCpuInfo', [nodeCpu, native]);
  check('mergeMemoryInfo', [nodeMemory, native]);
  check('mergeOsInfo', [native]);
  check('mergeGpuInfo', [undefined, native]);
}

assert.equal(run(source, 'mergeCpuInfo', [nodeCpu, { cpu: { logicalCores: 0 } }]).result.value.logicalCores, 8);
assert.equal(run(source, 'mergeMemoryInfo', [nodeMemory, { memory: { totalVisibleBytes: 0, freePhysicalBytes: 0 }, computer: { totalPhysicalMemoryBytes: 2048 } }]).result.value.totalBytes, 2048);
const fallback = run(source, 'mergeOsInfo', [{}]);
assert.deepEqual(fallback.calls, ['version', 'arch', 'release', 'type', 'version']);
assert.equal(fallback.result.value.osVersion, 'fixture-version');
const nativeGpu = [{ deviceString: 'native' }];
const preferred = run(source, 'mergeGpuInfo', [{ devices: [{ deviceString: 'electron' }], error: 'retained' }, { gpu: nativeGpu }]);
assert.equal(preferred.result.identities.nativeArray, true);
assert.equal(preferred.result.value.error, 'retained');
assert.equal(preferred.result.value.source, 'windows-native');

const digest = crypto.createHash('sha256').update(JSON.stringify(results)).digest('hex');
const expected = '8a6d5cbc8c0958444c5d7abf1e405202c0e8913ea14980371449068f673ee7be';
assert.equal(digest, expected);
console.log(`system-info-merge: ${results.length} cases passed; ${digest}${previousSource ? '; original merge functions and remaining root AST unchanged' : ''}`);
