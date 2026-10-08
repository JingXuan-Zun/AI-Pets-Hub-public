const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const crypto = require('node:crypto');
const source = fs.readFileSync(require.resolve('../electron/expressionLibraryIndex.cjs'), 'utf8');
const names = ['INDEX_VERSION', 'UNCLASSIFIED_ID', 'createId', 'nowIso', 'createCategory', 'createEmptyIndex', 'normalizeIndex', 'publicState'];
const old = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
function load(text, original) {
  let ids = 0; const trace = [], module = { exports: {} };
  const body = original ? text.slice(0, text.indexOf('function createExpressionLibraryService(')) + '\nmodule.exports = { ' + names.join(', ') + ' };' : text;
  new Function('require', 'module', 'Date', body)(id => {
    if (id === 'crypto') return { randomUUID() { trace.push('id'); return 'fixture-' + (++ids); } };
    if (id === 'path') return path;
    if (id === './expressionLibraryFiles.cjs') return { normalizeRelativePath(value) { trace.push(['path', value]); return String(value).replace(/\\/g, '/'); } };
    if (original && ['fs', './expressionLibraryAssetMutations.cjs', './expressionLibraryImport.cjs'].includes(id)) return {};
    throw Error('Unexpected dependency ' + id);
  }, module, class { toISOString() { trace.push('time'); return '2026-10-04T00:00:00.000Z'; } });
  return { api: module.exports, trace };
}
if (old) {
  const functions = text => ts.createSourceFile('index.cjs', text, 99, true).statements.filter(n => ts.isFunctionDeclaration(n) && [...names, 'createDefaultManagedCategories'].includes(n.name.text)).map(n => n.getText());
  assert.deepEqual(functions(source), functions(old), 'Moved functions unchanged');
}
const fixtures = [null, false, 12, 'invalid', {}, []];
for (const mode of ['managed', 'external', 'unknown']) for (const version of [undefined, 0, 4, 5, 6, 'bad'])
for (const categories of [undefined, [], [{ id: 'happy', name: '开心' }], [{ id: 'other', name: '其他' }]])
for (const rootPath of ['', 'relative-library', 'D:/fixture/external']) fixtures.push({ version, library: { mode, rootPath }, categories,
  assets: [{ id: 'kept', absolutePath: 'private', removedFromLibrary: false }, { id: 'removed', removedFromLibrary: true }], batchHistory: ['private'],
  librarySnapshots: [{ library: { mode: 'managed', rootPath: 'old' }, categories: [{ name: '开心' }], managedDefaultsInitialized: true }, { library: { mode: 'external', rootPath: 'external' } }], managedDefaultsInitialized: true });
function run(text, original, fixture) {
  const { api, trace } = load(text, original);
  const result = api.normalizeIndex(fixture, 'D:/fixture/managed');
  const state = api.publicState(result);
  assert.equal(state.batchHistory, undefined); assert.equal(state.librarySnapshots, undefined);
  assert.equal(state.managedDefaultsInitialized, undefined); assert.ok(state.assets.every(a => !('absolutePath' in a) && !a.removedFromLibrary));
  assert.equal(result.version, 5);
  const category = api.createCategory('folder\\child', 'Name');
  const empty = api.createEmptyIndex('D:/fixture/external', 'external');
  assert.equal(empty.categories.length, 1); assert.equal(empty.categories[0].id, 'cat_unclassified');
  return { result, state, category, empty, trace };
}
const hash = crypto.createHash('sha256');
for (const fixture of fixtures) { const actual = run(source, false, fixture); if (old) assert.deepEqual(actual, run(old, true, fixture)); hash.update(JSON.stringify(actual)); }
const digest = hash.digest('hex');
if (!old) assert.equal(digest, '06d49f271748da6681fca4dbb49a908dbf80ae18f7b8544d98cc556793838620');
console.log('Expression library index passed: ' + fixtures.length + ' defaults/version/mode/snapshot/public-state cases; deterministic ID/time order; ' + digest);
