const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ts = require('typescript');
const rules = require('../electron/localProjectInspectorRules.cjs');
const { inspectPackageJson } = require('../electron/localProjectInspectorNode.cjs');
const source = fs.readFileSync(require.resolve('../electron/localProjectInspectorNode.cjs'), 'utf8');
const tree = ts.createSourceFile('node.cjs', source, ts.ScriptTarget.Latest, true);
assert.ok(source.split('\n').length <= 300);
function budgets(node) {
  if (ts.isFunctionLike(node) && node.body) assert.ok(tree.getLineAndCharacterOfPosition(node.end).line - tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1 <= 50);
  ts.forEachChild(node, budgets);
}
budgets(tree);
let old;
if (process.argv[2]) {
  const baseline = fs.readFileSync(process.argv[2], 'utf8');
  const root = ts.createSourceFile('root.cjs', baseline, ts.ScriptTarget.Latest, true);
  const fn = root.statements.find(node => ts.isFunctionDeclaration(node) && node.name.text === 'inspectPackageJson');
  old = new Function(...Object.keys(rules), fn.getText(root) + '\nreturn inspectPackageJson;')(...Object.values(rules));
  function retained(value) {
    value = value.replace(/  selectPackageManager,\r?\n/, '').replace(/  createNodeRunCommand,\r?\n/, '');
    const tree = ts.createSourceFile('root.cjs', value, ts.ScriptTarget.Latest, true);
    return tree.statements.filter(node => !(ts.isFunctionDeclaration(node) && node.name.text === 'inspectPackageJson')
      && !node.getText(tree).includes("require('./localProjectInspectorNode.cjs')"))
      .map(node => ts.createPrinter().printNode(ts.EmitHint.Unspecified, node, tree)).join('\n');
  }
  assert.equal(retained(fs.readFileSync(path.resolve(__dirname, '../electron/localProjectInspectorService.cjs'), 'utf8')), retained(baseline));
}
const outcomes = [];
function run(fn, input, mask, mode = 'normal') {
  const warnings = [], trace = [], failure = Error('controlled failure');
  const entries = ['pnpm-lock.yaml', 'yarn.lock'].filter((_, index) => mask & (1 << index)).map(name => ({ get name() { trace.push(['entry', name]); if (mode === 'entry') throw failure; return name; } }));
  const text = mode === 'convert' || mode === 'convert-error' ? { toString() { trace.push(['convert']); if (mode === 'convert-error') throw failure; return input; } } : input;
  const value = fn(text, entries, '/controlled/project', warnings);
  if (value) {
    assert.ok(value.actions.length <= 8);
    assert.ok(value.actions.every(action => action.risk === 'launch' && action.source === 'package.json'));
    assert.equal(value.info.packageManager, mask & 1 ? 'pnpm' : mask & 2 ? 'yarn' : 'npm');
  }
  return { value, warnings, trace };
}
function compare(input, mask, mode) {
  const actual = run(inspectPackageJson, input, mask, mode);
  if (old) assert.deepEqual(actual, run(old, input, mask, mode));
  outcomes.push(actual);
}
const scripts = { test: 'test', preview: 'preview', dev: 'dev', start: 'start', serve: 'serve', desktop: 'desktop', electron: 'electron', 'bad;name': 'bad', 'test:unit': 'unit', '-x': 'x', '中文': 'invalid', build: 'build', lint: 'lint' };
for (let mask = 0; mask < 128; mask++) for (let lock = 0; lock < 4; lock++) {
  const dependencies = Object.fromEntries(['electron', 'vite', 'next', 'react', 'vue', 'svelte', 'express'].map((name, index) => [name, mask & (1 << index) ? '1' : null]));
  compare(JSON.stringify({ name: 'demo', scripts, dependencies }), lock);
}
for (const input of [undefined, null, '', ' ', '{broken', 'null', '3', 'true', '"value"', '[]', '{}',
  ...[null, [], 'invalid', 3, { dev: false, start: null }, scripts].map(value => JSON.stringify({ name: 123, scripts: value, dependencies: { electron: '1' }, devDependencies: { electron: null, react: '1' } }))])
  for (let lock = 0; lock < 4; lock++) compare(input, lock);
for (const mode of ['convert', 'convert-error', 'entry']) for (let lock = 0; lock < 4; lock++) compare('{"scripts":{"start":"run"}}', lock, mode);
const selected = inspectPackageJson(JSON.stringify({ scripts }), [], '/controlled/project', []);
assert.deepEqual(selected.actions.map(action => action.command), ['npm run dev', 'npm start', 'npm run serve', 'npm run preview', 'npm run desktop', 'npm run electron', 'npm run test', 'npm run test:unit']);
const warningFailure = Error('warning sink');
assert.throws(() => inspectPackageJson('{broken', [], '', { push() { throw warningFailure; } }), error => error === warningFailure);
const hash = crypto.createHash('sha256').update(JSON.stringify(outcomes)).digest('hex');
assert.equal(hash, 'e0af6694b38a5564157f6e56840e9d57d88192933952f1a6dde033f74b5adb5b', 'Reviewed Node detection results and evaluation order remain unchanged');
console.log('Project inspector Node passed: ' + outcomes.length + ' framework/manager/script/JSON/conversion cases; hash ' + hash);
