const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createPersistedConfigStore } = require('../electron/persistedConfigStore.cjs');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pet-secret-test-'));
const safeStorage = {
  isEncryptionAvailable: () => true,
  encryptString: (text) => Buffer.from([...Buffer.from(text)].map((n) => n ^ 91)),
  decryptString: (bytes) => Buffer.from([...bytes].map((n) => n ^ 91)).toString(),
};
try {
  const store = createPersistedConfigStore({ userDataPath: root, safeStorage });
  const config = { settings: { customApiKey: 'secret-A', geminiApiKey: 'secret-G', tavilyApiKey: 'secret-T' }, name: 'pet' };
  assert.equal(store.save(config).ok, true);
  for (const file of [store.getPaths().primaryPath, store.getPaths().backupPath]) {
    assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /secret-[AGT]/);
  }
  const loaded = store.load();
  assert.equal(loaded.config.settings.customApiKey, 'desktop-pet-credential:customApiKey');
  assert.equal(store.load({ includeModelSecrets: true }).config.settings.customApiKey, 'secret-A');
  const changedEndpoint = structuredClone(loaded.config);
  changedEndpoint.settings.customApiUrl = 'https://attacker.example';
  assert.equal(store.save(changedEndpoint).ok, false);
  assert.equal(store.save(loaded.config).ok, true);
  assert.equal(store.load({ includeModelSecrets: true }).config.settings.customApiKey, 'secret-A');
  // Legacy primary and backup must both migrate without losing their settings.
  fs.writeFileSync(store.getPaths().primaryPath, JSON.stringify({ config }));
  fs.writeFileSync(store.getPaths().backupPath, JSON.stringify({ config }));
  assert.equal(store.load().ok, true);
  for (const file of [store.getPaths().primaryPath, store.getPaths().backupPath]) {
    assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /secret-[AGT]/);
  }
  const unavailable = createPersistedConfigStore({ userDataPath: root, safeStorage: { isEncryptionAvailable: () => false } });
  const before = fs.readFileSync(store.getPaths().primaryPath, 'utf8');
  assert.equal(unavailable.save(config).ok, false);
  assert.equal(fs.readFileSync(store.getPaths().primaryPath, 'utf8'), before);
  assert.equal(unavailable.load().ok, false);
  assert.equal(unavailable.save({ settings: { customApiKey: '' } }).ok, false);
  assert.equal(fs.readFileSync(store.getPaths().primaryPath, 'utf8'), before);
  const cleared = store.load().config;
  cleared.settings.customApiKey = '';
  assert.equal(store.save(cleared).ok, true);
  assert.equal(store.load({ includeModelSecrets: true }).config.settings.customApiKey, '');
  fs.writeFileSync(store.getPaths().primaryPath, '{broken');
  assert.equal(store.load().recoveredFromBackup, true);
  console.log('persisted config credential smoke ok');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
