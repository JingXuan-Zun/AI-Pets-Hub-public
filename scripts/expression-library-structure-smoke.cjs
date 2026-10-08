const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = require.resolve('../electron/expressionLibraryService.cjs');
const graph = new Map(); let functions = 0;
function inspect(file) {
  if (graph.has(file)) return;
  const dependencies = []; graph.set(file, dependencies);
  const source = fs.readFileSync(file, 'utf8'), tree = ts.createSourceFile(file, source, 99, true);
  assert.ok(source.split('\n').length <= 300, path.basename(file) + ' source budget');
  function visit(n) {
    if (ts.isFunctionLike(n) && n.body) {
      functions++;
      const lines = tree.getLineAndCharacterOfPosition(n.end).line - tree.getLineAndCharacterOfPosition(n.getStart(tree)).line + 1;
      assert.ok(lines <= 50, path.basename(file) + ':' + (n.name?.getText(tree) ?? 'callback') + ' function budget ' + lines);
    }
    if (ts.isCallExpression(n) && n.expression.getText(tree) === 'require' && ts.isStringLiteral(n.arguments[0]) && n.arguments[0].text.startsWith('./')) {
      const dependency = path.resolve(path.dirname(file), n.arguments[0].text);
      assert.ok(path.basename(dependency).startsWith('expressionLibrary'), 'Review new production dependency ' + dependency);
      dependencies.push(dependency); inspect(dependency);
    }
    ts.forEachChild(n, visit);
  }
  visit(tree);
}
inspect(root);
const active = new Set(), visited = new Set();
function walk(file) {
  assert.ok(!active.has(file), 'Dependency cycle ' + file);
  if (visited.has(file)) return;
  active.add(file); for (const dependency of graph.get(file)) walk(dependency);
  active.delete(file); visited.add(file);
}
walk(root); assert.equal(visited.size, graph.size);
const production = require(root);
assert.deepEqual(Object.keys(production), ['createExpressionLibraryService']);
const first = production.createExpressionLibraryService({ userDataPath: 'fixture', managedRootPath: 'managed' });
const second = production.createExpressionLibraryService({ userDataPath: 'peer', managedRootPath: 'peer-managed' });
assert.deepEqual(Object.keys(first), ['createCategory','deleteCategory','getPreview','getReplyCatalog','getState','importClassifiedRoot','importImages','moveAssets','removeAssets','resolveCategoryDirectory','selectLibraryMode','setAssetStatus','setLibrary','updateCategory','undoBatchOperation']);
for (const name of Object.keys(first)) assert.notEqual(first[name], second[name]);
console.log('Expression structure passed: ' + graph.size + ' reachable, acyclic production modules; ' + functions + ' functions; all files <=300 and functions <=50; exact public API and instance closures, no IO.');
