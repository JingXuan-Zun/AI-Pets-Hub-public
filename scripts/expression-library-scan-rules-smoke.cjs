const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const crypto = require('node:crypto');
const root = require.resolve('../electron/expressionLibraryService.cjs');
const source = fs.readFileSync(root, 'utf8');
const rules = fs.readFileSync(require.resolve('../electron/expressionLibraryScanRules.cjs'), 'utf8');
const assetScan = fs.readFileSync(require.resolve('../electron/expressionLibraryAssetScan.cjs'), 'utf8');
const repositorySource = fs.readFileSync(require.resolve('../electron/expressionLibraryRepository.cjs'), 'utf8');
const old = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
function scanBody(text) {
  const tree = ts.createSourceFile('service.cjs', text, 99, true);
  const factory = tree.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'createExpressionLibraryService');
  const scan = factory.body.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'scanIndex');
  if (scan) return scan.getText(tree);
  const repositoryTree = ts.createSourceFile('repository.cjs', repositorySource, 99, true);
  return repositoryTree.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'createExpressionLibraryRepository').body.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'scanIndex').getText(repositoryTree);
}
if (old) {
  function retained(text) {
    const tree = ts.createSourceFile('service.cjs', text, 99, true);
    return tree.statements.filter(n => !/require\('\.\/expressionLibrary(?:ScanRules|AssetScan).cjs'\)/.test(n.getText(tree))).map(n => n.getText(tree).replace(scanBody(text), 'SCAN_BODY').replace('UNCLASSIFIED_ID, createId, nowIso', 'UNCLASSIFIED_ID, nowIso'));
  }
  if (!source.includes('createExpressionLibraryRepository')) assert.deepEqual(retained(source), retained(old), 'All other service statements unchanged');
  else {
    const printScan = text => ts.createPrinter().printFile(ts.createSourceFile('scan.cjs', scanBody(text), 99, true));
    assert.equal(printScan(source), printScan(old), 'Repository scan body unchanged');
  }
}
async function run(text, config) {
  const trace = []; let ids = 0;
  const createId = prefix => { trace.push(['id', prefix]); return prefix + '_' + (++ids); };
  const createCategory = (folderRelativePath, name) => ({ id: createId('cat'), folderRelativePath, name, semanticVersion: 1 });
  const normalizeRelativePath = value => String(value).replace(/\\/g, '/');
  const categoryNameIssue = category => { trace.push(['name', category.id]); return category.name === 'bad' ? 'invalid' : undefined; };
  const index = { library: { mode: config.mode, rootPath: 'fixture-root' }, managedDefaultsInitialized: false,
    categories: [{ id: 'cat_unclassified', name: '未分类', folderRelativePath: '', semanticVersion: 1 },
      { id: 'known', name: 'Known', folderRelativePath: 'known', semanticVersion: 2 },
      { id: 'missing', name: config.bad ? 'bad' : 'Missing', folderRelativePath: 'missing', semanticVersion: 3, nameIssue: config.bad ? 'invalid' : undefined }],
    assets: [{ id: 'old', relativePath: 'known/a.png', fileSignature: config.signature, categoryOverrideId: config.override,
      classificationStatus: config.status, removedFromLibrary: config.removed, reviewedAt: 'previous', assignmentSemanticVersion: 2 },
      { id: 'gone', relativePath: 'gone.png', classificationStatus: 'accepted', available: true }],
  };
  const scanned = { folders: config.folders, images: [{ folderRelativePath: 'known', fileName: 'a.png' }, { folderRelativePath: 'new', fileName: 'b.png' }] };
  const deps = {
    path, createId, createCategory, normalizeRelativePath, categoryNameIssue, UNCLASSIFIED_ID: 'cat_unclassified', CUSTOM_IMPORT_FOLDER_NAME: '自定义分类',
    async ensureLibraryRoot(library) { trace.push(['root', library.mode]); },
    async ensureDirectory(dir) { trace.push(['mkdir', dir]); },
    async resolveSafeLibraryPath(rootPath, relativePath, options) { trace.push(['resolve', rootPath, relativePath, options]); if (config.failure === 'resolve' && relativePath.endsWith('.png')) throw Error('controlled'); return relativePath; },
    async scanLibraryRoot(rootPath, options) { trace.push(['scan', rootPath, options]); return scanned; },
    mimeTypeForFileName(name) { trace.push(['mime', name]); return 'image/png'; },
    fs: { promises: { async stat(file) { trace.push(['stat', file]); if (config.failure === 'stat') throw Error('controlled'); return { size: 10, mtimeMs: 20 }; } } },
  };
  const module = { exports: {} };
  new Function('require', 'module', rules)(id => id === 'path' ? path : id.endsWith('Files.cjs') ? { normalizeRelativePath } : { UNCLASSIFIED_ID: deps.UNCLASSIFIED_ID, createCategory }, module);
  Object.assign(deps, module.exports);
  const assetModule = { exports: {} };
  new Function('require', 'module', assetScan)(id => {
    if (id === 'fs') return deps.fs;
    if (id === 'path') return path;
    if (id.endsWith('Files.cjs')) return deps;
    if (id.endsWith('Index.cjs')) return { createId };
    throw Error('Unexpected asset scan dependency ' + id);
  }, assetModule);
  Object.assign(deps, assetModule.exports);
  const scan = new Function(...Object.keys(deps), scanBody(text) + '\nreturn scanIndex;')(...Object.values(deps));
  const result = await scan(index);
  assert.equal(result.assets.find(a => a.id === 'gone').available, false);
  assert.equal(result.categories[0].id, 'cat_unclassified');
  assert.equal(index.managedDefaultsInitialized, config.mode === 'managed');
  const previous = result.assets.find(a => a.id === 'old');
  if (config.signature && (config.signature !== '10:20' || config.failure !== 'none')) {
    assert.equal(previous.classificationStatus, config.removed ? 'excluded' : 'needs-review');
    assert.equal(previous.reviewedAt, null);
  }
  return { result, index, trace };
}
async function main() {
  const hash = crypto.createHash('sha256'); let cases = 0;
  for (const mode of ['managed', 'external']) for (const signature of [undefined, '10:20', 'changed'])
  for (const override of [undefined, 'missing', 'unknown']) for (const status of ['accepted', 'excluded'])
  for (const removed of [false, true]) for (const failure of ['none', 'resolve', 'stat'])
  for (const folders of [[], ['known', 'new']]) for (const bad of [false, true]) {
    const config = { mode, signature, override, status, removed, failure, folders, bad };
    const actual = await run(source, config); if (old) assert.deepEqual(actual, await run(old, config));
    hash.update(JSON.stringify(actual)); cases++;
  }
  const digest = hash.digest('hex'); if (!old) assert.equal(digest, '54f7617054d9aa395489e0b05e57e03455a4240b7bfed2fd5b4428c490438aa9');
  await concurrentScan();
  console.log('Expression scan rules passed: ' + cases + ' managed/external/category/override/signature/missing/error/review cases; result and IO order; ' + digest);
}
async function concurrentScan() {
  const pending = [], ids = [], module = { exports: {} };
  new Function('require', 'module', assetScan)(id => {
    if (id === 'path') return path;
    if (id === 'fs') return { promises: { stat(file) { return new Promise(resolve => pending.push({ file, resolve })); } } };
    if (id.endsWith('Files.cjs')) return { normalizeRelativePath: s => s, resolveSafeLibraryPath: async (_root, relative) => relative, mimeTypeForFileName: () => 'image/png' };
    if (id.endsWith('Index.cjs')) return { createId(prefix) { const value = prefix + '_' + (ids.length + 1); ids.push(value); return value; } };
    throw Error('Unexpected concurrent dependency ' + id);
  }, module);
  const category = { id: 'category', semanticVersion: 3 };
  const promise = module.exports.scanImageAssets({ library: { mode: 'managed' }, assets: [] }, { images: ['a.png', 'b.png'].map(fileName => ({ folderRelativePath: '', fileName })) }, [category], 'root');
  for (let i = 0; i < 6; i++) await Promise.resolve();
  assert.equal(pending.length, 2, 'Both reads start before either completes');
  pending[1].resolve({ size: 20, mtimeMs: 2 });
  for (let i = 0; i < 6; i++) await Promise.resolve();
  assert.deepEqual(ids, ['sticker_1']);
  pending[0].resolve({ size: 10, mtimeMs: 1 });
  const result = await promise;
  assert.deepEqual(result.map(a => [a.fileName, a.id, a.fileSignature]), [['a.png', 'sticker_2', '10:1'], ['b.png', 'sticker_1', '20:2']]);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
