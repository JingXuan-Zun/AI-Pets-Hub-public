import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import ts from 'typescript';

const name = 'createWindowManagerPlacementControllers';
const providerNames = ['getAreaPickerWindow', 'getPersistentAreaBorderWindow'];
const parse = (text: string) => ts.createSourceFile('windowManager.cjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const hash = (text: string) => crypto.createHash('sha256').update(text).digest('hex');
const printer = ts.createPrinter({ removeComments: true });
function tokens(node: ts.Node, tree: ts.SourceFile) {
  const transformed = ts.transform(node, [context => {
    function visit(node: ts.Node): ts.VisitResult<ts.Node> {
      if (ts.isPropertyAssignment(node) && ['setTimeout', 'setInterval', 'clearInterval'].includes(node.name.getText(tree)) && ts.isArrowFunction(node.initializer)) {
        const timer = node.name.getText(tree), parameters = timer === 'clearInterval' ? 'timer' : 'callback, delay';
        assert.equal(node.initializer.getText(tree), `(${parameters}) => ${timer}(${parameters})`);
        return ts.factory.createShorthandPropertyAssignment(timer);
      }
      return ts.visitEachChild(node, visit, context);
    }
    return node => ts.visitNode(node, visit) as typeof node;
  }]);
  try {
    const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.Standard, printer.printNode(ts.EmitHint.Unspecified, transformed.transformed[0], tree));
    const result: unknown[] = [];
    for (let kind = scanner.scan(); kind !== ts.SyntaxKind.EndOfFileToken; kind = scanner.scan()) result.push([kind, scanner.getTokenText()]);
    return JSON.stringify(result);
  } finally { transformed.dispose(); }
}
const rootText = fs.readFileSync('electron/windowManager.cjs', 'utf8');
const tree = parse(fs.readFileSync('electron/windowManager/windowPlacementControllers.cjs', 'utf8'));
const factory = tree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name) as ts.FunctionDeclaration;
const providers = factory.body!.statements.filter(ts.isVariableStatement);
const call = factory.body!.statements.find(ts.isReturnStatement)!.expression!;
const digestFor = (providers: ts.Node[], call: ts.Node, tree: ts.SourceFile) => hash(JSON.stringify([...providers, call].map(node => tokens(node, tree))));
const callDigest = digestFor(providers, call, tree); assert.equal(callDigest, '8dc7ba55bce2e38f27647f44f618dd245ad30760d8016029c08dd49e1fd38da0');
const controlled = new Function('createWindowPlacementControllers', 'deps', factory.getText(tree) + ';return ' + name + '(deps);');
let original: Function | undefined;
if (process.argv[2]) {
  const oldTree = parse(fs.readFileSync(process.argv[2], 'utf8'));
  const oldFactory = oldTree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'createWindowManager') as ts.FunctionDeclaration;
  const oldProviders = oldFactory.body!.statements.filter(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(declaration => providerNames.includes(declaration.name.getText(oldTree))));
  const oldCall = oldFactory.body!.statements.filter(ts.isVariableStatement).flatMap(node => [...node.declarationList.declarations])
    .find(node => node.initializer && ts.isCallExpression(node.initializer) && node.initializer.expression.getText(oldTree) === 'createWindowPlacementControllers')!.initializer!;
  assert.equal(callDigest, digestFor(oldProviders, oldCall, oldTree));
  const parameters = (factory.parameters[0].name as ts.ObjectBindingPattern).elements.map(node => node.name.getText(tree));
  original = new Function('createWindowPlacementControllers', 'deps', 'const {' + parameters.join(',') + '}=deps;' + oldProviders.map(node => node.getText(oldTree)).join('\n') + ';return ' + oldCall.getText(oldTree) + ';');
  function canonical(text: string) {
    const tree = parse(text), factory = tree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'createWindowManager')!;
    const transformed = ts.transform(factory, [context => {
      function visit(node: ts.Node): ts.VisitResult<ts.Node> {
        if (ts.isVariableStatement(node) && node.declarationList.declarations.some(declaration => providerNames.includes(declaration.name.getText(tree)) || declaration.initializer && ts.isCallExpression(declaration.initializer)
          && ['createWindowPlacementControllers', name].includes(declaration.initializer.expression.getText(tree)))) return undefined;
        return ts.visitEachChild(node, visit, context);
      }
      return node => ts.visitNode(node, visit) as typeof node;
    }]);
    try { return hash(tokens(transformed.transformed[0], tree)); } finally { transformed.dispose(); }
  }
  assert.equal(canonical(rootText), canonical(oldTree.text), 'Remaining root order, execution and API');
}
function capture(assemble: Function, deps: any) {
  let options: any; const token = {};
  assert.equal(assemble((input: any) => { options = input; return token; }, deps), token, 'Placement API reference');
  return options;
}
function exercise(assemble: Function) {
  const outcomes: unknown[] = [];
  const modes = ['undefined', 'null', 'false', 'zero', 'string', 'empty', 'undefinedMethod', 'nullMethod', 'nonFunction', 'getterError', 'callError',
    'returnUndefined', 'returnNull', 'returnFalse', 'returnZero', 'returnString', 'returnObject', 'returnSymbol'];
  for (const method of providerNames) for (const mode of modes) for (const mutation of ['none', 'replace', 'remove']) {
    const calls: unknown[] = [], error = new Error('host access failure'), marker = {}, replacement = {}, symbol = Symbol('host');
    const primitives: any = { undefined, null: null, false: false, zero: 0, string: 'host' };
    const returns: any = { returnUndefined: undefined, returnNull: null, returnFalse: false, returnZero: 0, returnString: 'window', returnObject: marker, returnSymbol: symbol };
    const service: any = mode in primitives ? primitives[mode] : {};
    if (service && typeof service === 'object' && mode !== 'empty') Object.defineProperty(service, method, { configurable: true, get() {
      calls.push(['get-method']); if (mode === 'getterError') throw error;
      if (mode === 'undefinedMethod') return undefined; if (mode === 'nullMethod') return null; if (mode === 'nonFunction') return 1;
      return function (this: any, ...args: unknown[]) { assert.equal(this, service); assert.deepEqual(args, []); calls.push(['call']); if (mode === 'callError') throw error; return returns[mode]; };
    } });
    const options = capture(assemble, { areaPickerService: service, managerState: {} }); assert.deepEqual(calls, []);
    const results: unknown[] = [];
    for (let round = 0; round < 2; round++) {
      if (round && service && typeof service === 'object' && mutation !== 'none') Object.defineProperty(service, method, { configurable: true,
        value: mutation === 'remove' ? undefined : function (this: any) { assert.equal(this, service); calls.push(['replacement']); return replacement; } });
      try {
        const value = options[method]();
        const replaced = round && service && typeof service === 'object' && mutation !== 'none';
        assert.equal(value, replaced ? mutation === 'remove' ? null : replacement : (returns[mode] ?? null));
        results.push(value === marker ? '<object>' : value === replacement ? '<replacement>' : typeof value === 'symbol' ? '<symbol>' : value);
      } catch (caught) { assert.ok(caught === error || mode === 'nonFunction' && caught instanceof TypeError); results.push(caught === error ? '<error>' : '<TypeError>'); }
    }
    outcomes.push({ method, mode, mutation, calls, results });
  }
  const getterFields: Record<string, string> = { getMainWindow: 'mainWindow', getInputProxyWindow: 'postDragInputProxyWindow', getSettingsWindow: 'settingsWindow', getChatWindow: 'chatWindow', getGuardTimer: 'mainTopmostGuard' };
  for (const [method, field] of Object.entries(getterFields)) for (const value of [undefined, null, false, 0, '', {}, Symbol('state')]) for (const fail of [false, true]) {
    const calls: unknown[] = [], error = new Error('state read'); let current = value;
    const state = new Proxy({}, { get(_target, key) { calls.push(key); assert.equal(key, field); if (fail) throw error; return current; } });
    const options = capture(assemble, { managerState: state }); assert.deepEqual(calls, []); let caught;
    try { assert.equal(options[method](), value); current = { changed: true }; assert.equal(options[method](), current); } catch (failure) { caught = failure; }
    assert.equal(caught, fail ? error : undefined); outcomes.push({ method, fail, calls, type: typeof value });
  }
  for (const value of [undefined, null, false, 0, '', {}, Symbol('timer')]) for (const fail of [false, true]) {
    const calls: unknown[] = [], error = new Error('state write'), state: any = {};
    const options = capture(assemble, { managerState: new Proxy(state, { set(target, key, assigned) { assert.equal(key, 'mainTopmostGuard'); assert.equal(assigned, value); calls.push(key); if (fail) throw error; target[key] = assigned; return true; } }) });
    assert.deepEqual(calls, []); let caught; try { assert.equal(options.setGuardTimer(value), undefined); } catch (failure) { caught = failure; }
    assert.equal(caught, fail ? error : undefined); if (!fail) assert.equal(state.mainTopmostGuard, value); outcomes.push({ method: 'setGuardTimer', fail, calls, type: typeof value });
  }
  for (const timer of ['setTimeout', 'setInterval', 'clearInterval']) {
    const args = timer === 'clearInterval' ? [{}] : [() => {}, Symbol('delay')], calls: unknown[] = [], token = {};
    const options = capture(assemble, { managerState: {}, [timer]: (...received: unknown[]) => { assert.deepEqual(received, args); calls.push(timer); return token; } });
    assert.deepEqual(calls, []); assert.equal(options[timer](...args), token); outcomes.push({ timer, calls });
  }
  return outcomes;
}
const outcomes = exercise(controlled); if (original) assert.deepEqual(outcomes, exercise(original));
const digest = hash(JSON.stringify(outcomes)); assert.equal(digest, '1cca6e828aa5baf62afbd8309039d3ea5cc1fe0516bf1a2f90c6ec8d646d2ca4');
const rootTree = parse(rootText), bindings: ts.VariableDeclaration[] = [];
function inspect(node: ts.Node) {
  if (ts.isVariableDeclaration(node) && node.initializer && ts.isCallExpression(node.initializer) && node.initializer.expression.getText(rootTree) === name) bindings.push(node);
  ts.forEachChild(node, inspect);
}
inspect(rootTree); assert.equal(bindings.length, 1);
assert.deepEqual((bindings[0].name as ts.ObjectBindingPattern).elements.map(node => node.name.getText(rootTree)),
  ['scheduleKeepWindowOnTop', 'keepAuxWindowsOnTop', 'keepAreaPickerOnTop', 'keepPersistentAreaBorderOnTop', 'keepWindowStackOnTop',
    'scheduleWindowStackOnTop', 'resizeWindowForSettings', 'resizeWindowAroundCurrentCenter', 'startMainTopmostGuard', 'stopMainTopmostGuard']);
const options = ((bindings[0].initializer as ts.CallExpression).arguments[0] as ts.ObjectLiteralExpression).properties;
assert.deepEqual(options.map(node => node.name!.getText(rootTree)), (factory.parameters[0].name as ts.ObjectBindingPattern).elements.map(node => node.name.getText(tree)));
for (const node of options.slice(-3)) tokens(node, rootTree);
console.log(`Host placement passed: ${outcomes.length} host/state/timer cases; calls ${callDigest}; behavior ${digest}${original ? ', original providers/options and remaining root AST' : ''}.`);
