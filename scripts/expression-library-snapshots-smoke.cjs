const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const crypto = require('node:crypto');
const source = fs.readFileSync(require.resolve('../electron/expressionLibraryService.cjs'), 'utf8');
const rules = fs.readFileSync(require.resolve('../electron/expressionLibrarySnapshots.cjs'), 'utf8');
const switchSource = fs.readFileSync(require.resolve('../electron/expressionLibrarySwitchActions.cjs'), 'utf8');
const old = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
function method(text) {
  const t = ts.createSourceFile('service.cjs', text, 99, true);
  const factory = t.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'createExpressionLibraryService');
  const method = factory.body.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'setLibrary');
  if (method) return method.getText(t);
  const switchTree = ts.createSourceFile('switch.cjs', switchSource, 99, true);
  return switchTree.statements.find(n => ts.isFunctionDeclaration(n)).body.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'setLibrary').getText(switchTree);
}
if (old) {
  function retained(text) {
    const t = ts.createSourceFile('service.cjs', text, 99, true);
    return t.statements.filter(n => !(ts.isFunctionDeclaration(n) && n.name.text === 'sameLibrary') && !n.getText(t).includes("require('./expressionLibrarySnapshots.cjs')")).map(n => n.getText(t).replace(method(text), 'SET_LIBRARY').replace('createCategory, createEmptyIndex, normalizeIndex', 'createCategory, normalizeIndex'));
  }
  if (source.includes('createExpressionLibrarySwitchActions')) {
    const print = text => ts.createPrinter().printFile(ts.createSourceFile('set.cjs', method(text), 99, true));
    assert.equal(print(source), print(old), 'Switch entry unchanged');
  } else assert.deepEqual(retained(source), retained(old));
  const same = text => ts.createSourceFile('snapshots.cjs', text, 99, true).statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'sameLibrary').getText();
  if (!source.includes('createExpressionLibrarySwitchActions')) assert.equal(same(rules), same(old));
}
async function run(text, config) {
  const trace = [], managedRootPath = path.resolve('fixture-managed'), externalRoot = path.resolve('fixture-external');
  const targetMode = config.mode === 'external' ? 'external' : 'managed';
  const targetRoot = targetMode === 'managed' ? managedRootPath : externalRoot;
  const library = { mode: config.current === 'same' ? targetMode : 'external', rootPath: config.current === 'same' ? targetRoot : path.resolve('fixture-other') };
  const snapshot = marker => ({ library: { mode: targetMode, rootPath: targetRoot }, assets: [{ marker }], categories: [{ marker }], batchHistory: [marker], managedDefaultsInitialized: true });
  const snapshots = config.snapshot === 'none' ? [] : config.snapshot === 'duplicate' ? [snapshot('first'), snapshot('second')] : [snapshot('first')];
  snapshots.push({ library, marker: 'old-current' }, { library: { mode: 'external', rootPath: path.resolve('fixture-unrelated') }, marker: 'unrelated' });
  const index = { library, assets: [{ marker: 'current' }], categories: [{ marker: 'current' }], batchHistory: config.history ? ['current'] : null, librarySnapshots: snapshots, managedDefaultsInitialized: false, preserved: 'index' };
  const createEmptyIndex = (rootPath, mode) => { trace.push(['empty', rootPath, mode]); return { library: { rootPath, mode }, assets: [], categories: [], managedDefaultsInitialized: mode !== 'managed' }; };
  const module = { exports: {} };
  new Function('require', 'module', rules)(id => id === 'path' ? path : { createEmptyIndex }, module);
  const deps = { ...module.exports, path, managedRootPath, createEmptyIndex,
    async loadIndex() { trace.push('load'); if (config.failure === 'load') throw Error('load failure'); return index; },
    async ensureLibraryRoot(value) { trace.push(['ensure', value]); if (config.failure === 'ensure') throw Error('ensure failure'); },
    async scanIndex(value) { trace.push(['scan', value]); if (config.failure === 'scan') throw Error('scan failure'); return value; },
    async saveIndex(value) { trace.push('save'); if (config.failure === 'save') throw Error('save failure'); return value; },
    getStateFromIndex(value) { trace.push('project'); return { ok: true, state: value }; },
  };
  const set = new Function(...Object.keys(deps), method(text) + '\nreturn setLibrary;')(...Object.values(deps));
  let result, error;
  try { result = await set({ mode: config.mode, rootPath: config.blank ? '  ' : externalRoot }); } catch (e) { error = e.message; }
  if (result) {
    if (config.current === 'same') assert.equal(result.state, index);
    else {
      assert.notEqual(result.state.librarySnapshots, snapshots);
      const archived = result.state.librarySnapshots.find(s => s.library === library);
      assert.equal(archived.assets, index.assets); assert.equal(archived.categories, index.categories);
      if (config.history) assert.equal(archived.batchHistory, index.batchHistory);
      assert.deepEqual(archived.batchHistory, config.history ? ['current'] : []);
      if (config.snapshot !== 'none') {
        assert.equal(result.state.assets, snapshots[0].assets);
        assert.equal(result.state.assets[0].marker, 'first');
        assert.equal(result.state.preserved, 'index');
      } else assert.equal(result.state.preserved, undefined);
    }
  }
  return { result, error, trace, index };
}
async function main() {
  const hash = crypto.createHash('sha256'); let cases = 0;
  for (const mode of ['managed', 'external', 'unknown']) for (const current of ['same', 'different'])
  for (const snapshot of ['none', 'one', 'duplicate']) for (const history of [false, true])
  for (const blank of [false, true]) for (const failure of ['none', 'load', 'ensure', 'scan', 'save']) {
    const config = { mode, current, snapshot, history, blank, failure };
    const actual = await run(source, config); if (old) assert.deepEqual(actual, await run(old, config));
    hash.update(JSON.stringify(actual)); cases++;
  }
  const digest = hash.digest('hex'); if (!old) assert.equal(digest, '59f893b6608d71183c0058b5c74b7cbc2d3c18d709f7142462fb5854d32a10c4');
  console.log('Expression snapshots passed: ' + cases + ' library/default/restore/duplicate/history/blank/error cases; archive identity and phase order; ' + digest);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
