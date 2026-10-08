const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const crypto = require('node:crypto');
const source = fs.readFileSync(require.resolve('../electron/expressionLibraryService.cjs'), 'utf8');
const querySource = fs.readFileSync(require.resolve('../electron/expressionLibraryQueryActions.cjs'), 'utf8');
const projection = require('../electron/expressionLibraryReplyCatalog.cjs').buildReplyCatalog;
const old = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
function method(text) {
  const tree = ts.createSourceFile('service.cjs', text, 99, true);
  const factory = tree.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'createExpressionLibraryService');
  const method = factory.body.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'getReplyCatalog');
  if (method) return method.getText(tree);
  const queryTree = ts.createSourceFile('query.cjs', querySource, 99, true);
  return queryTree.statements.find(n => ts.isFunctionDeclaration(n)).body.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'getReplyCatalog').getText(queryTree);
}
if (old) {
  function retained(text) {
    const tree = ts.createSourceFile('service.cjs', text, 99, true);
    return tree.statements.filter(n => !n.getText(tree).includes("require('./expressionLibraryReplyCatalog.cjs')")).map(n => n.getText(tree).replace(method(text), 'REPLY_METHOD'));
  }
  if (source.includes('createExpressionLibraryQueryActions')) {
    const print = text => ts.createPrinter().printFile(ts.createSourceFile('reply.cjs', method(text), 99, true));
    assert.equal(print(source), print(old), 'Query reply entry unchanged');
  } else assert.deepEqual(retained(source), retained(old), 'Other service statements unchanged');
}
async function run(text, config) {
  const trace = []; let reads = 0;
  const watch = (value, label) => new Proxy(value, { get(target, key) {
    trace.push(label + '.' + String(key));
    if (++reads === config.throwAt) throw Error('fixture getter failure');
    return target[key];
  } });
  const category = watch({ id: 'category', name: 'Known', description: 'Description', semanticVersion: 2,
    available: config.category !== 'unavailable', nameIssue: config.category === 'invalid' ? 'invalid' : undefined }, 'category');
  const index = watch({ library: watch({ mode: config.mode }, 'library'),
    categories: config.category === 'missing' ? [] : [category],
    assets: [watch({ id: 'asset', mimeType: 'image/png', categoryId: config.category === 'unclassified' ? 'cat_unclassified' : 'category',
      available: config.available, removedFromLibrary: config.removed, classificationStatus: config.status, assignmentSemanticVersion: config.version }, 'asset')],
  }, 'index');
  function phase(name) { trace.push(name); if (config.failure === name) throw Error(name + ' failure'); return index; }
  const get = new Function('loadIndex', 'scanIndex', 'saveIndex', 'buildReplyCatalog', 'UNCLASSIFIED_ID', method(text) + '\nreturn getReplyCatalog;')(
    async () => phase('load'), async value => { assert.equal(value, index); return phase('scan'); },
    async value => { assert.equal(value, index); return phase('save'); }, projection, 'cat_unclassified');
  let result, error;
  try { result = await get(); } catch (e) { error = e.message; }
  const phases = trace.filter(v => ['load', 'scan', 'save'].includes(v));
  const expected = config.failure === 'load' ? ['load'] : config.failure === 'scan' ? ['load', 'scan'] : ['load', 'scan', 'save'];
  assert.deepEqual(phases, config.throwAt ? expected.slice(0, phases.length) : expected);
  return { result, error, trace };
}
async function main() {
  const configs = [];
  for (const mode of ['managed', 'external', 'unknown']) for (const available of [false, true])
  for (const removed of [false, true]) for (const status of ['accepted', 'excluded', 'needs-review'])
  for (const category of ['valid', 'missing', 'unavailable', 'invalid', 'unclassified']) for (const version of [1, 2, '2']) configs.push({ mode, available, removed, status, category, version });
  const valid = { mode: 'managed', available: true, removed: false, status: 'accepted', category: 'valid', version: 2 };
  for (const throwAt of [1, 3, 6, 10, 15, 20, 25]) configs.push({ ...valid, throwAt });
  for (const failure of ['load', 'scan', 'save']) configs.push({ ...valid, failure });
  const hash = crypto.createHash('sha256');
  for (const config of configs) { const actual = await run(source, config); if (old) assert.deepEqual(actual, await run(old, config)); hash.update(JSON.stringify(actual)); }
  const digest = hash.digest('hex'); if (!old) assert.equal(digest, '30bd696fbcba49081ec40a3ab000112bd313a0ca80ffedf4e1e88b13f56a6c62');
  const result = (await run(source, valid)).result;
  assert.deepEqual(result.catalog.roots[0], { categories: [{ description: 'Description', id: 'category', name: 'Known', semanticVersion: 2 }], enabledForReply: true, id: 'root-main', name: '我的表情包', replyPriority: 0, sourceType: 'managed', assets: [{ assetId: 'asset', categoryId: 'category', mimeType: 'image/png' }] });
  assert.equal(result.ok, true);
  console.log('Expression reply catalog passed: ' + configs.length + ' admission/version/mode/getter/phase-error cases; exact projection and load-scan-save order; ' + digest);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
