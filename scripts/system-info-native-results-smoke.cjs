const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const rules = require('../electron/systemInfoRules.cjs');
const { normalizeWindowsSystemInfo: normalize } = require('../electron/systemInfoNativeResults.cjs');

const root = path.resolve(__dirname, '..');
const parse = text => ts.createSourceFile('fixture.cjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const nativeText = fs.readFileSync(path.join(root, 'electron/systemInfoNativeResults.cjs'), 'utf8');
const nativeAst = parse(nativeText);
const functions = nativeAst.statements.filter(ts.isFunctionDeclaration);
const printer = ts.createPrinter();
const print = (node, ast) => printer.printNode(ts.EmitHint.Unspecified, node, ast);
assert.ok(nativeText.split('\n').length <= 300);
assert.equal(functions.length, 5);
for (const fn of functions) {
  assert.ok(nativeAst.getLineAndCharacterOfPosition(fn.end).line - nativeAst.getLineAndCharacterOfPosition(fn.getStart(nativeAst)).line + 1 <= 50, fn.name.text);
}

let previous;
if (process.argv[2]) {
  const oldAst = parse(fs.readFileSync(process.argv[2], 'utf8'));
  const oldFn = oldAst.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'normalizeWindowsSystemInfo');
  previous = new Function(...Object.keys(rules), oldFn.getText(oldAst) + '\nreturn normalizeWindowsSystemInfo;')(...Object.values(rules));
  let restored = functions.find(n => n.name.text === 'normalizeWindowsSystemInfo').getText(nativeAst);
  for (const fn of functions.filter(n => n.name.text !== 'normalizeWindowsSystemInfo')) {
    const object = fn.body.statements[0].expression.getText(nativeAst);
    restored = restored.replace(fn.name.text + '(' + fn.parameters[0].name.text + ')', object);
  }
  const restoredAst = parse(restored);
  assert.equal(print(oldFn, oldAst), print(restoredAst.statements[0], restoredAst));
  const nextAst = parse(fs.readFileSync(path.join(root, 'electron/systemInfoService.cjs'), 'utf8'));
  const imports = n => ts.isVariableStatement(n) && /require\('\.\/systemInfo(?:Rules|NativeResults)\.cjs'\)/.test(n.getText());
  assert.deepEqual(oldAst.statements.filter(n => n !== oldFn && !imports(n)).map(n => print(n, oldAst)), nextAst.statements.filter(n => !imports(n)).map(n => print(n, nextAst)));
  const remainingRules = nextAst.statements.find(n => ts.isVariableStatement(n) && n.getText().includes("require('./systemInfoRules.cjs')"));
  assert.deepEqual(remainingRules.declarationList.declarations[0].name.elements.map(n => n.name.text), ['toFiniteNumber', 'normalizeGpuDevice']);
}

function outcome(fn, input) {
  try { return { value: fn(input) }; }
  catch (error) { return { error: error.name, message: error.message }; }
}
const results = [];
function check(input) {
  const result = outcome(normalize, input);
  if (previous) assert.deepEqual(result, outcome(previous, input));
  results.push(result);
}

const values = [undefined, null, false, true, 0, -1, 0.49, 0.5, 1.5, NaN, Infinity, '', ' 12.5 ', ' invalid ', [], {}, 3n, Symbol('fixture'), { valueOf() { throw new Error('conversion failure'); } }];
const fields = {
  computer: ['manufacturer', 'model', 'totalPhysicalMemoryBytes'],
  cpu: ['logicalCores', 'manufacturer', 'maxClockMHz', 'model', 'physicalCores'],
  memory: ['freePhysicalBytes', 'totalVisibleBytes'],
  os: ['architecture', 'buildNumber', 'caption', 'displayVersion', 'editionId', 'installDate', 'lastBootUpTime', 'version'],
};
for (const value of values) {
  check(value);
  check({ error: value });
  check({ gpu: value });
  check({ gpu: [null, false, value, { name: ' GPU ', adapterRamBytes: '8192' }] });
  check({ errors: value });
  check({ errors: [null, false, value, ' warning ', '', 'warning'] });
  for (const [section, keys] of Object.entries(fields)) {
    check({ [section]: value });
    for (const key of keys) check({ [section]: { [key]: value } });
  }
}

function traced(fn, failAt) {
  const calls = [];
  const input = {};
  for (const [section, keys] of Object.entries(fields)) {
    const group = {};
    for (const key of keys) Object.defineProperty(group, key, { get() {
      const name = section + '.' + key;
      calls.push(name);
      if (name === failAt) throw new Error('getter: ' + name);
      return key.includes('Bytes') || key.includes('Cores') || key === 'maxClockMHz' ? ' 2.5 ' : ' text ';
    } });
    Object.defineProperty(input, section, { get() { calls.push(section); return group; } });
  }
  input.gpu = [{ name: ' GPU ' }];
  input.errors = [' warning '];
  return { outcome: outcome(fn, input), calls };
}
for (const failAt of [undefined, ...Object.entries(fields).flatMap(([section, keys]) => keys.map(key => section + '.' + key))]) {
  const result = traced(normalize, failAt);
  if (previous) assert.deepEqual(result, traced(previous, failAt));
  results.push(result);
}

assert.deepEqual(normalize(null), { error: '' });
assert.deepEqual(normalize({ error: ' denied ', cpu: { model: 'ignored' } }), { error: 'denied' });
const sample = normalize({ cpu: { physicalCores: 0.49, logicalCores: 1.5 }, computer: { totalPhysicalMemoryBytes: '8192' }, memory: { freePhysicalBytes: -1 }, gpu: { name: ' GPU ' }, errors: [' warning ', 7, '', 'warning'] });
assert.equal(sample.cpu.physicalCores, 0);
assert.equal(sample.cpu.logicalCores, 2);
assert.equal(sample.computer.totalPhysicalMemoryBytes, 8192);
assert.equal(sample.memory.freePhysicalBytes, -1);
assert.equal(sample.gpu.length, 1);
assert.equal(sample.gpu[0].source, 'windows-native');
assert.deepEqual(sample.warnings, ['warning', 'warning']);
assert.deepEqual(Object.keys(sample), ['computer', 'cpu', 'gpu', 'memory', 'os', 'source', 'warnings']);

const digest = crypto.createHash('sha256').update(JSON.stringify(results)).digest('hex');
const expected = '0b61bffae628d41efba47e7f07eb3773d40ec758db172d87893b3acb0f408993';
assert.equal(digest, expected);
console.log(`system-info-native-results: ${results.length} cases passed; ${digest}${previous ? '; restored function and remaining root AST unchanged' : ''}`);
