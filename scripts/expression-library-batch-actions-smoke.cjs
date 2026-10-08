const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const crypto = require('node:crypto');
const source = fs.readFileSync(require.resolve('../electron/expressionLibraryBatchActions.cjs'), 'utf8');
const root = fs.readFileSync(require.resolve('../electron/expressionLibraryService.cjs'), 'utf8');
const old = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
const names = ['setAssetStatus', 'moveAssets', 'removeAssets', 'undoBatchOperation'];
const tree = text => ts.createSourceFile('module.cjs', text, 99, true);
function methods(text) { const t = tree(text); return t.statements.find(n => ts.isFunctionDeclaration(n)).body.statements.filter(n => ts.isFunctionDeclaration(n) && names.includes(n.name.text)); }
if (old) {
  const printer = ts.createPrinter();
  const printed = text => methods(text).map(n => printer.printNode(ts.EmitHint.Unspecified, n, tree(text)));
  assert.deepEqual(printed(source), printed(old));
  function retained(text) {
    const t = tree(text);
    const nodes = t.statements.filter(n => !n.getText(t).includes("require('./expressionLibraryBatchActions.cjs')") && !n.getText(t).includes("require('./expressionLibraryAssetMutations.cjs')")).map(n => {
      if (!ts.isFunctionDeclaration(n) || n.name.text !== 'createExpressionLibraryService') return n;
      const body = ts.factory.updateBlock(n.body, n.body.statements.filter(s => !(ts.isFunctionDeclaration(s) && names.includes(s.name.text)) && !s.getText(t).includes('createExpressionLibraryBatchActions(')));
      return ts.factory.updateFunctionDeclaration(n, n.modifiers, n.asteriskToken, n.name, n.typeParameters, n.parameters, n.type, body);
    });
    return printer.printFile(ts.factory.updateSourceFile(t, nodes));
  }
  assert.equal(retained(root), retained(old), 'Other methods, API and serial queue unchanged');
}
async function run(text, config, original) {
  const trace = [], index = { marker: 'loaded' }, batch = { marker: 'batch' }, state = { marker: 'public' };
  const fail = stage => { if (config.failure === stage) throw Error(stage + ' failure'); };
  const request = { get status() { trace.push('status'); return config.status; }, get assetIds() { trace.push('ids'); return config.ids; } };
  const deps = {
    async loadIndex() { trace.push('load'); fail('load'); return index; },
    async executeBatch(value, received, type) { assert.equal(value, index); assert.equal(received, request); trace.push(['execute', type]); index.changed = true; fail('execute'); return batch; },
    async undoBatch(value, received) { assert.equal(value, index); assert.equal(received, request); trace.push('undo'); index.changed = true; fail('execute'); return batch; },
    async saveIndex(value) { assert.equal(value, index); trace.push('save'); fail('save'); return value; },
    getStateFromIndex(value) { assert.equal(value, index); trace.push('project'); fail('project'); return { ok: true, state }; },
  };
  let api;
  if (original) api = new Function(...Object.keys(deps), methods(text).map(n => n.getText(tree(text))).join('\n') + '\nreturn { ' + names.join(', ') + ' };')(...Object.values(deps));
  else {
    const module = { exports: {} }; new Function('require', 'module', text)(() => deps, module);
    api = module.exports.createExpressionLibraryBatchActions(deps);
    const peer = module.exports.createExpressionLibraryBatchActions(deps); for (const name of names) assert.notEqual(api[name], peer[name]);
  }
  let result, error;
  try { result = await api[config.action](request); } catch (e) { error = e.message; }
  if (result) { assert.equal(result.batch, batch); assert.equal(result.state, state); assert.equal(result.ok, true); }
  if (config.action === 'setAssetStatus' && !['accepted', 'needs-review'].includes(config.status)) assert.ok(!trace.includes('load'));
  return { result, error, trace, index };
}
async function main() {
  const hash = crypto.createHash('sha256'); let cases = 0;
  for (const action of names) for (const status of [undefined, 'accepted', 'needs-review', 'excluded'])
  for (const ids of [undefined, [], ['asset'], ['system-emoji']]) for (const failure of ['none', 'load', 'execute', 'save', 'project']) {
    const config = { action, status, ids, failure }, actual = await run(source, config, false);
    if (old) assert.deepEqual(actual, await run(old, config, true)); hash.update(JSON.stringify(actual)); cases++;
  }
  const digest = hash.digest('hex'); if (!old) assert.equal(digest, 'e53bf95852610744f1f2b2ac87ca3088167ac363471af3c18bb0de75c893df23');
  console.log('Expression batch actions passed: ' + cases + ' review/move/remove/undo/status/system/error cases; result identity and call order; ' + digest);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
