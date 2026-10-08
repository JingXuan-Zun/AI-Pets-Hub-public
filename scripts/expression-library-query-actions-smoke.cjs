const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const crypto = require('node:crypto');
const source = fs.readFileSync(require.resolve('../electron/expressionLibraryQueryActions.cjs'), 'utf8');
const root = fs.readFileSync(require.resolve('../electron/expressionLibraryService.cjs'), 'utf8');
const old = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
const names = ['getState', 'getReplyCatalog', 'resolveCategoryDirectory', 'getPreview'];
const tree = text => ts.createSourceFile('module.cjs', text, 99, true);
function methods(text) { const t = tree(text); return t.statements.find(n => ts.isFunctionDeclaration(n)).body.statements.filter(n => ts.isFunctionDeclaration(n) && names.includes(n.name.text)); }
if (old) {
  const printer = ts.createPrinter(), print = text => methods(text).map(n => printer.printNode(ts.EmitHint.Unspecified, n, tree(text)));
  assert.deepEqual(print(source), print(old));
  function retained(text) {
    const t = tree(text), nodes = t.statements.filter(n => !n.getText(t).includes("require('./expressionLibraryQueryActions.cjs')") && !n.getText(t).includes("require('./expressionLibraryReplyCatalog.cjs')")).map(n => {
      if (ts.isVariableStatement(n) && n.getText(t).includes("require('./expressionLibraryFiles.cjs')")) return ts.factory.updateVariableStatement(n, n.modifiers, ts.factory.updateVariableDeclarationList(n.declarationList, n.declarationList.declarations.map(d => ts.factory.updateVariableDeclaration(d, ts.factory.updateObjectBindingPattern(d.name, d.name.elements.filter(e => !['mimeTypeForFileName', 'normalizeRelativePath'].includes(e.name.getText(t)))), d.exclamationToken, d.type, d.initializer))));
      if (!ts.isFunctionDeclaration(n) || n.name.text !== 'createExpressionLibraryService') return n;
      return ts.factory.updateFunctionDeclaration(n, n.modifiers, n.asteriskToken, n.name, n.typeParameters, n.parameters, n.type, ts.factory.updateBlock(n.body, n.body.statements.filter(s => !(ts.isFunctionDeclaration(s) && names.includes(s.name.text)) && !s.getText(t).includes('createExpressionLibraryQueryActions('))));
    });
    return printer.printFile(ts.factory.updateSourceFile(t, nodes));
  }
  assert.equal(retained(root), retained(old), 'Other methods, queue and API unchanged');
}
async function run(text, config, original) {
  const trace = [], fail = stage => { if (config.failure === stage) throw Error(stage + ' failure'); };
  const category = { available: config.available, nameIssue: config.issue ? 'invalid' : undefined, folderRelativePath: 'Folder' };
  const asset = { id: 'asset', available: config.asset !== 'unavailable', removedFromLibrary: config.asset === 'removed', relativePath: 'a.png', mimeType: 'image/png' };
  const index = { library: { mode: config.mode, rootPath: 'root' }, assets: config.asset === 'missing' ? [] : [asset] }, state = { marker: 'public' }, reply = { marker: 'reply' };
  const deps = {
    async loadIndex() { trace.push('load'); fail('load'); return index; },
    async scanIndex(value) { assert.equal(value, index); trace.push('scan'); fail('scan'); return index; },
    async saveIndex(value) { assert.equal(value, index); trace.push('save'); fail('save'); return index; },
    publicState(value) { assert.equal(value, index); trace.push('public'); return state; },
    buildReplyCatalog(value) { assert.equal(value, index); trace.push('reply'); return reply; },
    findCategory(value, id) { assert.equal(value, index); trace.push(['find', id]); fail('find'); return category; },
    async resolveSafeLibraryPath(rootPath, relative, options) { trace.push(['resolve', rootPath, relative, options]); fail('resolve'); return 'resolved'; },
    async ensureDirectory(value) { trace.push(['mkdir', value]); fail('mkdir'); },
    fs: { promises: {
      async stat(value) { trace.push(['stat', value]); fail('stat'); return { size: config.size }; },
      async readFile(value) { trace.push(['read', value]); fail('read'); return Buffer.from('fixture'); },
    } },
  };
  let api;
  if (original) api = new Function(...Object.keys(deps), methods(text).map(n => n.getText(tree(text))).join('\n') + '\nreturn { ' + names.join(', ') + ' };')(...Object.values(deps));
  else { const module = { exports: {} }; new Function('require', 'module', text)(id => id === 'fs' ? deps.fs : deps, module); api = module.exports.createExpressionLibraryQueryActions(deps); }
  let result, error;
  try { result = await api[config.action]({ rescan: config.rescan, categoryId: 'category', assetId: 'asset' }); } catch (e) { error = e.message; }
  if (result) {
    if (config.action === 'getState') assert.equal(result.state, state);
    if (config.action === 'getReplyCatalog') assert.equal(result, reply);
    if (config.action === 'getPreview') assert.deepEqual(result, { dataUrl: 'data:image/png;base64,Zml4dHVyZQ==', ok: true });
  }
  if (config.action === 'getPreview' && config.size > 20 * 1024 * 1024) assert.ok(!trace.some(row => Array.isArray(row) && row[0] === 'read'));
  return { result, error, trace };
}
async function main() {
  const configs = [];
  for (const action of ['getState', 'getReplyCatalog']) for (const rescan of [false, true]) for (const failure of ['none', 'load', 'scan', 'save']) configs.push({ action, rescan, failure });
  for (const mode of ['managed', 'external']) for (const available of [false, true]) for (const issue of [false, true]) for (const failure of ['none', 'load', 'find', 'resolve', 'mkdir']) configs.push({ action: 'resolveCategoryDirectory', mode, available, issue, failure });
  for (const asset of ['valid', 'missing', 'unavailable', 'removed']) for (const size of [1, 20 * 1024 * 1024, 20 * 1024 * 1024 + 1]) for (const failure of ['none', 'load', 'resolve', 'stat', 'read']) configs.push({ action: 'getPreview', asset, size, failure });
  const hash = crypto.createHash('sha256');
  for (const config of configs) { const actual = await run(source, config, false); if (old) assert.deepEqual(actual, await run(old, config, true)); hash.update(JSON.stringify(actual)); }
  const digest = hash.digest('hex'); if (!old) assert.equal(digest, '433d70fc5f36bf44855f04cc238aa98134c57074642df05b5cfc63b6eed4eec5');
  console.log('Expression query actions passed: ' + configs.length + ' state/rescan/catalog/directory/preview/limit/error cases; identities and IO order; ' + digest);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
