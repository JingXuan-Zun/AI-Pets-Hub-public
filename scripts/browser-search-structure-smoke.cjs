const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const directory = path.resolve(__dirname, '../electron');
const files = fs.readdirSync(directory).filter(name => /^browserSearch.*\.cjs$/.test(name)).map(name => path.join(directory, name));
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
    if (ts.isCallExpression(n) && n.expression.getText(tree) === 'require' && n.arguments.length === 1 && ts.isStringLiteral(n.arguments[0]) && n.arguments[0].text.startsWith('./browserSearch')) {
      const target = path.resolve(path.dirname(file), n.arguments[0].text);
      assert.ok(files.includes(target), 'Missing browser dependency ' + target);
      dependencies.push(target);
    }
    ts.forEachChild(n, visit);
  }
  visit(tree); graph.set(file, dependencies);
}
const visited = new Set(), active = new Set();
function walk(file) {
  assert.ok(!active.has(file), 'Browser dependency cycle at ' + file);
  if (visited.has(file)) return;
  active.add(file);
  for (const target of graph.get(file)) walk(target);
  active.delete(file); visited.add(file);
}
walk(path.join(directory, 'browserSearchService.cjs'));
assert.equal(visited.size, files.length, 'All browser modules must be reachable from production entry');
const api = require('../electron/browserSearchService.cjs');
assert.deepEqual(Object.keys(api), ['createBrowserSearchService', 'extractTextFromDocumentLike', 'getDetectedBrowserCandidates']);
const first = api.createBrowserSearchService({ app: {} }), second = api.createBrowserSearchService({ app: {} });
assert.deepEqual(Object.keys(first), ['control', 'detect', 'closeSession', 'dispose', 'getSessionState', 'search']);
for (const name of Object.keys(first)) assert.notEqual(first[name], second[name]);
assert.equal(api.extractTextFromDocumentLike, require('../electron/browserSearchPageText.cjs').extractTextFromDocumentLike);
assert.equal(api.getDetectedBrowserCandidates, require('../electron/browserSearchDiscovery.cjs').getDetectedBrowserCandidates);
assert.equal(first.getSessionState().status, 'idle');
first.closeSession();
assert.equal(first.getSessionState().status, 'closed');
assert.equal(second.getSessionState().status, 'idle');
console.log('Browser structure passed: ' + files.length + ' reachable, acyclic modules; ' + functions + ' functions; all source/function budgets met; public API and instance isolation.');
