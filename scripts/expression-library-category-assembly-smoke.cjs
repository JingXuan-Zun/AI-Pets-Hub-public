const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const crypto = require('node:crypto');
const root = fs.readFileSync(require.resolve('../electron/expressionLibraryService.cjs'), 'utf8');
const categorySource = fs.readFileSync(require.resolve('../electron/expressionLibraryCategoryActions.cjs'), 'utf8');
const importSource = fs.readFileSync(require.resolve('../electron/expressionLibraryImportActions.cjs'), 'utf8');
const old = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
const names = ['createCategoryEntry', 'updateCategory', 'deleteCategory', 'importImages', 'importClassifiedRoot'];
const tree = text => ts.createSourceFile('actions.cjs', text, 99, true);
function methods(text) { const t = tree(text); return t.statements.find(n => ts.isFunctionDeclaration(n)).body.statements.filter(n => ts.isFunctionDeclaration(n) && names.includes(n.name.text)); }
if (old) {
  const printer = ts.createPrinter(), print = text => methods(text).map(n => printer.printNode(ts.EmitHint.Unspecified, n, tree(text)));
  assert.deepEqual([...print(categorySource), ...print(importSource)], print(old), 'All moved methods unchanged');
  function retained(text) {
    const t = tree(text), nodes = t.statements.filter(n => !(ts.isVariableStatement(n) && n.getText(t).includes('require('))).map(n => {
      if (!ts.isFunctionDeclaration(n) || n.name.text !== 'createExpressionLibraryService') return n;
      return ts.factory.updateFunctionDeclaration(n, n.modifiers, n.asteriskToken, n.name, n.typeParameters, n.parameters, n.type, ts.factory.updateBlock(n.body, n.body.statements.filter(s => !(ts.isFunctionDeclaration(s) && names.includes(s.name.text)) && !/createExpressionLibrary(?:Category|Import)Actions\(/.test(s.getText(t)))));
    });
    return printer.printFile(ts.factory.updateSourceFile(t, nodes));
  }
  assert.equal(retained(root), retained(old), 'Other methods, API and queue unchanged');
}
async function run(config, original) {
  const trace = [], category = { id: 'category', name: 'Known', description: 'Old', semanticVersion: 2, folderRelativePath: 'Known' };
  const index = { library: { mode: config.mode, rootPath: 'root' }, categories: [category], assets: [] };
  const fail = stage => { if (config.failure === stage) throw Error(stage + ' failure'); };
  const execute = name => { trace.push(name); index.executed = name; fail('execute'); };
  const deps = { UNCLASSIFIED_ID: 'cat_unclassified', CUSTOM_IMPORT_FOLDER_NAME: 'custom', customImportFolderName: 'custom',
    async loadIndex() { trace.push('load'); fail('load'); return index; },
    async saveIndex(value) { trace.push('save'); fail('save'); return value; },
    async scanIndex(value) { trace.push('scan'); fail('scan'); return value; },
    getStateFromIndex(value) { trace.push('project'); fail('project'); return { state: value, ok: true }; },
    assertManaged(value) { trace.push('managed'); if (value.library.mode !== 'managed') throw Error('managed only'); },
    validateNewCategoryName(value, name, folder) { assert.equal(value, index); trace.push(['name', name, folder]); return name; },
    resolveWithinRoot(rootPath, name) { trace.push(['resolve', rootPath, name]); return 'resolved'; },
    async ensureDirectory(value) { trace.push(['mkdir', value]); fail('execute'); },
    createCategory(name, folder) { execute('create'); return { id: 'new', name, folderRelativePath: folder }; },
    normalizeDescription(value) { trace.push(['description', value]); return value; },
    findCategory(value, id) { assert.equal(value, index); trace.push(['find', id]); return category; },
    sanitizeFolderName(value) { trace.push(['sanitize', value]); return value; },
    categoryNameIssue() { return undefined; },
    async renameCategoryDirectory() { execute('rename'); },
    applyCategorySemantics(value, received, name, description, changed) { assert.equal(received, category); execute('semantics'); received.name = name; received.description = description; if (changed) received.semanticVersion++; },
    async deleteCategoryFiles(value, received) { assert.equal(value, index); assert.equal(received, category); execute('delete'); },
    async importCategoryImages(value, received, request) { assert.equal(value, index); assert.equal(received, category); trace.push(['images', request.sourcePaths]); execute('images'); },
    async importClassifiedLibrary(value, source, options) { assert.equal(value, index); trace.push(['classified', source, options]); execute('classified'); },
  };
  let api;
  if (original) api = new Function(...Object.keys(deps), methods(old).map(n => n.getText(tree(old))).join('\n') + '\nreturn { ' + names.join(', ') + ' };')(...Object.values(deps));
  else {
    api = {};
    for (const [text, factory] of [[categorySource, 'createExpressionLibraryCategoryActions'], [importSource, 'createExpressionLibraryImportActions']]) {
      const module = { exports: {} }; new Function('require', 'module', text)(() => deps, module);
      const actions = module.exports[factory](deps), peer = module.exports[factory](deps);
      for (const name of Object.keys(actions)) assert.notEqual(actions[name], peer[name]);
      Object.assign(api, actions);
    }
  }
  let result, error;
  try { result = await api[config.action]({ categoryId: 'category', name: 'Known', description: 'New', sourcePaths: ['image.png'], sourceRootPath: 'source' }); } catch (e) { error = e.message; }
  if (result) { assert.equal(result.ok, true); if (config.action !== 'createCategoryEntry') assert.equal(result.state, index); }
  return { result, error, trace, index };
}
async function main() {
  const hash = crypto.createHash('sha256'); let cases = 0;
  for (const action of names) for (const mode of ['managed', 'external']) for (const failure of ['none', 'load', 'execute', 'scan', 'save', 'project']) {
    const config = { action, mode, failure }, actual = await run(config, false);
    if (old) assert.deepEqual(actual, await run(config, true)); hash.update(JSON.stringify(actual)); cases++;
  }
  const digest = hash.digest('hex'); if (!old) assert.equal(digest, '546ea1f1e417be1835f203a2cfb9ad7d0990609c678bbaa0edfb116f5a054ec2');
  console.log('Expression category/import assembly passed: ' + cases + ' mode/action/error cases; method identity and call order; ' + digest);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
