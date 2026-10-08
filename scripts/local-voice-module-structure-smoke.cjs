const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.join(__dirname, '../electron');
const graph = new Map(), pending = {}, visiting = new Set(), visited = new Set();
let functionCount = 0;
function inspect(name) {
  if (graph.has(name)) return;
  const source = fs.readFileSync(path.join(root, name), 'utf8');
  assert.ok(source.split('\n').length <= 300, `${name} exceeds file budget`);
  const ast = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const dependencies = new Set(); graph.set(name, dependencies);
  function walk(node) {
    if (ts.isFunctionLike(node) && node.body) {
      functionCount++;
      const size = ast.getLineAndCharacterOfPosition(node.end).line - ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1;
      if (size > 50) pending[`${name}:${node.name?.getText(ast) || '<anonymous>'}`] = size;
    }
    if (ts.isCallExpression(node) && node.expression.getText(ast) === 'require') {
      const argument = node.arguments[0];
      assert.ok(argument && ts.isStringLiteral(argument), `${name}: dynamic require needs explicit review`);
      if (argument.text.startsWith('.')) {
        const target = path.basename(path.resolve(root, argument.text));
        assert.ok(target.startsWith('localVoiceRuntime') && target.endsWith('.cjs'), `${name}: unexpected local dependency ${argument.text}`);
        dependencies.add(target);
      }
    }
    ts.forEachChild(node, walk);
  }
  walk(ast);
  for (const dependency of dependencies) inspect(dependency);
}
function checkCycles(name) {
  assert.ok(!visiting.has(name), `dependency cycle at ${name}`);
  if (visited.has(name)) return;
  visiting.add(name);
  for (const dependency of graph.get(name)) checkCycles(dependency);
  visiting.delete(name); visited.add(name);
}
inspect('localVoiceRuntime.cjs'); checkCycles('localVoiceRuntime.cjs');
const modules = fs.readdirSync(root).filter(name => /^localVoiceRuntime.*\.cjs$/.test(name));
assert.deepEqual([...graph.keys()].sort(), modules.sort(), 'every local voice module must be reachable');
const knownPending = {
  'localVoiceRuntime.cjs:createLocalVoiceRuntime': 68,
};
for (const [name, size] of Object.entries(pending)) {
  assert.ok(name in knownPending, `new function over budget: ${name}=${size}`);
  assert.ok(size <= knownPending[name], `pending function grew: ${name}=${size}`);
}
console.log(`Local voice structure passed (${graph.size} reachable modules, no cycles, ${functionCount} functions; ${Object.keys(pending).length} existing functions over 50 lines remain pending).`);
for (const [name, size] of Object.entries(pending)) console.log(`${name}=${size}`);
