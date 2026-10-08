const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const rules = require('../electron/systemInfoRules.cjs');

const root = path.resolve(__dirname, '..');
const names = Object.keys(rules);
const parse = (file, text) => ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const rulesText = fs.readFileSync(path.join(root, 'electron/systemInfoRules.cjs'), 'utf8');
const rulesAst = parse('rules.cjs', rulesText);
assert.deepEqual(names, ['toFiniteNumber', 'normalizePositiveInteger', 'normalizeOptionalString', 'normalizeNativeGpuDevice', 'normalizeGpuDevice']);
assert.ok(rulesText.split('\n').length <= 300);
for (const node of rulesAst.statements.filter(ts.isFunctionDeclaration)) {
  const start = rulesAst.getLineAndCharacterOfPosition(node.getStart(rulesAst)).line;
  const end = rulesAst.getLineAndCharacterOfPosition(node.end).line;
  assert.ok(end - start + 1 <= 50, node.name.text);
}

let previous;
if (process.argv[2]) {
  const oldText = fs.readFileSync(process.argv[2], 'utf8');
  const oldAst = parse('old.cjs', oldText);
  const moved = oldAst.statements.filter(n => ts.isFunctionDeclaration(n) && names.includes(n.name.text));
  assert.equal(moved.length, names.length);
  assert.deepEqual(moved.map(n => n.getText(oldAst)), rulesAst.statements.filter(ts.isFunctionDeclaration).map(n => n.getText(rulesAst)));
  previous = new Function(moved.map(n => n.getText(oldAst)).join('\n') + '\nreturn {' + names.join(',') + '};')();
  const nextText = fs.readFileSync(path.join(root, 'electron/systemInfoService.cjs'), 'utf8');
  const nextAst = parse('next.cjs', nextText);
  const printer = ts.createPrinter();
  const canonical = (ast, skip) => ast.statements.filter(n => !skip(n)).map(n => printer.printNode(ts.EmitHint.Unspecified, n, ast));
  assert.deepEqual(canonical(oldAst, n => moved.includes(n)), canonical(nextAst, n => ts.isVariableStatement(n) && n.getText(nextAst).includes("require('./systemInfoRules.cjs')")));
}

function outcome(fn, args) {
  try { return { value: fn(...args) }; }
  catch (error) { return { error: error.name, message: error.message }; }
}

const values = [undefined, null, false, true, 0, -0, -1, 0.49, 0.5, 1.5, NaN, Infinity, -Infinity, '', ' ', ' 2.5 ', 'bad', '0x10', [], [2], {}, 3n, Symbol('fixture'), { valueOf() { return 7; } }, { valueOf() { throw new Error('conversion failure'); } }];
const results = [];
function check(name, args) {
  const result = outcome(rules[name], args);
  if (previous) assert.deepEqual(result, outcome(previous[name], args), name);
  results.push({ name, result });
}

for (const value of values) {
  for (const fallback of [undefined, 0, -3, 'fallback']) {
    check('toFiniteNumber', [value, fallback]);
    check('normalizePositiveInteger', [value, fallback]);
  }
  check('normalizeOptionalString', [value]);
  check('normalizeNativeGpuDevice', [value]);
  check('normalizeGpuDevice', [value]);
}
for (const value of values) {
  for (const name of ['normalizeNativeGpuDevice', 'normalizeGpuDevice']) {
    for (const field of ['adapterRamBytes', 'name', 'deviceString', 'driverVersion', 'pnpDeviceId', 'videoProcessor', 'active', 'deviceId', 'driverVendor', 'vendorId']) {
      check(name, [{ [field]: value }]);
    }
  }
}

assert.equal(rules.toFiniteNumber('bad', 9), 9);
assert.equal(rules.normalizePositiveInteger(0.49, 9), 9);
assert.equal(rules.normalizePositiveInteger(0.5, 9), 1);
assert.equal(rules.normalizeOptionalString(123), '');
assert.equal(rules.normalizeNativeGpuDevice(null), null);
assert.equal(rules.normalizeGpuDevice(false), null);
assert.equal(rules.normalizeNativeGpuDevice({ name: 123 }).deviceString, '');
assert.equal(rules.normalizeGpuDevice({ name: 123 }).deviceString, '123');
assert.equal(rules.normalizeGpuDevice({ deviceString: '', name: 'fallback' }).deviceString, '');
assert.equal(rules.normalizeGpuDevice({ active: 'false' }).active, true);
assert.equal(rules.normalizeNativeGpuDevice({ adapterRamBytes: ' 8192 ' }).adapterRamBytes, 8192);

const serialized = JSON.stringify(results, (_, value) => typeof value === 'number' && (!Number.isFinite(value) || Object.is(value, -0)) ? String(value) + (Object.is(value, -0) ? ':negative-zero' : '') : value);
const digest = crypto.createHash('sha256').update(serialized).digest('hex');
const expected = '2cd628f0a28a7a2263db69aad157f8d04e8173d825620ef62f80e0a91bb6b604';
assert.equal(digest, expected);
console.log(`system-info-rules: ${results.length} cases passed; ${digest}${previous ? '; original functions and remaining root AST unchanged' : ''}`);
