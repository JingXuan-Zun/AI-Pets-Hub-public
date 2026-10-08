const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ts = require('typescript');
const actual = require('../electron/windowManager/windowInteractionStateAdapters.cjs');
const { createWindowManagerState } = require('../electron/windowManager/windowManagerState.cjs');
const specs = [
  ['nativeShapeState', 'createNativeShapeStateAdapter'],
  ['postDragInputProxyState', 'createPostDragInputProxyStateAdapter'],
  ['interactiveShapeState', 'createInteractiveShapeStateAdapter'],
];
const entry = path.resolve(__dirname, '../electron/windowManager.cjs');
const source = (() => {
  const root = fs.readFileSync(entry, 'utf8'), tree = ts.createSourceFile(entry, root, ts.ScriptTarget.Latest, true);
  const moduleText = fs.readFileSync(path.resolve(__dirname, '../electron/windowManager/postDragInputProxyLifecycle.cjs'), 'utf8');
  const moduleTree = ts.createSourceFile(entry, moduleText, ts.ScriptTarget.Latest, true);
  const phase = moduleTree.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'createPostDragInputProxyStateLifecycle');
  const owner = tree.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'createWindowManager');
  const binding = owner.body.statements.find(n => ts.isVariableStatement(n) && n.declarationList.declarations.some(d => d.initializer && ts.isCallExpression(d.initializer) && d.initializer.expression.getText(tree) === phase.name.text));
  assert.ok(binding && phase, 'Actual root proxy state stage');
  const names = binding.declarationList.declarations[0].name.elements.map(n => n.name.getText(tree)).filter(n => n !== 'postDragInputProxyState');
  const expanded = phase.body.statements.filter(ts.isVariableStatement).map(n => n.getText(moduleTree).replace('const controllers =', 'const {' + names.join(',') + '} =')).join('\n');
  return root.slice(0, binding.getStart(tree)) + expanded + root.slice(binding.end);
})();
const parse = text => ts.createSourceFile(entry, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const objects = new Map();
const baselinePath = process.argv[2];
let oldFactories = null;
if (baselinePath) {
  const baseline = fs.readFileSync(baselinePath, 'utf8'), tree = parse(baseline);
  function collect(node) {
    if (ts.isVariableDeclaration(node) && specs.some(([name]) => node.name.getText(tree) === name)) objects.set(node.name.getText(tree), node.initializer);
    ts.forEachChild(node, collect);
  }
  collect(tree); assert.equal(objects.size, 3);
  oldFactories = Object.fromEntries(specs.map(([name, factory]) => [factory,
    new Function('managerState', 'return ' + objects.get(name).getText(tree))]));
  const moduleTree = parse(fs.readFileSync(path.resolve(__dirname, '../electron/windowManager/windowInteractionStateAdapters.cjs'), 'utf8'));
  const printer = ts.createPrinter({ removeComments: true });
  const tokens = text => {
    const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.Standard, text), result = [];
    for (let kind = scanner.scan(); kind !== ts.SyntaxKind.EndOfFileToken; kind = scanner.scan()) result.push([kind, scanner.getTokenText()]);
    return JSON.stringify(result);
  };
  for (const [name, factory] of specs) {
    const declaration = moduleTree.statements.find(node => ts.isFunctionDeclaration(node) && node.name.text === factory);
    const returned = declaration.body.statements.find(ts.isReturnStatement).expression;
    assert.equal(tokens(printer.printNode(ts.EmitHint.Expression, returned, moduleTree)),
      tokens(printer.printNode(ts.EmitHint.Expression, objects.get(name), tree)), 'Original state adapter object: ' + name);
  }
  function canonical(text, restore) {
    const root = parse(text), factory = root.statements.find(node => ts.isFunctionDeclaration(node) && node.name.text === 'createWindowManager');
    const transformed = ts.transform(factory, [context => {
      function visit(node) {
        if (restore && ts.isVariableDeclaration(node) && objects.has(node.name.getText(root))) {
          const expected = specs.find(([name]) => name === node.name.getText(root))[1];
          assert.equal(node.initializer.expression.getText(root), expected);
          assert.equal(node.initializer.arguments[0].getText(root), 'managerState');
          return ts.factory.updateVariableDeclaration(node, node.name, node.exclamationToken, node.type, objects.get(node.name.getText(root)));
        }
        return ts.visitEachChild(node, visit, context);
      }
      return node => ts.visitNode(node, visit);
    }]);
    try {
      return crypto.createHash('sha256').update(tokens(printer.printNode(ts.EmitHint.Unspecified, transformed.transformed[0], root))).digest('hex');
    }
    finally { transformed.dispose(); }
  }
  assert.equal(canonical(source, true), canonical(baseline, false), 'Remaining root composition and execution AST must be identical');
}

function exercise(factories) {
  const outcomes = [];
  for (const [, factory] of specs) {
    const keys = Object.keys(factories[factory](createWindowManagerState()));
    for (const name of keys) for (const mode of ['string', 'object', 'null', 'false', 'read-error', 'write-error']) {
      const trace = [], writes = new Map(), error = new Error('fixture state error');
      const value = mode === 'object' ? { marker: 'identity' } : mode === 'null' ? null : mode === 'false' ? false : 'value';
      const proxy = new Proxy({}, {
        get(_target, key) { trace.push(['get', key]); if (mode === 'read-error') throw error; return writes.has(key) ? writes.get(key) : value; },
        set(_target, key, assigned) { trace.push(['set', key]); if (mode === 'write-error') throw error; writes.set(key, assigned); return true; },
      });
      const adapter = factories[factory](proxy);
      assert.deepEqual(trace, [], 'Creating callbacks must not read or write state');
      assert.deepEqual(Object.keys(adapter), keys, 'Preserve callback order');
      let result, caught;
      try { result = adapter[name](value); } catch (failure) { caught = failure; }
      assert.ok(caught === undefined || caught === error, 'Preserve exact state error identity');
      if (!caught) {
        if (trace[0][0] === 'get') assert.equal(result, value);
        else { assert.equal(result, undefined); assert.equal([...writes.values()][0], value); }
      }
      outcomes.push({ factory, name, mode, trace, result: caught ? 'thrown' : trace[0][0] === 'get' ? value : 'undefined' });
    }
  }
  return outcomes;
}
const results = exercise(actual);
const digest = crypto.createHash('sha256').update(JSON.stringify(results)).digest('hex');
if (oldFactories) assert.deepEqual(results, exercise(oldFactories));
const expectedDigest = '17b8f9a303c74f20a9e850e311db4486494acc8f22286a2dce72cfec9d359a09';
assert.equal(digest, expectedDigest, 'Original callback field/order/error contract');

const first = createWindowManagerState(), peer = createWindowManagerState();
const native = actual.createNativeShapeStateAdapter(first), shape = actual.createInteractiveShapeStateAdapter(first);
const proxy = actual.createPostDragInputProxyStateAdapter(first), peerProxy = actual.createPostDragInputProxyStateAdapter(peer);
const regions = [{ x: 1, y: 2, width: 3, height: 4 }];
shape.setRegions(regions); assert.equal(native.getRegions(), regions);
native.setApplied(true); assert.equal(shape.getApplied(), true);
first.requestedPointerPassthrough = true;
assert.equal(native.getRequestedPointerPassthrough(), true); assert.equal(shape.getRequestedPointerPassthrough(), true);
const timer = { marker: 'timer' }; proxy.setIdleDestroyTimer(timer); assert.equal(proxy.getIdleDestroyTimer(), timer);
assert.equal(peerProxy.getIdleDestroyTimer(), null);
const replacement = []; first.postDragInputProxyRegions = replacement; assert.equal(proxy.getRegions(), replacement);
assert.notEqual(peerProxy.getRegions(), replacement);
for (const [name, factory] of specs) assert.ok(source.includes(`const ${name} = ${factory}(managerState);`));
console.log(`Window interaction state adapters passed: ${results.length} callback cases; ${digest}; shared state aliases, live reads and instance isolation${baselinePath ? ', original object/root AST equivalence' : ''}.`);
