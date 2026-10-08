const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const ts = require('typescript');
const { normalizeErrorMessage } = require('../electron/persistedConfigFiles.cjs');
const source = fs.readFileSync(require.resolve('../electron/persistedConfigSaver.cjs'), 'utf8');
const old = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
const tree = text => ts.createSourceFile('config.cjs', text, 99, true);
const factory = text => tree(text).statements.find(n => n.name?.text === 'createPersistedConfigStore');
const oldSave = old && factory(old).body.statements.find(n => n.name?.text === 'save');
const printer = ts.createPrinter();
const canonical = n => printer.printNode(ts.EmitHint.Unspecified, n, n.getSourceFile());
if (old) {
  const retained = text => factory(text).body.statements.filter(n => n.name?.text !== 'save' && !n.getText().includes('createPersistedConfigSaver(')).map(canonical);
  assert.deepEqual(retained(fs.readFileSync(require.resolve('../electron/persistedConfigStore.cjs'), 'utf8')), retained(old));
  const helper = name => tree(source).statements.find(n => n.name?.text === name).body.statements;
  const original = oldSave.body.statements[0];
  const body = original.tryBlock.statements;
  const bytes = body.findIndex(n => n.declarationList?.declarations[0]?.name?.text === 'bytes');
  assert.deepEqual(helper('writeConfigPayload').slice(1, -1).map(canonical), body.slice(2, bytes).map(canonical));
  assert.deepEqual(helper('savedConfig').slice(1).map(canonical), body.slice(bytes).map(canonical));
  assert.deepEqual(helper('failedConfig').slice(1).map(canonical), original.catchClause.block.statements.map(canonical));
}
function run(baseline, primary, backup, failure, migrationMode, shape) {
  const trace = [], written = {}, counts = {};
  const config = shape === 'null' ? null : { name: 'new', text: '中文' };
  if (shape === 'cycle') config.self = config;
  function call(name, args) {
    const count = counts[name] = (counts[name] || 0) + 1;
    trace.push([name, ...args]);
    if (failure.split('+').some(value => value === name || value === `${name}-${count}`)) throw new Error(`${name}-${count} failure`);
  }
  function readConfig(p) {
    call('read-' + p, []);
    const state = p === 'primary' ? primary : backup;
    return state === 'ok' ? { ok: true, config: { name: p } } : { ok: false, error: state, ...(state === 'decode-error' ? { credentialReadFailed: true } : {}) };
  }
  const ensureDirectory = p => call('mkdir', [p]);
  const externalizeConfigImageDataUrls = (value, asset, sequence) => {
    call('migrate', [value?.name, asset, sequence]);
    return { config: value, migratedCount: migrationMode, migratedBytes: migrationMode * 128, errors: migrationMode === 2 ? [{ field: 'fixture', error: 'fixture-error' }] : [] };
  };
  const context = {
    storeDir: 'store', primaryPath: 'primary', backupPath: 'backup', assetDir: 'assets', sequenceAssetDir: 'sequences', readConfig,
    credentials: { encode(value, previous) { call('encode', [value?.name, previous?.name]); return value; } },
    buildPersistedPayload(value) { call('payload', [value?.name]); return { version: 1, savedAt: `time-${counts.payload}`, config: value }; },
    writeTextFileSafely(p, text) { call('write-' + p, [text]); written[p] = text; },
    logMessage(message, details) { call(message === 'persisted config saved' ? 'log-saved' : 'log-failed', [details]); },
  };
  let save;
  if (baseline) {
    const deps = { ...context, ensureDirectory, externalizeConfigImageDataUrls, normalizeErrorMessage };
    save = new Function(...Object.keys(deps), oldSave.getText() + '\nreturn save;')(...Object.values(deps));
  } else {
    const module = { exports: {} };
    new Function('require', 'module', source)(id => id.endsWith('Files.cjs') ? { ensureDirectory, normalizeErrorMessage } : { externalizeConfigImageDataUrls }, module);
    save = module.exports.createPersistedConfigSaver(context);
  }
  let result, error;
  try { result = save(config); } catch (e) { error = e.message; }
  if (result?.ok) {
    assert.equal(result.bytes, Buffer.byteLength(written.primary, 'utf8'));
    assert.equal(result.assetErrors.length, migrationMode === 2 ? 1 : 0);
  }
  return { result, error, trace, written };
}
const hash = crypto.createHash('sha256'); let cases = 0;
for (const primary of ['ok', 'missing', 'decode-error']) for (const backup of ['ok', 'missing', 'decode-error'])
for (const failure of ['none', 'mkdir', 'migrate', 'read-primary', 'read-backup', 'encode-1', 'encode-2', 'payload-1', 'payload-2', 'write-primary', 'write-backup', 'log-saved', 'write-primary+log-failed'])
for (const migration of [0, 1, 2]) for (const shape of ['normal', 'null', 'cycle']) {
  const actual = run(false, primary, backup, failure, migration, shape);
  if (old) assert.deepEqual(actual, run(true, primary, backup, failure, migration, shape));
  hash.update(JSON.stringify(actual)); cases++;
}
const successful = (p, b) => run(false, p, b, 'none', 0, 'normal');
const writes = value => value.trace.filter(row => row[0].startsWith('write-')).map(row => row[0]);
assert.deepEqual(writes(successful('ok', 'ok')), ['write-backup', 'write-primary']);
assert.equal(successful('ok', 'missing').result.backupMode, 'previous-primary');
assert.deepEqual(writes(successful('missing', 'ok')), ['write-primary', 'write-backup']);
assert.equal(successful('missing', 'ok').result.backupMode, 'existing-backup-retained');
const mirror = successful('missing', 'missing');
assert.equal(mirror.result.backupMode, 'mirrored-primary');
assert.equal(mirror.written.primary, mirror.written.backup);
const rejected = successful('decode-error', 'missing');
assert.equal(rejected.result.error, 'credential-decryption-failed');
assert.deepEqual(writes(rejected), []);
assert.ok(!rejected.trace.some(row => row[0] === 'encode'));
assert.equal(run(false, 'ok', 'ok', 'write-primary', 0, 'normal').result.ok, false);
assert.equal(run(false, 'ok', 'ok', 'write-primary+log-failed', 0, 'normal').error, 'log-failed-1 failure');
const digest = hash.digest('hex');
if (!old) assert.equal(digest, 'b79b70aeb37b6375031648ecfda8cbe8cd18038743c30c21263ba609d1463b54');
console.log(`Persisted config saver passed: ${cases} cases; ${digest}`);
