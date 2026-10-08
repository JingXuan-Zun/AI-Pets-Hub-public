const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const crypto = require('node:crypto');
const source = fs.readFileSync(require.resolve('../electron/expressionLibraryMigration.cjs'), 'utf8');
const service = fs.readFileSync(require.resolve('../electron/expressionLibraryService.cjs'), 'utf8');
const old = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
const names = ['shouldMigrateLegacyManagedRoot', 'removeEmptyLegacyAngryDefaults', 'copyMissingDirectoryContents'];
const description = '生气、不满、恼火或强烈反对。';
function moved(text) { const t = ts.createSourceFile('migration.cjs', text, 99, true); return t.statements.filter(n => ts.isFunctionDeclaration(n) && names.includes(n.name.text)).map(n => n.getText(t)); }
if (old) {
  assert.deepEqual(moved(source), moved(old), 'Moved functions unchanged');
  function retained(text) {
    const t = ts.createSourceFile('service.cjs', text, 99, true);
    return t.statements.filter(n => !(ts.isFunctionDeclaration(n) && names.includes(n.name.text)) && !n.getText(t).includes('const LEGACY_ANGRY_DESCRIPTION =') && !n.getText(t).includes("require('./expressionLibraryMigration.cjs')")).map(n => n.getText(t));
  }
  assert.deepEqual(retained(service), retained(old));
}
function load(text, config) {
  const trace = [], module = { exports: {} };
  const fail = (stage, code = 'EPERM') => { if (config.failure === stage) { const e = Error(stage); e.code = code; throw e; } };
  const dir = (name, type) => ({ name, isDirectory: () => type === 'dir', isFile: () => type === 'file' });
  const deps = {
    path, LEGACY_ANGRY_DESCRIPTION: description,
    async ensureDirectory(value) { trace.push(['mkdir', value]); fail('mkdir'); },
    resolveWithinRoot(root, relative) { trace.push(['resolve', root, relative]); return path.join(root, relative); },
    fs: { constants: { COPYFILE_EXCL: 1 }, promises: {
      async readdir(value, options) {
        trace.push(['read', value, options]);
        const child = path.basename(value) === 'nested';
        fail(child ? 'child-missing' : 'missing', 'ENOENT'); fail(child ? 'child-read' : 'read');
        return child ? [dir('inside.png', 'file')] : [dir('first.png', 'file'), dir('nested', 'dir'), dir('ignored-link', 'link'), dir('last.png', 'file')];
      },
      async copyFile(from, to, flags) { assert.equal(flags, 1, 'Exclusive copy flag'); trace.push(['copy', from, to, flags]); fail('exists', 'EEXIST'); fail('copy'); },
      async rm(value, options) { trace.push(['remove', value, options]); fail('remove'); },
    } },
  };
  new Function(...Object.keys(deps), 'module', moved(text).join('\n') + '\nmodule.exports = { ' + names.join(', ') + ' };')(...Object.values(deps), module);
  return { api: module.exports, trace };
}
async function run(text, config) {
  const { api, trace } = load(text, config); let result, error, index;
  try {
    if (config.action === 'detect') result = api.shouldMigrateLegacyManagedRoot(config.raw, 'legacy', config.same ? 'legacy' : 'managed');
    else if (config.action === 'copy') await api.copyMissingDirectoryContents('legacy', 'managed');
    else {
      const category = { id: 'angry', name: config.variant === 'name' ? 'Custom' : '愤怒', folderRelativePath: config.variant === 'folder' ? 'Custom' : '愤怒', description: config.variant === 'description' ? 'Custom' : description };
      const library = () => ({ library: { mode: config.mode }, categories: [{ ...category }, { id: 'other' }], assets: config.occupied ? [{ categoryId: 'angry' }] : [] });
      index = library(); index.librarySnapshots = config.snapshot ? [library(), { library: { mode: 'external' }, categories: [{ ...category }], assets: [] }] : [];
      await api.removeEmptyLegacyAngryDefaults(index, 'managed');
      if (config.occupied || config.mode !== 'managed' || config.variant !== 'default') assert.equal(trace.length, 0);
      else assert.equal(index.categories.some(c => c.id === 'angry'), false);
    }
  } catch (e) { error = [e.message, e.code]; }
  return { result, error, index, trace };
}
async function main() {
  const configs = [];
  for (const mode of ['managed', 'external']) for (const rootPath of [undefined, '', 'legacy', 'other'])
  for (const snapshot of [false, true]) for (const same of [false, true]) configs.push({ action: 'detect', same, raw: { library: snapshot ? { mode: 'external' } : { mode, rootPath }, librarySnapshots: snapshot ? [{ library: { mode, rootPath } }] : [] } });
  for (const raw of [null, undefined, {}, { librarySnapshots: 'invalid' }]) configs.push({ action: 'detect', raw });
  for (const mode of ['managed', 'external']) for (const variant of ['default', 'name', 'folder', 'description'])
  for (const occupied of [false, true]) for (const snapshot of [false, true]) for (const failure of ['none', 'remove']) configs.push({ action: 'clean', mode, variant, occupied, snapshot, failure });
  for (const failure of ['none', 'missing', 'read', 'child-missing', 'child-read', 'mkdir', 'exists', 'copy']) configs.push({ action: 'copy', failure });
  const hash = crypto.createHash('sha256');
  for (const config of configs) { const actual = await run(source, config); if (old) assert.deepEqual(actual, await run(old, config)); hash.update(JSON.stringify(actual)); }
  const digest = hash.digest('hex'); if (!old) assert.equal(digest, '6c92a8f809a8f8c2e80bcc1acb0c984803bf0bc13a78bbe8b91e6c74e7c4ba35');
  console.log('Expression migration passed: ' + configs.length + ' migration/default/occupied/snapshot/copy/error cases; exclusive copy and partial-state order; ' + digest);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
