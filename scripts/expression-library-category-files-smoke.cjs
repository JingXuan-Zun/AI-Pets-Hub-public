const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const crypto = require('node:crypto');
const source = fs.readFileSync(require.resolve('../electron/expressionLibraryService.cjs'), 'utf8');
const helper = fs.readFileSync(require.resolve('../electron/expressionLibraryCategoryFiles.cjs'), 'utf8');
const old = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
const methods = ['deleteCategory', 'importImages'];
function method(text, name) {
  const t = ts.createSourceFile('service.cjs', text, 99, true);
  const local = t.statements.find(n => ts.isFunctionDeclaration(n)).body.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === name);
  if (local) return local.getText(t);
  const moved = ts.createSourceFile('actions.cjs', fs.readFileSync(require.resolve(name === 'deleteCategory' ? '../electron/expressionLibraryCategoryActions.cjs' : '../electron/expressionLibraryImportActions.cjs'), 'utf8'), 99, true);
  return moved.statements.find(n => ts.isFunctionDeclaration(n)).body.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === name).getText(moved);
}
if (old && !source.includes('createExpressionLibraryCategoryActions')) {
  function retained(text) {
    const t = ts.createSourceFile('service.cjs', text, 99, true);
    return t.statements.filter(n => !n.getText(t).includes("require('./expressionLibraryCategoryFiles.cjs')")).map(n => {
      let result = n.getText(t); for (const name of methods) result = result.replace(method(text, name), name);
      return result.replace(/  (resolveAvailableFileName|validateSourceImage),\r?\n/g, '');
    });
  }
  assert.deepEqual(retained(source), retained(old));
}
async function run(text, config) {
  const trace = []; let moves = 0, copies = 0;
  const category = { id: config.category === 'unclassified' ? 'cat_unclassified' : 'category', nameIssue: config.category === 'invalid' ? 'invalid' : undefined, folderRelativePath: config.category === 'root' ? '.' : 'Folder' };
  const index = { library: { mode: config.mode, rootPath: path.resolve('fixture-root') }, categories: [category, { id: 'other' }],
    assets: [0, 1].slice(0, config.count).map(i => ({ id: 'asset' + i, categoryId: category.id, available: true, fileName: i + '.png', relativePath: 'Folder/' + i + '.png', classificationStatus: 'accepted' })) };
  index.assets.push({ id: 'unavailable', categoryId: category.id, available: false }, { id: 'other', categoryId: 'other', available: true });
  const fail = stage => { if (config.failure === stage) throw Error(stage + ' failure'); };
  const deps = { path, UNCLASSIFIED_ID: 'cat_unclassified',
    async loadIndex() { trace.push('load'); fail('load'); return index; },
    assertManaged(value) { trace.push('managed'); if (value.library.mode !== 'managed') throw Error('外部目录引用模式不会修改用户原文件。'); },
    findCategory(value, id) { assert.equal(value, index); trace.push(['find', id]); return category; },
    async resolveSafeLibraryPath(root, relative, options) { trace.push(['resolve', root, relative, options]); fail('resolve'); return path.resolve(root, relative); },
    async resolveAvailableFileName(root, name) { trace.push(['available', root, name]); fail('available'); return 'unique-' + name; },
    async ensureDirectory(value) { trace.push(['mkdir', value]); fail('mkdir'); },
    async validateSourceImage(value) { trace.push(['validate', value]); fail('validate'); return { resolvedPath: value }; },
    async scanIndex(value) { assert.equal(value, index); trace.push('scan'); fail('scan'); return value; },
    async saveIndex(value) { assert.equal(value, index); trace.push('save'); fail('save'); return value; },
    getStateFromIndex(value) { trace.push('project'); return { state: value }; },
    fs: { promises: {
      async rename(from, to) { trace.push(['rename', from, to]); fail(++moves === 2 ? 'rename-second' : 'rename'); },
      async rm(target, options) { trace.push(['rm', target, options]); fail('rm'); },
      async copyFile(from, to) { trace.push(['copy', from, to]); fail(++copies === 2 ? 'copy-second' : 'copy'); },
    } },
  };
  const module = { exports: {} };
  new Function('require', 'module', helper)(id => id === 'fs' ? deps.fs : id === 'path' ? path : id.endsWith('Index.cjs') ? { UNCLASSIFIED_ID: deps.UNCLASSIFIED_ID } : deps, module);
  Object.assign(deps, module.exports);
  const action = new Function(...Object.keys(deps), method(text, config.action) + '\nreturn ' + config.action + ';')(...Object.values(deps));
  const request = { categoryId: category.id, get sourcePaths() { trace.push('sourcePaths'); return ['a.png', 'b.png']; } };
  let result, error;
  try { result = await action(request); } catch (e) { error = e.message; }
  if (result && config.action === 'deleteCategory') {
    assert.ok(!index.categories.includes(category));
    assert.ok(!index.assets.some(a => a.id === 'unavailable'));
    assert.ok(index.assets.filter(a => a.id.startsWith('asset')).every(a => a.categoryId === 'cat_unclassified' && a.classificationStatus === 'needs-review' && a.reviewedAt === null));
  }
  if (config.category === 'root' && config.action === 'deleteCategory') assert.ok(!trace.some(row => Array.isArray(row) && row[0] === 'rm'));
  assert.equal(index.assets.find(a => a.id === 'other').categoryId, 'other');
  return { result, error, trace, index };
}
async function main() {
  const hash = crypto.createHash('sha256'); let cases = 0;
  for (const action of methods) for (const mode of ['managed', 'external']) for (const category of ['valid', 'invalid', 'unclassified', 'root'])
  for (const count of [0, 1, 2]) for (const failure of ['none', 'load', 'resolve', 'available', 'mkdir', 'validate', 'rename', 'rename-second', 'rm', 'copy', 'copy-second', 'scan', 'save']) {
    const config = { action, mode, category, count, failure }, actual = await run(source, config);
    if (old) assert.deepEqual(actual, await run(old, config)); hash.update(JSON.stringify(actual)); cases++;
  }
  const digest = hash.digest('hex'); if (!old) assert.equal(digest, '2ee140df5dbc2100e67fe1e1666836d7925910ecd3910fdc9ece0fe875fdeaed');
  console.log('Expression category files passed: ' + cases + ' delete/import/mode/root/path/partial-error cases; mutations and IO order; ' + digest);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
