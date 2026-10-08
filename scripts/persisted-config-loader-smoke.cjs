const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const ts = require('typescript');
const { createPersistedConfigLoader } = require('../electron/persistedConfigLoader.cjs');
const { normalizeErrorMessage } = require('../electron/persistedConfigFiles.cjs');
const { modelCredentialReferences } = require('../electron/configCredentials.cjs');
const old = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
const tree = text => ts.createSourceFile('config.cjs', text, 99, true);
const print = ts.createPrinter();
const canonical = n => print.printNode(ts.EmitHint.Unspecified, n, n.getSourceFile());
const factory = text => tree(text).statements.find(n => n.name?.text === 'createPersistedConfigStore');
const moved = ['readConfig', 'load', 'loadInternal'];
if (old) {
  const current = fs.readFileSync(require.resolve('../electron/persistedConfigStore.cjs'), 'utf8');
  const retained = text => factory(text).body.statements.filter(n => !moved.includes(n.name?.text) && !n.getText().includes('createPersistedConfigLoader(')).map(canonical);
  assert.deepEqual(retained(current), retained(old));
  const loader = tree(fs.readFileSync(require.resolve('../electron/persistedConfigLoader.cjs'), 'utf8'));
  const assembly = loader.statements.find(n => n.name?.text === 'createPersistedConfigLoader');
  for (const name of ['readConfig', 'load']) assert.equal(canonical(assembly.body.statements.find(n => n.name?.text === name)), canonical(factory(old).body.statements.find(n => n.name?.text === name)));
}
function run(baseline, primary, backup, failure, migrationMode, options) {
  const trace = [];
  function call(name, args) { trace.push([name, ...args]); if (failure === name) throw new Error(name + ' failure'); }
  function fileResult(state, name) {
    if (state === 'ok' || state === 'decode-error') return { ok: true, bytes: 37, config: { name, state, settings: { customApiKey: 'fixture-value', customApiUrl: 'fixture-url' } } };
    return { ok: false, error: state };
  }
  const context = {
    primaryPath: 'primary', backupPath: 'backup', assetDir: 'assets',
    readPersistedConfigFile(p) { call('read-' + p, []); return fileResult(p === 'primary' ? primary : backup, p); },
    credentials: {
      decode(config) { call('decode', [config.name]); if (config.state === 'decode-error') throw new Error('decode failed'); return { ...config, decoded: true }; },
      encode(config) { call('encode', [config.name]); return { ...config, encoded: true }; },
    },
    buildPersistedPayload(config) { call('payload', [config.name]); return { version: 1, savedAt: 'fixed-time', config }; },
    writeTextFileSafely(p, text) { call('write', [p, JSON.parse(text)]); },
    migrateCredentials(config) { call('credentials-migration', [config.name, Boolean(config.migrated)]); },
    migrateLoadedConfig(config, source) {
      call('image-migration', [config.name, source]);
      return { config: { ...config, migrated: true }, migratedCount: migrationMode ? 2 : 0, migratedBytes: migrationMode ? 128 : 0,
        errors: [], ...(migrationMode ? { saveResult: { ok: migrationMode === 1 } } : {}) };
    },
    logMessage(message, details) { call('log', [message, details]); },
  };
  let api;
  if (baseline) {
    const body = factory(old).body.statements.filter(n => moved.includes(n.name?.text)).map(n => n.getText()).join('\n');
    const deps = { ...context, normalizeErrorMessage, modelCredentialReferences };
    api = new Function(...Object.keys(deps), body + '\nreturn { readConfig, load };')(...Object.values(deps));
  } else api = createPersistedConfigLoader(context);
  const result = api.load(options);
  if (result.ok && options?.includeModelSecrets) assert.equal(result.config.settings.customApiKey, 'fixture-value');
  else if (result.ok) assert.equal(result.config.settings.customApiKey, 'desktop-pet-credential:customApiKey');
  return { result, trace };
}
const hash = crypto.createHash('sha256'); let cases = 0;
for (const primary of ['ok', 'missing-file', 'empty-file', 'invalid-config-payload', 'decode-error'])
for (const backup of ['ok', 'missing-file', 'empty-file', 'invalid-config-payload', 'decode-error'])
for (const failure of ['none', 'read-primary', 'read-backup', 'encode', 'payload', 'write', 'credentials-migration', 'image-migration', 'log'])
for (const migration of [0, 1, 2]) for (const options of [undefined, { includeModelSecrets: false }, { includeModelSecrets: true }, null]) {
  const actual = run(false, primary, backup, failure, migration, options);
  if (old) assert.deepEqual(actual, run(true, primary, backup, failure, migration, options));
  hash.update(JSON.stringify(actual)); cases++;
}
const primary = run(false, 'ok', 'ok', 'none', 1);
assert.ok(!primary.trace.some(row => row[0] === 'read-backup'), 'Valid primary avoids backup read');
assert.deepEqual(primary.trace.filter(row => row[0].endsWith('-migration')).map(row => row[0]), ['credentials-migration', 'image-migration']);
const backup = run(false, 'missing-file', 'ok', 'write', 1);
assert.equal(backup.result.ok, true);
assert.equal(backup.result.repairedPrimary, false);
assert.equal(backup.result.repairError, 'write failure');
assert.deepEqual(backup.trace.filter(row => row[0].endsWith('-migration')).map(row => row[0]), ['image-migration', 'credentials-migration']);
assert.equal(run(false, 'missing-file', 'missing-file', 'none', 0).result.source, 'missing');
assert.equal(run(false, 'ok', 'ok', 'credentials-migration', 0).result.source, 'credential-error');
const one = createPersistedConfigLoader({}), two = createPersistedConfigLoader({});
assert.notEqual(one.load, two.load); assert.notEqual(one.readConfig, two.readConfig);
const digest = hash.digest('hex');
if (!old) assert.equal(digest, 'a93fb9a8fb6666f35231b9ea308e1e5a95ea2a8c149c2e36fe54fe2fd2baa768');
console.log(`Persisted config loader passed: ${cases} cases; ${digest}`);
