const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ts = require('typescript');
const actual = require('../electron/windowManager/mainWindowLifecycleStateAdapters.cjs');
const { createWindowManagerState } = require('../electron/windowManager/windowManagerState.cjs');
const specs = [
  ['createMainInteractiveWarmupStateAdapter', 'createNativeShapeControllers', 'warmupState'],
  ['createMainInteractiveWarmupTimerStateAdapter', 'createMainInteractiveWarmupTimers', ['getWarmupCompleted', 'getWarmupTimer', 'setWarmupTimer', 'getRestoreTimer', 'setRestoreTimer']],
  ['createMainWindowReadinessStateAdapter', 'createMainWindowRecoveryControllers', ['getMainWindow', 'getCanShow', 'getRendererReadyToShow', 'setRendererReadyToShow', 'resetStartupRecoveryCount', 'getReadyFallbackTimer', 'setReadyFallbackTimer']],
  ['createMainWindowRecoveryStateAdapter', 'createMainWindowRecoveryControllers', ['getRendererRecoveryInProgress', 'setRendererRecoveryInProgress', 'markMainWindowCanShow', 'getStartupRecoveryCount', 'incrementStartupRecoveryCount']],
];
const entry = path.resolve(__dirname, '../electron/windowManager.cjs');
const source = (() => {
  let root = require('./windowManagerAuxiliaryAssemblySource.mjs').expandMainWindowLifecycleSource(fs.readFileSync(entry, 'utf8'));
  root = require('./windowManagerAuxiliaryAssemblySource.mjs').expandWindowPresentationTraySource(root);
  for (const [file, name] of [['mainWindowPresentation', 'createMainWindowPresentationControllers'], ['mainWindowRecoveryControllers', 'createMainWindowStateRecoveryControllers']]) {
    const rootTree = ts.createSourceFile(entry, root, ts.ScriptTarget.Latest, true);
    const moduleText = fs.readFileSync(path.resolve(__dirname, '../electron/windowManager/' + file + '.cjs'), 'utf8');
    const moduleTree = ts.createSourceFile(entry, moduleText, ts.ScriptTarget.Latest, true);
    const phase = moduleTree.statements.find(node => ts.isFunctionDeclaration(node) && node.name.text === name);
    const factory = rootTree.statements.find(node => ts.isFunctionDeclaration(node) && node.name.text === 'createWindowManager');
    const binding = factory.body.statements.find(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(declaration =>
      ts.isCallExpression(declaration.initializer) && declaration.initializer.expression.getText(rootTree) === name));
    assert.ok(binding && phase, 'Actual root phase and implementation: ' + name);
    const expansion = file === 'mainWindowPresentation'
      ? phase.body.statements.filter(ts.isVariableStatement).map(node => node.getText(moduleTree)).join('\n')
      : 'const ' + binding.declarationList.declarations[0].name.getText(rootTree) + ' = ' + phase.body.statements.find(ts.isReturnStatement).expression.getText(moduleTree) + ';';
    root = root.slice(0, binding.getStart(rootTree)) + expansion + root.slice(binding.end);
  }
  return root;
})();
const parse = text => ts.createSourceFile(entry, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const baselinePath = process.argv[2], original = new Map();
let oldFactories;
if (baselinePath) {
  const baseline = fs.readFileSync(baselinePath, 'utf8'), oldTree = parse(baseline), calls = new Map();
  function collect(node) {
    if (ts.isCallExpression(node) && specs.some(([, caller]) => node.expression.getText(oldTree) === caller)) calls.set(node.expression.getText(oldTree), node.arguments[0]);
    ts.forEachChild(node, collect);
  }
  collect(oldTree);
  oldFactories = Object.fromEntries(specs.map(([name, caller, selection]) => {
    const props = calls.get(caller).properties;
    const object = typeof selection === 'string'
      ? props.find(prop => prop.name?.getText(oldTree) === selection).initializer
      : ts.factory.createObjectLiteralExpression(ts.factory.createNodeArray(props.filter(prop => selection.includes(prop.name?.getText(oldTree))), true));
    original.set(name, object);
    const text = typeof selection === 'string' ? object.getText(oldTree)
      : '{' + object.properties.map(prop => prop.getText(oldTree)).join(',') + '}';
    return [name, new Function('managerState', 'return ' + text)];
  }));
  const printer = ts.createPrinter({ removeComments: true });
  function tokens(text) {
    const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.Standard, text), result = [];
    for (let kind = scanner.scan(); kind !== ts.SyntaxKind.EndOfFileToken; kind = scanner.scan()) result.push([kind, scanner.getTokenText()]);
    return JSON.stringify(result);
  }
  const moduleTree = parse(fs.readFileSync(path.resolve(__dirname, '../electron/windowManager/mainWindowLifecycleStateAdapters.cjs'), 'utf8'));
  for (const [name] of specs) {
    const factory = moduleTree.statements.find(node => ts.isFunctionDeclaration(node) && node.name.text === name);
    const returned = factory.body.statements.find(ts.isReturnStatement).expression;
    assert.equal(hash(tokens(printer.printNode(ts.EmitHint.Expression, returned, moduleTree))),
      hash(tokens(printer.printNode(ts.EmitHint.Expression, original.get(name), oldTree))), 'Original lifecycle adapter object: ' + name);
  }
  function canonical(text, restore) {
    const root = parse(text), factory = root.statements.find(node => ts.isFunctionDeclaration(node) && node.name.text === 'createWindowManager');
    const transformed = ts.transform(factory, [context => {
      function transplant(node) {
        if (ts.isNumericLiteral(node)) return ts.factory.createNumericLiteral(node.text);
        return ts.visitEachChild(node, transplant, context);
      }
      function visit(node) {
        if (restore && ts.isObjectLiteralExpression(node)) {
          const properties = node.properties.flatMap(property => {
            if (ts.isSpreadAssignment(property) && ts.isCallExpression(property.expression) && original.has(property.expression.expression.getText(root))) {
              assert.equal(property.expression.arguments[0].getText(root), 'managerState');
              return [...original.get(property.expression.expression.getText(root)).properties].map(prop => ts.visitNode(prop, transplant));
            }
            if (ts.isPropertyAssignment(property) && property.name.getText(root) === 'warmupState') {
              assert.equal(property.initializer.expression.getText(root), specs[0][0]);
              assert.equal(property.initializer.arguments[0].getText(root), 'managerState');
              return [ts.factory.updatePropertyAssignment(property, property.name, ts.visitNode(original.get(specs[0][0]), transplant))];
            }
            return [ts.visitNode(property, visit)];
          });
          return ts.factory.updateObjectLiteralExpression(node, ts.factory.createNodeArray(properties, node.properties.hasTrailingComma));
        }
        return ts.visitEachChild(node, visit, context);
      }
      return node => ts.visitNode(node, visit);
    }]);
    try { return JSON.parse(tokens(printer.printNode(ts.EmitHint.Unspecified, transformed.transformed[0], root))); }
    finally { transformed.dispose(); }
  }
  const restoredTokens = canonical(source, true), originalTokens = canonical(baseline, false);
  const difference = restoredTokens.findIndex((token, index) => JSON.stringify(token) !== JSON.stringify(originalTokens[index]));
  assert.equal(difference, -1, 'Root AST token difference: ' + JSON.stringify([restoredTokens.slice(difference, difference + 4), originalTokens.slice(difference, difference + 4)]));
  assert.equal(restoredTokens.length, originalTokens.length);
}

function exercise(factories) {
  const outcomes = [], modes = ['undefined', 'null', 'false', 'number', 'string', 'object', 'symbol', 'read-error', 'write-error', 'coercion-error'];
  for (const [factory] of specs) {
    const keys = Object.keys(factories[factory](createWindowManagerState()));
    for (const name of keys) for (const mode of modes) {
      const error = new Error('fixture lifecycle error'), trace = [], writes = new Map();
      const value = mode === 'undefined' ? undefined : mode === 'null' ? null : mode === 'false' ? false : mode === 'number' ? 3
        : mode === 'object' ? { marker: 'identity' } : mode === 'symbol' ? Symbol('fixture')
          : mode === 'coercion-error' ? { valueOf() { trace.push(['coerce']); throw error; } } : 'value';
      const encode = item => item === undefined ? '<undefined>' : typeof item === 'symbol' ? '<symbol>'
        : mode === 'coercion-error' && item === value ? '<coercion-object>' : item;
      const proxy = new Proxy({}, {
        get(_target, key) { trace.push(['get', key]); if (mode === 'read-error') throw error; return writes.has(key) ? writes.get(key) : value; },
        set(_target, key, assigned) { trace.push(['set', key, encode(assigned)]); if (mode === 'write-error') throw error; writes.set(key, assigned); return true; },
      });
      const adapter = factories[factory](proxy);
      assert.deepEqual(trace, [], 'Callback creation must not access state'); assert.deepEqual(Object.keys(adapter), keys);
      let result, caught;
      try { result = adapter[name](value); } catch (failure) { caught = failure; }
      if (caught && !(caught instanceof TypeError)) assert.equal(caught, error);
      if (!caught && name.startsWith('get')) assert.equal(result, value, 'Getter identity');
      outcomes.push({ factory, name, mode, trace, result: encode(result), error: caught ? [caught.name, caught.message] : null });
    }
  }
  return outcomes;
}
const results = exercise(actual), digest = hash(JSON.stringify(results));
if (oldFactories) assert.deepEqual(results, exercise(oldFactories));
const expectedDigest = '2e07258c1440d5d4c5a62dcf7a361db7bde911f580861308d893d0bafb2af04e';
assert.equal(digest, expectedDigest, 'Original lifecycle field/order/coercion/error contract');
const rootTree = parse(source), rootCalls = new Map(), usedAdapters = [];
function inspectRoot(node) {
  if (ts.isCallExpression(node) && specs.some(([, caller]) => node.expression.getText(rootTree) === caller)) {
    const properties = node.arguments[0].properties, keys = [];
    for (const property of properties) {
      if (ts.isSpreadAssignment(property)) {
        const call = property.expression, name = call.expression.getText(rootTree);
        assert.ok(Object.hasOwn(actual, name));
        assert.equal(call.arguments.length, 1); assert.equal(call.arguments[0].getText(rootTree), 'managerState');
        usedAdapters.push(name); keys.push(...Object.keys(actual[name](createWindowManagerState())));
      } else {
        keys.push(property.name.getText(rootTree));
        if (property.name.getText(rootTree) === 'warmupState') {
          const call = property.initializer;
          assert.equal(call.expression.getText(rootTree), specs[0][0]);
          assert.equal(call.arguments.length, 1); assert.equal(call.arguments[0].getText(rootTree), 'managerState');
          usedAdapters.push(specs[0][0]);
        }
      }
    }
    rootCalls.set(node.expression.getText(rootTree), keys);
  }
  ts.forEachChild(node, inspectRoot);
}
inspectRoot(rootTree);
assert.deepEqual([...usedAdapters].sort(), specs.map(([name]) => name).sort(), 'Each adapter must be wired exactly once');
const wiringDigest = hash(JSON.stringify([...rootCalls]));
if (baselinePath) {
  const baselineTree = parse(fs.readFileSync(baselinePath, 'utf8')), baselineCalls = new Map();
  function inspectBaseline(node) {
    if (ts.isCallExpression(node) && specs.some(([, caller]) => node.expression.getText(baselineTree) === caller)) {
      baselineCalls.set(node.expression.getText(baselineTree), node.arguments[0].properties.map(prop => prop.name.getText(baselineTree)));
    }
    ts.forEachChild(node, inspectBaseline);
  }
  inspectBaseline(baselineTree); assert.deepEqual([...rootCalls], [...baselineCalls]);
}
const expectedWiringDigest = '8a305561f7b60ae3c78336537d2cff6a54e770f1c9e5cbad1010f40dacdff404';
assert.equal(wiringDigest, expectedWiringDigest, 'Expanded root caller/key order');
const state = createWindowManagerState(), peer = createWindowManagerState();
const warm = actual.createMainInteractiveWarmupStateAdapter(state), timers = actual.createMainInteractiveWarmupTimerStateAdapter(state);
const ready = actual.createMainWindowReadinessStateAdapter(state), recovery = actual.createMainWindowRecoveryStateAdapter(state);
const timer = { marker: 'timer' }; warm.setWarmupTimer(timer); assert.equal(timers.getWarmupTimer(), timer);
timers.setRestoreTimer(timer); assert.equal(warm.getRestoreTimer(), timer);
warm.setCompleted(true); assert.equal(timers.getWarmupCompleted(), true);
ready.setRendererReadyToShow(true); assert.equal(ready.getRendererReadyToShow(), true);
recovery.incrementStartupRecoveryCount(); assert.equal(recovery.getStartupRecoveryCount(), 1);
ready.resetStartupRecoveryCount(); assert.equal(recovery.getStartupRecoveryCount(), 0);
recovery.markMainWindowCanShow(); assert.equal(ready.getCanShow(), true);
assert.equal(peer.mainWindowCanShow, false); assert.equal(peer.mainInteractiveLayerWarmupCompleted, false);
assert.equal(peer.mainInteractiveLayerWarmupTimer, null); assert.equal(peer.mainWindowRendererStartupRecoveryCount, 0);
for (const [factory] of specs) assert.ok(source.includes(factory + '(managerState)'));
console.log(`Window lifecycle state adapters passed: ${results.length} callback cases; ${digest}; wiring ${wiringDigest}; warmup/readiness/recovery aliases, live state and isolation${baselinePath ? ', original object/expanded root AST equivalence' : ''}.`);
