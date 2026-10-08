const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const rules = require('../electron/systemInfoRules.cjs');
const root = path.resolve(__dirname, '..');
const nodeText = fs.readFileSync(path.join(root, 'electron/systemInfoNodeReadings.cjs'), 'utf8');
const gpuText = fs.readFileSync(path.join(root, 'electron/systemInfoElectronGpu.cjs'), 'utf8');
const parse = text => ts.createSourceFile('fixture.cjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const movedNames = ['normalizeCpuInfo', 'normalizeMemoryInfo', 'getGpuInfo'];
let previousText;
if (process.argv[2]) {
  const oldAst = parse(fs.readFileSync(process.argv[2], 'utf8'));
  const oldFns = oldAst.statements.filter(n => ts.isFunctionDeclaration(n) && movedNames.includes(n.name.text));
  const nodeAst = parse(nodeText);
  const gpuAst = parse(gpuText);
  assert.deepEqual(oldFns.map(n => n.getText(oldAst)), [...nodeAst.statements.filter(n => ts.isFunctionDeclaration(n) && movedNames.includes(n.name.text)), ...gpuAst.statements.filter(ts.isFunctionDeclaration)].map(n => n.getText(n.getSourceFile())));
  previousText = "const os = require('os');\nconst { toFiniteNumber, normalizeGpuDevice } = require('./systemInfoRules.cjs');\n" + oldFns.map(n => n.getText(oldAst)).join('\n') + '\nfunction getUptimeSeconds() { return Math.max(0, Math.round(toFiniteNumber(os.uptime(), 0))); }\nmodule.exports = { normalizeCpuInfo, normalizeMemoryInfo, getUptimeSeconds, getGpuInfo };';
  const nextText = fs.readFileSync(path.join(root, 'electron/systemInfoService.cjs'), 'utf8');
  const restoredAst = parse(nextText.replace('uptimeSeconds: getUptimeSeconds(),', 'uptimeSeconds: Math.max(0, Math.round(toFiniteNumber(os.uptime(), 0))),'));
  const printer = ts.createPrinter();
  const imports = n => ts.isVariableStatement(n) && n.getText().includes('require(');
  const print = (n, ast) => printer.printNode(ts.EmitHint.Unspecified, n, ast);
  assert.deepEqual(oldAst.statements.filter(n => !oldFns.includes(n) && !imports(n)).map(n => print(n, oldAst)), restoredAst.statements.filter(n => !imports(n)).map(n => print(n, restoredAst)));
  const helper = nodeAst.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'getUptimeSeconds');
  assert.equal(helper.body.statements[0].expression.getText(nodeAst), 'Math.max(0, Math.round(toFiniteNumber(os.uptime(), 0)))');
}
for (const text of [nodeText, gpuText]) {
  assert.ok(text.split('\n').length <= 300);
  const ast = parse(text);
  for (const fn of ast.statements.filter(ts.isFunctionDeclaration)) assert.ok(ast.getLineAndCharacterOfPosition(fn.end).line - ast.getLineAndCharacterOfPosition(fn.getStart(ast)).line + 1 <= 50);
}

function load(text, os) {
  const module = { exports: {} };
  new Function('require', 'module', text)(name => {
    if (name === 'os') return os;
    assert.equal(name, './systemInfoRules.cjs');
    return rules;
  }, module);
  return module.exports;
}
function runNode(text, name, fixture) {
  const calls = [];
  const os = {};
  for (const key of ['cpus', 'freemem', 'totalmem', 'uptime']) os[key] = () => {
    calls.push(key);
    if (fixture.failAt === calls.length) throw new Error('OS failure');
    return key === 'cpus' ? fixture.cpus[Math.min(calls.length - 1, fixture.cpus.length - 1)] : fixture[key];
  };
  const api = load(text, os);
  try { return { value: api[name](), calls }; }
  catch (error) { return { error: error.name, message: error.message, calls }; }
}
async function runGpu(text, fixture) {
  const calls = [];
  const status = { fixture: true };
  const app = fixture.absent ? undefined : {};
  if (app && fixture.feature !== 'missing') app.getGPUFeatureStatus = function () {
    assert.equal(this, app);
    calls.push('feature');
    if (fixture.feature === 'throw') throw new Error('feature failure');
    return status;
  };
  if (app && fixture.query !== 'missing') app.getGPUInfo = function (kind) {
    assert.equal(this, app);
    calls.push(['query', kind]);
    if (fixture.query === 'throw') throw new Error('query failure');
    if (fixture.query === 'reject') return Promise.reject('rejected query');
    return Promise.resolve(fixture.raw);
  };
  try {
    const value = await load(text, {}).getGpuInfo(app);
    return { value, statusIdentity: value.featureStatus === status, calls };
  } catch (error) { return { error: error.name, message: error.message, calls }; }
}

(async () => {
  const results = [];
  const values = [undefined, null, false, 0, -1, 0.49, 0.5, 1.5, NaN, Infinity, '', ' 2.5 ', 'bad', 3n, Symbol('fixture'), { valueOf() { throw new Error('conversion failure'); } }];
  const cpus = [undefined, null, {}, [], [null], [{ model: ' CPU ', speed: ' 2000 ' }], [{ model: 123, speed: Infinity }, { model: 'second', speed: 9 }]];
  for (const first of cpus) {
    for (const second of cpus) {
      for (const failAt of [undefined, 1, 2]) {
        const fixture = { cpus: [first, second], failAt };
        const result = runNode(nodeText, 'normalizeCpuInfo', fixture);
        if (previousText) assert.deepEqual(result, runNode(previousText, 'normalizeCpuInfo', fixture));
        results.push(result);
      }
    }
  }
  for (const free of values) {
    for (const total of values) {
      for (const failAt of [undefined, 1, 2]) {
        const fixture = { cpus: [], freemem: free, totalmem: total, failAt };
        const result = runNode(nodeText, 'normalizeMemoryInfo', fixture);
        if (previousText) assert.deepEqual(result, runNode(previousText, 'normalizeMemoryInfo', fixture));
        results.push(result);
      }
    }
    for (const failAt of [undefined, 1]) {
      const fixture = { cpus: [], uptime: free, failAt };
      const result = runNode(nodeText, 'getUptimeSeconds', fixture);
      if (previousText) assert.deepEqual(result, runNode(previousText, 'getUptimeSeconds', fixture));
      results.push(result);
    }
  }
  const rawCases = [undefined, null, {}, { gpuDevice: {} }, { gpuDevice: [] }, { gpuDevice: [null, false, { deviceId: 3, name: ' GPU ', active: 'false' }] }, { gpuDevice: [{ deviceString: { toString() { throw new Error('device conversion'); } } }] }, { get gpuDevice() { throw new Error('device getter'); } }];
  for (const feature of ['missing', 'available', 'throw']) {
    for (const query of ['missing', 'resolve', 'throw', 'reject']) {
      for (const raw of rawCases) {
        const fixture = { feature, query, raw };
        const result = await runGpu(gpuText, fixture);
        if (previousText) assert.deepEqual(result, await runGpu(previousText, fixture));
        results.push(result);
      }
    }
  }
  const absent = await runGpu(gpuText, { absent: true });
  if (previousText) assert.deepEqual(absent, await runGpu(previousText, { absent: true }));
  results.push(absent);
  assert.deepEqual(absent.value, { devices: [], featureStatus: null });
  assert.deepEqual(runNode(nodeText, 'normalizeCpuInfo', { cpus: [[], []] }).calls, ['cpus', 'cpus']);
  assert.equal(runNode(nodeText, 'getUptimeSeconds', { cpus: [], uptime: -1 }).value, 0);
  assert.equal(runNode(nodeText, 'getUptimeSeconds', { cpus: [], uptime: 0.5 }).value, 1);
  assert.deepEqual((await runGpu(gpuText, { feature: 'throw', query: 'resolve' })).calls, ['feature']);
  assert.equal((await runGpu(gpuText, { feature: 'available', query: 'reject' })).value.error, 'rejected query');
  const digest = crypto.createHash('sha256').update(JSON.stringify(results)).digest('hex');
  const expected = '1276aae70e5ab4ab24eb6251d1f86efab22ba8fb27596a5d66d74557af883518';
  assert.equal(digest, expected);
  console.log(`system-info-readings: ${results.length} cases passed; ${digest}${previousText ? '; moved functions and restored root AST unchanged' : ''}`);
})().catch(error => { console.error(error); process.exitCode = 1; });
