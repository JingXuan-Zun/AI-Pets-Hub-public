const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = require.resolve('../electron/browserTtsService.cjs');
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
      assert.ok(/^(browserTts|localVoiceRuntime)/.test(path.basename(dependency)), 'Review new production dependency ' + dependency);
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
assert.deepEqual(Object.keys(production), ['createBrowserTtsService']);
const first = production.createBrowserTtsService({ app: { isPackaged: false, getPath: () => 'fixture-user' }, projectRoot: 'fixture' });
const second = production.createBrowserTtsService({ app: { isPackaged: false, getPath: () => 'peer-user' }, projectRoot: 'peer' });
assert.deepEqual(Object.keys(first), ['dispose', 'ensureStarted', 'getHealth', 'getSpeakers', 'installDependencies']);
for (const name of Object.keys(first)) assert.notEqual(first[name], second[name]);
assert.equal(graph.size, 15);
console.log('Browser TTS structure passed: ' + graph.size + ' reachable, acyclic production modules; ' + functions + ' functions; all files <=300 and functions <=50; exact public API and instance closures, no API invocation or process/install.');
