const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const crypto = require('node:crypto');
const files = require('../electron/expressionLibraryFiles.cjs');
const source = fs.readFileSync(require.resolve('../electron/expressionLibraryService.cjs'), 'utf8');
const rules = fs.readFileSync(require.resolve('../electron/expressionLibraryCategoryRules.cjs'), 'utf8');
const old = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
const names = ['categoryNameIssue', 'normalizeDescription', 'findCategory', 'assertManaged'];
function tree(text) { return ts.createSourceFile('service.cjs', text, 99, true); }
function method(text) {
  const t = tree(text);
  const local = t.statements.find(n => ts.isFunctionDeclaration(n)).body.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'createCategoryEntry');
  if (local) return local.getText(t);
  const moved = ts.createSourceFile('actions.cjs', fs.readFileSync(require.resolve('../electron/expressionLibraryCategoryActions.cjs'), 'utf8'), 99, true);
  return moved.statements.find(n => ts.isFunctionDeclaration(n)).body.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'createCategoryEntry').getText(moved);
}
if (old && !source.includes('createExpressionLibraryCategoryActions')) {
  const moved = text => tree(text).statements.filter(n => ts.isFunctionDeclaration(n) && names.includes(n.name.text)).map(n => n.getText()).sort();
  assert.deepEqual(moved(rules), moved(old));
  const retained = text => tree(text).statements.filter(n => !(ts.isFunctionDeclaration(n) && names.includes(n.name.text)) && !n.getText().includes("require('./expressionLibraryCategoryRules.cjs')")).map(n => n.getText().replace(method(text), 'CREATE_CATEGORY'));
  assert.deepEqual(retained(source), retained(old));
}
function loadRules(trace) {
  const module = { exports: {} };
  new Function('require', 'module', rules)(id => id.endsWith('Files.cjs') ? {
    sanitizeFolderName(value) { trace.push(['sanitize', value]); return files.sanitizeFolderName(value); }, normalizeRelativePath: files.normalizeRelativePath,
  } : { UNCLASSIFIED_ID: 'cat_unclassified' }, module);
  return module.exports;
}
async function run(text, config) {
  const trace = [], api = loadRules(trace);
  const index = { library: { mode: config.mode, rootPath: 'root' }, categories: [{ id: 'existing', name: 'Existing', folderRelativePath: 'Folder' }] };
  const request = { get name() { trace.push('name'); return config.name; }, get description() { trace.push('description'); return config.description; } };
  const deps = { ...api, UNCLASSIFIED_ID: 'cat_unclassified', CUSTOM_IMPORT_FOLDER_NAME: '自定义分类',
    sanitizeFolderName(value) { trace.push(['sanitize', value]); return files.sanitizeFolderName(value); },
    createCategory(folder, name) { trace.push(['create', folder, name]); return { id: 'new', name, folderRelativePath: folder }; },
    async loadIndex() { trace.push('load'); if (config.failure === 'load') throw Error('load failure'); return index; },
    resolveWithinRoot(root, relative) { trace.push(['resolve', root, relative]); if (config.failure === 'resolve') throw Error('resolve failure'); return root + '/' + relative; },
    async ensureDirectory(value) { trace.push(['mkdir', value]); if (config.failure === 'mkdir') throw Error('mkdir failure'); },
    async saveIndex(value) { trace.push('save'); if (config.failure === 'save') throw Error('save failure'); return value; },
    getStateFromIndex(value) { trace.push('project'); return { state: value }; },
  };
  const create = new Function(...Object.keys(deps), method(text) + '\nreturn createCategoryEntry;')(...Object.values(deps));
  let result, error;
  try { result = await create(request); } catch (e) { error = e.message; }
  if (result) {
    assert.equal(result.state.categories[0], index.categories[0]);
    assert.equal(result.state.categories[1].reviewRequired, false);
    assert.equal(result.state.categories[1].description, api.normalizeDescription(config.description));
    assert.equal(index.categories.length, 1);
  }
  if (config.mode !== 'managed') assert.ok(!trace.includes('name'), 'Mode checked before request name');
  return { result, error, trace };
}
async function main() {
  const hash = crypto.createHash('sha256'); let cases = 0;
  for (const mode of ['managed', 'external']) for (const name of [undefined, '', 'New', 'existing', 'folder', '自定义分类', 'CON', '../escape', 'space ', 'x'.repeat(65)])
  for (const description of [undefined, ' Text ', 'A\u0001B\nC', 'x'.repeat(300)]) for (const failure of ['none', 'load', 'resolve', 'mkdir', 'save']) {
    const config = { mode, name, description, failure }, actual = await run(source, config);
    if (old) assert.deepEqual(actual, await run(old, config)); hash.update(JSON.stringify(actual)); cases++;
  }
  const api = loadRules([]);
  for (const folder of ['Good', 'Good/Child', '', '../escape', 'a/b/c', 'CON']) {
    const category = { id: 'category', name: 'Good', folderRelativePath: folder };
    assert.equal(Boolean(api.categoryNameIssue(category)), !['Good', 'Good/Child'].includes(folder));
  }
  assert.equal(api.categoryNameIssue({ id: 'cat_unclassified' }), undefined);
  assert.throws(() => api.findCategory({ categories: [] }, 'missing'), /分类不存在/);
  const digest = hash.digest('hex'); if (!old) assert.equal(digest, '5526024b5eac01687ea6deda4d076b39fc61c2c3aa89033a899a656e5bdfe78a');
  console.log('Expression category rules passed: ' + cases + ' creation/mode/name/description/error cases; shared path rules and IO order; ' + digest);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
