const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const entry = require.resolve('../electron/systemInfoService.cjs');
const directory = path.dirname(entry);
const expected = [
  'systemInfoElectronGpu.cjs',
  'systemInfoMerge.cjs',
  'systemInfoNativeResults.cjs',
  'systemInfoNodeReadings.cjs',
  'systemInfoRules.cjs',
  'systemInfoService.cjs',
  'systemInfoWindowsCollector.cjs',
  'systemInfoWindowsScript.cjs',
];
const builtins = new Set(['child_process', 'fs', 'os', 'path']);
const graph = new Map();
const budgets = [];
let functions = 0;

function inspect(file) {
  if (graph.has(file)) return;
  const dependencies = [];
  graph.set(file, dependencies);
  const source = fs.readFileSync(file, 'utf8');
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const lines = source.split('\n').length;
  assert.ok(lines <= 300, path.basename(file) + ' source budget: ' + lines);
  let longest = 0;
  function visit(node) {
    if (ts.isFunctionLike(node) && node.body) {
      functions++;
      const length = tree.getLineAndCharacterOfPosition(node.end).line - tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1;
      longest = Math.max(longest, length);
      assert.ok(length <= 50, path.basename(file) + ':' + (node.name?.getText(tree) ?? 'callback') + ' function budget: ' + length);
    }
    assert.ok(!ts.isImportDeclaration(node), 'Review new import dependency: ' + file);
    if (ts.isCallExpression(node) && node.expression.getText(tree) === 'require') {
      assert.equal(node.arguments.length, 1, 'Require must have one argument');
      assert.ok(ts.isStringLiteral(node.arguments[0]), 'Review dynamic require: ' + file);
      const name = node.arguments[0].text;
      if (name.startsWith('.')) {
        const dependency = path.resolve(path.dirname(file), name);
        assert.equal(path.dirname(dependency), directory, 'Dependency must stay in the reviewed directory');
        assert.ok(expected.includes(path.basename(dependency)), 'Review new production dependency: ' + name);
        dependencies.push(dependency);
        inspect(dependency);
      } else {
        assert.ok(builtins.has(name), 'Review new host dependency: ' + name);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  budgets.push({ file: path.basename(file), lines, longest });
}
inspect(entry);
assert.deepEqual([...graph.keys()].map(file => path.basename(file)).sort(), expected);
assert.deepEqual(fs.readdirSync(directory).filter(file => /^systemInfo.*\.cjs$/.test(file)).sort(), expected, 'Every system info module must be reviewed and reachable');

const active = new Set();
const visited = new Set();
function walk(file) {
  assert.ok(!active.has(file), 'Dependency cycle: ' + file);
  if (visited.has(file)) return;
  active.add(file);
  for (const dependency of graph.get(file)) walk(dependency);
  active.delete(file);
  visited.add(file);
}
walk(entry);
assert.equal(visited.size, graph.size);

const production = require(entry);
assert.deepEqual(Object.keys(production), ['createSystemInfoService', 'getWindowsSystemInfoPowerShellScript']);
assert.equal(production.getWindowsSystemInfoPowerShellScript, require('../electron/systemInfoWindowsScript.cjs').getWindowsSystemInfoPowerShellScript);
const host = new Proxy({}, { get() { throw new Error('Service construction must not access host APIs'); } });
const first = production.createSystemInfoService({ app: host });
const second = production.createSystemInfoService();
assert.deepEqual(Object.keys(first), ['getSystemInfo']);
assert.deepEqual(Object.keys(second), ['getSystemInfo']);
assert.equal(typeof first.getSystemInfo, 'function');
assert.notEqual(first.getSystemInfo, second.getSystemInfo);
assert.notEqual(first, second);

console.log(`System info structure passed: ${graph.size} reachable, acyclic production modules; ${functions} functions; all files <=300 and functions <=50; exact public API and independent instances; no business API invocation.`);
console.log(JSON.stringify(budgets.sort((a, b) => a.file.localeCompare(b.file))));
