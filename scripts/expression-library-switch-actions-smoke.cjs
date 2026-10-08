const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const crypto = require('node:crypto');
const source = fs.readFileSync(require.resolve('../electron/expressionLibrarySwitchActions.cjs'), 'utf8');
const root = fs.readFileSync(require.resolve('../electron/expressionLibraryService.cjs'), 'utf8');
const old = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
const names = ['setLibrary', 'selectLibraryMode'];
const tree = text => ts.createSourceFile('module.cjs', text, 99, true);
function methods(text) { const t = tree(text); return t.statements.find(n => ts.isFunctionDeclaration(n)).body.statements.filter(n => ts.isFunctionDeclaration(n) && names.includes(n.name.text)); }
if (old) {
  const printer = ts.createPrinter(), print = text => methods(text).map(n => printer.printNode(ts.EmitHint.Unspecified, n, tree(text)));
  assert.deepEqual(print(source), print(old));
  function retained(text) {
    const t = tree(text), nodes = t.statements.filter(n => !n.getText(t).includes("require('./expressionLibrarySwitchActions.cjs')") && !n.getText(t).includes("require('./expressionLibrarySnapshots.cjs')")).map(n => {
      if (!ts.isFunctionDeclaration(n) || n.name.text !== 'createExpressionLibraryService') return n;
      return ts.factory.updateFunctionDeclaration(n, n.modifiers, n.asteriskToken, n.name, n.typeParameters, n.parameters, n.type, ts.factory.updateBlock(n.body, n.body.statements.filter(s => !(ts.isFunctionDeclaration(s) && names.includes(s.name.text)) && !s.getText(t).includes('createExpressionLibrarySwitchActions('))));
    });
    return printer.printFile(ts.factory.updateSourceFile(t, nodes));
  }
  assert.equal(retained(root), retained(old), 'Other service methods and serial queue unchanged');
}
async function run(text, config, original) {
  const trace = []; let ensures = 0;
  const snapshots = config.snapshots === 'none' ? [] : [{ library: { mode: 'external', rootPath: 'old-external' } }];
  if (config.snapshots === 'latest') snapshots.push({ library: { mode: 'managed', rootPath: 'managed' } }, { library: { mode: 'external', rootPath: 'latest-external' } });
  if (config.snapshots === 'missing') snapshots.push({ library: { mode: 'external', rootPath: '' } });
  const index = { library: { mode: config.current, rootPath: path.resolve(config.current === 'managed' ? 'managed' : 'current-external') }, librarySnapshots: snapshots };
  const fail = stage => { if (config.failure === stage) throw Error(stage + ' failure'); };
  const deps = { path, managedRootPath: path.resolve('managed'),
    async loadIndex() { trace.push('load'); fail('load'); return index; },
    async ensureLibraryRoot(value) { trace.push(['ensure', value]); ensures++; fail(ensures === 2 ? 'ensure-second' : 'ensure'); },
    sameLibrary(left, right) { trace.push(['same', left, right]); return left.mode === right.mode && path.resolve(left.rootPath) === path.resolve(right.rootPath); },
    restoreLibraryIndex(value, mode, rootPath) { assert.equal(value, index); trace.push(['restore', mode, rootPath]); fail('restore'); return { ...value, library: { mode, rootPath } }; },
    async scanIndex(value) { trace.push(['scan', value.library]); fail('scan'); return value; },
    async saveIndex(value) { trace.push('save'); fail('save'); return value; },
    getStateFromIndex(value) { trace.push('project'); return { ok: true, state: value }; },
  };
  let api;
  if (original) api = new Function(...Object.keys(deps), methods(text).map(n => n.getText(tree(text))).join('\n') + '\nreturn {setLibrary,selectLibraryMode};')(...Object.values(deps));
  else { const module = { exports: {} }; new Function('require', 'module', text)(id => id === 'path' ? path : deps, module); api = module.exports.createExpressionLibrarySwitchActions(deps); }
  let result, error;
  try { result = await api.selectLibraryMode({ mode: config.mode }); } catch (e) { error = e.message; }
  if (result && config.mode === 'external' && config.current === 'managed' && config.snapshots === 'missing') assert.equal(result.modeAvailable, false, 'Latest empty snapshot does not fall back to older one');
  if (result && config.mode === 'external' && config.current === 'managed' && config.snapshots === 'latest' && result.modeAvailable) assert.equal(result.state.library.rootPath, path.resolve('latest-external'));
  assert.equal(index.librarySnapshots, snapshots);
  return { result, error, trace, index };
}
async function main() {
  const hash = crypto.createHash('sha256'); let cases = 0;
  for (const mode of ['managed', 'external', 'unknown']) for (const current of ['managed', 'external'])
  for (const snapshots of ['none', 'one', 'latest', 'missing']) for (const failure of ['none', 'load', 'ensure', 'ensure-second', 'restore', 'scan', 'save']) {
    const config = { mode, current, snapshots, failure }, actual = await run(source, config, false);
    if (old) assert.deepEqual(actual, await run(old, config, true)); hash.update(JSON.stringify(actual)); cases++;
  }
  const digest = hash.digest('hex'); if (!old) assert.equal(digest, '64236a0ab2cfab912caf6bb7d88b21a527ac1d2d241b5a66e1f0ccbd02c7ee2d');
  console.log('Expression switch actions passed: ' + cases + ' mode/current/latest-snapshot/validation/error cases; fallback and call order; ' + digest);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
