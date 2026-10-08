const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const crypto = require('node:crypto');
const actualApi = require('../electron/localProjectInspectorActionSelection.cjs');
const moduleText = fs.readFileSync(require.resolve('../electron/localProjectInspectorActionSelection.cjs'), 'utf8');
const moduleTree = ts.createSourceFile('selection.cjs', moduleText, ts.ScriptTarget.Latest, true);
assert.ok(moduleText.split('\n').length <= 300);
function budgets(node) {
  if (ts.isFunctionLike(node) && node.body) assert.ok(moduleTree.getLineAndCharacterOfPosition(node.end).line - moduleTree.getLineAndCharacterOfPosition(node.getStart(moduleTree)).line + 1 <= 50);
  ts.forEachChild(node, budgets);
}
budgets(moduleTree);
let oldApi;
if (process.argv[2]) {
  const baseline = fs.readFileSync(process.argv[2], 'utf8');
  const tree = ts.createSourceFile('root.cjs', baseline, ts.ScriptTarget.Latest, true);
  const factory = tree.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'createLocalProjectInspectorService');
  const names = ['normalizeActionIndex', 'findSuggestedActionSelection', 'selectSuggestedAction'];
  const functions = factory.body.statements.filter(n => ts.isFunctionDeclaration(n) && names.includes(n.name.text));
  oldApi = new Function(functions.map(n => n.getText(tree)).join('\n') + '\nreturn { normalizeActionIndex, findSuggestedActionSelection };')();
  let unusedReferences = 0;
  function count(n) { if (ts.isIdentifier(n) && n.text === 'selectSuggestedAction') unusedReferences++; ts.forEachChild(n, count); }
  count(tree);
  assert.equal(unusedReferences, 1, 'Removed private wrapper has only its declaration reference');
  function retained(text) {
    const tree = ts.createSourceFile('root.cjs', text, ts.ScriptTarget.Latest, true);
    const statements = tree.statements.filter(n => !n.getText(tree).includes("require('./localProjectInspectorActionSelection.cjs')"))
      .map(n => {
        if (!ts.isFunctionDeclaration(n) || n.name.text !== 'createLocalProjectInspectorService') return n;
        const body = ts.factory.updateBlock(n.body, n.body.statements.filter(n => !(ts.isFunctionDeclaration(n) && names.includes(n.name.text))));
        return ts.factory.updateFunctionDeclaration(n, n.modifiers, n.asteriskToken, n.name, n.typeParameters, n.parameters, n.type, body);
      });
    return ts.createPrinter().printFile(ts.factory.updateSourceFile(tree, statements));
  }
  assert.equal(retained(fs.readFileSync(path.resolve(__dirname, '../electron/localProjectInspectorService.cjs'), 'utf8')), retained(baseline));
}
const outcomes = [];
const first = { command: 'npm start', label: '启动服务', risk: 'launch' }, second = { command: ' pnpm run dev ', label: '开发服务', risk: 'launch' };
function selection(api, actions, request) {
  try {
    const value = api.findSuggestedActionSelection({ suggestedActions: actions }, request);
    if (value) assert.strictEqual(value.action, actions[value.index]);
    return { value };
  } catch (error) { return { error: error.message, type: error.name }; }
}
for (const actions of [undefined, {}, [], [first, second], [false, second], [null, first], [, second], [first, { ...first, label: 'duplicate' }]]) {
  for (const request of [undefined, {}, { actionIndex: 1 }, { actionIndex: 2 }, { actionIndex: 99, command: 'npm start' }, { index: -1 }, { index: 0 }, { index: 1.5 }, { index: '2' }, { actionIndex: null, index: 2 }, { actionIndex: false }, { index: Infinity }, { index: NaN }, { command: ' NPM START ' }, { command: 'missing', label: '服务' }, { label: '服务' }, { label: '开发' }, { command: ' ', label: '开发' }, { label: 'missing' }, { index: Symbol('invalid') }]) {
    const actual = selection(actualApi, actions, request);
    if (oldApi) assert.deepEqual(actual, selection(oldApi, actions, request));
    outcomes.push(actual);
  }
}
for (const input of [undefined, null, false, true, 0, -1, -0.5, 0.5, 1, 1.49, 1.5, 2, '2', '', 'invalid', Infinity, NaN, 3n]) {
  const actual = actualApi.normalizeActionIndex(input);
  if (oldApi) assert.equal(actual, oldApi.normalizeActionIndex(input));
  outcomes.push(actual);
}
function traced(api, mode) {
  const trace = [], failure = Error('controlled ' + mode);
  const request = {
    get actionIndex() { trace.push('actionIndex'); if (mode === 'actionIndex') throw failure; return mode === 'index' ? 1 : undefined; },
    get index() { trace.push('index'); return { valueOf() { trace.push('number'); if (mode === 'number') throw failure; return NaN; } }; },
    get command() { trace.push('command'); if (mode === 'command') throw failure; return mode === 'label' ? '' : { toString() { trace.push('command-string'); if (mode === 'command-string') throw failure; return 'RUN'; } }; },
    get label() { trace.push('label'); return '服务'; },
  };
  const action = { get command() { trace.push('action-command'); if (mode === 'action-command') throw failure; return 'run'; }, get label() { trace.push('action-label'); return '服务'; } };
  try {
    const selected = api.findSuggestedActionSelection({ suggestedActions: [action] }, request);
    assert.strictEqual(selected.action, action);
    return { index: selected.index, reason: selected.reason, trace };
  } catch (error) { assert.strictEqual(error, failure); return { error: error.message, trace }; }
}
for (const mode of ['normal', 'index', 'actionIndex', 'number', 'command', 'command-string', 'action-command', 'label']) {
  const actual = traced(actualApi, mode);
  if (oldApi) assert.deepEqual(actual, traced(oldApi, mode));
  outcomes.push(actual);
}
assert.equal(actualApi.findSuggestedActionSelection({ suggestedActions: [first, second] }, { actionIndex: 99, command: 'npm start' }), null);
assert.equal(actualApi.findSuggestedActionSelection({ suggestedActions: [first, second] }, { command: 'missing', label: '服务' }), null);
const hash = crypto.createHash('sha256').update(JSON.stringify(outcomes)).digest('hex');
assert.equal(hash, 'e156fd063f16c097dcf9dc1b64f022b9dde05676ff6a50d5dc9ae723f1e5e929', 'Reviewed selection outcomes and request reads remain unchanged');
console.log('Project action selection passed: ' + outcomes.length + ' index/precedence/command/label/identity/getter/error cases; hash ' + hash);
