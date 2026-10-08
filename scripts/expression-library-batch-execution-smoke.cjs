const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ts = require('typescript');
const source = fs.readFileSync(require.resolve('../electron/expressionLibraryAssetMutations.cjs'), 'utf8');
const old = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
if (old) {
  function retained(text) { const t = ts.createSourceFile('batch.cjs', text, 99, true); return t.statements.filter(n => !(ts.isFunctionDeclaration(n) && ['executeBatch', 'executeBatchAsset'].includes(n.name.text))).map(n => n.getText(t)); }
  assert.deepEqual(retained(source), retained(old));
}
async function run(text, config) {
  const trace = [], epoch = 1791072000000;
  const index = { library: { mode: config.mode, rootPath: 'root' }, categories: [
    { id: 'cat_unclassified', available: true, semanticVersion: 1 }, { id: 'from', available: true, semanticVersion: 2 },
    { id: 'target', available: config.variant !== 'target-invalid', name: 'Target', semanticVersion: 3, folderRelativePath: 'Target' },
  ], assets: ['one', 'two'].map(id => ({ id, categoryId: config.variant === 'unclassified' ? 'cat_unclassified' : 'from', fileName: id + '.png', relativePath: id + '.png', available: config.variant !== 'unavailable' || id !== 'one', removedFromLibrary: config.variant === 'removed' && id === 'one', classificationStatus: 'accepted', assignmentSemanticVersion: 2 })) };
  const fail = stage => { if (config.failure === stage) { const e = Error(stage); e.code = config.code; throw e; } };
  const deps = {
    async resolveSafeLibraryPath(root, relative, options) { trace.push(['resolve', root, relative, options]); fail('resolve'); return path.join(root, relative); },
    async validateSourceImage(value) { trace.push(['validate', value]); fail('validate'); },
    async ensureDirectory(value) { trace.push(['mkdir', value]); fail('mkdir'); },
    async resolveAvailableFileName(value, name) { trace.push(['available', value, name]); fail('available'); return 'unique-' + name; },
    normalizeRelativePath: value => String(value).replace(/\\/g, '/'),
  };
  const mockFs = {
    async stat(value) { trace.push(['stat', value]); fail('stat'); return { size: 12, mtimeMs: 22 }; },
    async unlink(value) { trace.push(['unlink', value]); fail('unlink'); },
    async rename(from, to) { trace.push(['rename', from, to]); fail('rename'); },
  };
  const module = { exports: {} };
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [epoch])); } static now() { return epoch; } }
  new Function('require', 'module', 'Date', text)(id => id === 'crypto' ? { randomUUID() { trace.push('uuid'); return 'operation-id'; } } : id === 'fs/promises' ? mockFs : id === 'path' ? path : deps, module, Clock);
  let result, error;
  try { result = await module.exports.executeBatch(index, { assetIds: ['one', 'missing', 'one', 'two'], targetCategoryId: 'target' }, config.action); } catch (e) { error = e.message; }
  if (result) {
    assert.equal(result.successCount + result.failureCount, 3);
    assert.equal(index.batchHistory.length, 1);
    assert.equal(result.undoExpiresAt !== undefined, config.action !== 'remove' && result.successCount > 0);
    assert.equal(result.failures.some(f => f.assetId === 'missing'), true);
  }
  return { result, error, index, trace };
}
async function main() {
  const hash = crypto.createHash('sha256'); let cases = 0;
  for (const action of ['accepted', 'needs-review', 'move', 'remove']) for (const mode of ['managed', 'external'])
  for (const variant of ['normal', 'unclassified', 'unavailable', 'removed', 'target-invalid'])
  for (const failure of ['none', 'resolve', 'validate', 'stat', 'mkdir', 'available', 'unlink', 'rename']) for (const code of ['ENOENT', 'EACCES']) {
    const config = { action, mode, variant, failure, code }, actual = await run(source, config);
    if (old) assert.deepEqual(actual, await run(old, config)); hash.update(JSON.stringify(actual)); cases++;
  }
  const digest = hash.digest('hex'); if (!old) assert.equal(digest, '0d1f2ef6d3b8a05c127a3f6b88a67399ac105a175c487c1a76d54f625a34fb5c');
  console.log('Expression batch execution passed: ' + cases + ' action/mode/asset/error cases; deduplication, partial failures, undo/history and IO order; ' + digest);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
