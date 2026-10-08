const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const ts = require('typescript');
const { hasPlaintextCredentials } = require('../electron/configCredentials.cjs');
const source = fs.readFileSync(require.resolve('../electron/persistedConfigMigrations.cjs'), 'utf8');
const old = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
const names = ['migrateLoadedConfig', 'migrateCredentials'];
const tree = text => ts.createSourceFile('config.cjs', text, 99, true);
const factory = text => tree(text).statements.find(n => n.name?.text === 'createPersistedConfigStore');
const printer = ts.createPrinter();
const canonical = n => printer.printNode(ts.EmitHint.Unspecified, n, n.getSourceFile());
if (old) {
  const original = factory(old).body.statements;
  const assembly = tree(source).statements.find(n => n.name?.text === 'createPersistedConfigMigrations');
  for (const name of names) assert.equal(canonical(assembly.body.statements.find(n => n.name?.text === name)), canonical(original.find(n => n.name?.text === name)));
  const retained = text => factory(text).body.statements.filter(n => !names.includes(n.name?.text) && !n.getText().includes('createPersistedConfigMigrations(')).map(canonical);
  assert.deepEqual(retained(fs.readFileSync(require.resolve('../electron/persistedConfigStore.cjs'), 'utf8')), retained(old));
}
function run(baseline, method, primary, backup, count, saveMode, failure) {
  const trace = [], config = { marker: 'decoded-input' };
  const migration = { config: { marker: 'migrated-input' }, migratedCount: count, migratedBytes: count * 128, errors: [{ field: 'fixture', error: 'fixture' }] };
  const saveResult = saveMode === 'failed' ? { ok: false, error: 'save rejected' } : { ok: true, ...(saveMode === 'bytes' ? { bytes: 512 } : {}) };
  function call(name, args) { trace.push([name, ...args]); if (failure === name) throw new Error(name + ' failure'); }
  const context = {
    primaryPath: 'primary', backupPath: 'backup', assetDir: 'assets', sequenceAssetDir: 'sequences',
    readPersistedConfigFile(p) {
      call('read-' + p, []);
      const state = p === 'primary' ? primary : backup;
      if (state === 'missing') return { ok: false, error: 'missing-file' };
      const value = state === 'plain' ? 'fixture-text' : state === 'reference' ? 'desktop-pet-credential:customApiKey' : state === 'protected' ? { protectedCredential: 1, ciphertext: 'fixture' } : '';
      return { ok: true, config: { settings: { customApiKey: value } } };
    },
    save(value) { call('save', [value.marker]); return saveResult; },
    logMessage(message, details) { call('log', [message, details]); },
  };
  const externalizeConfigImageDataUrls = (value, assets, sequences) => { call('images', [value.marker, assets, sequences]); return migration; };
  let api;
  if (baseline) {
    const declarations = factory(old).body.statements.filter(n => names.includes(n.name?.text)).map(n => n.getText()).join('\n');
    const deps = { ...context, externalizeConfigImageDataUrls, hasPlaintextCredentials };
    api = new Function(...Object.keys(deps), declarations + '\nreturn { migrateLoadedConfig, migrateCredentials };')(...Object.values(deps));
  } else {
    const module = { exports: {} };
    new Function('require', 'module', source)(id => id.endsWith('Assets.cjs') ? { externalizeConfigImageDataUrls } : { hasPlaintextCredentials }, module);
    api = module.exports.createPersistedConfigMigrations(context);
  }
  assert.deepEqual(trace, [], 'Assembly performs no reads or saves');
  let result, error;
  try { result = api[method](config, 'backup-file'); } catch (e) { error = e.message; }
  if (method === 'migrateLoadedConfig' && !error) {
    if (!count) assert.equal(result, migration);
    else { assert.equal(result.config, migration.config); assert.equal(result.errors, migration.errors); assert.equal(result.saveResult, saveResult); }
  }
  return { result, error, trace };
}
const hash = crypto.createHash('sha256'); let cases = 0;
for (const method of names) for (const primary of ['missing', 'empty', 'plain', 'protected', 'reference'])
for (const backup of ['missing', 'empty', 'plain', 'protected', 'reference']) for (const count of [0, 2])
for (const saveMode of ['bytes', 'no-bytes', 'failed']) for (const failure of ['none', 'read-primary', 'read-backup', 'images', 'save', 'log']) {
  const actual = run(false, method, primary, backup, count, saveMode, failure);
  if (old) assert.deepEqual(actual, run(true, method, primary, backup, count, saveMode, failure));
  hash.update(JSON.stringify(actual)); cases++;
}
const images = (count, mode) => run(false, 'migrateLoadedConfig', 'missing', 'missing', count, mode, 'none');
assert.deepEqual(images(0, 'bytes').trace.map(row => row[0]), ['images']);
assert.equal(images(2, 'failed').result.saveResult.ok, false, 'Image compaction failure is reported without throwing');
const credential = (p, b, mode) => run(false, 'migrateCredentials', p, b, 0, mode, 'none');
assert.deepEqual(credential('plain', 'missing', 'bytes').trace.map(row => row[0]), ['read-primary', 'read-backup', 'save']);
assert.deepEqual(credential('protected', 'empty', 'bytes').trace.map(row => row[0]), ['read-primary', 'read-backup']);
assert.equal(credential('missing', 'plain', 'failed').error, 'save rejected');
const digest = hash.digest('hex');
if (!old) assert.equal(digest, 'b962261d599e5a6dd48ab63ed107b9ddeb30c1a018c4762f80a0dc97a44647cb');
console.log(`Persisted config migrations passed: ${cases} cases; ${digest}`);
