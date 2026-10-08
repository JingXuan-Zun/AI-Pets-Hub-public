const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const crypto = require('node:crypto');
const source = fs.readFileSync(require.resolve('../electron/expressionLibraryService.cjs'), 'utf8');
const helper = fs.readFileSync(require.resolve('../electron/expressionLibraryCategoryUpdate.cjs'), 'utf8');
const old = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
function method(text) {
  const t = ts.createSourceFile('service.cjs', text, 99, true);
  const local = t.statements.find(n => ts.isFunctionDeclaration(n)).body.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'updateCategory');
  if (local) return local.getText(t);
  const moved = ts.createSourceFile('actions.cjs', fs.readFileSync(require.resolve('../electron/expressionLibraryCategoryActions.cjs'), 'utf8'), 99, true);
  return moved.statements.find(n => ts.isFunctionDeclaration(n)).body.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'updateCategory').getText(moved);
}
if (old && !source.includes('createExpressionLibraryCategoryActions')) {
  function retained(text) {
    const t = ts.createSourceFile('service.cjs', text, 99, true);
    return t.statements.filter(n => !n.getText(t).includes("require('./expressionLibraryCategoryUpdate.cjs')")).map(n => n.getText(t).replace(method(text), 'UPDATE_CATEGORY'));
  }
  assert.deepEqual(retained(source), retained(old));
}
async function run(text, config) {
  const trace = [];
  const category = { id: 'category', name: 'Old', description: 'Description', folderRelativePath: 'Old', semanticVersion: 2, nameIssue: config.issue ? 'invalid' : undefined, available: false };
  const index = { library: { mode: config.mode, rootPath: 'root' }, categories: [category, { id: 'other', name: 'Duplicate' }],
    assets: [{ categoryId: 'category', fileName: 'a.png', relativePath: 'Old/a.png', available: true, removedFromLibrary: config.removed, classificationStatus: 'accepted', reviewedAt: 'previous' },
      { categoryId: 'category', fileName: 'b.png', relativePath: 'Old/b.png', available: false, classificationStatus: 'accepted' },
      { categoryId: 'other', fileName: 'c.png', relativePath: 'Other/c.png', available: true, classificationStatus: 'accepted' }] };
  const fail = code => { const e = Error(code); e.code = code; throw e; };
  const deps = { path, UNCLASSIFIED_ID: 'cat_unclassified', CUSTOM_IMPORT_FOLDER_NAME: '自定义分类',
    sanitizeFolderName(value) { trace.push(['sanitize', value]); return String(value); },
    normalizeRelativePath(value) { return String(value).replace(/\\/g, '/'); },
    normalizeDescription(value) { return String(value ?? '').trim(); },
    categoryNameIssue(value) { trace.push(['nameIssue', value.name]); return undefined; },
    findCategory(value, id) { assert.equal(value, index); trace.push(['find', id]); return category; },
    async loadIndex() { trace.push('load'); return index; },
    async saveIndex(value) { assert.equal(value, index); trace.push('save'); if (config.failure === 'save') fail('SAVE'); return value; },
    getStateFromIndex(value) { trace.push('project'); return { state: value }; },
    async resolveSafeLibraryPath(root, relative, options) {
      trace.push(['resolve', root, relative, options]);
      if (!options && config.source !== 'present') fail(config.source === 'missing' ? 'ENOENT' : 'EPERM');
      return path.join(root, relative);
    },
    async ensureDirectory(value) { trace.push(['mkdir', value]); if (config.failure === 'mkdir') fail('MKDIR'); },
    fs: { promises: {
      async lstat(value) { trace.push(['lstat', value]); if (config.target !== 'present') fail(config.target === 'missing' ? 'ENOENT' : 'EPERM'); return {}; },
      async rename(from, to) { trace.push(['rename', from, to]); if (config.failure === 'rename') fail('RENAME'); },
    } },
  };
  const module = { exports: {} };
  new Function('require', 'module', helper)(id => id === 'fs' ? deps.fs : id === 'path' ? path : deps, module);
  Object.assign(deps, module.exports);
  const update = new Function(...Object.keys(deps), method(text) + '\nreturn updateCategory;')(...Object.values(deps));
  let result, error;
  try { result = await update({ categoryId: 'category', name: config.name, description: config.description }); } catch (e) { error = e.message; }
  if (result) {
    assert.equal(result.state, index); assert.equal(index.assets[2].classificationStatus, 'accepted');
    const changed = config.name !== 'Old' || config.description !== 'Description' || config.issue;
    assert.equal(category.semanticVersion, changed ? 3 : 2);
    assert.equal(index.assets[0].classificationStatus, changed && !config.removed ? 'needs-review' : 'accepted');
    assert.equal(index.assets[1].classificationStatus, 'accepted');
  }
  return { result, error, trace, index };
}
async function main() {
  const hash = crypto.createHash('sha256'); let cases = 0;
  for (const mode of ['managed', 'external']) for (const name of ['Old', 'New', 'Duplicate', '自定义分类'])
  for (const description of ['Description', 'Changed']) for (const issue of [false, true])
  for (const sourceState of ['present', 'missing', 'denied']) for (const target of ['present', 'missing', 'denied'])
  for (const removed of [false, true]) for (const failure of ['none', 'rename', 'mkdir', 'save']) {
    const config = { mode, name, description, issue, source: sourceState, target, removed, failure };
    const actual = await run(source, config); if (old) assert.deepEqual(actual, await run(old, config));
    hash.update(JSON.stringify(actual)); cases++;
  }
  const digest = hash.digest('hex'); if (!old) assert.equal(digest, 'edaed3d2c934110edc0c792ca583cf9e1a3c555d8667f508ee9bc286965d1101');
  console.log('Expression category update passed: ' + cases + ' mode/name/path/collision/error/semantic/review cases; mutation and IO order; ' + digest);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
