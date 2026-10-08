const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const directory = path.resolve(__dirname, '../electron');
const files = fs.readdirSync(directory).filter(name => /^localProjectInspector.*\.cjs$/.test(name)).map(name => path.join(directory, name));
const graph = new Map();
let functions = 0;
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  assert.ok(source.split('\n').length <= 300, path.basename(file) + ' source budget');
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true), dependencies = [];
  function visit(n) {
    if (ts.isFunctionLike(n) && n.body) {
      functions++;
      assert.ok(tree.getLineAndCharacterOfPosition(n.end).line - tree.getLineAndCharacterOfPosition(n.getStart(tree)).line + 1 <= 50, path.basename(file) + ':' + (n.name?.getText(tree) ?? 'callback') + ' function budget');
    }
    if (ts.isCallExpression(n) && n.expression.getText(tree) === 'require' && n.arguments.length === 1 && ts.isStringLiteral(n.arguments[0]) && n.arguments[0].text.startsWith('./localProjectInspector')) {
      const target = path.resolve(path.dirname(file), n.arguments[0].text);
      assert.ok(files.includes(target), 'Missing inspector dependency ' + target);
      dependencies.push(target);
    }
    ts.forEachChild(n, visit);
  }
  visit(tree); graph.set(file, dependencies);
}
const visited = new Set(), active = new Set();
function walk(file) {
  assert.ok(!active.has(file), 'Inspector dependency cycle at ' + file);
  if (visited.has(file)) return;
  active.add(file);
  for (const target of graph.get(file)) walk(target);
  active.delete(file); visited.add(file);
}
walk(path.join(directory, 'localProjectInspectorService.cjs'));
assert.equal(visited.size, files.length, 'All inspector modules must be reachable from production entry');
const api = require('../electron/localProjectInspectorService.cjs');
assert.deepEqual(Object.keys(api), ['createLocalProjectInspectorService']);
const first = api.createLocalProjectInspectorService(), second = api.createLocalProjectInspectorService();
assert.deepEqual(Object.keys(first), ['inspectLocalProject', 'runLocalProjectAction']);
assert.notEqual(first.inspectLocalProject, second.inspectLocalProject);
assert.notEqual(first.runLocalProjectAction, second.runLocalProjectAction);
console.log('Project inspector structure passed: ' + files.length + ' reachable, acyclic modules; ' + functions + ' functions; all source/function budgets met; independent instances.');
