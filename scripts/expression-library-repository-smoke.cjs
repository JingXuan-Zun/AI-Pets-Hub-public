const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const crypto = require('node:crypto');
const source = fs.readFileSync(require.resolve('../electron/expressionLibraryRepository.cjs'), 'utf8');
const root = fs.readFileSync(require.resolve('../electron/expressionLibraryService.cjs'), 'utf8');
const old = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
const names = ['loadIndex', 'saveIndex', 'scanIndex'];
const tree = text => ts.createSourceFile('module.cjs', text, 99, true);
function methods(text) { const t = tree(text); return t.statements.find(n => ts.isFunctionDeclaration(n)).body.statements.filter(n => ts.isFunctionDeclaration(n) && names.includes(n.name.text)); }
const printer = ts.createPrinter();
if (old) {
  const printed = text => methods(text).map(n => printer.printNode(ts.EmitHint.Unspecified, n, tree(text)));
  assert.deepEqual(printed(source), printed(old), 'Load/save/scan functions unchanged');
  function retained(text) {
    const t = tree(text);
    const statements = t.statements.filter(n => !(ts.isVariableStatement(n) && n.getText(t).includes('require('))).map(n => {
      if (!ts.isFunctionDeclaration(n) || n.name.text !== 'createExpressionLibraryService') return n;
      const body = ts.factory.updateBlock(n.body, n.body.statements.filter(s => !(ts.isFunctionDeclaration(s) && names.includes(s.name.text)) && !s.getText(t).includes('createExpressionLibraryRepository(')));
      return ts.factory.updateFunctionDeclaration(n, n.modifiers, n.asteriskToken, n.name, n.typeParameters, n.parameters, n.type, body);
    });
    return printer.printFile(ts.factory.updateSourceFile(t, statements));
  }
  assert.equal(retained(root), retained(old), 'Other service bodies and queue unchanged');
}
function fixture(text, config, original) {
  const trace = [], fail = stage => { if (config.failure === stage) throw Error(stage + ' failure'); };
  const index = { assets: [], categories: [{ id: 'main' }], librarySnapshots: [{ categories: [{ id: 'snapshot' }] }], library: { mode: 'managed', rootPath: config.path } };
  const deps = {
    INDEX_VERSION: 5, UNCLASSIFIED_ID: 'cat_unclassified',
    async readJsonFile(file, fallback) { trace.push(['read', file, fallback]); fail('read'); return { version: config.version }; },
    shouldMigrateLegacyManagedRoot(raw, legacy, managed) { trace.push(['detect', raw.version, legacy, managed]); fail('detect'); return config.migrate; },
    async copyMissingDirectoryContents(from, to) { trace.push(['copy', from, to]); fail('copy'); },
    normalizeIndex(raw, managed) { trace.push(['normalize', raw.version, managed]); fail('normalize'); return index; },
    categoryNameIssue(category) { trace.push(['name', category.id]); fail('name'); return undefined; },
    async removeEmptyLegacyAngryDefaults(value, managed) { assert.equal(value, index); trace.push(['clean', managed]); fail('clean'); },
    nowIso() { trace.push('time'); fail('time'); return 'fixture-time'; },
    async writeJsonAtomic(file, value) { trace.push(['write', file, value]); fail('write'); },
  };
  const options = { indexPath: config.path + '/index.json', legacyManagedRootPath: config.path + '/legacy', managedRootPath: config.path + '/managed', customImportFolderName: 'custom', ensureLibraryRoot: async () => {} };
  let api, second;
  if (original) {
    const variables = { ...deps, ...options, CUSTOM_IMPORT_FOLDER_NAME: 'custom' };
    api = new Function(...Object.keys(variables), methods(text).map(n => n.getText(tree(text))).join('\n') + '\nreturn {loadIndex,saveIndex,scanIndex};')(...Object.values(variables));
  } else {
    const module = { exports: {} };
    new Function('require', 'module', text)(() => deps, module);
    api = module.exports.createExpressionLibraryRepository(options);
    second = module.exports.createExpressionLibraryRepository({ ...options, indexPath: 'peer/index.json' });
    for (const name of names) assert.notEqual(api[name], second[name]);
  }
  return { api, second, trace, index };
}
async function run(text, config, original) {
  const { api, trace, index } = fixture(text, config, original);
  let loaded, saved, error;
  try {
    loaded = await api.loadIndex(); assert.equal(loaded, index);
    saved = await api.saveIndex(loaded); assert.notEqual(saved, index);
    assert.equal(saved.assets, index.assets); assert.equal(saved.updatedAt, 'fixture-time'); assert.equal(saved.version, 5);
    assert.equal(index.updatedAt, undefined);
  } catch (e) { error = e.message; }
  return { loaded, saved, error, trace };
}
async function main() {
  const hash = crypto.createHash('sha256'); let cases = 0;
  for (const path of ['first', 'second']) for (const version of [0, 5, 6]) for (const migrate of [false, true])
  for (const failure of ['none', 'read', 'detect', 'copy', 'normalize', 'name', 'clean', 'time', 'write']) {
    const config = { path, version, migrate, failure }, actual = await run(source, config, false);
    if (old) assert.deepEqual(actual, await run(old, config, true)); hash.update(JSON.stringify(actual)); cases++;
  }
  const digest = hash.digest('hex'); if (!old) assert.equal(digest, 'e15724546954c0dea45223c9d709adbed70ad9338166bc0fc97d06220357586c');
  const peers = fixture(source, { path: 'first', version: 5, migrate: false, failure: 'none' }, false);
  await peers.api.loadIndex(); await peers.second.loadIndex();
  await peers.second.saveIndex(peers.index); await peers.api.saveIndex(peers.index);
  assert.deepEqual(peers.trace.filter(row => Array.isArray(row) && row[0] === 'read').map(row => row[1]), ['first/index.json', 'peer/index.json']);
  assert.deepEqual(peers.trace.filter(row => Array.isArray(row) && row[0] === 'write').map(row => row[1]), ['peer/index.json', 'first/index.json']);
  console.log('Expression repository passed: ' + cases + ' path/version/migration/load/save/error cases; per-instance bindings, timestamps and call order; ' + digest);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
